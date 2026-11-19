export type SearchMode = 'locators' | 'broad'

/** What Google Places (or an uploaded CSV) gives us before we touch the website. */
export interface BaseLead {
  name: string
  street: string
  city: string
  state: string
  zip: string
  phone: string
  website: string
  rating: string
  reviews: string
  mapsUrl: string
  placeId: string
  googleTypes: string
  businessStatus: string
  googleSummary: string
  searchLocation: string
  sameNameListings: number     // distinct Google listings sharing this business name across the run (>=2 suggests multiple locations)
}

/** Everything we learn from the business's own website. All strings so CSV export is trivial. */
export interface SiteIntel {
  websiteStatus: string        // OK | No website | Unreachable | Blocked URL
  domain: string
  pageTitle: string
  overview: string             // 1-3 sentence plain-English summary of what the business does
  businessType: string         // Parts Locator | Salvage Yard / Recycler | Locator + Yard | Unclear
  partsOffered: string
  vehicleFocus: string
  keyClaims: string            // nationwide shipping, warranty, same-day, etc.
  ownerName: string
  primaryContactName: string
  primaryContactTitle: string
  primaryContactEmail: string
  otherContacts: string        // "Name (Title); Name (Title)"
  allEmails: string
  allPhones: string
  paymentProcessors: string
  ecommercePlatform: string
  acceptsCards: string
  onlineCheckout: string       // Yes | No
  quoteOnly: string            // Yes when the site funnels to "request a quote / call us"
  payOnlineLink: string        // Yes when there is a pay-invoice / pay-online page
  shipsNationwide: string
  b2bAccounts: string
  marketplaces: string
  financing: string
  facebookUrl: string
  instagramUrl: string
  linkedinUrl: string
  websiteTech: string
  websiteModern: string
  franchiseStatus: string      // Franchise | Chain | Part of a group | Independent | Unknown
  franchiseEvidence: string
  locationCount: string        // '1', '2+', or a number
  multiLocation: string        // Yes | No | Unknown
  pagesScanned: string
  leadScore: number            // 0-100 heuristic: how good a payment-processing prospect
  pitchNotes: string           // the reasons behind the score, written as talking points
}

export type Lead = BaseLead & SiteIntel

// ── Google Places search configuration ────────────────────────────────────

// "Locators" mode: businesses whose job is finding parts across a yard network.
export const LOCATOR_KEYWORDS = [
  'used auto parts locator',
  'auto parts locating service',
  'used parts locator',
  'used auto parts nationwide shipping',
  'used engines and transmissions',
  'used OEM auto parts',
  'used truck parts locator',
  'salvage parts locator',
  'hard to find auto parts',
  'used body parts',
]

// "Broad" mode adds the yards and recyclers themselves (many also locate and ship).
export const BROAD_EXTRA_KEYWORDS = [
  'auto recycler',
  'auto salvage yard',
  'auto dismantler',
  'junkyard used auto parts',
  'used auto parts',
  'used truck parts',
  'used diesel engines',
  'foreign auto parts salvage',
]

// Must look like an auto-parts business to be kept (name or Google types).
export const RELEVANT_NAME = /part|salvage|recycl|dismantl|wreck|junk|yard|locat|autos?\b|auto[a-z]*|truck|diesel|motor|engine|trans|import|foreign|collision|u-?pull|pick/i
export const AUTO_TYPES = new Set(['auto_parts_store', 'car_repair', 'car_dealer'])

// National chains / retailers / auctions that are not independent parts locators.
export const CHAIN_NAMES = [
  'autozone', "o'reilly", 'oreilly', 'advance auto', 'napa auto', 'pep boys', 'carquest', 'parts authority',
  'discount auto parts', 'walmart', 'harbor freight', 'tractor supply', 'carparts.com', 'rockauto',
  'lkq', 'pull-a-part', 'pull a part', 'pick-n-pull', 'pick n pull', 'copart', 'insurance auto auctions', 'iaa ',
  'carmax', 'carvana', 'autonation', 'sunbelt rentals', 'enterprise', 'hertz', 'avis',
  'pick your part', 'pickyourpart', 'u-pull', 'upull', 'pick-a-part', 'row52', 'ssi auto', 'usautoparts',
  'jiffy lube', 'midas', 'firestone', 'meineke', 'discount tire', 'les schwab', 'goodyear',
  'ford ', 'toyota of', 'honda of', 'chevrolet of', 'nissan of', 'dealership',
]

// ── State sweeps ───────────────────────────────────────────────────────────
// Parts locators ship nationwide, so one radius around one address misses most of them.
// Sweep a state's major markets instead; results are de-duplicated by Google place ID.
export const STATE_MARKETS: Record<string, string[]> = {
  FL: ['Miami', 'Fort Lauderdale', 'West Palm Beach', 'Orlando', 'Tampa', 'Jacksonville', 'Tallahassee', 'Pensacola', 'Fort Myers', 'Naples', 'Sarasota', 'Lakeland', 'Ocala', 'Gainesville', 'Daytona Beach', 'Melbourne', 'Panama City'].map(c => `${c}, FL`),
  GA: ['Atlanta', 'Marietta', 'Lawrenceville', 'Savannah', 'Augusta', 'Macon', 'Columbus', 'Athens', 'Albany', 'Valdosta', 'Gainesville', 'Rome', 'Warner Robins', 'Dalton'].map(c => `${c}, GA`),
  AL: ['Birmingham', 'Montgomery', 'Mobile', 'Huntsville', 'Tuscaloosa', 'Dothan'].map(c => `${c}, AL`),
  SC: ['Charleston', 'Columbia', 'Greenville', 'Spartanburg', 'Myrtle Beach'].map(c => `${c}, SC`),
  NC: ['Charlotte', 'Raleigh', 'Greensboro', 'Fayetteville', 'Wilmington', 'Asheville'].map(c => `${c}, NC`),
  TN: ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga'].map(c => `${c}, TN`),
  TX: ['Houston', 'Dallas', 'San Antonio', 'Austin', 'El Paso', 'Fort Worth', 'Lubbock', 'Corpus Christi'].map(c => `${c}, TX`),
}

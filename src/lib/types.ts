export type SearchMode = 'focused' | 'broad'

/** businessType value for a site that doesn't read as belonging to the selected industry. */
export const OFF_INDUSTRY = 'Not in this industry'

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
  industry: string             // industry profile id this lead was found/scanned under
  websiteStatus: string        // OK | No website | Unreachable | Blocked URL
  domain: string
  pageTitle: string
  overview: string             // 1-3 sentence plain-English summary of what the business does
  businessType: string         // industry-specific label (e.g. Parts Locator) | Unclear | OFF_INDUSTRY
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

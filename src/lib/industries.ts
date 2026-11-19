// Industry profiles. Pick one in the dropdown and the whole app retargets: what Google is asked for,
// which businesses are filtered out as chains, what counts as "on-industry" on a website, what the
// business is described as selling, and how the call script is worded.
//
// To add an industry: copy any `ind(...)` entry below and edit it. Nothing else needs to change.

import { OFF_INDUSTRY } from './types'
import {
  AUTO_BROAD_TERMS, AUTO_CHAINS, AUTO_GOOGLE_TYPES, AUTO_OFFERINGS, AUTO_STRICT_NAME, AUTO_TERMS, AUTO_VOCAB,
  autoClaims, classifyAutoParts, detectVehicleFocus,
} from './auto'

export interface TypeInfo {
  score: number   // points added to the lead score for this business type
  note: string    // shown in the pitch notes
  why: string    // shown to the sales agent as "why this call is worth it"
}

export interface IndustryProfile {
  id: string
  group: string
  label: string                 // plural, for the dropdown: "HVAC contractors"
  type: string                  // singular, for a single business: "HVAC contractor"
  pitch: string                 // why payment processing matters to this industry (UI + call script)
  pitchNoun: string             // "HVAC companies" → "I help HVAC companies like X take card payments"
  orderPhrase: string           // "book a service call" → email: "when they book a service call"
  askFirst: string              // discovery question for quote-driven sites
  searchTerms: string[]         // Google Places text queries (focused)
  broadTerms: string[]          // extra queries in broad mode
  strictName?: RegExp           // only keep search results whose NAME matches this (used where Google is noisy)
  googleTypes: string[]         // Google place types that also count as relevant
  chains: string[]              // national chains / franchises to flag (lowercase substrings of the name or domain)
  vocab: RegExp                 // global regex: words that make a site read as this industry
  vocabMin: number              // how many vocab hits are needed to count as on-industry
  offerings: [string, RegExp][] // what they sell / do, as short labels
  bigTicket: string[]           // offering labels that imply large ticket sizes
  bigTicketNote: string
  classify: (text: string, html: string) => string
  typeInfo?: Record<string, TypeInfo>
  focus?: (text: string) => string
  extraClaims?: (text: string) => string[]
}

export const DEFAULT_INDUSTRY = 'auto-parts-locators'

/** "Used auto parts" → "used auto parts", but keep acronyms: "HVAC contractors" stays as is. */
export const lcFirst = (s: string) => s.replace(/^([A-Z])([a-z])/, (_, a: string, b: string) => a.toLowerCase() + b)

/** Is this businessType the "doesn't match the industry" marker (incl. values saved by older versions)? */
export const isOffIndustry = (t: string) => t === OFF_INDUSTRY || t === 'Not auto parts'

// big national names that are never independent small businesses, in any industry
const GLOBAL_CHAINS = ['walmart', 'home depot', "lowe's", 'lowes ', 'costco', "sam's club", 'amazon', 'staples', 'office depot', 'officemax', 'target ']

const words = (w: string) => `\\b(?:${w})\\b`

function ind(
  id: string, group: string, label: string, type: string, pitchNoun: string,
  o: {
    pitch: string; terms: string[]; broad?: string[]; vocab: string; offers: [string, string][]; chains?: string[]
    order?: string; types?: string[]; bigTicket?: string[]; bigNote?: string; min?: number; ask?: string
  },
): IndustryProfile {
  const vocab = new RegExp(words(o.vocab), 'gi')
  const min = o.min ?? 4
  const order = o.order ?? 'place an order'
  return {
    id, group, label, type, pitch: o.pitch, pitchNoun, orderPhrase: order,
    askFirst: o.ask ?? `When a customer wants to ${order}, how do you collect payment — over the phone, a payment link, or invoice?`,
    searchTerms: o.terms, broadTerms: o.broad ?? [], googleTypes: o.types ?? [],
    chains: [...GLOBAL_CHAINS, ...(o.chains ?? [])], vocab, vocabMin: min,
    offerings: o.offers.map(([n, w]) => [n, new RegExp(words(w), 'i')] as [string, RegExp]),
    bigTicket: o.bigTicket ?? [], bigTicketNote: o.bigNote ?? '',
    classify: (text: string) => ((text.toLowerCase().match(vocab) || []).length >= min ? type : OFF_INDUSTRY),
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Automotive & transportation
// ═══════════════════════════════════════════════════════════════════════════

const AUTO_PARTS: IndustryProfile = {
  id: DEFAULT_INDUSTRY, group: 'Automotive & transportation', label: 'Used auto parts locators', type: 'Used auto parts business',
  pitch: 'They find parts for customers across a network of salvage yards and ship them — mostly card-not-present, invoice-style sales with big tickets.',
  pitchNoun: 'parts businesses', orderPhrase: 'order a part',
  askFirst: 'When a customer asks for a part, how do you collect payment — over the phone, a payment link, or invoice?',
  searchTerms: AUTO_TERMS, broadTerms: AUTO_BROAD_TERMS, strictName: AUTO_STRICT_NAME, googleTypes: AUTO_GOOGLE_TYPES,
  chains: [...GLOBAL_CHAINS, ...AUTO_CHAINS], vocab: AUTO_VOCAB, vocabMin: 4,
  offerings: AUTO_OFFERINGS, bigTicket: ['Engines', 'Transmissions', 'Turbo/diesel'], bigTicketNote: 'Sells engines/transmissions — big ticket sizes.',
  classify: classifyAutoParts, focus: detectVehicleFocus, extraClaims: autoClaims,
  typeInfo: {
    'Parts Locator': { score: 20, note: 'Confirmed parts-locator model (brokers parts → card-not-present, invoice-style sales).', why: 'They find parts for customers across a network of yards and ship them — mostly card-not-present sales.' },
    'Locator + Yard': { score: 20, note: 'Confirmed parts-locator model (brokers parts → card-not-present, invoice-style sales).', why: 'They find parts for customers across a network of yards and ship them — mostly card-not-present sales.' },
    'Salvage Yard / Recycler': { score: 8, note: 'Looks like a yard/recycler rather than a pure locator.', why: 'Looks like a yard/recycler more than a pure locator — still sells parts by phone and web.' },
  },
}

const INDUSTRIES: IndustryProfile[] = [
  AUTO_PARTS,

  ind('auto-collision', 'Automotive & transportation', 'Collision & body shops', 'Collision/body shop', 'auto body shops', {
    pitch: 'Large repair invoices, insurance deductibles paid at pickup, and customers who want to pay by card or in installments.',
    terms: ['collision repair shop', 'auto body shop', 'paint and body shop', 'frame straightening'], broad: ['dent repair', 'fleet collision repair'],
    vocab: 'collision|body shop|paint|dent|bumper|frame|insurance claims?|estimates?|auto body|refinish', order: 'drop off a car for repair',
    offers: [['Collision repair', 'collision'], ['Paint', 'paint|refinish'], ['Dent repair', 'dents?|pdr'], ['Frame work', 'frame'], ['Insurance claims', 'insurance claims?|direct repair']],
    bigTicket: ['Collision repair', 'Frame work'], bigNote: 'Repair invoices run into the thousands.',
    chains: ['caliber', 'service king', 'gerber', 'maaco', 'abra', 'carstar', 'fix auto', 'crash champions', 'certified collision'],
  }),
  ind('truck-repair', 'Automotive & transportation', 'Heavy-duty truck & trailer repair', 'Truck/trailer repair shop', 'truck and trailer repair shops', {
    pitch: 'Big repair and parts invoices to fleets and owner-operators, often paid by card at pickup or by phone for roadside jobs.',
    terms: ['heavy duty truck repair', 'semi truck repair', 'trailer repair', 'diesel truck repair', 'truck parts'], broad: ['mobile truck repair', 'reefer repair'],
    vocab: 'truck|trailer|diesel|fleet|semi|tractor|brakes?|transmission|reefer|dot inspection', order: 'bring a truck in',
    offers: [['Diesel repair', 'diesel'], ['Trailer repair', 'trailers?'], ['Brakes', 'brakes?'], ['DOT inspections', 'dot inspection'], ['Mobile/roadside', 'mobile|roadside'], ['Truck parts', 'parts']],
    bigTicket: ['Diesel repair'], bigNote: 'Engine/transmission jobs are large tickets.',
    chains: ['fleetpride', 'truckpro', 'rush truck', 'penske', 'ryder', "love's", 'pilot', 'petro', 'tandem'],
  }),
  ind('towing', 'Automotive & transportation', 'Towing & roadside assistance', 'Towing company', 'towing companies', {
    pitch: 'Payment is taken on the roadside at the moment of service, and motor-club/commercial accounts pay by invoice.',
    terms: ['towing service', 'roadside assistance', 'heavy duty towing', 'flatbed towing'], broad: ['wrecker service', 'impound lot'],
    vocab: 'tow|towing|wrecker|roadside|flatbed|recovery|jump ?start|lockout|impound', order: 'request a tow',
    offers: [['Light-duty towing', 'towing|flatbed'], ['Heavy-duty towing', 'heavy[- ]duty|semi'], ['Roadside', 'roadside|jump ?start|lockout'], ['Impound/storage', 'impound|storage'], ['Accident recovery', 'accident|recovery']],
    chains: ['agero', 'urgently', 'honk'],
  }),
  ind('trucking', 'Automotive & transportation', 'Trucking & freight carriers', 'Trucking company', 'trucking companies', {
    pitch: 'Freight is invoiced and paid on terms; fuel, lumper and detention charges are paid by card and quick-pay.',
    terms: ['trucking company', 'freight carrier', 'flatbed trucking', 'LTL freight', 'drayage'], broad: ['freight broker', 'refrigerated trucking'],
    vocab: 'freight|trucking|carrier|shipping|logistics|ltl|truckload|dispatch|drivers?|flatbed|reefer', order: 'ship a load',
    offers: [['Truckload', 'truckload|ftl'], ['LTL', 'ltl'], ['Flatbed', 'flatbed'], ['Refrigerated', 'reefer|refrigerated'], ['Drayage', 'drayage|port'], ['Brokerage', 'broker']],
    chains: ['fedex', 'ups', 'xpo', 'j.b. hunt', 'jb hunt', 'schneider', 'werner', 'old dominion', 'saia', 'estes', 'tforce', 'yrc', 'r+l', 'ch robinson', 'landstar'],
  }),
  ind('courier', 'Automotive & transportation', 'Courier & delivery services', 'Courier company', 'courier companies', {
    pitch: 'Many small accounts billed monthly plus walk-in and one-off jobs paid by card — recurring billing and card-on-file fit well.',
    terms: ['courier service', 'same day delivery', 'medical courier', 'legal courier'], broad: ['last mile delivery', 'messenger service'],
    vocab: 'courier|delivery|same[- ]day|dispatch|pickup|rush|deliver|messenger|routes?', order: 'schedule a delivery',
    offers: [['Same-day', 'same[- ]day'], ['Medical courier', 'medical|lab'], ['Legal courier', 'legal|court'], ['Scheduled routes', 'routes?|scheduled'], ['Rush/STAT', 'rush|stat']],
    chains: ['fedex', 'ups', 'dhl', 'lasership', 'ontrac', 'velocity express', 'veterans delivery'],
  }),
  ind('moving', 'Automotive & transportation', 'Moving & storage companies', 'Moving company', 'moving companies', {
    pitch: 'High-ticket jobs with deposits up front and balance on delivery day — mobile card acceptance and pay-by-link matter.',
    terms: ['moving company', 'commercial movers', 'storage and moving', 'office relocation'], broad: ['long distance movers', 'piano movers'],
    vocab: 'moving|movers|relocation|storage|packing|crew|truck|long[- ]distance|estimate', order: 'book a move',
    offers: [['Local moving', 'local'], ['Long-distance', 'long[- ]distance|interstate'], ['Commercial/office', 'commercial|office'], ['Packing', 'packing'], ['Storage', 'storage'], ['Specialty items', 'piano|antiques?']],
    bigTicket: ['Long-distance'], bigNote: 'Long-distance moves are large tickets.',
    chains: ['two men and a truck', 'college hunks', 'u-haul', 'public storage', 'extra space', 'cubesmart', 'mayflower', 'allied van', 'united van lines', 'atlas van', 'north american van', 'bekins', 'pods'],
  }),

  // ═════════════════════════════════════════════════════════════════════════
  // Trades & contractors (invoice and on-site payment)
  // ═════════════════════════════════════════════════════════════════════════
  ind('hvac', 'Trades & contractors', 'HVAC contractors', 'HVAC contractor', 'HVAC companies', {
    pitch: 'Techs collect payment on site and installs run into the thousands — mobile card acceptance, pay-by-link and financing close jobs faster.',
    terms: ['HVAC contractor', 'air conditioning repair', 'heating and cooling company', 'commercial HVAC'], broad: ['AC installation', 'ductwork contractor'],
    vocab: 'hvac|air conditioning|heating|cooling|furnace|ac repair|duct|heat pump|refrigeration|thermostat', order: 'book a service call', min: 3,
    offers: [['AC repair', 'ac repair|air conditioning repair'], ['Installation', 'install'], ['Heating', 'heating|furnace|heat pump'], ['Commercial HVAC', 'commercial'], ['Maintenance plans', 'maintenance (?:plan|agreement)s?'], ['Duct work', 'duct']],
    bigTicket: ['Installation'], bigNote: 'System installs are large tickets.',
    chains: ['one hour heating', 'aire serv', 'service experts', 'comfort systems', 'mr. cool', 'trane', 'carrier', 'lennox', 'rheem', 'goodman', 'ars ', 'rescue rooter', 'american residential'],
  }),
  ind('plumbing', 'Trades & contractors', 'Plumbing contractors', 'Plumbing contractor', 'plumbing companies', {
    pitch: 'Emergency jobs are paid on the spot, and commercial work is invoiced — mobile card acceptance and pay-by-link shorten the collection time.',
    terms: ['plumbing contractor', 'commercial plumber', 'emergency plumber', 'drain cleaning'], broad: ['water heater installation', 'backflow testing'],
    vocab: 'plumb\\w*|drain|sewer|water heater|pipe|leak|backflow|repipe|hydro[- ]?jet', order: 'book a plumber', min: 3,
    offers: [['Emergency service', 'emergency|24/7'], ['Drain cleaning', 'drain'], ['Water heaters', 'water heaters?'], ['Repiping', 're-?pip\\w*'], ['Commercial', 'commercial'], ['Backflow', 'backflow']],
    chains: ['roto-rooter', 'mr. rooter', 'benjamin franklin plumbing', 'rooter-man', 'rescue rooter', 'ars '],
  }),
  ind('electrical', 'Trades & contractors', 'Electrical contractors', 'Electrical contractor', 'electrical contractors', {
    pitch: 'Service calls are paid on site and commercial jobs are billed in stages — card and pay-by-link acceptance speeds collection.',
    terms: ['electrical contractor', 'commercial electrician', 'electrician', 'industrial electrical'], broad: ['generator installation', 'lighting contractor'],
    vocab: 'electric\\w*|wiring|panel|generator|lighting|circuit|breaker|ev charger|rewir\\w+', order: 'book an electrician', min: 3,
    offers: [['Commercial', 'commercial'], ['Residential service', 'residential'], ['Panels', 'panels?|breakers?'], ['Generators', 'generators?'], ['Lighting', 'lighting'], ['EV chargers', 'ev charger']],
    chains: ['mister sparky', 'mr. electric', 'ars '],
  }),
  ind('roofing', 'Trades & contractors', 'Roofing contractors', 'Roofing contractor', 'roofing contractors', {
    pitch: 'Roofs are 5-figure tickets paid in deposits and progress payments — card, ACH and pay-by-link make deposits easy to collect.',
    terms: ['roofing contractor', 'commercial roofing', 'roof repair', 'roof replacement'], broad: ['metal roofing', 'storm damage roofing'],
    vocab: 'roof\\w*|shingles?|tpo|metal roof|storm damage|gutters?|leak|flat roof|insurance claims?', order: 'schedule an estimate', min: 3,
    offers: [['Roof replacement', 'replacement|re-?roof\\w*'], ['Repairs', 'repair'], ['Commercial', 'commercial|flat roof|tpo'], ['Metal roofs', 'metal'], ['Storm/insurance', 'storm|insurance'], ['Gutters', 'gutters?']],
    bigTicket: ['Roof replacement', 'Commercial'], bigNote: 'Roof jobs are large, deposit-based tickets.',
    chains: ['abc supply', 'beacon roofing', 'srs distribution', 'owens corning', 'gaf'],
  }),
  ind('fire-security', 'Trades & contractors', 'Fire protection & security systems', 'Fire/security contractor', 'fire and security companies', {
    pitch: 'Install deposits plus monthly monitoring and inspection contracts — recurring billing, card-on-file and ACH are a natural fit.',
    terms: ['fire protection company', 'fire alarm contractor', 'security system installer', 'fire sprinkler contractor'], broad: ['fire extinguisher service', 'access control installer'],
    vocab: 'fire (?:alarm|sprinkler|protection|extinguisher)s?|security|cctv|surveillance|monitoring|access control|inspections?', order: 'schedule an inspection',
    offers: [['Fire alarms', 'fire alarms?'], ['Sprinklers', 'sprinklers?'], ['Extinguishers', 'extinguishers?'], ['CCTV/surveillance', 'cctv|surveillance|cameras?'], ['Access control', 'access control'], ['Monitoring', 'monitoring']],
    chains: ['adt', 'vivint', 'brinks', 'protection 1', 'simplisafe', 'tyco', 'johnson controls', 'securitas', 'allied universal', 'frontpoint'],
  }),
  ind('pest-control', 'Trades & contractors', 'Pest control companies', 'Pest control company', 'pest control companies', {
    pitch: 'Recurring monthly/quarterly service plans — card-on-file and automatic recurring billing reduce chasing payments.',
    terms: ['pest control company', 'commercial pest control', 'termite control', 'exterminator'], broad: ['mosquito control', 'rodent control'],
    vocab: 'pest|termite|exterminat\\w*|rodent|mosquito|bed bugs?|ants?|roaches|fumigation', order: 'schedule a treatment', min: 3,
    offers: [['General pest', 'general pest|pest control'], ['Termites', 'termites?'], ['Rodents', 'rodents?'], ['Mosquito', 'mosquito'], ['Commercial', 'commercial'], ['Recurring plans', 'quarterly|monthly|maintenance plans?']],
    chains: ['orkin', 'terminix', 'rollins', 'truly nolen', 'aptive', 'arrow exterminators', 'rentokil', 'massey', 'hometeam'],
  }),
  ind('landscaping', 'Trades & contractors', 'Commercial landscaping', 'Landscaping company', 'landscaping companies', {
    pitch: 'Recurring maintenance contracts billed monthly to property managers and HOAs — recurring billing and ACH/card-on-file fit.',
    terms: ['commercial landscaping', 'landscape maintenance company', 'lawn care contractor', 'irrigation contractor'], broad: ['tree service', 'hardscape contractor'],
    vocab: 'landscap\\w*|lawn|irrigation|mowing|mulch|tree|hardscape|sod|maintenance', order: 'request a proposal', min: 3,
    offers: [['Maintenance', 'maintenance|mowing'], ['Irrigation', 'irrigation|sprinklers?'], ['Design/install', 'design|install'], ['Tree service', 'tree'], ['Hardscape', 'hardscape|pavers?'], ['Commercial/HOA', 'commercial|hoa|property managers?']],
    chains: ['brightview', 'trugreen', 'lawn doctor', 'scotts lawn', 'weed man', 'spring-green', 'davey tree', 'yardmaster'],
  }),
  ind('commercial-cleaning', 'Trades & contractors', 'Commercial cleaning & janitorial services', 'Cleaning company', 'commercial cleaning companies', {
    pitch: 'Monthly contracts across many small accounts — recurring billing, ACH and card-on-file replace paper invoices and late payments.',
    terms: ['commercial cleaning company', 'janitorial services', 'office cleaning', 'floor care services'], broad: ['carpet cleaning', 'post construction cleaning'],
    vocab: 'cleaning|janitorial|custodial|sanitiz\\w+|disinfect\\w*|floor care|carpet|office cleaning', order: 'request a cleaning quote', min: 3,
    offers: [['Office cleaning', 'office'], ['Janitorial', 'janitorial|custodial'], ['Floor care', 'floor|strip|wax'], ['Carpet', 'carpet'], ['Disinfecting', 'disinfect\\w*|sanitiz\\w+'], ['Construction cleanup', 'construction']],
    chains: ['jani-king', 'coverall', 'stanley steemer', 'servpro', 'chem-dry', 'merry maids', 'molly maid', 'anago', 'jan-pro', 'vanguard cleaning', 'office pride', 'abm'],
  }),
  ind('equipment-rental', 'Trades & contractors', 'Equipment rental companies', 'Equipment rental company', 'equipment rental companies', {
    pitch: 'Deposits, damage holds and card-on-file are essential for rentals, and contractors expect to pay by card or invoice.',
    terms: ['equipment rental', 'construction equipment rental', 'tool rental', 'aerial lift rental'], broad: ['scaffolding rental', 'portable toilet rental'],
    vocab: 'rental|rent|equipment|excavator|lift|scaffold\\w*|generator|forklift|tools?|per day', order: 'reserve equipment',
    offers: [['Heavy equipment', 'excavators?|loaders?|dozers?'], ['Lifts', 'lifts?|boom'], ['Tools', 'tools?'], ['Scaffolding', 'scaffold\\w*'], ['Generators/power', 'generators?|power'], ['Forklifts', 'forklifts?']],
    bigTicket: ['Heavy equipment'], bigNote: 'Heavy equipment rentals carry large holds/deposits.',
    chains: ['sunbelt', 'united rentals', 'herc rentals', 'ahern', 'neff', 'home depot rental'],
  }),

  // ═════════════════════════════════════════════════════════════════════════
  // Supply & distribution
  // ═════════════════════════════════════════════════════════════════════════
  ind('industrial-supply', 'Supply & distribution', 'Industrial supply & MRO distributors', 'Industrial supply distributor', 'industrial distributors', {
    pitch: 'Lots of repeat B2B orders by phone, email and counter — Level 2/3 interchange savings, pay-by-link and invoice payment portals matter.',
    terms: ['industrial supply company', 'MRO supplies', 'industrial distributor', 'bearings and power transmission'], broad: ['hydraulic hose supply', 'abrasives supplier'],
    vocab: 'industrial|mro|bearings?|hydraulic|pneumatic|abrasives?|tools?|fasteners?|supplies|distributor|oem', order: 'place an order', min: 4,
    offers: [['Bearings/power transmission', 'bearings?|belts?|sprockets?'], ['Hydraulics/pneumatics', 'hydraulic|pneumatic'], ['Abrasives/cutting tools', 'abrasives?|cutting tools?'], ['Fasteners', 'fasteners?'], ['Safety', 'safety'], ['Tools', 'tools?']],
    chains: ['grainger', 'fastenal', 'msc industrial', 'motion industries', 'applied industrial', 'mcmaster', 'uline', 'airgas', 'zoro', 'global industrial'],
  }),
  ind('welding-gas', 'Supply & distribution', 'Welding & gas suppliers', 'Welding supply company', 'welding supply companies', {
    pitch: 'Counter and phone sales plus cylinder-rental accounts — contractors pay by card at pickup and by invoice on account.',
    terms: ['welding supply', 'industrial gas supplier', 'welding equipment store', 'cylinder refill'], broad: ['argon co2 refill', 'metal fabrication supply'],
    vocab: 'welding|gas|cylinders?|argon|oxygen|acetylene|mig|tig|plasma|torch|filler metal|consumables', order: 'order gas or welding supplies',
    offers: [['Gases', 'gases|argon|oxygen|acetylene|co2'], ['Welding equipment', 'welders?|welding equipment|mig|tig|plasma'], ['Consumables', 'consumables|filler|electrodes?|wire'], ['Cylinder refills', 'cylinders?|refill'], ['Safety gear', 'safety|helmets?']],
    chains: ['airgas', 'praxair', 'linde', 'matheson', 'lincoln electric', 'tractor supply'],
  }),
  ind('packaging', 'Supply & distribution', 'Packaging & shipping supplies', 'Packaging supplier', 'packaging suppliers', {
    pitch: 'Recurring B2B orders from many small accounts — online ordering with card-on-file and net-terms invoicing reduce payment friction.',
    terms: ['packaging supplies', 'corrugated boxes supplier', 'shipping supplies wholesale', 'custom packaging'], broad: ['pallets and stretch wrap', 'packaging machinery'],
    vocab: 'packaging|boxes|corrugated|stretch wrap|tape|pallets?|shipping supplies|bubble|labels?', order: 'order packaging',
    offers: [['Boxes/corrugated', 'boxes|corrugated|cartons?'], ['Tape/wrap', 'tape|stretch wrap|film'], ['Custom packaging', 'custom'], ['Labels', 'labels?'], ['Pallets', 'pallets?'], ['Mailers', 'mailers?|poly bags?']],
    chains: ['uline', 'packsize', 'pak mail', 'the ups store', 'postnet', 'veritiv', 'berlin packaging'],
  }),
  ind('janitorial-supply', 'Supply & distribution', 'Janitorial & sanitation supply', 'Janitorial supplier', 'janitorial supply companies', {
    pitch: 'Frequent small B2B orders from cleaners, schools and restaurants — card-on-file, online ordering and invoice payments cut collection time.',
    terms: ['janitorial supplies', 'sanitation supply', 'cleaning chemicals distributor', 'paper and disposables supplier'], broad: ['restroom supplies', 'floor care supplies'],
    vocab: 'janitorial|sanitation|cleaning|chemicals?|paper|disposables?|trash liners?|dispensers?|floor care|restroom', order: 'place a supply order',
    offers: [['Chemicals', 'chemicals?|disinfectants?|cleaners?'], ['Paper goods', 'paper|towels?|tissue'], ['Liners', 'liners?|trash bags?'], ['Dispensers', 'dispensers?'], ['Equipment', 'machines?|equipment|vacuums?'], ['Floor care', 'floor']],
    chains: ['grainger', 'uline', 'sysco', 'imperial dade', 'unisource', 'veritiv', 'bunzl', 'swisher'],
  }),
  ind('restaurant-supply', 'Supply & distribution', 'Restaurant equipment & supply', 'Restaurant supply company', 'restaurant supply companies', {
    pitch: 'Walk-in, phone and online sales of equipment with big-ticket items — card, financing and pay-by-link are standard buyer expectations.',
    terms: ['restaurant equipment supplier', 'commercial kitchen equipment', 'restaurant supply store', 'food service equipment'], broad: ['bar equipment supplier', 'smallwares wholesale'],
    vocab: 'restaurant|commercial kitchen|food service|equipment|refrigeration|ovens?|fryers?|smallwares|ice machines?', order: 'order equipment',
    offers: [['Cooking equipment', 'ovens?|ranges?|fryers?|grills?'], ['Refrigeration', 'refrigerat\\w+|coolers?|freezers?|walk-?ins?'], ['Smallwares', 'smallwares|utensils?|pans?'], ['Ice machines', 'ice machines?'], ['Furniture', 'furniture|tables|chairs'], ['Used equipment', 'used|reconditioned']],
    bigTicket: ['Cooking equipment', 'Refrigeration'], bigNote: 'Kitchen equipment is large-ticket.',
    chains: ['webstaurant', 'sysco', 'us foods', 'restaurant depot', 'ace mart', 'katom', 'performance food'],
  }),
  ind('medical-supply', 'Supply & distribution', 'Medical & dental supply', 'Medical/dental supplier', 'medical and dental supply companies', {
    pitch: 'Practices order often by phone and web, and larger equipment is financed — pay-by-link, card-on-file and invoice portals are used heavily.',
    terms: ['medical supply company', 'dental supply company', 'durable medical equipment supplier', 'surgical supplies'], broad: ['lab supplies distributor', 'veterinary supply'],
    vocab: 'medical|dental|clinical|surgical|equipment|supplies|dme|practice|lab|disposables?', order: 'place an order',
    offers: [['Medical supplies', 'medical supplies'], ['Dental supplies', 'dental'], ['DME', 'dme|durable medical|mobility'], ['Surgical', 'surgical'], ['Lab', 'lab'], ['Equipment', 'equipment']],
    chains: ['henry schein', 'patterson', 'benco', 'mckesson', 'cardinal health', 'medline', 'owens & minor', 'darby'],
  }),
  ind('electrical-supply', 'Supply & distribution', 'Electrical supply houses', 'Electrical supply house', 'electrical supply houses', {
    pitch: 'Contractors buy at the counter and on account all day — card at pickup, pay-by-link and statement payments matter.',
    terms: ['electrical supply house', 'electrical wholesale supplier', 'lighting and electrical supply', 'wire and cable distributor'], broad: ['conduit supplier', 'switchgear distributor'],
    vocab: 'electrical|wire|cable|conduit|lighting|breakers?|panels?|switchgear|contractors?|supply', order: 'place a will-call order',
    offers: [['Wire/cable', 'wire|cable'], ['Conduit/fittings', 'conduit|fittings?'], ['Lighting', 'lighting|lamps?|led'], ['Panels/breakers', 'panels?|breakers?'], ['Switchgear', 'switchgear'], ['Will-call/counter', 'will[- ]call|counter']],
    chains: ['graybar', 'wesco', 'rexel', 'border states', 'crescent electric', 'platt', 'elliott electric'],
  }),
  ind('plumbing-hvac-supply', 'Supply & distribution', 'Plumbing & HVAC supply wholesalers', 'Plumbing/HVAC supply house', 'plumbing and HVAC supply houses', {
    pitch: 'Contractors buy daily at the counter, by phone and on account — card at pickup, pay-by-link and portal payments speed collection.',
    terms: ['plumbing supply house', 'HVAC supply wholesaler', 'plumbing wholesale distributor', 'pipe valves and fittings'], broad: ['water heater distributor', 'irrigation supply'],
    vocab: 'plumbing|hvac|supply|pipe|valves?|fittings?|water heaters?|wholesale|contractors?|furnaces?', order: 'place a will-call order',
    offers: [['Pipe/valves/fittings', 'pipe|valves?|fittings?'], ['Water heaters', 'water heaters?'], ['HVAC equipment', 'hvac|furnaces?|condensers?|air handlers?'], ['Fixtures', 'fixtures?|faucets?'], ['Controls', 'controls?|thermostats?'], ['Will-call/counter', 'will[- ]call|counter']],
    chains: ['ferguson', 'johnstone supply', 'watsco', 'carrier', 'lennox', 'trane', 'hajoca', 'winsupply', 'f.w. webb', 'core & main', 'sunbelt supply'],
  }),
  ind('building-materials', 'Supply & distribution', 'Building materials & lumber yards', 'Building materials supplier', 'building material suppliers', {
    pitch: 'Contractors buy large orders on account and at the yard — card at pickup, pay-by-link and statement payments cut chasing.',
    terms: ['lumber yard', 'building materials supplier', 'masonry supply', 'roofing and siding supplier'], broad: ['concrete supplier', 'drywall supply'],
    vocab: 'lumber|building materials|masonry|drywall|siding|plywood|concrete|delivery|contractors?|yard', order: 'place a delivery order',
    offers: [['Lumber', 'lumber|plywood'], ['Masonry', 'masonry|brick|block'], ['Drywall/insulation', 'drywall|insulation'], ['Roofing/siding', 'roofing|siding'], ['Concrete', 'concrete'], ['Delivery', 'delivery']],
    chains: ['84 lumber', 'menards', 'builders firstsource', 'bmc', 'abc supply', 'beacon', 'ferguson', 'white cap', 'lumber liquidators', 'floor & decor', 'sherwin', 'ply gem'],
  }),
  ind('office-supply', 'Supply & distribution', 'Office furniture & supply dealers', 'Office furniture dealer', 'office furniture dealers', {
    pitch: 'Large furniture orders with deposits and progress payments — card, ACH and pay-by-link are used for deposits.',
    terms: ['office furniture dealer', 'commercial furniture', 'office supplies company', 'cubicle and workstation dealer'], broad: ['used office furniture', 'office interior design'],
    vocab: 'office|furniture|desks?|chairs?|workstations?|cubicles?|filing|conference|supplies|installation', order: 'request a quote', min: 4,
    offers: [['Desks/workstations', 'desks?|workstations?|cubicles?'], ['Seating', 'chairs?|seating'], ['Conference/tables', 'conference|tables?'], ['Storage/filing', 'storage|filing'], ['Installation', 'install'], ['Used/refurbished', 'used|refurbished|pre-?owned']],
    bigTicket: ['Desks/workstations'], bigNote: 'Office build-outs are large tickets with deposits.',
    chains: ['steelcase', 'herman miller', 'ikea', 'national office furniture'],
  }),
  ind('safety-supply', 'Supply & distribution', 'Safety & PPE suppliers', 'Safety supplier', 'safety supply companies', {
    pitch: 'Contractors and plants buy PPE and training in volume — card, pay-by-link and invoice payments simplify repeat ordering.',
    terms: ['safety supply company', 'industrial safety equipment', 'PPE supplier', 'safety training and supplies'], broad: ['fall protection supplier', 'work boots supplier'],
    vocab: 'safety|ppe|protective|fall protection|gloves?|respirators?|hard hats?|osha|first aid|training', order: 'place an order',
    offers: [['PPE', 'ppe|gloves?|glasses|hard hats?'], ['Fall protection', 'fall protection|harness'], ['Respiratory', 'respirators?|masks?'], ['Signage', 'signs?|signage'], ['First aid', 'first aid'], ['Training', 'training|osha']],
    chains: ['grainger', 'fastenal', 'uline', 'airgas', 'global industrial', 'northern safety', 'lakeland', '3m'],
  }),
  ind('fasteners', 'Supply & distribution', 'Fastener & hardware distributors', 'Fastener distributor', 'fastener distributors', {
    pitch: 'High order counts across many small accounts — card-on-file, pay-by-link and net-terms invoices cut admin.',
    terms: ['fastener distributor', 'bolt and screw supplier', 'industrial fasteners', 'hardware wholesale'], broad: ['anchors and fixings supplier', 'threaded rod supplier'],
    vocab: 'fasteners?|bolts?|screws?|nuts?|washers?|anchors?|rivets?|hardware|stainless|threaded', order: 'place an order',
    offers: [['Bolts/screws', 'bolts?|screws?'], ['Nuts/washers', 'nuts?|washers?'], ['Anchors', 'anchors?'], ['Stainless', 'stainless'], ['Custom/special', 'custom|special'], ['Kitting', 'kitting|bin stock']],
    chains: ['fastenal', 'grainger', 'mcmaster', 'lawson products', 'bolt depot', 'harbor freight'],
  }),
  ind('wholesale-food', 'Supply & distribution', 'Wholesale food & beverage distributors', 'Food/beverage distributor', 'food and beverage distributors', {
    pitch: 'Daily delivery orders on thin margins — avoiding high card fees (Level 2/3, ACH) and collecting at delivery both matter.',
    terms: ['wholesale food distributor', 'beverage distributor', 'restaurant food supplier', 'produce wholesaler'], broad: ['meat and seafood distributor', 'ice supplier'],
    vocab: 'wholesale|distributor|food service|produce|beverage|delivery|case|restaurants?|foodservice', order: 'place a delivery order',
    offers: [['Produce', 'produce|fruits?|vegetables?'], ['Meat/seafood', 'meat|seafood'], ['Dry goods', 'dry goods|groceries'], ['Beverage', 'beverage|beer|wine|soda'], ['Ice', 'ice'], ['Dairy', 'dairy']],
    chains: ['sysco', 'us foods', 'performance food', 'gordon food', 'restaurant depot', 'shamrock', 'reinhart', 'cheney brothers', "chef's warehouse", 'jetro', 'costco business'],
  }),
  ind('pallets', 'Supply & distribution', 'Pallet & crate manufacturers', 'Pallet company', 'pallet companies', {
    pitch: 'Recurring B2B orders and pickups from many accounts — card-on-file, ACH and pay-by-link reduce invoice chasing.',
    terms: ['pallet company', 'wood pallets manufacturer', 'pallet recycling', 'custom crates'], broad: ['pallet repair', 'plastic pallets supplier'],
    vocab: 'pallets?|crates?|skids?|heat treated|ispm|recycl\\w+|wood|custom|delivery', order: 'order pallets',
    offers: [['New pallets', 'new pallets?'], ['Used/recycled', 'used|recycled|repair'], ['Custom crates', 'crates?|custom'], ['Heat treated', 'heat treated|ispm'], ['Delivery/pickup', 'delivery|pickup'], ['Plastic', 'plastic']],
    chains: ['chep', 'pallet one', 'pgs', 'pallettrader', 'pallets.com'],
  }),
  ind('scrap-metal', 'Supply & distribution', 'Scrap metal recyclers', 'Scrap metal recycler', 'scrap metal recyclers', {
    pitch: 'They PAY customers, and also sell to businesses — ACH/check alternatives, instant payouts and card for retail sales are useful.',
    terms: ['scrap metal recycling', 'metal recycler', 'scrap yard', 'copper and aluminum buyer'], broad: ['catalytic converter buyer', 'industrial scrap pickup'],
    vocab: 'scrap|metal|recycl\\w+|copper|aluminum|steel|ferrous|non-ferrous|roll-?off|buy', order: 'schedule a pickup',
    offers: [['Ferrous', 'ferrous|steel|iron'], ['Non-ferrous', 'non-?ferrous|copper|aluminum|brass'], ['Roll-off service', 'roll-?off|containers?'], ['Catalytic converters', 'catalytic'], ['Industrial pickup', 'industrial|pickup'], ['Retail sales', 'retail|sells?']],
    chains: ['sims', 'schnitzer', 'radius recycling', 'cmc recycling', 'gerdau'],
  }),
  ind('wholesale-general', 'Supply & distribution', 'Wholesale distributors (general)', 'Wholesale distributor', 'wholesale distributors', {
    pitch: 'Mostly B2B orders on account — Level 2/3 interchange, pay-by-link and portal payments are the standard pain points.',
    terms: ['wholesale distributor', 'wholesale supplier', 'wholesale warehouse', 'trade supply company'], broad: ['import wholesale', 'closeout wholesaler'],
    vocab: 'wholesale|distributor|distribution|resellers?|dealers?|trade accounts?|bulk|minimum order|open an account', order: 'place a wholesale order',
    offers: [['Wholesale pricing', 'wholesale'], ['Dealer/reseller accounts', 'dealers?|resellers?|trade accounts?'], ['Bulk orders', 'bulk|case'], ['Drop-shipping', 'drop-?ship\\w*'], ['Private label', 'private label'], ['Import', 'import']],
    chains: ['sysco', 'us foods', 'costco business', 'uline', 'grainger'],
  }),

  // ═════════════════════════════════════════════════════════════════════════
  // Manufacturing & industrial services
  // ═════════════════════════════════════════════════════════════════════════
  ind('machine-shops', 'Manufacturing & industrial services', 'Machine shops & metal fabrication', 'Machine shop', 'machine shops', {
    pitch: 'Custom jobs quoted per project with deposits and progress billing — card, ACH and pay-by-link make deposits and short-run payments easy.',
    terms: ['machine shop', 'CNC machining', 'metal fabrication', 'precision machining'], broad: ['welding fabrication shop', 'sheet metal fabrication'],
    vocab: 'machin\\w+|cnc|fabrication|welding|sheet metal|prototype|tolerance|precision|milling|turning', order: 'request a quote', min: 3,
    offers: [['CNC machining', 'cnc'], ['Fabrication', 'fabrication|fabricat\\w+'], ['Welding', 'welding'], ['Sheet metal', 'sheet metal'], ['Prototyping', 'prototype|prototyping'], ['Short-run production', 'short[- ]run|production']],
    bigTicket: ['CNC machining', 'Fabrication'], bigNote: 'Custom fabrication jobs run into the thousands.',
    chains: ['xometry', 'protolabs', 'fictiv'],
  }),
  ind('equipment-repair', 'Manufacturing & industrial services', 'Industrial equipment repair & dealers', 'Industrial equipment dealer', 'industrial equipment companies', {
    pitch: 'High-value parts and repair invoices — mobile card acceptance, pay-by-link and financing close service work faster.',
    terms: ['industrial equipment repair', 'forklift dealer', 'heavy equipment repair', 'hydraulic repair service'], broad: ['compressor repair', 'generator service'],
    vocab: 'equipment|repair|forklifts?|hydraulic|service|parts|dealers?|compressors?|generators?|machinery', order: 'schedule service',
    offers: [['Forklifts', 'forklifts?'], ['Hydraulics', 'hydraulics?'], ['Compressors', 'compressors?'], ['Generators', 'generators?'], ['Mobile service', 'mobile|field service'], ['Parts', 'parts']],
    bigTicket: ['Forklifts'], bigNote: 'Equipment sales and major repairs are large tickets.',
    chains: ['caterpillar', 'john deere', 'komatsu', 'hyster-yale', 'crown equipment', 'toyota material handling', 'ingersoll rand', 'atlas copco'],
  }),
  ind('printing-signs', 'Manufacturing & industrial services', 'Commercial printing & sign shops', 'Print/sign shop', 'print and sign shops', {
    pitch: 'Custom jobs paid by deposit and on delivery, with many repeat business accounts — pay-by-link and card-on-file simplify approvals.',
    terms: ['commercial printing', 'sign shop', 'banner and signage', 'vehicle wraps'], broad: ['screen printing shop', 'large format printing'],
    vocab: 'print\\w*|signs?|signage|banners?|wraps?|graphics|large format|vinyl|brochures?|proofs?', order: 'request a quote',
    offers: [['Offset/digital printing', 'printing|brochures?|flyers?'], ['Signs', 'signs?|signage'], ['Banners', 'banners?'], ['Vehicle wraps', 'wraps?'], ['Large format', 'large format'], ['Apparel/screen printing', 'screen print\\w*|apparel|embroider\\w*']],
    chains: ['fedex office', 'staples', 'the ups store', 'minuteman press', 'alphagraphics', 'sir speedy', 'postnet', 'pip printing', 'kinkos', 'vistaprint'],
  }),
  ind('promo-products', 'Manufacturing & industrial services', 'Promotional products & uniforms', 'Promo products company', 'promotional product companies', {
    pitch: 'Custom orders with deposits and proofs approved by email — pay-by-link and card deposits move jobs into production faster.',
    terms: ['promotional products company', 'custom apparel and uniforms', 'embroidery and screen printing', 'corporate gifts'], broad: ['trade show displays', 'branded merchandise'],
    vocab: 'promotional|custom|embroider\\w*|screen print\\w*|apparel|logo|uniforms?|branded|swag|corporate gifts?', order: 'request a quote',
    offers: [['Promotional products', 'promotional'], ['Embroidery', 'embroider\\w*'], ['Screen printing', 'screen print\\w*'], ['Uniforms', 'uniforms?'], ['Corporate gifts', 'corporate gifts?'], ['Trade show', 'trade show']],
    chains: ['4imprint', 'vistaprint', 'customink', 'cintas', 'unifirst', 'aramark'],
  }),
  ind('marine', 'Manufacturing & industrial services', 'Marine supply & boat services', 'Marine business', 'marine businesses', {
    pitch: 'Large repair and parts tickets paid at pickup, plus remote customers ordering by phone — mobile card acceptance and pay-by-link fit.',
    terms: ['marine supply store', 'boat repair', 'marine engine service', 'boat parts'], broad: ['yacht service', 'marina'],
    vocab: 'marine|boat\\w*|yacht|outboard|engine|marina|hull|vessel|ship supply', order: 'order marine parts',
    offers: [['Boat repair', 'boat repair'], ['Marine engines', 'outboard|marine engines?'], ['Parts', 'parts'], ['Fiberglass/hull', 'fiberglass|hull'], ['Electronics', 'electronics|gps'], ['Dockage/storage', 'marina|dockage|storage']],
    bigTicket: ['Marine engines', 'Boat repair'], bigNote: 'Marine repairs are large tickets.',
    chains: ['west marine', 'boat us', 'marinemax', 'bass pro', "cabela's"],
  }),
  ind('agriculture', 'Manufacturing & industrial services', 'Agricultural equipment & supplies', 'Agricultural supplier', 'agricultural suppliers', {
    pitch: 'Large seasonal purchases on account or by card with long payment cycles — financing, pay-by-link and ACH ease the cycle.',
    terms: ['farm equipment dealer', 'agricultural supply', 'farm supply store', 'irrigation equipment supplier'], broad: ['feed and seed store', 'tractor parts'],
    vocab: 'farm\\w*|agricultur\\w+|tractors?|feed|seed|irrigation|livestock|equipment|fertilizer', order: 'place an order',
    offers: [['Tractors/equipment', 'tractors?|equipment'], ['Feed/seed', 'feed|seed'], ['Irrigation', 'irrigation'], ['Livestock supplies', 'livestock'], ['Fertilizer/chemicals', 'fertilizer|chemicals?'], ['Parts/service', 'parts|service']],
    bigTicket: ['Tractors/equipment'], bigNote: 'Equipment sales are large tickets.',
    chains: ['tractor supply', 'rural king', "blain's", 'orscheln', 'john deere', 'case ih', 'kubota'],
  }),

  // ═════════════════════════════════════════════════════════════════════════
  // Business services
  // ═════════════════════════════════════════════════════════════════════════
  ind('staffing', 'Business services', 'Staffing agencies', 'Staffing agency', 'staffing agencies', {
    pitch: 'Heavy invoicing to clients on terms — ACH, card for small accounts, and fast payment links shorten days-sales-outstanding.',
    terms: ['staffing agency', 'temp agency', 'industrial staffing', 'healthcare staffing'], broad: ['executive search firm', 'payroll and staffing'],
    vocab: 'staffing|temp|temporary|recruit\\w+|placement|payroll|workforce|candidates?|clients?', order: 'request staff', min: 3,
    offers: [['Temp staffing', 'temp|temporary'], ['Direct hire', 'direct hire|placement'], ['Industrial', 'industrial|light industrial'], ['Healthcare', 'healthcare|medical'], ['Clerical/office', 'clerical|office|administrative'], ['Payrolling', 'payroll']],
    chains: ['adecco', 'randstad', 'manpower', 'kelly services', 'robert half', 'express employment', 'labor ready', 'trueblue', 'spherion', 'aerotek', 'kforce', 'insperity'],
  }),
  ind('managed-it', 'Business services', 'IT services & managed service providers', 'IT services company', 'IT services companies', {
    pitch: 'Monthly recurring contracts plus project invoices — ACH, card-on-file and recurring billing cut late payments.',
    terms: ['managed IT services', 'IT support company', 'computer network services', 'cybersecurity services'], broad: ['cloud services provider', 'VoIP phone systems'],
    vocab: 'it support|managed services?|network|cybersecurity|cloud|helpdesk|msp|voip|backup|microsoft', order: 'request IT support', min: 3,
    offers: [['Managed IT', 'managed (?:it )?services?|msp'], ['Helpdesk/support', 'helpdesk|it support'], ['Cybersecurity', 'cybersecurity|security'], ['Cloud', 'cloud'], ['VoIP/phones', 'voip|phone systems?'], ['Backup/DR', 'backup|disaster recovery']],
    chains: ['geek squad', 'best buy', 'cdw', 'insight', 'connection', 'dell', 'tek systems', 'ibm', 'accenture'],
  }),
]

export const INDUSTRY_LIST: IndustryProfile[] = INDUSTRIES

export function getIndustry(id?: string): IndustryProfile {
  return INDUSTRIES.find(i => i.id === id) || AUTO_PARTS
}

/** For a grouped dropdown. */
export const INDUSTRY_GROUPS: { group: string; items: IndustryProfile[] }[] = (() => {
  const order: string[] = []
  const map = new Map<string, IndustryProfile[]>()
  for (const i of INDUSTRIES) {
    if (!map.has(i.group)) { map.set(i.group, []); order.push(i.group) }
    map.get(i.group)!.push(i)
  }
  return order.map(g => ({ group: g, items: map.get(g)! }))
})()

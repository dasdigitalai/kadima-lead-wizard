// Keyword/pattern detectors run over a site's lowercased HTML and visible text.

export interface Platform { name: string; patterns: string[] }

const has = (hay: string, pats: string[]) => pats.some(p => hay.includes(p))
const names = (hay: string, list: Platform[]) => list.filter(p => has(hay, p.patterns)).map(p => p.name)

// ── Payments ───────────────────────────────────────────────────────────────

export const PROCESSORS: Platform[] = [
  { name: 'Stripe',            patterns: ['js.stripe.com', 'buy.stripe.com', 'checkout.stripe.com'] },
  { name: 'PayPal',            patterns: ['paypal.com', 'paypalobjects.com', 'paypal.me'] },
  { name: 'Square',            patterns: ['squareup.com', 'square.site', 'squarecdn.com', 'checkout.square'] },
  { name: 'Authorize.Net',     patterns: ['authorize.net', 'accept.authorize'] },
  { name: 'Braintree',         patterns: ['braintreegateway', 'braintree-api', 'braintreepayments'] },
  { name: 'Clover',            patterns: ['clover.com', 'cloverpay'] },
  { name: 'Shopify Payments',  patterns: ['shop.app', 'shopify-pay', 'shopifypay'] },
  { name: 'Elavon',            patterns: ['elavon.com', 'converge.elavon'] },
  { name: 'Worldpay/FIS',      patterns: ['worldpay.com', 'worldpay.us', 'fisglobal'] },
  { name: 'Intuit/QuickBooks', patterns: ['quickbooks payments', 'payments.intuit', 'intuit.com/pay', 'quickbooks.intuit.com/payments'] },
  { name: 'CardConnect',       patterns: ['cardconnect.com', 'cardpointe'] },
  { name: 'Fortis',            patterns: ['fortispay', 'fortis.tech'] },
  { name: 'Helcim',            patterns: ['helcim.com'] },
  { name: 'NMI',               patterns: ['networkmerchants', 'secure.nmi.com', 'nmi.com/'] },
  { name: 'BluePay',           patterns: ['bluepay.com'] },
  { name: 'Moneris',           patterns: ['moneris.com'] },
  { name: 'Heartland',         patterns: ['heartlandpaymentsystems', 'securesubmit', 'heartlandpayments'] },
  { name: 'Stax',              patterns: ['staxpayments', 'fattmerchant', 'stax.com'] },
  { name: 'Payment Cloud',     patterns: ['paymentcloudinc'] },
  { name: 'Bill.com',          patterns: ['bill.com/pay', 'app.bill.com'] },
  { name: 'Zelle',             patterns: ['zellepay.com'] },
]

export const COMMERCE_PLATFORMS: Platform[] = [
  { name: 'Shopify',       patterns: ['cdn.shopify.com', 'myshopify.com'] },
  { name: 'WooCommerce',   patterns: ['woocommerce', 'wc-ajax'] },
  { name: 'BigCommerce',   patterns: ['bigcommerce.com', 'mybigcommerce'] },
  { name: 'Magento',       patterns: ['mage/cookies', 'magento', '/static/frontend/'] },
  { name: 'Wix Stores',    patterns: ['wixstores', 'wix-ecommerce'] },
  { name: 'Squarespace Commerce', patterns: ['squarespace-commerce', 'sqs-add-to-cart'] },
  { name: 'PrestaShop',    patterns: ['prestashop'] },
  { name: 'OpenCart',      patterns: ['route=checkout/cart', 'opencart'] },
  { name: 'Volusion',      patterns: ['volusion.com'] },
  { name: 'Ecwid',         patterns: ['ecwid.com'] },
]

export const FINANCING: Platform[] = [
  { name: 'Affirm',    patterns: ['affirm.com', 'affirm.js'] },
  { name: 'Klarna',    patterns: ['klarna.com'] },
  { name: 'Afterpay',  patterns: ['afterpay.com', 'afterpay-js'] },
  { name: 'Sezzle',    patterns: ['sezzle.com'] },
  { name: 'Katapult',  patterns: ['katapult.com'] },
  { name: 'Synchrony', patterns: ['synchrony.com', 'mysynchrony'] },
]

export const MARKETPLACES: Platform[] = [
  { name: 'eBay',        patterns: ['ebay.com/str', 'ebay.com/itm', 'ebay.com/usr', 'stores.ebay.com', 'ebaymotors'] },
  { name: 'Amazon',      patterns: ['amazon.com/s?', 'amazon.com/sp?', 'amazon.com/stores'] },
  { name: 'Car-Part.com', patterns: ['car-part.com'] },
  { name: 'Hollander',   patterns: ['hollanderinterchange', 'hollander.com'] },
  { name: 'Parts Trader', patterns: ['partstrader.com'] },
  { name: 'Facebook Marketplace', patterns: ['facebook.com/marketplace'] },
]

export interface PaymentSignals {
  processors: string[]
  commerce: string[]
  financing: string[]
  marketplaces: string[]
  acceptsCards: boolean
  onlineCheckout: boolean
  quoteOnly: boolean
  payOnlineLink: boolean
}

export function detectPayments(html: string, text: string): PaymentSignals {
  const h = html.toLowerCase()
  const t = text.toLowerCase()
  const processors = names(h, PROCESSORS)
  const commerce = names(h, COMMERCE_PLATFORMS)
  const acceptsCards = /\b(visa|master\s?card|amex|american express|discover)\b/.test(t) ||
    /\b(we accept|accepted payment|credit cards? (?:accepted|welcome)|major credit cards)\b/.test(t)
  const cartWords = /\b(add to cart|add to basket|view cart|shopping cart|proceed to checkout|checkout)\b/.test(t) ||
    /\/(cart|checkout)\b/.test(h)
  const onlineCheckout = cartWords && (commerce.length > 0 || processors.length > 0 || /add to cart/.test(t))
  const quoteOnly = /\b(request (?:a )?(?:part|quote)|get (?:a )?(?:free )?quote|part request|parts? inquiry|call for (?:price|pricing|quote)|free quote|find (?:my|your) part|request a free)\b/.test(t)
  const payOnlineLink = /\b(pay (?:your |an |my )?invoice|pay online|make a payment|payment portal|pay now|secure payment|payment link)\b/.test(t)
  return {
    processors,
    commerce,
    financing: names(h, FINANCING),
    marketplaces: names(h, MARKETPLACES),
    acceptsCards,
    onlineCheckout,
    quoteOnly,
    payOnlineLink,
  }
}

// ── What the business actually does ────────────────────────────────────────

const PART_CATEGORIES: [string, RegExp][] = [
  ['Engines', /\b(used |rebuilt |remanufactured )?engines?\b|\bmotors?\b(?! vehicle)/],
  ['Transmissions', /\btransmissions?\b|\btransaxles?\b|\btransfer cases?\b/],
  ['Rear ends/axles', /\brear ends?\b|\bdifferentials?\b|\baxles?\b/],
  ['Body parts', /\bbumpers?\b|\bfenders?\b|\bhoods?\b|\bquarter panels?\b|\bbody parts?\b|\bdoors?\b/],
  ['Lights/mirrors', /\bheadlights?\b|\btail ?lights?\b|\bmirrors?\b|\bheadlamps?\b/],
  ['Electronics/modules', /\becm\b|\bpcm\b|\bcomputers?\b|\bmodules?\b|\bfuse box\b|\binstrument clusters?\b|\bradios?\b|\binfotainment\b/],
  ['A/C & cooling', /\bradiators?\b|\ba\/c\b|\bcompressors?\b|\bcondensers?\b/],
  ['Wheels/tires', /\bwheels?\b|\brims?\b|\btires?\b/],
  ['Interior/seats', /\bseats?\b|\binteriors?\b|\bdashboards?\b|\bcarpets?\b/],
  ['Suspension/steering', /\bsuspension\b|\bsteering\b|\bstruts?\b|\bcontrol arms?\b/],
  ['Turbo/diesel', /\bturbos?\b|\bdiesel\b|\binjectors?\b/],
  ['Airbags/safety', /\bair ?bags?\b|\bseat belts?\b/],
  ['Catalytic converters', /\bcatalytic converters?\b/],
]

const MAKES = ['ford', 'chevrolet', 'chevy', 'gmc', 'dodge', 'ram', 'jeep', 'chrysler', 'toyota', 'honda', 'nissan', 'subaru', 'mazda', 'hyundai', 'kia', 'bmw', 'mercedes', 'audi', 'volkswagen', 'volvo', 'lexus', 'acura', 'infiniti', 'cadillac', 'buick', 'lincoln', 'tesla', 'porsche', 'land rover', 'mitsubishi', 'freightliner', 'peterbilt', 'kenworth', 'cummins', 'detroit diesel', 'mack', 'international']

export function detectParts(text: string): string[] {
  const t = text.toLowerCase()
  return PART_CATEGORIES.filter(([, re]) => re.test(t)).map(([n]) => n)
}

export function detectVehicleFocus(text: string): string {
  const t = text.toLowerCase()
  const makes = MAKES
    .map(m => [m, (t.match(new RegExp(`\\b${m}\\b`, 'g')) || []).length] as const)
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([m]) => m.replace(/\b\w/g, c => c.toUpperCase()))
  const tags: string[] = []
  if (/\b(heavy[- ]duty|semi|class 8|commercial truck|diesel truck|freightliner|peterbilt|kenworth)\b/.test(t)) tags.push('Heavy-duty/truck')
  if (/\b(import|foreign|european|asian)\b/.test(t)) tags.push('Import')
  if (/\bdomestic\b/.test(t)) tags.push('Domestic')
  if (/\b(rv|motorhome|marine|motorcycle|powersports|atv)\b/.test(t)) tags.push('RV/Marine/Powersports')
  return [...tags, ...makes].join(', ')
}

export function detectClaims(text: string): string[] {
  const t = text.toLowerCase()
  const claims: string[] = []
  if (/\b(nationwide|all 50 states|coast to coast|ships? (?:anywhere|to all|across))\b|\bship(?:ping|s)? (?:nationwide|worldwide)\b/.test(t)) claims.push('Ships nationwide')
  if (/\b(worldwide|international shipping|export)\b/.test(t)) claims.push('International/export')
  if (/\bfree (?:freight|shipping)\b|\bshipping (?:is )?included\b/.test(t)) claims.push('Free shipping')
  const warranty = t.match(/\b(\d+)[- ](day|month|year)s?\s+(?:limited\s+)?warranty\b/) || t.match(/\bwarranty[^.]{0,30}?(\d+)[- ](day|month|year)s?/)
  if (warranty) claims.push(`${warranty[1]}-${warranty[2]} warranty`)
  else if (/\bwarranty\b/.test(t)) claims.push('Warranty offered')
  if (/\bsame[- ]day\b/.test(t)) claims.push('Same-day')
  if (/\b(next[- ]day|overnight|24 hours?)\b/.test(t)) claims.push('Next-day')
  if (/\bhard[- ]to[- ]find\b|\bobsolete\b/.test(t)) claims.push('Hard-to-find parts')
  if (/\boem\b|\bgenuine\b/.test(t)) claims.push('OEM')
  if (/\b(rebuilt|remanufactured|reman)\b/.test(t)) claims.push('Rebuilt/reman')
  if (/\bcore (?:charge|deposit|return)\b/.test(t)) claims.push('Core charges')
  const net = t.match(/\b(?:network of|access to|search(?:es|ing)?)\s+(?:over\s+|more than\s+)?(\d[\d,]*\+?|hundreds|thousands)\s+(?:of\s+)?(?:\w+\s+){0,2}(?:salvage|recycl\w+|yards|dismantl\w+)/)
  if (net) claims.push(`Yard network: ${net[1]}`)
  return claims
}

export function detectB2B(text: string): boolean {
  return /\b(body shops?|repair shops?|mechanics?|dealers?|dealerships?|fleets?|wholesale|trade accounts?|commercial accounts?|net ?30|open an account|shops? welcome)\b/i.test(text)
}

export type BusinessType = 'Parts Locator' | 'Salvage Yard / Recycler' | 'Locator + Yard' | 'Unclear' | 'Not auto parts'

const AUTO_WORDS = /\b(auto|automotive|vehicles?|cars?|trucks?|salvage|junk ?yards?|engines?|transmissions?|oem|collision|body shops?|recyclers?)\b/g

/** Does this text read like it's about cars/trucks at all? (guards against e.g. a medical-parts "PartsFinder") */
export function isAutoRelated(text: string): boolean {
  return (text.toLowerCase().match(AUTO_WORDS) || []).length >= 4
}

export function classifyBusiness(text: string, html: string): BusinessType {
  if (!isAutoRelated(text)) return 'Not auto parts'
  const t = (text + ' ' + html.slice(0, 20000)).toLowerCase()
  const head = ((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '') + ' ' + (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '')).toLowerCase()

  // strong: the business itself says it searches a yard network on the customer's behalf
  const strong = [
    /parts? locat(?:or|ing)|locating service|locate (?:the |any |your )?(?:part|engine|transmission)/,
    /(?:network|database|inventory)\s+of\s+(?:\w+\s+){0,3}(?:salvage|recycl|yards|dismantl)/,
    /(?:hundreds|thousands)\s+of\s+(?:\w+\s+){0,2}(?:salvage|recycl\w*|yards|dismantl\w*)/,
    /\bwe (?:find|locate|source|search)\b[^.]{0,60}\b(?:part|engine|transmission)/,
    /(?:search|find|explore)[^.]{0,70}(?:salvage|recycl\w*)\s+(?:yards?|database|network|inventory)|salvage (?:database|network)/,
    /\bnationwide (?:network|search|locator|locating)\b/,
  ].filter(r => r.test(t)).length + (/part[s]?\s+(?:locator|finder|locating)|locator service|parts? search/.test(head) ? 1 : 0)

  // weak: generic quote/inquiry language that yards use too
  const weak = [
    /\b(?:request|find) (?:a |my |your )?part\b|\bpart request\b|\bfree quote\b/,
    /\binterchange\b|\bhollander\b|\bcar-part\.com\b/,
  ].filter(r => r.test(t)).length

  // yard: they own inventory / dismantle / buy cars
  const yard = [
    /\bour (?:salvage )?yards?\b|\bour (?:\d+[- ]acre|facility|lot|warehouse|locations?)\b/,
    /\bwe (?:dismantle|recycle|buy (?:junk|wrecked|salvage|used|your))\b|\bcash for (?:junk )?cars\b|\bsell your (?:junk |used |old )?(?:car|vehicle)\b/,
    /\bu-?pull\b|\bpick[- ]?(?:n|and)[- ]?pull\b|\bself[- ]service\b|\bpick your part\b/,
    /\b\d+\s*acres?\b/,
    /\b(?:salvage yards?|recycler of used|largest recycler)\b[^.]{0,50}\b(?:sell|located|near|across)\b|\brecycler of used (?:cars|vehicles)\b/,
    /\b(?:inventory|vehicles?) (?:arrives|received) (?:daily|weekly)\b/,
  ].filter(r => r.test(t)).length

  if (strong >= 1 && yard >= 2) return 'Locator + Yard'
  if (strong >= 1) return 'Parts Locator'
  if (weak >= 2 && yard === 0) return 'Parts Locator'
  if (yard >= 1) return 'Salvage Yard / Recycler'
  return 'Unclear'
}

// ── Franchise / chain / multi-location ─────────────────────────────────────

const squash = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, '')

export interface Ownership {
  franchiseStatus: 'Franchise' | 'Chain' | 'Part of a group' | 'Independent'
  evidence: string[]
  locationCount: string
  multiLocation: 'Yes' | 'No' | 'Unknown'
}

/**
 * @param chainNames known national/regional chains (name or domain match)
 * @param zips distinct "STATE ZIP" addresses found in site text (own address included)
 */
export function detectOwnership(opts: {
  text: string; name: string; domain: string; chainNames: string[]
  addressKeys: string[]; sameNameListings: number; hasLocationsPage: boolean
}): Ownership {
  const t = opts.text.toLowerCase()
  const evidence: string[] = []
  let status: Ownership['franchiseStatus'] = 'Independent'

  const nameLc = opts.name.toLowerCase()
  const chain = opts.chainNames.find(c => nameLc.includes(c) || (squash(c).length >= 8 && squash(opts.domain).includes(squash(c))))
  if (chain) { status = 'Chain'; evidence.push(`Known chain/brand: "${chain.trim()}"`) }

  const franchisePats: [RegExp, string][] = [
    [/\b(?:own|buy|start|open|become|join)\s+(?:a|an|your own)?\s*(?:\w+\s+)?franchise\b/, 'Offers franchise opportunities'],
    [/\bfranchise\s+(?:opportunit|availab|inquir|information|owners?|fees?|system|partners?|network)/, 'Franchise program language'],
    [/\bfranchisees?\b/, 'Mentions franchisees'],
    [/\bindependently owned and operated\b|\beach (?:location|yard|store|branch) is (?:independently )?(?:owned|operated)/, '"Independently owned and operated" (franchise-style wording)'],
    [/\bmaster franchise\b|\bfranchised (?:location|yard|store)s?\b/, 'Franchised locations'],
  ]
  for (const [re, label] of franchisePats) if (re.test(t)) { evidence.push(label); if (status === 'Independent') status = 'Franchise' }

  if (status === 'Independent') {
    const grp = t.match(/\b(?:a (?:division|subsidiary|brand|member|company) of|part of the [\w\s&]{2,40}(?:family|group|network) of (?:companies|brands)|parent company)\b/)
    if (grp) { status = 'Part of a group'; evidence.push(`Group language: "${grp[0].slice(0, 60)}"`) }
  }

  // ── locations ──
  let count = 1
  const nums = [...t.matchAll(/\b(\d{1,3})\+?\s+(?:locations|branches|yards|stores|facilities|offices|warehouses)\b/g)].map(m => parseInt(m[1], 10)).filter(n => n > 1 && n < 1000)
  if (nums.length) { count = Math.max(...nums); evidence.push(`Site claims ${count} locations/yards`) }
  const addrCount = new Set(opts.addressKeys).size
  if (addrCount >= 2) { count = Math.max(count, addrCount); evidence.push(`${addrCount} distinct addresses on site`) }
  if (opts.sameNameListings >= 2) { count = Math.max(count, opts.sameNameListings); evidence.push(`${opts.sameNameListings} Google listings with this name`) }
  if (count === 1 && (opts.hasLocationsPage || /\b(?:our locations|find a (?:location|yard|branch|store)|all locations|multiple locations|locations near you|other locations)\b/.test(t))) {
    count = 2; evidence.push('Site has a "Locations" page/section')
  }
  const multi = count >= 2
  if (status === 'Independent' && multi && count >= 5) { status = 'Chain'; evidence.push(`${count}+ locations`) }
  return {
    franchiseStatus: status,
    evidence,
    locationCount: count >= 2 && !nums.length && addrCount < 2 && opts.sameNameListings < 2 ? '2+' : String(count),
    multiLocation: multi ? 'Yes' : 'No',
  }
}

// ── Tech / modernity ───────────────────────────────────────────────────────

const TECH: Platform[] = [
  { name: 'Wix', patterns: ['wixstatic.com', 'wix.com', 'wixsite.com'] },
  { name: 'Squarespace', patterns: ['squarespace.com', 'sqsp'] },
  { name: 'WordPress', patterns: ['wp-content', 'wp-includes'] },
  { name: 'Shopify', patterns: ['cdn.shopify.com'] },
  { name: 'GoDaddy', patterns: ['godaddysites.com', 'secureserver.net', 'websitebuilder.godaddy'] },
  { name: 'Weebly', patterns: ['weebly.com'] },
  { name: 'Webflow', patterns: ['webflow.com', 'webflow.io'] },
  { name: 'Joomla', patterns: ['/media/jui/', 'joomla'] },
  { name: 'Drupal', patterns: ['drupal'] },
  { name: 'Dealer/auto-parts CMS', patterns: ['partsbase', 'dealercarsearch', 'car-part.com/cgi'] },
]

export function detectTech(html: string): string {
  const h = html.toLowerCase()
  return TECH.find(t => has(h, t.patterns))?.name || ''
}

export function modernity(html: string, tech: string): { label: string; notes: string[] } {
  const h = html.toLowerCase()
  const notes: string[] = []
  let score = 50
  if (h.includes('viewport')) score += 10; else notes.push('Not mobile-friendly')
  if (h.includes('tailwind') || /\bnext\b|react|vue/.test(h)) score += 10
  if (h.includes('schema.org')) score += 5
  if (['Squarespace', 'Wix', 'Webflow', 'Shopify'].includes(tech)) score += 10
  if (h.includes('bootstrap/3') || h.includes('bootstrap/2')) score -= 15
  if (/jquery[/-]1\.|jquery[/-]2\./.test(h)) score -= 10
  if (h.includes('.swf')) score -= 20
  if (['Weebly', 'GoDaddy', 'Joomla'].includes(tech)) score -= 8
  const c = h.match(/©\s*(?:\d{4}\s*[-–]\s*)?(20\d{2})|copyright\s*(?:\d{4}\s*[-–]\s*)?(20\d{2})/)
  if (c) {
    const y = parseInt(c[1] || c[2], 10)
    if (y <= 2018) { score -= 20; notes.push(`Copyright ${y}`) }
    else if (y <= 2020) { score -= 10; notes.push(`Copyright ${y}`) }
  }
  score = Math.max(0, Math.min(100, score))
  return { label: score >= 70 ? 'Modern' : score >= 45 ? 'Dated' : 'Outdated', notes }
}

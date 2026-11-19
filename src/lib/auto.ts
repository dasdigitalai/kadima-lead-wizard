// Everything specific to the "used auto parts locators" industry profile:
// search terms, relevance filters, chain list, what they sell, and how to classify a site.

import { OFF_INDUSTRY } from './types'

// Focused: businesses whose job is finding parts across a yard network.
export const AUTO_TERMS = [
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

// Broad: adds the yards and recyclers themselves (many also locate and ship).
export const AUTO_BROAD_TERMS = [
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
export const AUTO_STRICT_NAME = /part|salvage|recycl|dismantl|wreck|junk|yard|locat|autos?\b|auto[a-z]*|truck|diesel|motor|engine|trans|import|foreign|collision|u-?pull|pick/i
export const AUTO_GOOGLE_TYPES = ['auto_parts_store', 'car_repair', 'car_dealer']

// National chains / retailers / auctions that are not independent parts locators.
export const AUTO_CHAINS = [
  'autozone', "o'reilly", 'oreilly', 'advance auto', 'napa auto', 'pep boys', 'carquest', 'parts authority',
  'discount auto parts', 'walmart', 'harbor freight', 'tractor supply', 'carparts.com', 'rockauto',
  'lkq', 'pull-a-part', 'pull a part', 'pick-n-pull', 'pick n pull', 'copart', 'insurance auto auctions', 'iaa ',
  'carmax', 'carvana', 'autonation', 'sunbelt rentals', 'enterprise', 'hertz', 'avis',
  'pick your part', 'pickyourpart', 'u-pull', 'upull', 'pick-a-part', 'row52', 'ssi auto', 'usautoparts',
  'jiffy lube', 'midas', 'firestone', 'meineke', 'discount tire', 'les schwab', 'goodyear',
  'ford ', 'toyota of', 'honda of', 'chevrolet of', 'nissan of', 'dealership',
]


// ── What they sell / who they sell to ──────────────────────────────────────

export const AUTO_OFFERINGS: [string, RegExp][] = [
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

/** Auto-specific claims layered on top of the generic ones. */
export function autoClaims(text: string): string[] {
  const t = text.toLowerCase()
  const claims: string[] = []
  if (/\bhard[- ]to[- ]find\b|\bobsolete\b/.test(t)) claims.push('Hard-to-find parts')
  if (/\boem\b|\bgenuine\b/.test(t)) claims.push('OEM')
  if (/\b(rebuilt|remanufactured|reman)\b/.test(t)) claims.push('Rebuilt/reman')
  if (/\bcore (?:charge|deposit|return)\b/.test(t)) claims.push('Core charges')
  const net = t.match(/\b(?:network of|access to|search(?:es|ing)?)\s+(?:over\s+|more than\s+)?(\d[\d,]*\+?|hundreds|thousands)\s+(?:of\s+)?(?:\w+\s+){0,2}(?:salvage|recycl\w+|yards|dismantl\w+)/)
  if (net) claims.push(`Yard network: ${net[1]}`)
  return claims
}

// ── Classification ─────────────────────────────────────────────────────────

export const AUTO_VOCAB = /\b(auto|automotive|vehicles?|cars?|trucks?|salvage|junk ?yards?|engines?|transmissions?|oem|collision|body shops?|recyclers?)\b/g

export function classifyAutoParts(text: string, html: string): string {
  if ((text.toLowerCase().match(AUTO_VOCAB) || []).length < 4) return OFF_INDUSTRY
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


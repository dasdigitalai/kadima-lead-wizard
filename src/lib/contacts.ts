// Pull people, emails and phone numbers out of a small business website.

import { decodeEntities } from './html'

// ── People ─────────────────────────────────────────────────────────────────

export interface Person { name: string; title: string; rank: number }

// Lower rank = more likely to be the decision-maker for a payment-processing pitch.
const TITLES: { re: RegExp; title: string; rank: number }[] = [
  { re: /\b(?:co-?)?owners?\b/i, title: 'Owner', rank: 1 },
  { re: /\bproprietor\b/i, title: 'Owner', rank: 1 },
  { re: /\b(?:co-?)?founders?\b/i, title: 'Founder', rank: 1 },
  { re: /\bpresident\b/i, title: 'President', rank: 2 },
  { re: /\bc\.?e\.?o\b|\bchief executive\b/i, title: 'CEO', rank: 2 },
  { re: /\bprincipal\b|\bmanaging (?:partner|member|director)\b/i, title: 'Principal', rank: 2 },
  { re: /\bc\.?f\.?o\b|\bcontroller\b/i, title: 'Finance', rank: 3 },
  { re: /\bgeneral manager\b/i, title: 'General Manager', rank: 3 },
  { re: /\bGM\b/, title: 'General Manager', rank: 3 },
  { re: /\boperations manager\b|\bcoo\b/i, title: 'Operations Manager', rank: 3 },
  { re: /\boffice manager\b|\baccounting\b|\bbookkeep/i, title: 'Office/Accounting', rank: 4 },
  { re: /\bsales manager\b|\bparts manager\b|\bmanager\b/i, title: 'Manager', rank: 4 },
  { re: /\bsales (?:rep|representative|associate|consultant)\b|\bparts (?:specialist|consultant|locator|advisor)\b/i, title: 'Sales/Parts', rank: 5 },
]

// Words that can never be part of a personal name. Heavily weighted toward
// what shows up on auto-parts sites so "Used Engines" / "Customer Service"
// are not mistaken for people.
const NOT_NAME = new Set((
  'contact us our team about the and of for to in at by with from or a an ' +
  'parts part auto automotive used new oem aftermarket engine engines transmission transmissions ' +
  'sales service services customer support manager owner owners general president vice director ' +
  'office specialist locator locating locate call email phone fax hours open closed home get free ' +
  'quote quotes request shipping warranty copyright rights reserved privacy policy terms ' +
  'years experience family based owned operated since inc llc corp company co ltd ' +
  'salvage recycling recyclers recycler yard yards truck trucks motors motor collision body ' +
  'wholesale retail find finding more learn read meet staff leadership management ' +
  'monday tuesday wednesday thursday friday saturday sunday ' +
  'florida texas california georgia ohio nevada arizona carolina alabama michigan ' +
  'north south east west united states america usa national nationwide international ' +
  'chief executive officer founder proprietor partner principal accounting dispatch dispatcher ' +
  'representative associate consultant advisor operations head ' +
  'ford chevy chevrolet dodge toyota honda nissan jeep gmc ram bmw audi mercedes benz volvo ' +
  'view all see click here learn contact welcome hello thank thanks please ' +
  'is are was were be been being your you we it its if what why how who whom this that these those on as any can will would ' +
  'should could do does did has have had not no yes my them their there when where which while than then so but also just very ' +
  'most some such only own same too top best largest leading premier quality discount great'
).split(/\s+/))

const NAME_TOKEN = "(?:Mc|Mac|De|Di|La|Le)?[A-Z][a-z]+(?:['’-][A-Z][a-z]+)?"
const NAME_RE = new RegExp(`\\b${NAME_TOKEN}(?:\\s+[A-Z]\\.)?(?:\\s+${NAME_TOKEN}){1,2}\\b`, 'g')

interface NameHit { name: string; index: number }

function extractNames(line: string): NameHit[] {
  const hits: NameHit[] = []
  NAME_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = NAME_RE.exec(line)) !== null) {
    const tokens = m[0].split(/\s+/)
    // trim stop-words off both ends ("Contact John Smith Owner" -> "John Smith")
    while (tokens.length && NOT_NAME.has(tokens[0].toLowerCase().replace(/\.$/, ''))) tokens.shift()
    while (tokens.length && NOT_NAME.has(tokens[tokens.length - 1].toLowerCase().replace(/\.$/, ''))) tokens.pop()
    if (tokens.length < 2) continue
    if (tokens.some(t => NOT_NAME.has(t.toLowerCase().replace(/\.$/, '')))) continue
    const name = tokens.join(' ')
    hits.push({ name, index: m.index + Math.max(0, m[0].indexOf(tokens[0])) })
  }
  return hits
}

const titleCase = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase())

function matchTitle(line: string): { title: string; rank: number; index: number } | null {
  let best: { title: string; rank: number; index: number } | null = null
  for (const t of TITLES) {
    const m = t.re.exec(line)
    // keep the real wording ("Sales Manager") for non-owner roles
    if (m && (!best || t.rank < best.rank)) best = { title: t.rank <= 2 ? t.title : titleCase(m[0]), rank: t.rank, index: m.index }
  }
  return best
}

const BY_PHRASE = /\b(?:founded|owned|operated|started|established|run)\s+by\s+/i

const GENERIC_OWNER_PHRASES = /\b(business owner|small business|new owner|previous owner|former owner|original owner|car owner|vehicle owner|home owner|homeowner|owners? manual|our owner|the owner|an owner|each owner|every owner|customers?)\b/i

/**
 * Find "Name + Title" pairs in visible text. Handles the common layouts:
 *   "John Smith, Owner"   "Owner: John Smith"   "Founded by John Smith"
 *   staff cards where the name and title sit on adjacent lines.
 */
export function findPeople(text: string): Person[] {
  const lines = text.split('\n')
  const found = new Map<string, Person>()
  const add = (name: string, title: string, rank: number) => {
    const key = name.toLowerCase()
    const prev = found.get(key)
    if (!prev || rank < prev.rank) found.set(key, { name, title, rank })
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.length > 180) continue
    // "Founded by / owned by / started by John Smith" — no title word needed
    const by = BY_PHRASE.exec(line)
    if (by) {
      const after = extractNames(line.slice(by.index + by[0].length))
      if (after.length && !GENERIC_OWNER_PHRASES.test(line)) { add(after[0].name, /^(founded|started|established)/i.test(by[0]) ? 'Founder' : 'Owner', 1); continue }
    }
    const t = matchTitle(line)
    if (!t) continue
    if (GENERIC_OWNER_PHRASES.test(line) && t.rank === 1) continue
    let hits = extractNames(line)

    if (hits.length === 0) {
      // staff-card layout: name on the line before (preferred) or after the title
      for (const adj of [lines[i - 1], lines[i + 1]]) {
        if (!adj || adj.length > 60 || matchTitle(adj)) continue
        const h = extractNames(adj)
        if (h.length === 1) { hits = h; break }
      }
    }
    if (hits.length === 0) continue
    // choose the name closest to where the title appears on this line
    const nearest = hits.reduce((a, b) => (Math.abs(b.index - t.index) < Math.abs(a.index - t.index) ? b : a))
    add(nearest.name, t.title, t.rank)
  }
  return [...found.values()].sort((a, b) => a.rank - b.rank)
}

// ── Emails ─────────────────────────────────────────────────────────────────

const JUNK_EMAIL_DOMAINS = /(^|\.)(sentry\.io|sentry-next\.wixpress\.com|wixpress\.com|example\.com|domain\.com|email\.com|yourdomain\.com|yoursite\.com|godaddy\.com|schema\.org|w3\.org|wordpress\.org|squarespace\.com|shopify\.com|google\.com|googleapis\.com|facebook\.com|gstatic\.com|cloudflare\.com|jquery\.com|test\.com)$/i
const JUNK_EMAIL_LOCAL = /^(your|youremail|name|email|user|username|test|example|first|last|firstname|lastname|john\.?doe|jane\.?doe|noreply|no-reply|donotreply|do-not-reply|mailer-daemon|postmaster|webmaster|abuse|privacy|dmca|wordpress)$/i
const FILE_EXT = /\.(png|jpe?g|gif|svg|webp|ico|css|js|woff2?|ttf|eot|map|pdf|mp4)$/i

function cleanEmail(raw: string): string | null {
  const e = raw.trim().replace(/^mailto:/i, '').split('?')[0].replace(/[.,;:)>\]]+$/, '').toLowerCase()
  const m = e.match(/^([a-z0-9._%+-]+)@([a-z0-9.-]+\.[a-z]{2,})$/)
  if (!m) return null
  if (FILE_EXT.test(e)) return null
  if (JUNK_EMAIL_LOCAL.test(m[1]) || JUNK_EMAIL_DOMAINS.test(m[2])) return null
  if (/^\d+x\d*$/.test(m[1]) || /^[0-9a-f]{24,}$/.test(m[1])) return null // image@2x / hash-like
  return e
}

function decodeCfEmail(hex: string): string {
  try {
    const key = parseInt(hex.slice(0, 2), 16)
    let out = ''
    for (let i = 2; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ key)
    return out
  } catch { return '' }
}

export function extractEmails(html: string, text: string): string[] {
  const found: string[] = []
  const push = (raw: string) => { const e = cleanEmail(raw); if (e && !found.includes(e)) found.push(e) }

  // 1. mailto: links (most reliable)
  const mailto = /href\s*=\s*["']mailto:([^"'>\s]+)/gi
  let m: RegExpExecArray | null
  while ((m = mailto.exec(html)) !== null) { try { push(decodeURIComponent(m[1])) } catch { push(m[1]) } }

  // 2. Cloudflare-obfuscated emails
  const cf1 = /data-cfemail\s*=\s*["']([0-9a-f]+)["']/gi
  while ((m = cf1.exec(html)) !== null) push(decodeCfEmail(m[1]))
  const cf2 = /email-protection#([0-9a-f]+)/gi
  while ((m = cf2.exec(html)) !== null) push(decodeCfEmail(m[1]))

  // 3. "name [at] domain [dot] com" style obfuscation, then plain emails in visible text
  const deobf = decodeEntities(text)
    .replace(/\s*[\[(]\s*at\s*[\])]\s*/gi, '@')
    .replace(/\s*[\[(]\s*dot\s*[\])]\s*/gi, '.')
  const plain = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  while ((m = plain.exec(deobf)) !== null) push(m[0])
  // 4. emails living in raw html attributes / JSON blobs
  const raw = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  while ((m = raw.exec(html)) !== null) push(m[0])
  return found
}

const ROLE_RANK: [RegExp, number][] = [
  [/^(owner|president|ceo|gm|manager|admin)$/, 1],
  [/^(sales|parts|quotes?|quote|orders?|locator|locate|inventory|dispatch|accounting|billing)/, 2],
  [/^(info|contact|office|hello|service|support|help|customerservice)$/, 3],
]

const LOW_VALUE_LOCAL = /^(hr|jobs?|careers?|recruit\w*|employment|media|press|pr|marketing|legal|compliance|privacy|unsubscribe|support-?tickets?|abuse|help-?desk)([._-].*)?$|[._-](hr|jobs?|careers?|recruiting)$/i

function emailRank(email: string): number {
  const local = email.split('@')[0]
  for (const [re, rank] of ROLE_RANK) if (re.test(local)) return rank
  return 4
}

/** Does this email look like it belongs to the given person (john@, jsmith@, john.smith@)? */
export function emailMatchesPerson(email: string, name: string): boolean {
  const local = email.split('@')[0].replace(/[._-]/g, '')
  const parts = name.toLowerCase().replace(/[^a-z\s'-]/g, '').split(/\s+/).filter(Boolean)
  if (parts.length < 2) return false
  const first = parts[0], last = parts[parts.length - 1]
  return local === first || local === first + last || local === first[0] + last || local === last + first[0] ||
    (first.length >= 3 && local.startsWith(first)) || (last.length >= 4 && local.includes(last))
}

export function pickPrimaryEmail(emails: string[], siteDomain: string, person?: Person): string {
  if (!emails.length) return ''
  if (person) {
    const mine = emails.find(e => emailMatchesPerson(e, person.name))
    if (mine) return mine
  }
  const useful = emails.filter(e => !LOW_VALUE_LOCAL.test(e.split('@')[0]))
  const sameDomain = useful.filter(e => siteDomain && e.endsWith('@' + siteDomain))
  const pool = sameDomain.length ? sameDomain : useful
  return [...pool].sort((a, b) => emailRank(a) - emailRank(b))[0] || ''
}

// ── Phones ─────────────────────────────────────────────────────────────────

export function formatPhone(digits: string): string {
  const d = digits.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : digits.trim()
}

export function extractPhones(html: string, text: string): string[] {
  const out: string[] = []
  const push = (p: string) => { const f = formatPhone(p); if (/^\(\d{3}\) \d{3}-\d{4}$/.test(f) && !out.includes(f)) out.push(f) }

  const tel = /href\s*=\s*["']tel:([^"'>\s]+)/gi
  let m: RegExpExecArray | null
  while ((m = tel.exec(html)) !== null) { try { push(decodeURIComponent(m[1])) } catch { push(m[1]) } }

  const re = /(?<!\d)(?:\+?1[\s.-]?)?\(?([2-9]\d{2})\)?[\s.-]?([2-9]\d{2})[\s.-]?(\d{4})(?!\d)/g
  while ((m = re.exec(text)) !== null) {
    const before = text.slice(Math.max(0, m.index - 14), m.index)
    if (/fax/i.test(before)) continue
    if (/(#|\border|\bsku|\bref|\binvoice|\bvin|\bid|\bno\.?|\bpart)\s*:?\s*$/i.test(before)) continue // IDs, not phones
    push(`${m[1]}${m[2]}${m[3]}`)
  }
  return out
}

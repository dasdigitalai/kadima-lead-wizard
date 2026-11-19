// Network layer: fetch a business's homepage plus its contact/about/team pages.

import { analyzeSite, emptyIntel, type Page } from './intel'
import { extractLinks, stripWww } from './html'
import type { BaseLead, Lead } from './types'
import { getIndustry, type IndustryProfile } from './industries'

const UA = 'Mozilla/5.0 (compatible; PartsLocatorRadar/1.0)'

/** Block obviously-internal targets: this endpoint fetches URLs supplied by the client. */
export function isPublicHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    const h = u.hostname.toLowerCase()
    if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') || h === '[::1]' || h.startsWith('[')) return false
    if (/^(127|10|0)\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)) return false
    return h.includes('.')
  } catch { return false }
}

export function normalizeUrl(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  return /^https?:\/\//i.test(t) ? t : `https://${t}`
}

interface Fetched { page: Page | null; httpStatus: number }

async function fetchPage(url: string, timeoutMs: number): Promise<Fetched> {
  if (!isPublicHttpUrl(url)) return { page: null, httpStatus: 0 }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow', headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' } })
    const type = res.headers.get('content-type') || ''
    if (!res.ok || (type && !/html|xml|text/i.test(type))) return { page: null, httpStatus: res.status }
    if (!isPublicHttpUrl(res.url || url)) return { page: null, httpStatus: 0 }
    const html = (await res.text()).slice(0, 500_000)
    return { page: html.length > 100 ? { url: res.url || url, html } : null, httpStatus: res.status }
  } catch { return { page: null, httpStatus: 0 } } finally { clearTimeout(timer) }
}

const INTEREST = /contact|about|team|staff|leader|who-we|our-story|our-company|meet|management|people|locations?|branches|our-yards|find-a-/i
const FALLBACK_PATHS = ['/contact', '/contact-us', '/about', '/about-us', '/our-team']

function pickSubpages(home: Page): string[] {
  let host = ''
  try { host = stripWww(new URL(home.url).hostname) } catch { return [] }
  const seen = new Set<string>()
  const picked: string[] = []
  const rank = (u: string, text: string) => (/contact/i.test(u + text) ? 0 : /about|story|who-we/i.test(u + text) ? 1 : 2)
  const links = extractLinks(home.html, home.url)
    .filter(l => { try { return stripWww(new URL(l.url).hostname) === host } catch { return false } })
    .filter(l => INTEREST.test(new URL(l.url).pathname) || INTEREST.test(l.text))
    .filter(l => !/\.(pdf|jpg|png|zip)$/i.test(l.url))
    .sort((a, b) => rank(a.url, a.text) - rank(b.url, b.text))
  for (const l of links) {
    const key = l.url.split('#')[0].replace(/\/$/, '')
    if (seen.has(key) || key === home.url.replace(/\/$/, '')) continue
    seen.add(key); picked.push(key)
    if (picked.length >= 4) break
  }
  if (picked.length < 2) {
    const origin = new URL(home.url).origin
    for (const p of FALLBACK_PATHS) {
      const u = origin + p
      if (!seen.has(u) && picked.length < 4) { seen.add(u); picked.push(u) }
    }
  }
  return picked
}

export async function crawlSite(website: string): Promise<{ pages: Page[]; status: string }> {
  const url = normalizeUrl(website)
  if (!url) return { pages: [], status: 'No website' }
  if (!isPublicHttpUrl(url)) return { pages: [], status: 'Blocked URL' }
  let r = await fetchPage(url, 8000)
  if (!r.page && r.httpStatus === 0 && url.startsWith('https://')) r = await fetchPage(url.replace('https://', 'http://'), 6000)
  const home = r.page
  if (!home) {
    // 403/429/503 usually means bot protection (Cloudflare etc.) — worth knowing, the site is real
    const blocked = [401, 403, 429, 503].includes(r.httpStatus)
    return { pages: [], status: blocked ? `Blocked by site (HTTP ${r.httpStatus})` : 'Unreachable' }
  }
  const subs = await Promise.all(pickSubpages(home).map(u => fetchPage(u, 5000)))
  return { pages: [home, ...subs.map(f => f.page).filter((p): p is Page => !!p)], status: 'OK' }
}

export async function enrichLead(base: BaseLead, profile: IndustryProfile = getIndustry()): Promise<Lead> {
  const { pages, status } = await crawlSite(base.website)
  const intel = pages.length ? analyzeSite(base, pages, status, profile) : emptyIntel(status, base.phone, profile.id)
  if (!pages.length) {
    // we can still say something from the name and Google data
    const nm = base.name.toLowerCase()
    const chain = profile.chains.find(c => nm.includes(c))
    if (chain) { intel.franchiseStatus = 'Chain'; intel.franchiseEvidence = `Known chain/brand: "${chain.trim()}"` }
    if ((base.sameNameListings || 1) >= 2) { intel.multiLocation = 'Yes'; intel.locationCount = String(base.sameNameListings); intel.franchiseEvidence = [intel.franchiseEvidence, `${base.sameNameListings} Google listings with this name`].filter(Boolean).join('; ') }
  }
  if (!pages.length) intel.pitchNotes = status === 'No website' ? 'No website found.' : `Website not scanned (${status}) — look up contacts manually.`
  return { ...base, ...intel }
}

/** Run `fn` over items with a fixed concurrency, preserving order. */
export async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]) }
  }))
  return out
}

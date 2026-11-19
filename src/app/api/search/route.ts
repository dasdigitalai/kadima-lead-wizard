import { NextRequest } from 'next/server'
import { parseAddress } from '@/lib/csv'
import { accessDenied, serverPlacesKey } from '@/lib/access'
import { getIndustry, type IndustryProfile } from '@/lib/industries'
import type { BaseLead, SearchMode } from '@/lib/types'

export const maxDuration = 60

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const API = 'https://places.googleapis.com/v1'

// Only the fields we use — keeps the Places request in the cheaper field-mask tiers.
const FIELD_MASK = [
  'places.id', 'places.displayName', 'places.formattedAddress', 'places.addressComponents',
  'places.location', 'places.types', 'places.primaryType', 'places.businessStatus',
  'places.googleMapsUri', 'places.websiteUri', 'places.nationalPhoneNumber',
  'places.rating', 'places.userRatingCount', 'places.editorialSummary',
  'nextPageToken',
].join(',')

interface Place {
  id?: string
  displayName?: { text?: string }
  formattedAddress?: string
  addressComponents?: { longText: string; shortText?: string; types: string[] }[]
  location?: { latitude: number; longitude: number }
  types?: string[]
  primaryType?: string
  businessStatus?: string
  googleMapsUri?: string
  websiteUri?: string
  nationalPhoneNumber?: string
  rating?: number
  userRatingCount?: number
  editorialSummary?: { text?: string }
}

function miles(a: { lat: number; lng: number }, b: { latitude: number; longitude: number }) {
  const R = 3958.8, rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.latitude - a.lat), dLng = rad(b.longitude - a.lng)
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

function keep(p: Place, profile: IndustryProfile): boolean {
  if (p.businessStatus === 'CLOSED_PERMANENTLY') return false
  const name = (p.displayName?.text || '').toLowerCase()
  if (profile.chains.some(c => name.includes(c))) return false
  // some industries are noisy on Google: require the name to look relevant, or Google to file it under a matching type
  if (profile.strictName) return profile.strictName.test(p.displayName?.text || '') || (p.types || []).some(t => profile.googleTypes.includes(t))
  return true
}

function toBase(p: Place, searchLocation: string): BaseLead {
  const comp = (t: string) => p.addressComponents?.find(c => c.types.includes(t))
  const street = [comp('street_number')?.longText, comp('route')?.longText].filter(Boolean).join(' ')
  const parsed = p.formattedAddress ? parseAddress(p.formattedAddress) : { street: '', city: '', state: '', zip: '' }
  return {
    name: p.displayName?.text || '',
    street: street || parsed.street,
    city: comp('locality')?.longText || comp('sublocality')?.longText || parsed.city,
    state: comp('administrative_area_level_1')?.shortText || parsed.state,
    zip: comp('postal_code')?.longText || parsed.zip,
    phone: p.nationalPhoneNumber || '',
    website: p.websiteUri || '',
    rating: p.rating != null ? String(p.rating) : '',
    reviews: p.userRatingCount != null ? String(p.userRatingCount) : '',
    mapsUrl: p.googleMapsUri || '',
    placeId: p.id || '',
    googleTypes: (p.types || []).filter(t => !['establishment', 'point_of_interest'].includes(t)).join('; '),
    businessStatus: p.businessStatus || '',
    googleSummary: p.editorialSummary?.text || '',
    searchLocation,
    sameNameListings: 1,
  }
}

async function post(path: string, body: object, apiKey: string) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELD_MASK },
    body: JSON.stringify(body),
  })
  return res.json()
}

async function geocode(address: string, apiKey: string) {
  const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`)
  const d = await res.json()
  if (d.status !== 'OK') throw new Error(`Geocode failed for "${address}": ${d.status}${d.error_message ? ' – ' + d.error_message : ''}`)
  return d.results[0].geometry.location as { lat: number; lng: number }
}

// POST { apiKey, location, radius (miles), target, mode, industry, excludeIds[] }  (SSE stream of progress events)
// The API key travels in the body, never in a URL that could end up in logs.
export async function POST(req: NextRequest) {
  const denied = accessDenied(req)
  if (denied) return denied
  const b = await req.json().catch(() => ({}))
  const apiKey = String(b.apiKey || serverPlacesKey())
  const location = String(b.location || '')
  const radius = Math.min(Math.max(Number(b.radius) || 25, 1), 31) // Places text-search bias caps at 50 km
  const target = Math.min(Math.max(parseInt(b.target) || 50, 1), 300)
  const mode = (b.mode === 'broad' ? 'broad' : 'focused') as SearchMode
  const profile = getIndustry(typeof b.industry === 'string' ? b.industry : undefined)
  const exclude = new Set<string>(Array.isArray(b.excludeIds) ? b.excludeIds : [])
  const keywords = mode === 'broad' ? [...profile.searchTerms, ...profile.broadTerms] : profile.searchTerms
  const radiusM = Math.min(Math.round(radius * 1609.34), 50000)
  const deadline = Date.now() + 50_000

  const enc = new TextEncoder()
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()
  const send = async (d: object) => { try { await writer.write(enc.encode(`data: ${JSON.stringify(d)}\n\n`)) } catch { /* client gone */ } }

  ;(async () => {
    try {
      if (!apiKey || !location) throw new Error('Missing API key or location')
      const center = await geocode(location, apiKey)
      await send({ phase: 'geocoding', message: `📍 ${location} → ${center.lat.toFixed(3)}, ${center.lng.toFixed(3)}` })

      const seen = new Set<string>(exclude)
      const leads: BaseLead[] = []

      outer: for (const kw of keywords) {
        let pageToken = ''
        for (let page = 0; page < 3; page++) {
          if (Date.now() > deadline) { await send({ phase: 'collecting', message: '⏱ Time budget reached — returning what we have' }); break outer }
          if (pageToken) await sleep(2000)
          const data = await post('/places:searchText', {
            textQuery: kw,
            locationBias: { circle: { center: { latitude: center.lat, longitude: center.lng }, radius: radiusM } },
            pageSize: 20,
            ...(pageToken ? { pageToken } : {}),
          }, apiKey)
          if (data.error) { await send({ phase: 'error', message: `Places API: ${data.error.message}` }); break outer }
          let added = 0
          for (const p of (data.places || []) as Place[]) {
            const id = p.id || ''
            if (!id || seen.has(id)) continue
            seen.add(id)
            if (!keep(p, profile)) continue
            if (p.location && miles(center, p.location) > radius * 1.05) continue
            leads.push(toBase(p, location)); added++
            if (leads.length >= target) break outer
          }
          await send({ phase: 'collecting', message: `"${kw}" p${page + 1}: +${added} (${leads.length}/${target})`, found: leads.length })
          pageToken = data.nextPageToken || ''
          if (!pageToken) break
        }
      }
      await send({ phase: 'collected', message: `Found ${leads.length} candidates near ${location}`, found: leads.length, leads })
    } catch (err) {
      await send({ phase: 'error', message: String(err instanceof Error ? err.message : err) })
    } finally {
      try { await writer.close() } catch { /* already closed */ }
    }
  })()

  return new Response(stream.readable, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' } })
}

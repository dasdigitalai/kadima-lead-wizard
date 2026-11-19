import type { Lead } from './types'

export function parseAddress(full: string) {
  const cleaned = full.replace(/,\s*USA\s*$/i, '').trim()
  const m = cleaned.match(/^(.+),\s*([^,]+),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/)
  if (m) return { street: m[1].trim(), city: m[2].trim(), state: m[3].trim(), zip: m[4].trim() }
  return { street: cleaned, city: '', state: '', zip: '' }
}

const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
const toCsv = (headers: string[], rows: unknown[][]) =>
  [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\r\n')

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first: '', last: '' }
  if (parts.length === 1) return { first: '', last: parts[0] }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

/** Plain contact list: opens in Excel/Google Sheets and imports into any CRM (HubSpot, Salesforce, Pipedrive…). */
export function toContactsCSV(rows: Lead[]): string {
  const headers = [
    'Company', 'First Name', 'Last Name', 'Job Title', 'Email', 'Phone', 'Website',
    'Street', 'City', 'State', 'Zip', 'Lead Score', 'Business Type', 'Franchise/Chain', 'Locations', 'Notes',
  ]
  return toCsv(headers, rows.map(r => {
    const who = splitName(r.ownerName || r.primaryContactName)
    const title = r.ownerName ? 'Owner' : r.primaryContactTitle
    const phone = (r.phone || r.allPhones.split(';')[0] || '').trim()
    const notes = [
      r.overview && `Overview: ${r.overview}`,
      r.paymentProcessors ? `Processors on site: ${r.paymentProcessors}` : r.websiteStatus === 'OK' ? 'No processor detected on site' : '',
      r.onlineCheckout === 'No' && r.websiteStatus === 'OK' && 'No online checkout',
      r.quoteOnly && 'Quote/phone-driven',
      r.shipsNationwide && 'Ships nationwide',
      r.otherContacts && `Other contacts: ${r.otherContacts}`,
      r.pitchNotes && `Pitch: ${r.pitchNotes}`,
    ].filter(Boolean).join('\n')
    return [
      r.name, who.first, who.last, title, r.primaryContactEmail, phone, r.website,
      r.street, r.city, r.state, r.zip, r.leadScore, r.businessType,
      r.franchiseStatus === 'Unknown' ? '' : r.franchiseStatus, r.multiLocation === 'Yes' ? r.locationCount : '', notes,
    ]
  }))
}

export type CallOutcome = 'talked' | 'noanswer' | 'callback' | 'notfit'
const OUTCOME_LABEL: Record<CallOutcome, string> = { talked: 'Talked to them', noanswer: 'No answer / voicemail', callback: 'Call back later', notfit: 'Not a fit' }

/** The agent's own activity log — works as the CRM when there isn't one. */
export function toCallLogCSV(rows: Lead[], status: Record<string, { s: CallOutcome; at: number; note: string }>, keyOf: (l: Lead) => string): string {
  const headers = ['Date', 'Time', 'Outcome', 'Company', 'Contact', 'Phone', 'Email', 'Website', 'City', 'State', 'Note']
  const logged = rows.filter(r => status[keyOf(r)]).sort((a, b) => status[keyOf(b)].at - status[keyOf(a)].at)
  return toCsv(headers, logged.map(r => {
    const st = status[keyOf(r)]
    const d = new Date(st.at)
    return [
      d.toLocaleDateString(), d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), OUTCOME_LABEL[st.s],
      r.name, r.ownerName || r.primaryContactName, r.phone || r.allPhones.split(';')[0] || '', r.primaryContactEmail, r.website, r.city, r.state, st.note,
    ]
  }))
}

/** Everything we know, one row per business. */
export function toFullCSV(rows: Lead[]): string {
  const headers = [
    'Lead Score', 'Company', 'Business Type', 'Website', 'Website Status',
    'Owner', 'Primary Contact', 'Contact Title', 'Primary Email', 'Phone(s)', 'All Emails', 'Other Contacts',
    'Overview', 'Parts Offered', 'Vehicle Focus', 'Key Claims',
    'Payment Processors', 'E-commerce Platform', 'Online Checkout', 'Quote/Phone Driven', 'Pay-Online Page',
    'Accepts Cards (stated)', 'Ships Nationwide', 'Sells To Shops/Dealers', 'Marketplaces', 'Financing', 'Pitch Notes',
    'Franchise/Chain', 'Locations', 'Multi-Location', 'Ownership Evidence',
    'Street', 'City', 'State', 'Zip', 'Rating', 'Reviews', 'Google Maps', 'Business Status',
    'Facebook', 'Instagram', 'LinkedIn', 'Website Tech', 'Website Age', 'Page Title', 'Pages Scanned',
    'Search Location', 'Place ID',
  ]
  return toCsv(headers, rows.map(r => [
    r.leadScore, r.name, r.businessType, r.website, r.websiteStatus,
    r.ownerName, r.primaryContactName, r.primaryContactTitle, r.primaryContactEmail, r.allPhones, r.allEmails, r.otherContacts,
    r.overview, r.partsOffered, r.vehicleFocus, r.keyClaims,
    r.paymentProcessors, r.ecommercePlatform, r.onlineCheckout, r.quoteOnly, r.payOnlineLink,
    r.acceptsCards, r.shipsNationwide, r.b2bAccounts, r.marketplaces, r.financing, r.pitchNotes,
    r.franchiseStatus, r.locationCount, r.multiLocation, r.franchiseEvidence,
    r.street, r.city, r.state, r.zip, r.rating, r.reviews, r.mapsUrl, r.businessStatus,
    r.facebookUrl, r.instagramUrl, r.linkedinUrl, r.websiteTech, r.websiteModern, r.pageTitle, r.pagesScanned,
    r.searchLocation, r.placeId,
  ]))
}

/** Minimal RFC-4180 CSV parser (quoted fields, escaped quotes, embedded newlines). */
export function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let field = '', row: string[] = [], inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else inQ = false } else field += c
    } else if (c === '"') inQ = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some(f => f.trim())) rows.push(row)
      row = []
    } else field += c
  }
  row.push(field)
  if (row.some(f => f.trim())) rows.push(row)
  const headers = (rows.shift() || []).map(h => h.trim())
  return rows.map(r => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()])))
}

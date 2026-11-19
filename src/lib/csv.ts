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

// Zoho's Industry field is a picklist; an unknown value is rejected on import.
// Change this to a value that exists in your Zoho account.
export const ZOHO_INDUSTRY = 'Other'
export const ZOHO_LEAD_SOURCE = 'Parts Locator Radar'

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first: '', last: 'Unknown' } // Zoho Leads require a Last Name
  if (parts.length === 1) return { first: '', last: parts[0] }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

/** Compact file that maps straight onto Zoho CRM's Leads import. */
export function toZohoLeadsCSV(rows: Lead[]): string {
  const headers = [
    'Company', 'First Name', 'Last Name', 'Designation', 'Email', 'Phone', 'Website',
    'Street', 'City', 'State', 'Zip Code', 'Lead Source', 'Industry', 'Rating', 'Description',
  ]
  return toCsv(headers, rows.map(r => {
    const who = splitName(r.ownerName || r.primaryContactName)
    const title = r.ownerName ? 'Owner' : r.primaryContactTitle
    const phone = (r.phone || r.allPhones.split(';')[0] || '').trim()
    const description = [
      r.overview && `Overview: ${r.overview}`,
      r.businessType !== 'Unclear' && `Type: ${r.businessType}`,
      r.franchiseStatus !== 'Independent' && r.franchiseStatus !== 'Unknown' && `Ownership: ${r.franchiseStatus}`,
      r.multiLocation === 'Yes' && `Locations: ${r.locationCount}`,
      r.paymentProcessors ? `Processors on site: ${r.paymentProcessors}` : 'No processor detected on site',
      r.onlineCheckout === 'No' && 'No online checkout',
      r.quoteOnly && 'Quote/phone-driven',
      r.shipsNationwide && 'Ships nationwide',
      r.otherContacts && `Other contacts: ${r.otherContacts}`,
      r.pitchNotes && `Pitch: ${r.pitchNotes}`,
      `Lead score: ${r.leadScore}/100`,
    ].filter(Boolean).join('\n')
    return [
      r.name, who.first, who.last, title, r.primaryContactEmail, phone, r.website,
      r.street, r.city, r.state, r.zip, ZOHO_LEAD_SOURCE, ZOHO_INDUSTRY, r.rating, description,
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

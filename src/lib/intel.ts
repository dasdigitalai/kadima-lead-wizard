// Turn the fetched pages of one website into SiteIntel. Pure functions, no network.

import type { BaseLead, SiteIntel } from './types'
import { DEFAULT_INDUSTRY, getIndustry, isOffIndustry, lcFirst, type IndustryProfile } from './industries'
import {
  extractEmails, extractPhones, findPeople, pickPrimaryEmail, formatPhone, type Person,
} from './contacts'
import { extractJsonLd, getFirstHeading, getMeta, getTitle, htmlToText, stripWww } from './html'
import {
  detectB2B, detectClaims, detectOfferings, detectOwnership, detectPayments, detectTech, modernity, type PaymentSignals,
} from './signals'

export interface Page { url: string; html: string }

const BOILERPLATE = /cookie|privacy policy|all rights reserved|accept all|javascript|skip to|sign up for|subscribe|newsletter|©/i

/** First substantive paragraph that reads like a company description. */
function bestParagraph(text: string, min = 70, max = 420): string {
  const lines = text.split('\n')
  const scored = lines
    .filter(l => l.length >= min && l.length <= 1200 && !BOILERPLATE.test(l))
    .map(l => {
      const letters = (l.match(/[a-z]/gi) || []).length / l.length
      const about = /\b(we|our|since|founded|family|locat\w+|parts|salvage|recycl\w+|network|nationwide|serving)\b/i.test(l) ? 1 : 0
      return { l, s: (letters > 0.7 ? 1 : 0) + about }
    })
    .filter(x => x.s >= 2)
  if (!scored.length) return ''
  const l = scored[0].l
  if (l.length <= max) return l
  const cut = l.slice(0, max)
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '))
  return (end > 120 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '') + '…')
}

function jsonLdFacts(html: string) {
  const out = { description: '', emails: [] as string[], phones: [] as string[], people: [] as Person[] }
  for (const o of extractJsonLd(html)) {
    if (typeof o.description === 'string' && !out.description) out.description = o.description
    if (typeof o.email === 'string') out.emails.push(o.email)
    if (typeof o.telephone === 'string') out.phones.push(o.telephone)
    const peopleKeys = ['founder', 'founders', 'employee', 'employees', 'member', 'owner', 'author']
    for (const k of peopleKeys) {
      const v = o[k]
      for (const p of Array.isArray(v) ? v : v ? [v] : []) {
        const po = p as Record<string, unknown>
        const name = typeof p === 'string' ? p : typeof po?.name === 'string' ? po.name : ''
        if (!name || name.split(/\s+/).length < 2 || /^[a-z]/.test(name)) continue
        const title = typeof po?.jobTitle === 'string' ? po.jobTitle : k.startsWith('found') ? 'Founder' : k === 'owner' ? 'Owner' : ''
        if (k === 'author' && !title) continue
        out.people.push({ name, title: title || 'Staff', rank: k.startsWith('found') || k === 'owner' ? 1 : 4 })
      }
    }
  }
  return out
}

function socialLink(html: string, host: RegExp): string {
  const m = html.match(new RegExp(`https?:\\/\\/(?:www\\.)?${host.source}\\/[A-Za-z0-9._\\-/%?=&]+`, 'i'))
  if (!m) return ''
  const url = m[0].split(/["'<>\s]/)[0].replace(/[?#].*$/, '').replace(/\/$/, '')
  return /\/(sharer|share|plugins|tr|dialog)\b|\/\/[^/]+\/?$/.test(url) ? '' : url
}

export function emptyIntel(status: string, phoneFromPlaces = '', industry = DEFAULT_INDUSTRY): SiteIntel {
  return {
    industry, websiteStatus: status, domain: '', pageTitle: '', overview: '', businessType: 'Unclear',
    partsOffered: '', vehicleFocus: '', keyClaims: '', ownerName: '', primaryContactName: '',
    primaryContactTitle: '', primaryContactEmail: '', otherContacts: '', allEmails: '',
    allPhones: phoneFromPlaces, paymentProcessors: '', ecommercePlatform: '', acceptsCards: '',
    onlineCheckout: '', quoteOnly: '', payOnlineLink: '', shipsNationwide: '', b2bAccounts: '',
    marketplaces: '', financing: '', facebookUrl: '', instagramUrl: '', linkedinUrl: '',
    websiteTech: '', websiteModern: '', franchiseStatus: 'Unknown', franchiseEvidence: '', locationCount: '', multiLocation: 'Unknown',
    pagesScanned: '0', leadScore: 0, pitchNotes: '',
  }
}

/** Score how attractive this business is as a payment-processing prospect, and say why. */
export function scorePitch(p: {
  hasWebsite: boolean; businessType: string; pay: PaymentSignals; ships: boolean; b2b: boolean
  highTicket: boolean; hasOwner: boolean; hasEmail: boolean; hasPhone: boolean; outdated: boolean
  franchiseStatus?: string; multiLocation?: boolean; locationCount?: string; profile: IndustryProfile
}): { score: number; notes: string[] } {
  const notes: string[] = []
  let s = 0
  const info = p.profile.typeInfo?.[p.businessType]
  if (info) { s += info.score; notes.push(info.note) }
  else if (!p.profile.typeInfo && !isOffIndustry(p.businessType)) { s += 12; notes.push(p.profile.pitch) }
  if (p.pay.quoteOnly && !p.pay.onlineCheckout) { s += 20; notes.push('Quote/phone-driven sales with no online checkout → pitch pay-by-link, virtual terminal, and invoicing.') }
  if (!p.pay.onlineCheckout) { s += 5 } else { notes.push('Has online checkout — likely already has a gateway; pitch rates/switching.') }
  if (p.pay.processors.length === 0) { s += 12; notes.push('No payment processor detected on the site.') }
  else if (p.pay.processors.length === 1 && p.pay.processors[0] === 'PayPal') { s += 10; notes.push('Only PayPal detected — likely paying PayPal rates; room to undercut.') }
  else notes.push(`Processor(s) detected: ${p.pay.processors.join(', ')}.`)
  if (p.pay.payOnlineLink) notes.push('Has a pay-online / pay-invoice page.')
  if (p.ships) { s += 10; notes.push('Ships nationwide → mostly card-not-present, higher chargeback exposure.') }
  if (p.highTicket) { s += 8; notes.push(p.profile.bigTicketNote || 'Large ticket sizes.') }
  if (p.b2b) { s += 5; notes.push('Sells to businesses → B2B / Level 2-3 interchange savings.') }
  if (p.outdated) { s += 3; notes.push('Dated website — payment stack is probably dated too.') }
  if (p.hasOwner) s += 7
  if (p.hasEmail) s += 6
  if (p.hasPhone) s += 4
  if (!p.hasWebsite) { s = Math.min(s, 10); notes.push('No website found.') }
  if (p.franchiseStatus === 'Franchise' || p.franchiseStatus === 'Chain') { s = Math.min(s, 30); notes.unshift(`${p.franchiseStatus} — payment decisions are usually made at corporate, not the local owner.`) }
  else if (p.franchiseStatus === 'Part of a group') notes.push('Part of a larger group — confirm who controls payment processing.')
  if (p.multiLocation && p.franchiseStatus === 'Independent') { s += 4; notes.push(`Independent with multiple locations (${p.locationCount}) — higher volume, one decision-maker.`) }
  if (isOffIndustry(p.businessType)) { s = Math.min(s, 12); notes.unshift(`Site does not read as a ${lcFirst(p.profile.type)} — verify before calling.`) }
  return { score: Math.max(0, Math.min(100, s)), notes }
}

export function analyzeSite(base: BaseLead, pages: Page[], status = 'OK', profile: IndustryProfile = getIndustry()): SiteIntel {
  const home = pages[0]
  if (!home || !home.html) return emptyIntel(status, base.phone, profile.id)

  const allHtml = pages.map(p => p.html).join('\n')
  const homeText = htmlToText(home.html)
  const allText = pages.map(p => htmlToText(p.html)).join('\n')
  const domain = (() => { try { return stripWww(new URL(home.url).hostname) } catch { return '' } })()

  // ── Overview ────────────────────────────────────────────────────────────
  const ld = jsonLdFacts(allHtml)
  const title = getTitle(home.html)
  const h1 = getFirstHeading(home.html, 1)
  const metaDesc = getMeta(home.html, 'description', 'og:description', 'twitter:description') || ld.description
  const aboutPage = pages.find((p, i) => i > 0 && /about|story|who-we|our-company/i.test(p.url))
  const aboutPara = bestParagraph(aboutPage ? htmlToText(aboutPage.html) : homeText) || bestParagraph(homeText)

  const businessType = profile.classify(allText, home.html)
  const onIndustry = !isOffIndustry(businessType)
  const parts = onIndustry ? detectOfferings(allText, profile.offerings) : []
  const vehicles = onIndustry ? profile.focus?.(allText) ?? '' : ''
  const claims = [...detectClaims(allText), ...(profile.extraClaims?.(allText) ?? [])]

  const overviewBits: string[] = []
  const lead = metaDesc || aboutPara
  if (lead) overviewBits.push(lead.replace(/\s+/g, ' ').trim())
  else if (h1) overviewBits.push(h1)
  if (aboutPara && lead && !lead.includes(aboutPara.slice(0, 40)) && overviewBits.join(' ').length < 260) overviewBits.push(aboutPara)
  const summary: string[] = []
  if (!onIndustry) summary.push(`Does not appear to be a ${lcFirst(profile.type)} — verify before calling`)
  else if (businessType !== 'Unclear') summary.push(businessType)
  if (parts.length) summary.push(`sells ${parts.slice(0, 5).join(', ').toLowerCase()}`)
  if (vehicles) summary.push(`focus: ${vehicles}`)
  let overview = overviewBits.join(' ')
  if (overview.length > 520) overview = overview.slice(0, 520).replace(/\s+\S*$/, '') + '…'
  if (summary.length) overview = (overview ? overview + ' — ' : '') + summary.join('; ') + '.'
  if (!overview) overview = title || 'Website reachable but little descriptive text found.'

  // ── People, emails, phones ──────────────────────────────────────────────
  const people = [...findPeople(allText), ...ld.people]
    .reduce((acc, p) => { if (!acc.find(x => x.name.toLowerCase() === p.name.toLowerCase())) acc.push(p); return acc }, [] as Person[])
    .sort((a, b) => a.rank - b.rank)
  const owner = people.find(p => p.rank === 1)
  const primary = people[0]

  const emails = extractEmails(allHtml, allText)
  for (const e of ld.emails) { const c = e.toLowerCase().replace(/^mailto:/, '').trim(); if (/@/.test(c) && !emails.includes(c)) emails.push(c) }
  const primaryEmail = pickPrimaryEmail(emails, domain, primary)

  const phones = extractPhones(allHtml, allText)
  for (const p of ld.phones) { const f = formatPhone(p); if (/^\(\d{3}\)/.test(f) && !phones.includes(f)) phones.push(f) }
  const placesPhone = base.phone ? formatPhone(base.phone) : ''
  const allPhones = [placesPhone, ...phones].filter(Boolean).filter((p, i, a) => a.indexOf(p) === i).slice(0, 6)

  // ── Payments & business signals ─────────────────────────────────────────
  const pay = detectPayments(allHtml, allText)
  const ships = claims.includes('Ships nationwide') || claims.includes('International/export') || claims.includes('Free shipping')
  const b2b = detectB2B(allText)
  const tech = detectTech(home.html)
  const mod = modernity(home.html, tech)
  const highTicket = profile.bigTicket.some(n => parts.includes(n))

  // ── franchise / chain / multi-location ──────────────────────────────────
  const addressKeys = [...allText.matchAll(/,\s*([A-Z]{2})\s+(\d{5})\b/g)].map(m => `${m[1]} ${m[2]}`)
  const own = detectOwnership({
    text: allText, name: base.name, domain, chainNames: profile.chains, addressKeys,
    sameNameListings: base.sameNameListings || 1, hasLocationsPage: pages.some((pg, i) => i > 0 && /locations?|branches|our-yards|find-a-/i.test(new URL(pg.url).pathname)),
  })

  const { score, notes } = scorePitch({
    franchiseStatus: own.franchiseStatus, multiLocation: own.multiLocation === 'Yes', locationCount: own.locationCount,
    profile, hasWebsite: true, businessType, pay, ships, b2b, highTicket,
    hasOwner: !!owner, hasEmail: !!primaryEmail, hasPhone: allPhones.length > 0, outdated: mod.label === 'Outdated',
  })

  return {
    industry: profile.id,
    websiteStatus: status,
    domain,
    pageTitle: title,
    overview,
    businessType,
    partsOffered: parts.join(', '),
    vehicleFocus: vehicles,
    keyClaims: claims.join('; '),
    ownerName: owner?.name || '',
    primaryContactName: primary?.name || '',
    primaryContactTitle: primary?.title || '',
    primaryContactEmail: primaryEmail,
    otherContacts: people.filter(p => p !== primary).slice(0, 5).map(p => `${p.name} (${p.title})`).join('; '),
    allEmails: emails.slice(0, 8).join('; '),
    allPhones: allPhones.join('; '),
    paymentProcessors: pay.processors.join(', '),
    ecommercePlatform: pay.commerce.join(', '),
    acceptsCards: pay.acceptsCards ? 'Yes' : '',
    onlineCheckout: pay.onlineCheckout ? 'Yes' : 'No',
    quoteOnly: pay.quoteOnly ? 'Yes' : '',
    payOnlineLink: pay.payOnlineLink ? 'Yes' : '',
    shipsNationwide: ships ? 'Yes' : '',
    b2bAccounts: b2b ? 'Yes' : '',
    marketplaces: pay.marketplaces.join(', '),
    financing: pay.financing.join(', '),
    facebookUrl: socialLink(allHtml, /facebook\.com/),
    instagramUrl: socialLink(allHtml, /instagram\.com/),
    linkedinUrl: socialLink(allHtml, /linkedin\.com\/(?:company|in)/),
    websiteTech: tech,
    websiteModern: mod.label,
    franchiseStatus: own.franchiseStatus,
    franchiseEvidence: own.evidence.join('; '),
    locationCount: own.locationCount,
    multiLocation: own.multiLocation,
    pagesScanned: String(pages.length),
    leadScore: score,
    pitchNotes: [...notes, ...mod.notes.map(n => `Site: ${n}`)].join(' '),
  }
}

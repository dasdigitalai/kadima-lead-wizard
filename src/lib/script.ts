// Turn a scored lead into a plain-English call plan: who to ask for, why this call is worth making,
// what to say, and a ready-to-send email. Pure templates over the scanned data — no AI, no guessing.

import type { Lead } from './types'

export type Temp = 'Hot' | 'Warm' | 'Cool'

export interface CallPlan {
  temp: Temp
  askFor: string            // "Maria Gonzalez (Owner)" or a safe fallback
  hasName: boolean
  phone: string
  email: string
  why: string[]             // max 4 short bullets
  opener: string
  questions: string[]       // max 3
  emailSubject: string
  emailBody: string
  caution: string           // e.g. franchise/chain warning; '' if none
}

const first = (full: string) => full.trim().split(/\s+/)[0] || ''

export function leadKey(l: Pick<Lead, 'placeId' | 'website' | 'name'>): string {
  return l.placeId || l.website || l.name
}

export function tempOf(score: number): Temp { return score >= 70 ? 'Hot' : score >= 40 ? 'Warm' : 'Cool' }

export function callPlan(l: Lead, agentName = ''): CallPlan {
  const person = l.ownerName ? { name: l.ownerName, title: 'Owner' }
    : l.primaryContactName ? { name: l.primaryContactName, title: l.primaryContactTitle } : null
  const askFor = person ? `${person.name}${person.title ? ` (${person.title})` : ''}` : 'the owner or whoever handles payments'
  const phone = (l.phone || l.allPhones.split(';')[0] || '').trim()
  const noCheckout = l.onlineCheckout !== 'Yes'
  const highTicket = /engine|transmission|turbo/i.test(l.partsOffered)

  const why: string[] = []
  if (l.businessType === 'Parts Locator' || l.businessType === 'Locator + Yard') why.push('They find parts for customers across a network of yards and ship them — mostly card-not-present sales.')
  else if (l.businessType === 'Salvage Yard / Recycler') why.push('Looks like a yard/recycler more than a pure locator — still sells parts by phone and web.')
  if (l.quoteOnly === 'Yes' && noCheckout) why.push('Customers request quotes by phone or form — there is no online checkout, so payment is probably taken by phone.')
  else if (!l.paymentProcessors && l.websiteStatus === 'OK') why.push('No card processor is visible on their website.')
  else if (l.paymentProcessors === 'PayPal') why.push('Only PayPal shows on their site — they may be paying PayPal rates.')
  else if (l.paymentProcessors) why.push(`They already use ${l.paymentProcessors} — this is a switch/better-rates conversation.`)
  if (l.shipsNationwide === 'Yes') why.push('Ships nationwide, so most payments are over the phone or online (higher chargeback exposure).')
  if (highTicket) why.push('Sells engines/transmissions — big ticket sizes.')
  if (l.multiLocation === 'Yes' && l.franchiseStatus === 'Independent') why.push(`Independent with ${l.locationCount} locations — more volume, one decision-maker.`)

  const caution = l.franchiseStatus === 'Franchise' || l.franchiseStatus === 'Chain'
    ? `${l.franchiseStatus}: the payment decision is usually made at corporate, not by this location. Consider skipping.`
    : l.franchiseStatus === 'Part of a group' ? 'Part of a larger group — ask who controls payment processing.' : ''

  const me = agentName.trim() || '[your name]'
  const who = person ? first(person.name) : ''
  const opener = person
    ? `"Hi, is this ${who}? This is ${me}. I help parts businesses like ${l.name} take card payments more easily. Do you have two minutes?"`
    : `"Hi, this is ${me}. Who handles payments or card processing there? I help parts businesses take card payments more easily."`

  const questions: string[] = []
  if (l.quoteOnly === 'Yes' && noCheckout) questions.push('When a customer asks for a part, how do you collect payment — over the phone, a payment link, or invoice?')
  else questions.push('How do customers pay you today — phone, online, or invoice?')
  if (l.shipsNationwide === 'Yes') questions.push('You ship all over the country — do you run into chargebacks or declined cards on out-of-state orders?')
  questions.push(l.paymentProcessors ? `Who are you with for processing now, and are you happy with the rates?` : 'Who do you use to process cards right now?')

  const emailSubject = 'Quick question about how you take payments'
  const emailBody = [
    person ? `Hi ${who},` : 'Hi,',
    '',
    `I came across ${l.name} and had a quick question: how do your customers pay you when they order a part — over the phone, a payment link, or online?`,
    '',
    'I help parts businesses accept card payments more easily. If it is easy to take a look at your setup, I would be happy to share what I find. No pressure either way.',
    '',
    'Thanks,',
    agentName.trim() || '[your name]',
  ].join('\n')

  return { temp: tempOf(l.leadScore), askFor, hasName: !!person, phone, email: l.primaryContactEmail, why: why.slice(0, 4), opener, questions: questions.slice(0, 3), emailSubject, emailBody, caution }
}

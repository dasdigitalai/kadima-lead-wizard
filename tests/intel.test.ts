import assert from 'node:assert/strict'
import { analyzeSite } from '../src/lib/intel'
import { findPeople, extractEmails, extractPhones, pickPrimaryEmail } from '../src/lib/contacts'
import { htmlToText } from '../src/lib/html'
import { isPublicHttpUrl } from '../src/lib/crawl'
import type { BaseLead } from '../src/lib/types'

const base: BaseLead = {
  name: 'Sunshine Auto Parts Locators', street: '1 Main St', city: 'Miami', state: 'FL', zip: '33101',
  phone: '3055550100', website: 'https://sunshinepartsfinder.com', rating: '4.7', reviews: '88', mapsUrl: '',
  placeId: 'x', googleTypes: '', businessStatus: 'OPERATIONAL', googleSummary: '', searchLocation: 'Miami, FL', sameNameListings: 1,
}

// A realistic locator site: JSON-LD, cloudflare-obfuscated email, staff cards, quote-only flow, PayPal only.
const home = `<!doctype html><html><head>
<title>Sunshine Parts Finder | Used Auto Parts Locator</title>
<meta name="viewport" content="width=device-width">
<meta name="description" content="We locate quality used auto parts from a nationwide network of over 3,000 salvage yards and ship them to your door.">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"LocalBusiness","name":"Sunshine Parts Finder","telephone":"+1-305-555-0100","email":"mailto:info@sunshinepartsfinder.com"}</script>
</head><body>
<nav><a href="/contact-us">Contact</a><a href="/about-us">About Us</a><a href="/parts-request">Request a Part</a></nav>
<h1>Used Auto Parts Locator</h1>
<p>Our parts locating service searches a network of thousands of salvage yards to find engines, transmissions and body parts. We ship nationwide with a 90 day warranty. Free quote in minutes.</p>
<p>Body shops, repair shops and dealers welcome — open an account today.</p>
<form><button>Request a Free Quote</button></form>
<a href="https://www.facebook.com/sunshinepartsfinder">FB</a>
<a href="https://www.paypal.com/paypalme/sunshine">Pay with PayPal</a>
<p>We accept Visa, Mastercard and Discover. Call (305) 555-0100 or toll free 1-800-555-0123. Fax: (305) 555-0199</p>
<footer>© 2023 Sunshine Parts Finder. All rights reserved.</footer></body></html>`

const contact = `<html><body><h2>Contact</h2>
<p>Sales: <a href="mailto:sales@sunshinepartsfinder.com">sales@sunshinepartsfinder.com</a></p>
<p>Email Maria directly: <a class="__cf_email__" data-cfemail="${cf('maria@sunshinepartsfinder.com')}">[email protected]</a></p></body></html>`

function cf(email: string): string {
  const key = 0x4a
  return key.toString(16).padStart(2, '0') + [...email].map(c => (c.charCodeAt(0) ^ key).toString(16).padStart(2, '0')).join('')
}

const about = `<html><body><h1>About Us</h1>
<p>Sunshine Parts Finder was founded in 2009 and our family has helped thousands of customers find hard-to-find used parts through our network of salvage yards across the country.</p>
<div class="staff"><div class="card"><h3>Maria Gonzalez</h3><p>Owner &amp; President</p></div>
<div class="card"><h3>Dave Peterson</h3><p>Sales Manager</p></div>
<div class="card"><h3>Customer Service</h3><p>Sales Representative</p></div></div>
<p>Contact Us Today for a free quote</p></body></html>`

const intel = analyzeSite(base, [
  { url: 'https://sunshinepartsfinder.com/', html: home },
  { url: 'https://sunshinepartsfinder.com/contact-us', html: contact },
  { url: 'https://sunshinepartsfinder.com/about-us', html: about },
])

console.log(JSON.stringify(intel, null, 2))

assert.equal(intel.websiteStatus, 'OK')
assert.equal(intel.domain, 'sunshinepartsfinder.com')
assert.equal(intel.businessType, 'Parts Locator')
assert.equal(intel.ownerName, 'Maria Gonzalez')
assert.equal(intel.primaryContactName, 'Maria Gonzalez')
assert.match(intel.otherContacts, /Dave Peterson \(Sales Manager\)/)
assert.ok(!/Customer Service|Contact Us/.test(intel.otherContacts + intel.ownerName), 'job-title phrases must not become names')
assert.equal(intel.primaryContactEmail, 'maria@sunshinepartsfinder.com', 'person-matching email preferred (cloudflare-decoded)')
assert.ok(intel.allEmails.includes('sales@sunshinepartsfinder.com'))
assert.ok(intel.allEmails.includes('info@sunshinepartsfinder.com'), 'JSON-LD email picked up')
assert.ok(!intel.allPhones.includes('555-0199'), 'fax numbers excluded')
assert.ok(intel.allPhones.includes('(305) 555-0100'))
assert.ok(intel.allPhones.includes('(800) 555-0123'))
assert.equal(intel.paymentProcessors, 'PayPal')
assert.equal(intel.quoteOnly, 'Yes')
assert.equal(intel.onlineCheckout, 'No')
assert.equal(intel.acceptsCards, 'Yes')
assert.equal(intel.shipsNationwide, 'Yes')
assert.equal(intel.b2bAccounts, 'Yes')
assert.match(intel.keyClaims, /90-day warranty/)
assert.match(intel.overview, /nationwide network of over 3,000 salvage yards/)
assert.equal(intel.facebookUrl, 'https://www.facebook.com/sunshinepartsfinder')
assert.ok(intel.leadScore >= 70, `expected high score, got ${intel.leadScore}`)

// ── People heuristics ─────────────────────────────────────────────────────
const names = (t: string) => findPeople(t).map(p => `${p.name}|${p.title}`)
assert.deepEqual(names('John Smith, Owner'), ['John Smith|Owner'])
assert.deepEqual(names('Owner: John Smith'), ['John Smith|Owner'])
assert.deepEqual(names('Founded by Robert McDonald in 1998'), ['Robert McDonald|Founder'])
assert.deepEqual(names('Jane Doe-Smith\nGeneral Manager'), ['Jane Doe-Smith|General Manager'])
assert.deepEqual(names('Contact our owner today for used engines'), [])
assert.deepEqual(names('Are you a business owner looking for Used Engines?'), [])
assert.deepEqual(names('Customer Service Manager'), [])
assert.deepEqual(names('Used Transmissions Sales Manager'), [])

assert.deepEqual(names('Is UsedPart Locator'), [], 'company names / camel-case must not become people')
assert.deepEqual(names('Welcome to Premier Auto Parts Locator'), [])
assert.deepEqual(names('John Knapp, President'), ['John Knapp|President'])
assert.deepEqual(names('Sean McDonald, Owner'), ['Sean McDonald|Owner'])

// ── Emails / phones ───────────────────────────────────────────────────────
assert.deepEqual(extractEmails('', 'write to john [at] acme-parts [dot] com'), ['john@acme-parts.com'])
assert.deepEqual(extractEmails('<img src="logo@2x.png"> abc@sentry.io user@example.com', ''), [])
assert.equal(pickPrimaryEmail(['info@a.com', 'sales@a.com', 'zz@gmail.com'], 'a.com'), 'sales@a.com')
assert.equal(pickPrimaryEmail(['pyp-hr@a.com', 'careers@a.com'], 'a.com'), '', 'HR/jobs mailboxes are never the sales contact')
assert.equal(pickPrimaryEmail(['hr@a.com', 'orders@a.com'], 'a.com'), 'orders@a.com')
assert.deepEqual(extractPhones('', 'Order #12345678901 call 561-555-0142 or Fax 561-555-0143'), ['(561) 555-0142'])
assert.ok(htmlToText('<p>A</p><p>B</p>').split('\n').length === 2)

// ── Business classification (cases taken from real sites) ──────────────────
import { classifyAutoParts } from '../src/lib/auto'
import { OFF_INDUSTRY } from '../src/lib/types'
const cls = (html: string) => classifyAutoParts(htmlToText(html), html)
assert.equal(cls('<title>Used Auto Parts Locator</title><h1>Find Quality Used Auto Parts</h1><p>Explore millions of used auto parts in our extensive salvage database. Find millions of used auto parts from local salvage yards. We ship cars trucks engines transmissions nationwide.</p>'), 'Parts Locator')
assert.equal(cls('<title>Pick Your Part</title><p>Pick Your Part is North America\'s largest recycler of used cars and trucks. Pick Your Part salvage yards sell used car parts. Sell your car today. Free quote on engines and transmissions.</p>'), 'Salvage Yard / Recycler')
assert.equal(cls('<title>PartsSource</title><p>Healthcare parts for hospitals, clinical equipment and biomedical teams. Request a part quote.</p>'), OFF_INDUSTRY)


// ── Franchise / chain / multi-location ────────────────────────────────────
import { markSameNameListings, brandKey } from '../src/lib/group'
// the main fixture is a single-location independent
assert.equal(intel.franchiseStatus, 'Independent')
assert.equal(intel.multiLocation, 'No')

const mk = (over: Partial<BaseLead>): BaseLead => ({ ...base, ...over })
const page = (html: string, path = '') => [{ url: `https://example-parts.com/${path}`, html: `<html><body>${html}${'x'.repeat(120)}</body></html>` }]
const autoText = '<p>Used auto parts salvage engines transmissions cars trucks for sale.</p>'

const fr = analyzeSite(mk({ name: 'Acme Auto Recyclers' }), page(autoText + '<p>Become a franchisee! Own a franchise today. Franchise opportunities available.</p>'))
assert.equal(fr.franchiseStatus, 'Franchise')
assert.ok(fr.leadScore <= 30, `franchise score capped, got ${fr.leadScore}`)
assert.match(fr.pitchNotes, /corporate/)

const ch = analyzeSite(mk({ name: 'Pick Your Part - Orlando', website: 'https://www.pickyourpart.com' }), [{ url: 'https://www.pickyourpart.com/', html: `<html><body>${autoText}${'x'.repeat(120)}</body></html>` }])
assert.equal(ch.franchiseStatus, 'Chain')

const multi = analyzeSite(mk({ name: 'Dixie Used Parts' }), page(autoText + '<p>Visit any of our 3 locations. 12 Oak St, Atlanta, GA 30301. 9 Pine Rd, Marietta, GA 30060. 4 Elm Ave, Macon, GA 31201.</p>'))
assert.equal(multi.multiLocation, 'Yes')
assert.equal(multi.locationCount, '3')
assert.equal(multi.franchiseStatus, 'Independent', 'a few locations alone is not a chain')

const many = analyzeSite(mk({ name: 'Big Yard Co' }), page(autoText + '<p>We operate 14 yards across the Southeast.</p>'))
assert.equal(many.franchiseStatus, 'Chain', '5+ locations -> chain')

const locPage = analyzeSite(mk({ name: 'Delta Parts' }), [...page(autoText), { url: 'https://example-parts.com/locations', html: `<html><body>${autoText}<p>Find a location near you</p>${'x'.repeat(120)}</body></html>` }])
assert.equal(locPage.multiLocation, 'Yes')
assert.equal(locPage.locationCount, '2+')

// same-name Google listings
const ls = markSameNameListings([mk({ name: 'LKQ Pick Your Part - Tampa', placeId: '1' }), mk({ name: 'LKQ PICK YOUR PART #22', placeId: '2' }), mk({ name: 'Solo Salvage Inc.', placeId: '3' })])
assert.deepEqual(ls.map(l => l.sameNameListings), [2, 2, 1])
assert.equal(brandKey('Solo Salvage, Inc.'), brandKey('SOLO SALVAGE LLC'))
const viaGoogle = analyzeSite(mk({ name: 'Solo Salvage', sameNameListings: 3 }), page(autoText))
assert.equal(viaGoogle.multiLocation, 'Yes')


// ── Call plan (what the sales agent sees) ──────────────────────────────────
import { callPlan, tempOf, leadKey } from '../src/lib/script'
const plan = callPlan({ ...base, ...intel }, 'Sam')
assert.equal(plan.temp, 'Hot')
assert.equal(plan.askFor, 'Maria Gonzalez (Owner)')
assert.ok(plan.why.length >= 2 && plan.why.length <= 4)
assert.match(plan.opener, /Hi, is this Maria\? This is Sam\./)
assert.ok(plan.questions.length >= 2 && plan.questions.length <= 3)
assert.match(plan.emailBody, /^Hi Maria,/)
assert.equal(plan.caution, '')
const noName = callPlan({ ...base, ...analyzeSite(mk({ name: 'No Names Auto' }), page(autoText)) })
assert.equal(noName.hasName, false)
assert.match(noName.askFor, /owner or whoever handles payments/)
assert.match(noName.opener, /Who handles payments/)
assert.match(noName.emailBody, /\[your name\]/, 'unnamed agent gets an obvious placeholder, never a made-up name')
assert.match(callPlan({ ...base, ...ch }).caution, /Chain/)
assert.equal(tempOf(69), 'Warm'); assert.equal(tempOf(40), 'Warm'); assert.equal(tempOf(39), 'Cool')
assert.equal(leadKey({ placeId: '', website: 'a.com', name: 'A' }), 'a.com')


// ── Industry profiles ──────────────────────────────────────────────────────
import { INDUSTRY_LIST, INDUSTRY_GROUPS, getIndustry, DEFAULT_INDUSTRY } from '../src/lib/industries'

// every profile is complete and well-formed
const ids = new Set<string>()
for (const p of INDUSTRY_LIST) {
  assert.ok(!ids.has(p.id), `duplicate id ${p.id}`); ids.add(p.id)
  assert.ok(p.searchTerms.length >= 3, `${p.id}: needs >=3 search terms`)
  assert.ok(p.offerings.length >= 3, `${p.id}: needs >=3 offerings`)
  assert.ok(p.pitch.length > 30 && p.pitchNoun && p.orderPhrase && p.askFirst, `${p.id}: missing pitch wording`)
  assert.ok(p.vocab.flags.includes('g') && p.vocabMin >= 1, `${p.id}: vocab must be global`)
  assert.ok(p.chains.length >= 5, `${p.id}: chains`)
  // classifier returns the type or off-industry, and never throws on empty text
  assert.equal(p.classify('', ''), OFF_INDUSTRY)
}
assert.ok(INDUSTRY_LIST.length >= 30, `expected 30+ industries, got ${INDUSTRY_LIST.length}`)
assert.equal(INDUSTRY_GROUPS.reduce((n, g) => n + g.items.length, 0), INDUSTRY_LIST.length)
assert.equal(getIndustry('nope').id, DEFAULT_INDUSTRY, 'unknown id falls back to auto parts')
assert.equal(getIndustry(undefined).id, DEFAULT_INDUSTRY)

// an HVAC company scanned under the HVAC profile
const hvac = getIndustry('hvac')
const hvacPage = [{ url: 'https://coolair.com/', html: `<html><head><title>Cool Air HVAC | Air Conditioning Repair</title><meta name="viewport" content="width=device-width"></head><body>
<h1>Air conditioning and heating experts</h1><p>Family owned HVAC contractor offering AC repair, furnace installation, heat pump service and commercial duct cleaning. Book a service call today — 24/7 emergency service. Licensed and insured. Free estimate on every install.</p>
<div><h3>Tony Ricci</h3><p>Owner</p></div><p>Call (561) 555-0188 or <a href="mailto:tony@coolair.com">email us</a>.</p>${'x'.repeat(120)}</body></html>` }]
const hv = analyzeSite(mk({ name: 'Cool Air HVAC' }), hvacPage, 'OK', hvac)
assert.equal(hv.industry, 'hvac')
assert.equal(hv.businessType, 'HVAC contractor')
assert.equal(hv.ownerName, 'Tony Ricci')
assert.match(hv.partsOffered, /AC repair/)
assert.match(hv.partsOffered, /Installation/)
assert.match(hv.keyClaims, /24\/7/)
assert.match(hv.keyClaims, /Licensed & insured/)
assert.equal(hv.quoteOnly, 'Yes', '"free estimate" counts as quote-driven')
assert.ok(hv.leadScore >= 40, `on-industry HVAC should score, got ${hv.leadScore}`)

// the SAME page under the auto-parts profile is off-industry and capped
const hvAsAuto = analyzeSite(mk({ name: 'Cool Air HVAC' }), hvacPage)
assert.equal(hvAsAuto.businessType, OFF_INDUSTRY)
assert.ok(hvAsAuto.leadScore <= 12)
// and an auto-parts page under HVAC is off-industry too
const autoAsHvac = analyzeSite(mk({}), page(autoText), 'OK', hvac)
assert.equal(autoAsHvac.businessType, OFF_INDUSTRY)

// industry-specific chains
const orkin = analyzeSite(mk({ name: 'Orkin Pest Control' }), [{ url: 'https://orkin.com/', html: `<html><body><p>Pest control termite exterminator rodent mosquito service. Schedule a treatment.</p>${'x'.repeat(120)}</body></html>` }], 'OK', getIndustry('pest-control'))
assert.equal(orkin.franchiseStatus, 'Chain')
assert.ok(orkin.leadScore <= 30)
// global retailers are chains in every industry
assert.equal(analyzeSite(mk({ name: 'Home Depot Tool Rental' }), page(autoText), 'OK', getIndustry('equipment-rental')).franchiseStatus, 'Chain')

// scripts speak the selected industry's language, and still match auto parts exactly
const hvPlan = callPlan({ ...mk({}), ...hv }, 'Sam')
assert.match(hvPlan.opener, /I help HVAC companies like/)
assert.match(hvPlan.emailBody, /when they book a service call/)
assert.match(hvPlan.questions[0], /book a service call|collect payment/)
assert.ok(hvPlan.why.length >= 1)
assert.match(callPlan({ ...base, ...intel }, 'Sam').opener, /I help parts businesses like Sunshine/)
assert.match(callPlan({ ...base, ...intel }, 'Sam').questions[0], /asks for a part/)
// old saved leads (no industry field) still work as auto parts
const legacy = { ...base, ...intel } as unknown as Record<string, unknown>; delete legacy.industry
assert.match(callPlan(legacy as never, 'Sam').opener, /parts businesses/)

// ── SSRF guard ────────────────────────────────────────────────────────────
for (const bad of ['http://localhost/x', 'http://127.0.0.1', 'http://10.0.0.5', 'http://192.168.1.1', 'http://169.254.169.254/latest', 'file:///etc/passwd', 'http://172.20.0.1', 'http://[::1]/'])
  assert.equal(isPublicHttpUrl(bad), false, bad)
assert.equal(isPublicHttpUrl('https://example-parts.com/contact'), true)

console.log('\nAll tests passed ✔')

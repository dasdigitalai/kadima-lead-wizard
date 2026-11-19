# 🔩 PartsLocatorRadar

Find **used-auto-parts locator businesses** (companies that find parts across a network of
salvage/scrap yards and ship them to the customer), profile each one's website and
decision-makers, and flag **payment-processing opportunities**. Exports a Zoho CRM-ready CSV.

Built from the RestaurantRadar app; same shape (Google Places → website scan → CSV), new target.

## What you get per business

| | |
|---|---|
| **Contact** | owner, primary contact + title, best email (person-matched when possible), all emails, phones (fax/ID numbers excluded) |
| **Website overview** | what they say they do, parts they sell, vehicle focus, claims (nationwide shipping, warranty, yard-network size…) |
| **Business type** | Parts Locator · Salvage Yard / Recycler · Locator + Yard · Not auto parts |
| **Franchise / chain?** | known-chain list, franchise language on the site, "independently owned and operated" wording |
| **Multiple locations?** | "N locations/yards" claims, distinct addresses on the site, a Locations page, repeat Google listings across your run |
| **Payments angle** | processors seen on the site (Stripe, PayPal, Square, Authorize.Net…), online checkout vs quote/phone-driven, pay-online page, ships nationwide, sells to shops/dealers, financing |
| **Lead score 0–100** | heuristic + the plain-English reasons (pitch notes). Franchises/chains are capped at 30 — the buying decision is usually corporate |

Click any row in the results table for the full detail.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # extraction tests (no network)
```

You need a **Google Places API key** (Places API (New) + Geocoding API enabled). Paste it in the
page; it is sent in a POST body to your own server routes and never stored.
Deploys to Vercel as-is (routes stay under the 60 s function limit by batching).

### Two ways in
1. **Find new businesses** – pick a state preset (FL, GA, AL, SC, NC, TN, TX) or paste your own
   cities (one per line). Locators ship nationwide, so sweep markets rather than one radius.
   Results are de-duplicated across markets by Google place ID.
   Edit `STATE_MARKETS` in `src/lib/types.ts` to add states/cities.
2. **Scan a CSV** – any CSV with a `Company`/`Name` and `Website` column. No Google calls.

### Exports
- **Zoho Leads CSV** – Company, First/Last Name, Designation, Email, Phone, Website, address,
  Lead Source, Industry, Description (overview, processors, pitch notes). Leads with no contact
  name get Last Name `Unknown` (Zoho requires one). `Industry` is set to `Other` — change
  `ZOHO_INDUSTRY` in `src/lib/csv.ts` to a value in your Zoho picklist.
- **Full intel CSV** – every field above.

## Honest limitations
- **Web-only locators with no Google listing won't be found** by Places. Cover more markets,
  use "broad" mode, or feed a list into the CSV tab (e.g. from directories/Car-Part.com membership).
- **Sites behind bot protection** (Cloudflare etc.) return 403/503; they're reported as
  `Blocked by site (HTTP …)` so you can look them up by hand.
- Owner/contact extraction is heuristic (pattern matching on About/Team/Contact pages). Expect
  misses and the occasional wrong name — verify before outreach. Emails are only what's published.
- Franchise/chain detection is a known-name list plus site language; it will miss unlisted chains.
  Add to `CHAIN_NAMES` as you spot them.
- Lead score is a starting heuristic — tune `scorePitch` in `src/lib/intel.ts` to your real buyer profile.
- Respect each site's terms and applicable outreach laws (CAN-SPAM, TCPA, state do-not-call).

## Layout
```
src/lib/html.ts      HTML → text, meta, links, JSON-LD
src/lib/contacts.ts  people, emails (incl. Cloudflare-obfuscated), phones
src/lib/signals.ts   parts, claims, payments, business type, franchise/locations
src/lib/intel.ts     combine pages → one lead record + score
src/lib/crawl.ts     fetch home + contact/about/team/locations pages (SSRF-guarded)
src/lib/group.ts     same-name Google listings → multi-location signal
src/app/api/search   Google Places sweep (SSE)      src/app/api/enrich  website scan (batched)
```

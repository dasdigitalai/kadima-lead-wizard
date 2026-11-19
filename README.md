# 🧭 Lead Wizard

Pick an **industry** from the dropdown, find the businesses in it, profile each one's website and
decision-makers, and flag **payment-processing opportunities**. Includes a one-lead-at-a-time call queue
and CSV export. Started as RestaurantRadar; same shape (Google Places → website scan → CSV).

## Industries (dropdown)

40 B2B industries in 5 groups — each is a profile with its own search terms, chain/franchise list,
"does this site belong to the industry?" vocabulary, what-they-offer categories, and call-script wording:

- **Automotive & transportation** – used auto parts locators (the original), collision/body shops, heavy-duty truck & trailer repair, towing, trucking, couriers, movers
- **Trades & contractors** – HVAC, plumbing, electrical, roofing, fire & security, pest control, landscaping, commercial cleaning, equipment rental
- **Supply & distribution** – industrial/MRO, welding & gas, packaging, janitorial, restaurant equipment, medical/dental, electrical supply, plumbing/HVAC supply, building materials, office furniture, safety/PPE, fasteners, food & beverage wholesale, pallets, scrap metal, general wholesale
- **Manufacturing & industrial services** – machine shops, industrial equipment, printing & signs, promo products, marine, agricultural
- **Business services** – staffing, managed IT

A site that doesn't read as the selected industry is marked **Off-industry** and its score is capped, so
picking the wrong industry shows up immediately instead of producing confident-looking junk.

### Adding an industry
Copy any `ind(...)` entry in `src/lib/industries.ts` and edit it (search terms, vocabulary words,
offerings, chains, pitch wording). Nothing else changes — the dropdown, search, scoring and scripts all read the profile.
The `npm test` suite checks every profile is complete.

## What you get per business

| | |
|---|---|
| **Contact** | owner, primary contact + title, best email (person-matched when possible), all emails, phones (fax/ID numbers excluded) |
| **Website overview** | what they say they do, what they offer, focus, claims (nationwide shipping, warranty, 24/7, licensed & insured…) |
| **Business type** | the industry's label (auto parts also distinguishes Locator / Yard / Both) · Off-industry |
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
1. **Find new businesses** – choose an industry, then pick a state preset (FL, GA, AL, SC, NC, TN, TX) or paste your own
   cities (one per line). Sweep several markets rather than one radius.
   Results are de-duplicated across markets by Google place ID.
   Edit `STATE_MARKETS` in `src/lib/types.ts` to add states/cities.
2. **Scan a CSV** – any CSV with a `Company`/`Name` and `Website` column. No Google calls.

### Exports
- **Contacts CSV** – Company, First/Last Name, Job Title, Email, Phone, Website, address, score, notes.
  Opens in Excel/Google Sheets and imports into any CRM.
- **Call log CSV** – everything the agent logged in the Work screen (date, outcome, contact, note).
- **Full intel CSV** – every field above.

## Hand-off setup (for whoever deploys it)

The sales agent should never see an API key or a terminal. One-time setup:

1. Create an empty GitHub repo, push this code, and import it into **Vercel** (free tier is fine).
2. In Vercel → Settings → Environment Variables, add:
   - `GOOGLE_PLACES_API_KEY` — your key (Places API (New) + Geocoding API enabled). Restrict it to those two APIs in Google Cloud and set a daily quota/budget alert.
   - `ACCESS_CODE` — any shared password. The app asks for it once per browser; without it nobody with the link can use your key.
3. Send the agent the Vercel URL, the access code, and **`AGENT_QUICKSTART.md`**.

With the key set on the server, the key field disappears from the page and "Find new businesses" is one click.
Everything the agent does is saved in their own browser (not shared between people).

## Honest limitations
- **Businesses with no Google listing won't be found** by Places. Cover more markets,
  use "broad" mode, or feed a list into the CSV tab.
- **Sites behind bot protection** (Cloudflare etc.) return 403/503; they're reported as
  `Blocked by site (HTTP …)` so you can look them up by hand.
- Owner/contact extraction is heuristic (pattern matching on About/Team/Contact pages). Expect
  misses and the occasional wrong name — verify before outreach. Emails are only what's published.
- Franchise/chain detection is a known-name list plus site language; it will miss unlisted chains.
  Add to `CHAIN_NAMES` as you spot them.
- Lead score is a starting heuristic — tune `scorePitch` in `src/lib/intel.ts` to your real buyer profile. The non-auto industry profiles are first drafts; check a few results per industry and tune their vocabulary/chain lists.
- Respect each site's terms and applicable outreach laws (CAN-SPAM, TCPA, state do-not-call).

## Layout
```
src/lib/html.ts      HTML → text, meta, links, JSON-LD
src/lib/contacts.ts  people, emails (incl. Cloudflare-obfuscated), phones
src/lib/industries.ts  the industry profiles (edit/add here)
src/lib/auto.ts      auto-parts-specific detection (the original profile)
src/lib/signals.ts   generic claims, payments, franchise/locations, tech
src/lib/intel.ts     combine pages → one lead record + score
src/lib/crawl.ts     fetch home + contact/about/team/locations pages (SSRF-guarded)
src/lib/group.ts     same-name Google listings → multi-location signal
src/app/api/search   Google Places sweep (SSE)      src/app/api/enrich  website scan (batched)
```

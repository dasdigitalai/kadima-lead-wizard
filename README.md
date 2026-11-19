# 🔩 PartsLocatorRadar

Find **used-auto-parts locator businesses** (companies that find parts across a network of
salvage/scrap yards and ship them to the customer), profile each one's website and
decision-makers, and flag **payment-processing opportunities**. Includes a one-lead-at-a-time call queue and CSV export.

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

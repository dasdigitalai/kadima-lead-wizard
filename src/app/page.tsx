'use client'

import { Fragment, useMemo, useRef, useState } from 'react'
import { STATE_MARKETS, type BaseLead, type Lead, type SearchMode } from '@/lib/types'
import { parseCSV, toFullCSV, toZohoLeadsCSV } from '@/lib/csv'
import { markSameNameListings } from '@/lib/group'

const C = { bg: '#0f1117', card: '#1e2433', line: '#2d3748', mute: '#64748b', text: '#e2e8f0', blue: '#3b82f6', green: '#22c55e', amber: '#f59e0b', red: '#ef4444' }
const input = { background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: '8px 12px', color: C.text, fontSize: 14, outline: 'none', width: '100%' } as const
const label = { fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 } as const
const card = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: '1.5rem', marginBottom: '1.5rem' } as const
const btn = (primary: boolean, disabled = false) => ({
  background: primary ? (disabled ? C.card : C.blue) : C.bg, color: primary ? (disabled ? C.mute : '#fff') : C.green,
  border: primary ? (disabled ? `1px solid ${C.line}` : 'none') : `1px solid ${C.green}44`,
  borderRadius: 8, padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
}) as const

function Badge({ text, color = '#94a3b8' }: { text: string; color?: string }) {
  return <span style={{ background: color + '22', color, border: `1px solid ${color}44`, borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{text}</span>
}
const scoreColor = (n: number) => (n >= 70 ? C.green : n >= 40 ? C.amber : C.mute)

async function readSSE(res: Response, onEvent: (ev: Record<string, unknown>) => void) {
  if (!res.body) return
  const reader = res.body.getReader(), dec = new TextDecoder()
  let buf = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const parts = buf.split('\n\n'); buf = parts.pop() || ''
    for (const part of parts) {
      const line = part.replace(/^data: /, '').trim()
      if (line) { try { onEvent(JSON.parse(line)) } catch { /* partial frame */ } }
    }
  }
}

async function enrichAll(base: BaseLead[], onProgress: (leads: Lead[], done: number) => void) {
  const out: Lead[] = []
  const BATCH = 10
  for (let i = 0; i < base.length; i += BATCH) {
    try {
      const res = await fetch('/api/enrich', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leads: base.slice(i, i + BATCH) }) })
      const data = await res.json()
      out.push(...(data.leads || []))
    } catch { /* skip failed batch; user can re-run */ }
    onProgress([...out], Math.min(i + BATCH, base.length))
  }
  return out
}

function download(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url)
}

// ── Results ────────────────────────────────────────────────────────────────
function Stats({ rows }: { rows: Lead[] }) {
  const n = (f: (r: Lead) => boolean) => rows.filter(f).length
  const stats = [
    ['Total', rows.length], ['Hot (70+)', n(r => r.leadScore >= 70)], ['Parts locators', n(r => r.businessType.includes('Locator'))],
    ['Owner found', n(r => !!r.ownerName)], ['Email found', n(r => !!r.primaryContactEmail)], ['No processor seen', n(r => !r.paymentProcessors && r.websiteStatus === 'OK')],
    ['Franchise / chain', n(r => r.franchiseStatus === 'Franchise' || r.franchiseStatus === 'Chain')], ['Multi-location', n(r => r.multiLocation === 'Yes')],
    ['Quote/phone-driven', n(r => r.quoteOnly === 'Yes')], ['Ships nationwide', n(r => r.shipsNationwide === 'Yes')], ['No website', n(r => r.websiteStatus !== 'OK')],
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: '1.5rem' }}>
      {stats.map(([l, v]) => (
        <div key={l} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: '0.8rem 1rem' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9' }}>{v}</div>
          <div style={{ fontSize: 12, color: C.mute }}>{l}</div>
        </div>
      ))}
    </div>
  )
}

function Detail({ r }: { r: Lead }) {
  const row = (k: string, v: string) => v ? <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}><span style={{ color: C.mute, minWidth: 130 }}>{k}</span><span style={{ color: '#cbd5e1', wordBreak: 'break-word' }}>{v}</span></div> : null
  return (
    <div style={{ padding: '14px 18px', fontSize: 13, lineHeight: 1.5, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '8px 28px' }}>
      <div>
        <div style={{ color: '#f1f5f9', fontWeight: 700, marginBottom: 6 }}>Website overview</div>
        <div style={{ color: '#cbd5e1', marginBottom: 8 }}>{r.overview || '—'}</div>
        {row('Parts', r.partsOffered)}{row('Vehicles', r.vehicleFocus)}{row('Claims', r.keyClaims)}{row('Marketplaces', r.marketplaces)}
        {row('Ownership', r.franchiseStatus)}{row('Locations', r.multiLocation === 'Yes' ? r.locationCount : r.multiLocation === 'No' ? '1 (no sign of others)' : '')}{row('Ownership evidence', r.franchiseEvidence)}
        {row('Page title', r.pageTitle)}{row('Tech', [r.websiteTech, r.websiteModern].filter(Boolean).join(' · '))}
      </div>
      <div>
        <div style={{ color: '#f1f5f9', fontWeight: 700, marginBottom: 6 }}>Contacts</div>
        {row('Owner', r.ownerName)}{row('Primary', [r.primaryContactName, r.primaryContactTitle && `(${r.primaryContactTitle})`].filter(Boolean).join(' '))}
        {row('Other people', r.otherContacts)}{row('Emails', r.allEmails)}{row('Phones', r.allPhones)}
        {row('Facebook', r.facebookUrl)}{row('Instagram', r.instagramUrl)}{row('LinkedIn', r.linkedinUrl)}
        {row('Address', [r.street, r.city, r.state, r.zip].filter(Boolean).join(', '))}
      </div>
      <div>
        <div style={{ color: '#f1f5f9', fontWeight: 700, marginBottom: 6 }}>Payment-processing angle</div>
        {row('Processors on site', r.paymentProcessors || 'none detected')}{row('E-commerce', r.ecommercePlatform)}{row('Online checkout', r.onlineCheckout)}
        {row('Quote/phone-driven', r.quoteOnly)}{row('Pay-online page', r.payOnlineLink)}{row('Cards stated', r.acceptsCards)}{row('Financing', r.financing)}
        <div style={{ color: '#94a3b8', marginTop: 6 }}>{r.pitchNotes || '—'}</div>
      </div>
    </div>
  )
}

function Results({ rows }: { rows: Lead[] }) {
  const [open, setOpen] = useState<string>('')
  const [hideChains, setHideChains] = useState(false)
  const [onlyIndependent, setOnlyIndependent] = useState(false)
  const isChain = (r: Lead) => r.franchiseStatus === 'Franchise' || r.franchiseStatus === 'Chain'
  const sorted = useMemo(() => rows
    .filter(r => !(hideChains && isChain(r)) && !(onlyIndependent && (isChain(r) || r.multiLocation === 'Yes')))
    .sort((a, b) => b.leadScore - a.leadScore), [rows, hideChains, onlyIndependent])
  const th = { padding: '10px 14px', textAlign: 'left', color: '#94a3b8', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8, whiteSpace: 'nowrap' } as const
  const td = { padding: '8px 14px', color: '#cbd5e1', verticalAlign: 'top' } as const
  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 18, padding: '10px 14px', borderBottom: `1px solid ${C.line}`, fontSize: 13, color: '#94a3b8', flexWrap: 'wrap' }}>
        <label style={{ cursor: 'pointer' }}><input type="checkbox" checked={hideChains} onChange={e => setHideChains(e.target.checked)} /> Hide franchises &amp; chains</label>
        <label style={{ cursor: 'pointer' }}><input type="checkbox" checked={onlyIndependent} onChange={e => setOnlyIndependent(e.target.checked)} /> Single-location independents only</label>
        <span style={{ marginLeft: 'auto', color: C.mute }}>Showing {sorted.length} of {rows.length}</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead><tr style={{ background: C.bg, borderBottom: `1px solid ${C.line}` }}>
            {['Score', 'Company', 'Type', 'Contact', 'Email', 'Phone', 'Payments', 'Overview'].map(h => <th key={h} style={th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {sorted.map((r, i) => {
              const key = r.placeId || r.website || String(i)
              const contact = r.ownerName ? `${r.ownerName} (Owner)` : r.primaryContactName ? `${r.primaryContactName}${r.primaryContactTitle ? ` (${r.primaryContactTitle})` : ''}` : ''
              return (
                <Fragment key={key}>
                  <tr onClick={() => setOpen(open === key ? '' : key)} style={{ cursor: 'pointer', borderBottom: `1px solid #1e2a3a`, background: i % 2 ? '#161d2e' : 'transparent' }}>
                    <td style={td}><Badge text={String(r.leadScore)} color={scoreColor(r.leadScore)} /></td>
                    <td style={{ ...td, color: '#f1f5f9', fontWeight: 600, minWidth: 180 }}>
                      {r.website ? <a href={r.website.startsWith('http') ? r.website : `https://${r.website}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ color: '#60a5fa', textDecoration: 'none' }}>{r.name}</a> : r.name}
                      <div style={{ color: C.mute, fontSize: 12, fontWeight: 400 }}>{[r.city, r.state].filter(Boolean).join(', ')}{r.websiteStatus !== 'OK' ? ` · ${r.websiteStatus}` : ''}</div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                        {(r.franchiseStatus === 'Franchise' || r.franchiseStatus === 'Chain') && <Badge text={r.franchiseStatus} color={C.red} />}
                        {r.franchiseStatus === 'Part of a group' && <Badge text="Group" color={C.amber} />}
                        {r.multiLocation === 'Yes' && <Badge text={`${r.locationCount} locations`} color={C.amber} />}
                      </div>
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{r.businessType === 'Unclear' ? <span style={{ color: C.mute }}>—</span> : <Badge text={r.businessType} color={r.businessType.includes('Locator') ? C.blue : '#94a3b8'} />}</td>
                    <td style={{ ...td, minWidth: 160 }}>{contact || <span style={{ color: '#475569' }}>—</span>}</td>
                    <td style={td}>{r.primaryContactEmail || <span style={{ color: '#475569' }}>—</span>}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{(r.phone || r.allPhones.split(';')[0] || '—')}</td>
                    <td style={{ ...td, minWidth: 150 }}>
                      {r.paymentProcessors ? <Badge text={r.paymentProcessors} color={C.amber} /> : r.websiteStatus === 'OK' ? <Badge text="none seen" color={C.green} /> : '—'}
                      <div style={{ color: C.mute, fontSize: 12, marginTop: 3 }}>{[r.onlineCheckout === 'Yes' && 'checkout', r.quoteOnly && 'quote-driven', r.shipsNationwide && 'ships'].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td style={{ ...td, color: '#94a3b8', fontSize: 12, minWidth: 320, maxWidth: 460, lineHeight: 1.5 }}>{r.overview.length > 220 ? r.overview.slice(0, 220) + '…' : r.overview || '—'}</td>
                  </tr>
                  {open === key && <tr><td colSpan={8} style={{ background: '#121826', borderBottom: `1px solid ${C.line}` }}><Detail r={r} /></td></tr>}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ padding: '8px 14px', color: C.mute, fontSize: 12 }}>Click a row for the full website overview, contacts and pitch notes.</div>
    </div>
  )
}

function Progress({ message, done, total, logs, logRef }: { message: string; done: number; total: number; logs: string[]; logRef: React.RefObject<HTMLDivElement> }) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0
  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}><span style={{ color: '#94a3b8' }}>{message}</span><span style={{ color: C.mute }}>{done} / {total}</span></div>
      <div style={{ background: C.bg, borderRadius: 4, height: 4, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: C.blue, transition: 'width .3s' }} /></div>
      <div ref={logRef} style={{ marginTop: 12, maxHeight: 130, overflowY: 'auto', fontFamily: 'monospace', fontSize: 12, color: '#475569' }}>{logs.map((l, i) => <div key={i}>{l}</div>)}</div>
    </div>
  )
}

function Downloads({ rows }: { rows: Lead[] }) {
  if (!rows.length) return null
  return (
    <>
      <button onClick={() => download('parts_locators_zoho_leads.csv', toZohoLeadsCSV(rows))} style={btn(false)}>⬇️ Zoho Leads CSV ({rows.length})</button>
      <button onClick={() => download('parts_locators_full_intel.csv', toFullCSV(rows))} style={btn(false)}>⬇️ Full intel CSV</button>
    </>
  )
}

function useRun() {
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState('')
  const [done, setDone] = useState(0)
  const [total, setTotal] = useState(0)
  const [logs, setLogs] = useState<string[]>([])
  const [rows, setRows] = useState<Lead[]>([])
  const logRef = useRef<HTMLDivElement>(null)
  const log = (m: string) => { setMessage(m); setLogs(p => [...p, m]); setTimeout(() => logRef.current?.scrollTo(0, 1e9), 40) }
  return { running, setRunning, message, done, setDone, total, setTotal, logs, setLogs, rows, setRows, log, logRef }
}

// ── Tab 1: Find ────────────────────────────────────────────────────────────
function FindTab() {
  const [apiKey, setApiKey] = useState('')
  const [locations, setLocations] = useState(STATE_MARKETS.FL.join('\n'))
  const [radius, setRadius] = useState(25)
  const [target, setTarget] = useState(60)
  const [mode, setMode] = useState<SearchMode>('locators')
  const s = useRun()

  const run = async () => {
    const locs = locations.split('\n').map(l => l.trim()).filter(Boolean)
    if (!apiKey || !locs.length) return alert('Enter your Google Places API key and at least one location.')
    s.setRunning(true); s.setRows([]); s.setLogs([]); s.setDone(0); s.setTotal(target)
    const collected: BaseLead[] = []
    for (const loc of locs) {
      if (collected.length >= target) break
      s.log(`Searching ${loc}…`)
      try {
        const res = await fetch('/api/search', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey, location: loc, radius, target: target - collected.length, mode, excludeIds: collected.map(b => b.placeId) }),
        })
        await readSSE(res, ev => {
          if (ev.message) s.log(String(ev.message))
          if (ev.phase === 'collected' && Array.isArray(ev.leads)) collected.push(...(ev.leads as BaseLead[]))
        })
      } catch (e) { s.log(`Search failed for ${loc}: ${String(e)}`) }
    }
    const base = markSameNameListings(collected)
    if (!base.length) { s.log('No candidates found. Try a larger radius, broad mode, or other cities.'); s.setRunning(false); return }
    s.setTotal(base.length); s.log(`Profiling ${base.length} websites…`)
    const out = await enrichAll(base, (leads, d) => { s.setRows(leads); s.setDone(d); s.log(`Profiled ${d}/${base.length}`) })
    s.log(`✅ Done — ${out.length} leads`)
    s.setRunning(false)
  }

  return (
    <>
      <div style={card}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={label}>Google Places API key</label>
            <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="AIza…" style={input} />
            <span style={{ color: C.mute, fontSize: 12 }}>Used only for this run; sent to your own server routes, never stored.</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: 'span 2' }}>
            <label style={label}>Markets to search (one per line)</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ color: C.mute, fontSize: 12 }}>Sweep a state:</span>
              {Object.keys(STATE_MARKETS).map(st => (
                <button key={st} type="button" onClick={() => setLocations(STATE_MARKETS[st].join('\n'))}
                  style={{ background: 'transparent', color: '#60a5fa', border: '1px solid #3b82f660', borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{st}</button>
              ))}
            </div>
            <textarea value={locations} onChange={e => setLocations(e.target.value)} rows={6} style={{ ...input, resize: 'vertical', fontFamily: 'inherit' }} />
            <span style={{ color: C.mute, fontSize: 12 }}>{locations.split('\n').filter(l => l.trim()).length} markets · edit freely, or paste your own cities. Results are de-duplicated across markets.</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={label}>Radius (miles, max 31)</label>
            <input type="number" value={radius} min={1} max={31} onChange={e => setRadius(Number(e.target.value))} style={input} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={label}>Total leads wanted</label>
            <input type="number" value={target} min={5} max={300} onChange={e => setTarget(Number(e.target.value))} style={input} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={label}>Search mode</label>
            <select value={mode} onChange={e => setMode(e.target.value as SearchMode)} style={input}>
              <option value="locators">Parts locators (focused)</option>
              <option value="broad">Locators + yards &amp; recyclers (broad)</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={run} disabled={s.running} style={btn(true, s.running)}>{s.running ? '⏳ Running…' : '🔩 Find parts locators'}</button>
          <Downloads rows={s.rows} />
        </div>
      </div>
      {(s.running || s.logs.length > 0) && <Progress message={s.message} done={s.done} total={s.total} logs={s.logs} logRef={s.logRef} />}
      {s.rows.length > 0 && <><Stats rows={s.rows} /><Results rows={s.rows} /></>}
    </>
  )
}

// ── Tab 2: Upload CSV ──────────────────────────────────────────────────────
function UploadTab() {
  const [fileName, setFileName] = useState('')
  const [drag, setDrag] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const s = useRun()
  const pick = (r: Record<string, string>, ...keys: string[]) => { for (const k of keys) if (r[k]) return r[k]; return '' }

  const process = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) return alert('Please upload a .csv file.')
    setFileName(file.name)
    const rows = parseCSV(await file.text())
    const parsed: BaseLead[] = rows
      .map((r, i) => ({
        name: pick(r, 'Company', 'Account Name', 'Name', 'Business Name'),
        street: pick(r, 'Street', 'Billing Street', 'Address'), city: pick(r, 'City', 'Billing City'),
        state: pick(r, 'State', 'Billing State'), zip: pick(r, 'Zip Code', 'Zip', 'Billing Zip'),
        phone: pick(r, 'Phone'), website: pick(r, 'Website', 'URL', 'Domain'),
        rating: pick(r, 'Rating'), reviews: pick(r, 'Reviews', 'Review Count'), mapsUrl: '', placeId: pick(r, 'Place ID') || `upload-${i}`,
        googleTypes: '', businessStatus: '', googleSummary: '', searchLocation: file.name, sameNameListings: 1,
      }))
      .filter(b => b.name || b.website)
    const base = markSameNameListings(parsed)
    if (!base.length) return alert('No rows with a Company/Name or Website column found.')
    s.setRunning(true); s.setRows([]); s.setLogs([]); s.setDone(0); s.setTotal(base.length); s.log(`Profiling ${base.length} websites…`)
    await enrichAll(base, (leads, d) => { s.setRows(leads); s.setDone(d); s.log(`Profiled ${d}/${base.length}`) })
    s.log('✅ Done'); s.setRunning(false)
  }

  return (
    <>
      <div style={card}>
        <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 14 }}>
          Already have a list? Upload a CSV with a <b>Company</b> (or Name) and <b>Website</b> column. No Google API calls — each site is scanned for owner, email, phone, overview and payment signals.
        </p>
        <div
          onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) process(f) }}
          onClick={() => fileRef.current?.click()}
          style={{ border: `2px dashed ${drag ? C.blue : '#334155'}`, borderRadius: 10, padding: '2rem', textAlign: 'center', cursor: 'pointer', marginBottom: 12, background: drag ? '#1a2744' : 'transparent' }}>
          <div style={{ fontSize: 30 }}>📂</div>
          <div style={{ color: '#94a3b8', fontSize: 14 }}>{fileName ? `✅ ${fileName}` : 'Drop a CSV here or click to browse'}</div>
          <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) process(f) }} />
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><Downloads rows={s.rows} /></div>
      </div>
      {(s.running || s.logs.length > 0) && <Progress message={s.message} done={s.done} total={s.total} logs={s.logs} logRef={s.logRef} />}
      {s.rows.length > 0 && <><Stats rows={s.rows} /><Results rows={s.rows} /></>}
    </>
  )
}

export default function Home() {
  const [tab, setTab] = useState<'find' | 'upload'>('find')
  return (
    <div style={{ maxWidth: 1600, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: '#f1f5f9' }}>🔩 PartsLocatorRadar</h1>
      <p style={{ color: C.mute, margin: '4px 0 20px', fontSize: 14 }}>Find used-parts locator businesses, profile their websites and decision-makers, and spot payment-processing opportunities.</p>
      <div style={{ display: 'flex', gap: 4, marginBottom: '1.5rem', background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {([['find', '🚀 Find new businesses'], ['upload', '🔍 Scan a CSV']] as const).map(([id, l]) => (
          <button key={id} onClick={() => setTab(id)} style={{ background: tab === id ? C.bg : 'transparent', color: tab === id ? '#f1f5f9' : C.mute, border: tab === id ? '1px solid #334155' : '1px solid transparent', borderRadius: 8, padding: '8px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{l}</button>
        ))}
      </div>
      {tab === 'find' ? <FindTab /> : <UploadTab />}
    </div>
  )
}

'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { STATE_MARKETS, type BaseLead, type Lead, type SearchMode } from '@/lib/types'
import { parseCSV, toCallLogCSV, toContactsCSV, toFullCSV } from '@/lib/csv'
import { markSameNameListings } from '@/lib/group'
import { leadKey } from '@/lib/script'
import { DEFAULT_INDUSTRY, INDUSTRY_GROUPS, getIndustry, isOffIndustry, lcFirst } from '@/lib/industries'
import { Badge, C, api, btn, card, input, label, scoreColor, store } from './ui'
import FocusTab, { type Outcome, type StatusMap } from './FocusTab'

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

async function enrichAll(base: BaseLead[], industry: string, onProgress: (leads: Lead[], done: number) => void) {
  const out: Lead[] = []
  const BATCH = 10
  for (let i = 0; i < base.length; i += BATCH) {
    try {
      const res = await api('/api/enrich', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leads: base.slice(i, i + BATCH), industry }) })
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

// ── Industry picker ────────────────────────────────────────────────────────
function IndustryPicker({ value, onChange, disabled }: { value: string; onChange: (id: string) => void; disabled?: boolean }) {
  const p = getIndustry(value)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, gridColumn: '1 / -1' }}>
      <label style={label} htmlFor="industry">Industry</label>
      <select id="industry" value={value} onChange={e => onChange(e.target.value)} disabled={disabled} style={{ ...input, fontSize: 16, padding: '10px 12px' }}>
        {INDUSTRY_GROUPS.map(g => (
          <optgroup key={g.group} label={g.group}>{g.items.map(i => <option key={i.id} value={i.id}>{i.label}</option>)}</optgroup>
        ))}
      </select>
      <span style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.5 }}>💡 <b>Why payment processing fits:</b> {p.pitch}</span>
    </div>
  )
}

// ── Results ────────────────────────────────────────────────────────────────
function Stats({ rows }: { rows: Lead[] }) {
  const n = (f: (r: Lead) => boolean) => rows.filter(f).length
  const stats = [
    ['Total', rows.length], ['Hot (70+)', n(r => r.leadScore >= 70)], ['Look like a fit', n(r => !isOffIndustry(r.businessType) && r.businessType !== 'Unclear' && r.websiteStatus === 'OK')], ['Off-industry', n(r => isOffIndustry(r.businessType))],
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
        {row('Offers', r.partsOffered)}{row('Focus', r.vehicleFocus)}{row('Industry', getIndustry(r.industry).label)}{row('Claims', r.keyClaims)}{row('Marketplaces', r.marketplaces)}
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

function Results({ rows, onRemove, onUndo, undoCount, locked }: { rows: Lead[]; onRemove: (keys: string[]) => void; onUndo: () => void; undoCount: number; locked: boolean }) {
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
        {rows.some(isChain) && <button disabled={locked} onClick={() => { if (window.confirm(`Remove ${rows.filter(isChain).length} franchises/chains from this list?`)) onRemove(rows.filter(isChain).map(r => r.placeId || r.website || r.name)) }} style={{ background: 'none', border: `1px solid ${C.red}55`, color: '#fca5a5', borderRadius: 6, padding: '2px 10px', fontSize: 12, cursor: locked ? 'not-allowed' : 'pointer' }}>🗑 Remove all franchises &amp; chains ({rows.filter(isChain).length})</button>}
        {undoCount > 0 && <button onClick={onUndo} style={{ background: 'none', border: `1px solid ${C.line}`, color: '#60a5fa', borderRadius: 6, padding: '2px 10px', fontSize: 12, cursor: 'pointer' }}>↩ Undo remove ({undoCount})</button>}
        {locked && <span style={{ color: C.mute }}>Wait for the run to finish to remove rows.</span>}
        <span style={{ marginLeft: 'auto', color: C.mute }}>Showing {sorted.length} of {rows.length}</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead><tr style={{ background: C.bg, borderBottom: `1px solid ${C.line}` }}>
            {['', 'Score', 'Company', 'Type', 'Contact', 'Email', 'Phone', 'Payments', 'Overview'].map((h, i) => <th key={i} style={th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {sorted.map((r, i) => {
              const key = r.placeId || r.website || String(i)
              const contact = r.ownerName ? `${r.ownerName} (Owner)` : r.primaryContactName ? `${r.primaryContactName}${r.primaryContactTitle ? ` (${r.primaryContactTitle})` : ''}` : ''
              return (
                <Fragment key={key}>
                  <tr onClick={() => setOpen(open === key ? '' : key)} style={{ cursor: 'pointer', borderBottom: `1px solid #1e2a3a`, background: i % 2 ? '#161d2e' : 'transparent' }}>
                    <td style={{ ...td, padding: '8px 6px 8px 10px', width: 34 }}>
                      <button title="Remove from list" aria-label={`Remove ${r.name}`} disabled={locked} onClick={e => { e.stopPropagation(); onRemove([leadKey(r)]) }}
                        style={{ background: 'transparent', border: `1px solid ${C.line}`, color: '#94a3b8', borderRadius: 6, width: 28, height: 28, cursor: locked ? 'not-allowed' : 'pointer', fontSize: 14, lineHeight: 1 }}>✕</button>
                    </td>
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
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{r.businessType === 'Unclear' ? <span style={{ color: C.mute }}>—</span> : isOffIndustry(r.businessType) ? <Badge text="Off-industry" color={C.red} /> : <Badge text={r.businessType} color={C.blue} />}</td>
                    <td style={{ ...td, minWidth: 160 }}>{contact || <span style={{ color: '#475569' }}>—</span>}</td>
                    <td style={td}>{r.primaryContactEmail || <span style={{ color: '#475569' }}>—</span>}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{(r.phone || r.allPhones.split(';')[0] || '—')}</td>
                    <td style={{ ...td, minWidth: 150 }}>
                      {r.paymentProcessors ? <Badge text={r.paymentProcessors} color={C.amber} /> : r.websiteStatus === 'OK' ? <Badge text="none seen" color={C.green} /> : '—'}
                      <div style={{ color: C.mute, fontSize: 12, marginTop: 3 }}>{[r.onlineCheckout === 'Yes' && 'checkout', r.quoteOnly && 'quote-driven', r.shipsNationwide && 'ships'].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td style={{ ...td, color: '#94a3b8', fontSize: 12, minWidth: 320, maxWidth: 460, lineHeight: 1.5 }}>{r.overview.length > 220 ? r.overview.slice(0, 220) + '…' : r.overview || '—'}</td>
                  </tr>
                  {open === key && <tr><td colSpan={9} style={{ background: '#121826', borderBottom: `1px solid ${C.line}` }}><Detail r={r} /></td></tr>}
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
      <button onClick={() => download('lead_wizard_contacts.csv', toContactsCSV(rows))} style={btn(false)}>⬇️ Contacts CSV ({rows.length})</button>
      <button onClick={() => download('lead_wizard_full_intel.csv', toFullCSV(rows))} style={btn(false)}>⬇️ Full intel CSV</button>
    </>
  )
}

function useRun(onRows?: (r: Lead[]) => void, onRemoved?: (keys: string[]) => void, onRestored?: (rows: Lead[]) => void) {
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState('')
  const [done, setDone] = useState(0)
  const [total, setTotal] = useState(0)
  const [logs, setLogs] = useState<string[]>([])
  const [rows, setRowsState] = useState<Lead[]>([])
  const [removed, setRemoved] = useState<Lead[][]>([])        // stack of removal batches, for Undo
  const setRows = (r: Lead[]) => { setRowsState(r); if (r.length) onRows?.(r) }
  const removeRows = (keys: string[]) => {
    const gone = rows.filter(r => keys.includes(leadKey(r)))
    if (!gone.length) return
    setRowsState(rows.filter(r => !keys.includes(leadKey(r))))
    setRemoved(st => [...st, gone]); onRemoved?.(keys)
  }
  const undoRemove = () => {
    const last = removed[removed.length - 1]
    if (!last) return
    setRemoved(st => st.slice(0, -1)); setRowsState([...rows, ...last]); onRestored?.(last)
  }
  const logRef = useRef<HTMLDivElement>(null)
  const log = (m: string) => { setMessage(m); setLogs(p => [...p, m]); setTimeout(() => logRef.current?.scrollTo(0, 1e9), 40) }
  return { removeRows, undoRemove, undoCount: removed.reduce((n, b) => n + b.length, 0), running, setRunning, message, done, setDone, total, setTotal, logs, setLogs, rows, setRows, log, logRef }
}

// ── Tab 1: Find ────────────────────────────────────────────────────────────
function FindTab({ onLeads, onRemoved, onRestored, serverKey, industry, setIndustry }: { onLeads: (r: Lead[]) => void; onRemoved: (k: string[]) => void; onRestored: (r: Lead[]) => void; serverKey: boolean; industry: string; setIndustry: (id: string) => void }) {
  const [apiKey, setApiKey] = useState('')
  const [locations, setLocations] = useState(STATE_MARKETS.FL.join('\n'))
  const [radius, setRadius] = useState(25)
  const [target, setTarget] = useState(60)
  const [mode, setMode] = useState<SearchMode>('focused')
  const s = useRun(onLeads, onRemoved, onRestored)

  const run = async () => {
    const locs = locations.split('\n').map(l => l.trim()).filter(Boolean)
    if ((!apiKey && !serverKey) || !locs.length) return alert(serverKey ? 'Add at least one market.' : 'Enter your Google Places API key and at least one market.')
    s.setRunning(true); s.setRows([]); s.setLogs([]); s.setDone(0); s.setTotal(target)
    const collected: BaseLead[] = []
    for (const loc of locs) {
      if (collected.length >= target) break
      s.log(`Searching ${loc}…`)
      try {
        const res = await api('/api/search', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: serverKey ? '' : apiKey, location: loc, radius, target: target - collected.length, mode, industry, excludeIds: collected.map(b => b.placeId) }),
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
    const out = await enrichAll(base, industry, (leads, d) => { s.setRows(leads); s.setDone(d); s.log(`Profiled ${d}/${base.length}`) })
    s.log(`✅ Done — ${out.length} leads`)
    s.setRunning(false)
  }

  return (
    <>
      <div style={card}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 16 }}>
          <IndustryPicker value={industry} onChange={setIndustry} disabled={s.running} />
          {!serverKey && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={label}>Google Places API key</label>
            <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="AIza…" style={input} />
            <span style={{ color: C.mute, fontSize: 12 }}>Used only for this run; sent to your own server routes, never stored.</span>
          </div>
          )}
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
              <option value="focused">Focused — closest matches</option>
              <option value="broad">Broad — adds related searches</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={run} disabled={s.running} style={btn(true, s.running)}>{s.running ? '⏳ Running…' : `🔎 Find ${lcFirst(getIndustry(industry).label)}`}</button>
          <Downloads rows={s.rows} />
        </div>
      </div>
      {(s.running || s.logs.length > 0) && <Progress message={s.message} done={s.done} total={s.total} logs={s.logs} logRef={s.logRef} />}
      {s.rows.length > 0 && <><Stats rows={s.rows} /><Results rows={s.rows} onRemove={s.removeRows} onUndo={s.undoRemove} undoCount={s.undoCount} locked={s.running} /></>}
    </>
  )
}

// ── Tab 2: Upload CSV ──────────────────────────────────────────────────────
function UploadTab({ onLeads, onRemoved, onRestored, industry, setIndustry }: { onLeads: (r: Lead[]) => void; onRemoved: (k: string[]) => void; onRestored: (r: Lead[]) => void; industry: string; setIndustry: (id: string) => void }) {
  const [fileName, setFileName] = useState('')
  const [drag, setDrag] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const s = useRun(onLeads, onRemoved, onRestored)
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
    await enrichAll(base, industry, (leads, d) => { s.setRows(leads); s.setDone(d); s.log(`Profiled ${d}/${base.length}`) })
    s.log('✅ Done'); s.setRunning(false)
  }

  return (
    <>
      <div style={card}>
        <div style={{ display: 'grid', marginBottom: 14 }}><IndustryPicker value={industry} onChange={setIndustry} disabled={s.running} /></div>
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
      {s.rows.length > 0 && <><Stats rows={s.rows} /><Results rows={s.rows} onRemove={s.removeRows} onUndo={s.undoRemove} undoCount={s.undoCount} locked={s.running} /></>}
    </>
  )
}

export default function Home() {
  const [tab, setTab] = useState<'work' | 'find' | 'upload'>('find')
  const [ready, setReady] = useState(false)
  const [leads, setLeads] = useState<Lead[]>([])
  const [status, setStatus] = useState<StatusMap>({})
  const [history, setHistory] = useState<string[]>([])   // keys in the order they were logged, for Undo
  const [agentName, setAgentName] = useState('')
  const [serverKey, setServerKey] = useState(false)
  const [industry, setIndustryState] = useState(DEFAULT_INDUSTRY)
  const setIndustry = (id: string) => { setIndustryState(id); store.set('plr.industry', id) }

  // load saved work once, and learn whether the server holds the Google key / needs an access code
  useEffect(() => {
    const saved = store.get<Lead[]>('plr.leads', [])
    const st = store.get<StatusMap>('plr.status', {})
    setLeads(saved); setStatus(st); setHistory(store.get<string[]>('plr.history', []))
    setAgentName(store.get<string>('plr.name', ''))
    setIndustryState(getIndustry(store.get<string>('plr.industry', DEFAULT_INDUSTRY)).id)
    setTab(saved.length ? 'work' : 'find')
    setReady(true)
    ;(async () => {
      try {
        let cfg = await (await api('/api/config')).json()
        if (cfg.needsAccessCode && !cfg.authorized) {
          const code = window.prompt('Enter the team access code:')
          if (code) { store.set('plr.code', code.trim()); cfg = await (await api('/api/config')).json() }
        }
        setServerKey(!!cfg.serverKey)
      } catch { /* offline: fall back to pasting a key */ }
    })()
  }, [])

  useEffect(() => { if (ready) store.set('plr.leads', leads) }, [leads, ready])
  useEffect(() => { if (ready) { store.set('plr.status', status); store.set('plr.history', history) } }, [status, history, ready])
  useEffect(() => { if (ready) store.set('plr.name', agentName) }, [agentName, ready])

  // merge new results into the saved queue (never wipes what's already been worked)
  const addLeads = (rows: Lead[]) => setLeads(prev => {
    const map = new Map(prev.map(l => [leadKey(l), l]))
    for (const r of rows) map.set(leadKey(r), r)
    return [...map.values()]
  })
  // Removing from a results table also removes from the saved queue — unless a call was already logged on it
  const removeLeads = (keys: string[]) => setLeads(prev => prev.filter(l => !keys.includes(leadKey(l)) || !!status[leadKey(l)]))
  const log = (key: string, s: Outcome, note: string) => { setStatus(p => ({ ...p, [key]: { s, at: Date.now(), note } })); setHistory(h => [...h, key]) }
  const undo = () => setHistory(h => {
    const key = h[h.length - 1]
    if (key) setStatus(p => { const n = { ...p }; delete n[key]; return n })
    return h.slice(0, -1)
  })
  const clearAll = () => { setLeads([]); setStatus({}); setHistory([]) }
  const loggedCount = Object.keys(status).length

  const tabs = [['work', `🎯 Work leads${leads.length ? ` (${leads.length})` : ''}`], ['find', '🚀 Find new businesses'], ['upload', '🔍 Scan a CSV']] as const
  return (
    <div style={{ maxWidth: 1600, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: '#f1f5f9' }}>🧭 Lead Wizard</h1>
      <p style={{ color: C.mute, margin: '4px 0 20px', fontSize: 14 }}>Pick an industry, find the businesses, see who to call and what to say, and spot payment-processing opportunities.</p>
      <div style={{ display: 'flex', gap: 4, marginBottom: '1.5rem', background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: 4, width: 'fit-content', flexWrap: 'wrap' }}>
        {tabs.map(([id, l]) => (
          <button key={id} onClick={() => setTab(id)} style={{ background: tab === id ? C.bg : 'transparent', color: tab === id ? '#f1f5f9' : C.mute, border: tab === id ? '1px solid #334155' : '1px solid transparent', borderRadius: 8, padding: '8px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{l}</button>
        ))}
      </div>
      {tab === 'work' && (
        <>
          <FocusTab leads={leads} status={status} onLog={log} onUndo={undo} onClear={clearAll} agentName={agentName} setAgentName={setAgentName} goFind={() => setTab('find')} />
          {(leads.length > 0 || loggedCount > 0) && (
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
              {loggedCount > 0 && <button onClick={() => download('my_call_log.csv', toCallLogCSV(leads, status, leadKey))} style={btn(false)}>⬇️ Download my call log ({loggedCount})</button>}
              {leads.some(l => status[leadKey(l)]?.s !== 'notfit') && <button onClick={() => download('lead_wizard_contacts.csv', toContactsCSV(leads.filter(l => status[leadKey(l)]?.s !== 'notfit')))} style={btn(false)}>⬇️ Contacts CSV ({leads.filter(l => status[leadKey(l)]?.s !== 'notfit').length}, skips “Not a fit”)</button>}
            </div>
          )}
        </>
      )}
      {tab === 'find' && <FindTab onLeads={addLeads} onRemoved={removeLeads} onRestored={addLeads} serverKey={serverKey} industry={industry} setIndustry={setIndustry} />}
      {tab === 'upload' && <UploadTab onLeads={addLeads} onRemoved={removeLeads} onRestored={addLeads} industry={industry} setIndustry={setIndustry} />}
    </div>
  )
}

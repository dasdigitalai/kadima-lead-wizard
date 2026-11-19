'use client'

import { useMemo, useState } from 'react'
import type { Lead } from '@/lib/types'
import { callPlan, leadKey, type Temp } from '@/lib/script'
import { Badge, C, store } from './ui'

export type Outcome = 'talked' | 'noanswer' | 'callback' | 'notfit'
export interface Logged { s: Outcome; at: number; note: string }
export type StatusMap = Record<string, Logged>

const TEMP_COLOR: Record<Temp, string> = { Hot: C.green, Warm: C.amber, Cool: C.mute }
const TEMP_LABEL: Record<Temp, string> = { Hot: '🔥 Hot lead', Warm: '🙂 Warm lead', Cool: '❄️ Cool lead' }
const isChain = (l: Lead) => l.franchiseStatus === 'Franchise' || l.franchiseStatus === 'Chain'
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() }

const big = (bg: string, fg = '#fff', border = 'none') => ({
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 56, width: '100%', padding: '12px 16px',
  borderRadius: 12, background: bg, color: fg, border, fontSize: 17, fontWeight: 700, cursor: 'pointer', textDecoration: 'none', textAlign: 'center',
}) as const

const OUTCOMES: { s: Outcome; label: string; bg: string; fg: string; border: string }[] = [
  { s: 'talked', label: '✅ Talked to them', bg: '#14532d', fg: '#bbf7d0', border: '1px solid #22c55e66' },
  { s: 'noanswer', label: '📞 No answer / left voicemail', bg: C.card, fg: '#e2e8f0', border: `1px solid ${C.line}` },
  { s: 'callback', label: '🔁 Call back later', bg: C.card, fg: '#e2e8f0', border: `1px solid ${C.line}` },
  { s: 'notfit', label: '❌ Not a fit', bg: C.card, fg: '#fca5a5', border: '1px solid #ef444455' },
]

export default function FocusTab({ leads, status, onLog, onUndo, onClear, agentName, setAgentName, goFind }: {
  leads: Lead[]; status: StatusMap; onLog: (key: string, s: Outcome, note: string) => void; onUndo: () => void; onClear: () => void
  agentName: string; setAgentName: (n: string) => void; goFind: () => void
}) {
  const [goal, setGoal] = useState<number>(() => store.get('plr.goal', 10))
  const [showChains, setShowChains] = useState(false)
  const [skipped, setSkipped] = useState<string[]>([])
  const [override, setOverride] = useState('')
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState(false)

  const reachable = (l: Lead) => !!(l.phone || l.allPhones || l.primaryContactEmail)
  const pool = useMemo(() => leads
    .filter(l => !status[leadKey(l)] && !skipped.includes(leadKey(l)) && reachable(l) && l.businessType !== 'Not auto parts' && (showChains || !isChain(l)))
    .sort((a, b) => b.leadScore - a.leadScore), [leads, status, skipped, showChains])
  const followUps = useMemo(() => leads.filter(l => ['noanswer', 'callback'].includes(status[leadKey(l)]?.s)).sort((a, b) => status[leadKey(a)].at - status[leadKey(b)].at), [leads, status])

  const doneToday = Object.values(status).filter(x => x.at >= startOfToday()).length
  const current = (override && leads.find(l => leadKey(l) === override)) || pool[0]
  const next = pool.find(l => current && leadKey(l) !== leadKey(current))
  const plan = current ? callPlan(current, agentName) : null

  const log = (s: Outcome) => {
    if (!current) return
    onLog(leadKey(current), s, note.trim()); setNote(''); setOverride(''); setCopied(false)
  }
  const skip = () => { if (current) { setSkipped(p => [...p, leadKey(current)]); setOverride(''); setNote('') } }
  const copy = async () => {
    if (!current || !plan) return
    const text = [current.name, `Contact: ${plan.askFor}`, `Phone: ${plan.phone}`, plan.email && `Email: ${plan.email}`, current.website && `Website: ${current.website}`, note.trim() && `Notes: ${note.trim()}`].filter(Boolean).join('\n')
    try { await navigator.clipboard.writeText(text); setCopied(true) } catch { /* clipboard blocked */ }
  }

  const pct = Math.min(100, Math.round((doneToday / goal) * 100))
  const section = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: '16px 18px', marginBottom: 14 } as const
  const h = { fontSize: 12, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 } as const

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* progress + settings: small, calm, out of the way */}
      <div style={{ ...section, display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>{doneToday >= goal ? `🎉 Goal hit! ${doneToday} calls today` : `${doneToday} of ${goal} today`}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#94a3b8' }}>
            Goal
            <select value={goal} onChange={e => { const g = Number(e.target.value); setGoal(g); store.set('plr.goal', g) }} style={{ background: C.bg, color: C.text, border: `1px solid ${C.line}`, borderRadius: 6, padding: '4px 6px' }}>
              {[5, 10, 15, 20, 30].map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <button onClick={onUndo} style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: 13 }}>↩ Undo last</button>
          </div>
        </div>
        <div style={{ background: C.bg, borderRadius: 6, height: 8, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: C.green }} /></div>
        <label style={{ fontSize: 13, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 8 }}>
          Your name (goes in the scripts):
          <input value={agentName} onChange={e => setAgentName(e.target.value)} placeholder="e.g. Sam" style={{ background: C.bg, color: C.text, border: `1px solid ${C.line}`, borderRadius: 6, padding: '6px 10px', fontSize: 14, width: 160 }} />
        </label>
      </div>

      {!current || !plan ? (
        <div style={{ ...section, textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 40 }}>{leads.length ? '🎉' : '🔩'}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', margin: '8px 0' }}>{leads.length ? 'Queue is clear — nice work.' : 'No leads yet.'}</div>
          <div style={{ color: '#94a3b8', marginBottom: 16 }}>{leads.length ? `${doneToday} done today. Find another batch whenever you're ready.` : 'Start by finding a batch of businesses.'}</div>
          <button onClick={goFind} style={big(C.blue)}>🚀 Find more leads</button>
        </div>
      ) : (
        <>
          {/* 1 — who */}
          <div style={section}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <Badge text={TEMP_LABEL[plan.temp]} color={TEMP_COLOR[plan.temp]} />
              {current.businessType !== 'Unclear' && <Badge text={current.businessType} color={C.blue} />}
              {current.multiLocation === 'Yes' && <Badge text={`${current.locationCount} locations`} color={C.amber} />}
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#f8fafc', lineHeight: 1.2 }}>{current.name}</div>
            <div style={{ color: '#94a3b8', marginTop: 2 }}>{[current.city, current.state].filter(Boolean).join(', ')}</div>
            {plan.caution && <div style={{ marginTop: 12, background: '#451a03', border: '1px solid #f59e0b66', color: '#fde68a', borderRadius: 10, padding: '10px 12px', fontSize: 14 }}>⚠️ {plan.caution}</div>}
          </div>

          {/* 2 — the one primary action */}
          <div style={section}>
            <div style={h}>Step 1 · Call</div>
            {plan.phone
              ? <a href={`tel:${plan.phone.replace(/[^\d+]/g, '')}`} style={big(C.green, '#052e16')}>📞 Call {plan.phone}</a>
              : <div style={{ color: '#94a3b8' }}>No phone number found — try the email below.</div>}
            <div style={{ marginTop: 10, fontSize: 16, color: '#e2e8f0' }}>Ask for: <b>{plan.askFor}</b></div>
            {!plan.hasName && <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 2 }}>No name found on their site — that's normal. Just ask.</div>}
          </div>

          {/* 3 — why + what to say */}
          <div style={section}>
            <div style={h}>Why this call is worth it</div>
            <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6, color: '#cbd5e1' }}>{plan.why.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </div>
          <div style={section}>
            <div style={h}>Say this</div>
            <div style={{ borderLeft: `4px solid ${C.blue}`, paddingLeft: 12, fontSize: 16, lineHeight: 1.5, color: '#f1f5f9' }}>{plan.opener}</div>
            <div style={{ ...h, marginTop: 14 }}>Then ask (pick one, you don't need all)</div>
            <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.6, color: '#cbd5e1' }}>{plan.questions.map((q, i) => <li key={i}>{q}</li>)}</ol>
          </div>

          {/* 4 — email alternative */}
          <div style={section}>
            <div style={h}>Or email instead</div>
            {plan.email
              ? <a href={`mailto:${plan.email}?subject=${encodeURIComponent(plan.emailSubject)}&body=${encodeURIComponent(plan.emailBody)}`} style={big(C.card, '#e2e8f0', `1px solid ${C.line}`)}>✉️ Email {plan.email}</a>
              : <div style={{ color: '#94a3b8' }}>No email found for this one.</div>}
          </div>

          {/* optional detail — closed by default so it never competes for attention */}
          <details style={{ ...section, color: '#cbd5e1' }}>
            <summary style={{ cursor: 'pointer', color: '#94a3b8', fontWeight: 600 }}>More about them (optional)</summary>
            <div style={{ marginTop: 10, lineHeight: 1.6, fontSize: 14 }}>
              <p>{current.overview || 'No overview available.'}</p>
              {current.website && <p>🌐 <a href={current.website.startsWith('http') ? current.website : `https://${current.website}`} target="_blank" rel="noreferrer" style={{ color: '#60a5fa' }}>{current.website}</a></p>}
              {current.otherContacts && <p>Other people: {current.otherContacts}</p>}
              {current.allEmails && <p>Emails: {current.allEmails}</p>}
              {current.allPhones && <p>Phones: {current.allPhones}</p>}
              {current.paymentProcessors && <p>Processors on site: {current.paymentProcessors}</p>}
            </div>
          </details>

          {/* 5 — log it and move on */}
          <div style={section}>
            <div style={h}>Step 2 · How did it go?</div>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Quick note (optional) — e.g. 'call back Thursday after 2'" style={{ width: '100%', background: C.bg, color: C.text, border: `1px solid ${C.line}`, borderRadius: 10, padding: '12px', fontSize: 15, marginBottom: 12 }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10 }}>
              {OUTCOMES.map(o => <button key={o.s} onClick={() => log(o.s)} style={big(o.bg, o.fg, o.border)}>{o.label}</button>)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 13, flexWrap: 'wrap', gap: 8 }}>
              <button onClick={skip} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>⏭ Skip for now</button>
              <button onClick={copy} style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer' }}>{copied ? '✓ Copied' : '📋 Copy details'}</button>
            </div>
          </div>
          {next && <div style={{ color: C.mute, fontSize: 13, textAlign: 'center', marginBottom: 14 }}>Up next: {next.name}</div>}
        </>
      )}

      {followUps.length > 0 && (
        <details style={{ ...section, color: '#cbd5e1' }}>
          <summary style={{ cursor: 'pointer', color: '#94a3b8', fontWeight: 600 }}>Follow-ups ({followUps.length})</summary>
          <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
            {followUps.map(l => {
              const st = status[leadKey(l)]
              return (
                <button key={leadKey(l)} onClick={() => { setOverride(leadKey(l)); window.scrollTo({ top: 0 }) }} style={{ textAlign: 'left', background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, padding: '10px 12px', color: '#e2e8f0', cursor: 'pointer' }}>
                  <b>{l.name}</b> <span style={{ color: C.mute }}>· {st.s === 'callback' ? 'call back' : 'no answer'} · {new Date(st.at).toLocaleDateString()}</span>
                  {st.note && <div style={{ color: '#94a3b8', fontSize: 13 }}>{st.note}</div>}
                </button>
              )
            })}
          </div>
        </details>
      )}

      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', fontSize: 12, color: C.mute, margin: '8px 0 24px', flexWrap: 'wrap' }}>
        <label style={{ cursor: 'pointer' }}><input type="checkbox" checked={showChains} onChange={e => setShowChains(e.target.checked)} /> Include franchises &amp; chains</label>
        <span>{pool.length} in queue</span>
        <button onClick={() => { if (window.confirm('Remove all leads and call history from this browser?')) onClear() }} style={{ background: 'none', border: 'none', color: C.mute, cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}>Clear everything</button>
      </div>
    </div>
  )
}

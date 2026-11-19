'use client'

export const C = { bg: '#0f1117', card: '#1e2433', line: '#2d3748', mute: '#64748b', text: '#e2e8f0', blue: '#3b82f6', green: '#22c55e', amber: '#f59e0b', red: '#ef4444' }
export const input = { background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: '8px 12px', color: C.text, fontSize: 14, outline: 'none', width: '100%' } as const
export const label = { fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 } as const
export const card = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: '1.5rem', marginBottom: '1.5rem' } as const
export const btn = (primary: boolean, disabled = false) => ({
  background: primary ? (disabled ? C.card : C.blue) : C.bg, color: primary ? (disabled ? C.mute : '#fff') : C.green,
  border: primary ? (disabled ? `1px solid ${C.line}` : 'none') : `1px solid ${C.green}44`,
  borderRadius: 8, padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
}) as const

export function Badge({ text, color = '#94a3b8' }: { text: string; color?: string }) {
  return <span style={{ background: color + '22', color, border: `1px solid ${color}44`, borderRadius: 4, padding: '2px 8px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{text}</span>
}
export const scoreColor = (n: number) => (n >= 70 ? C.green : n >= 40 ? C.amber : C.mute)

// ── browser storage that never throws (private windows, blocked storage…) ──
export const store = {
  get<T>(key: string, fallback: T): T {
    try { const v = localStorage.getItem(key); return v == null ? fallback : (JSON.parse(v) as T) } catch { return fallback }
  },
  set(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* storage full/blocked */ } },
}

/** fetch() that adds the team access code (if the server requires one) and asks for it once on a 401. */
export async function api(path: string, init: RequestInit = {}): Promise<Response> {
  const withCode = () => ({ ...init, headers: { ...(init.headers || {}), 'x-access-code': store.get<string>('plr.code', '') } })
  let res = await fetch(path, withCode())
  if (res.status === 401) {
    const code = window.prompt('Enter the team access code:')
    if (code) { store.set('plr.code', code.trim()); res = await fetch(path, withCode()) }
  }
  return res
}

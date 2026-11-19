// Small dependency-free HTML helpers. Regex-based on purpose: we only need
// text, meta tags, links and JSON-LD from small business sites, not a DOM.

function safeCodePoint(n: number): string {
  try { return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ' ' } catch { return ' ' }
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;|&#x27;|&rsquo;|&lsquo;/gi, "'")
    .replace(/&ndash;|&mdash;/gi, '-')
    .replace(/&#(\d+);/g, (_, n) => safeCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeCodePoint(parseInt(h, 16)))
    .replace(/&amp;/gi, '&')
}

/** Visible text, one block per line (so "Name\nTitle" staff cards stay adjacent). */
export function htmlToText(html: string): string {
  let s = html
    .replace(/<(script|style|noscript|svg|template|head)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|tr|td|th|section|article|header|footer|address|blockquote|table|dd|dt|a|button)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
  s = decodeEntities(s)
  return s
    .split('\n')
    .map(l => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
}

function parseAttrs(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g
  let m: RegExpExecArray | null
  while ((m = re.exec(tag)) !== null) attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '')
  return attrs
}

export function getMeta(html: string, ...names: string[]): string {
  const want = new Set(names.map(n => n.toLowerCase()))
  const re = /<meta\b[^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const a = parseAttrs(m[0])
    const key = (a.name || a.property || '').toLowerCase()
    if (want.has(key) && a.content) return a.content.trim()
  }
  return ''
}

export function getTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return m ? decodeEntities(m[1]).replace(/\s+/g, ' ').trim() : ''
}

export function getFirstHeading(html: string, level = 1): string {
  const m = html.match(new RegExp(`<h${level}\\b[^>]*>([\\s\\S]*?)<\\/h${level}>`, 'i'))
  return m ? decodeEntities(m[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim() : ''
}

export interface Link { url: string; text: string }

export function extractLinks(html: string, baseUrl: string): Link[] {
  const out: Link[] = []
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const href = parseAttrs(m[1]).href
    if (!href || /^(#|javascript:)/i.test(href)) continue
    try {
      const u = new URL(href, baseUrl)
      const text = decodeEntities(m[2].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
      out.push({ url: u.toString(), text })
    } catch { /* bad href */ }
  }
  return out
}

/** All JSON-LD objects on the page, with @graph flattened. */
export function extractJsonLd(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  const re = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  const push = (v: unknown) => {
    if (Array.isArray(v)) return v.forEach(push)
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>
      out.push(o)
      if (o['@graph']) push(o['@graph'])
    }
  }
  while ((m = re.exec(html)) !== null) {
    try { push(JSON.parse(m[1].trim())) } catch { /* malformed JSON-LD is common */ }
  }
  return out
}

export function stripWww(host: string): string {
  return host.toLowerCase().replace(/^www\./, '')
}

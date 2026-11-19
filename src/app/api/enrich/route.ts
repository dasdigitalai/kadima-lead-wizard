import { NextRequest } from 'next/server'
import { enrichLead, mapPool } from '@/lib/crawl'
import type { BaseLead } from '@/lib/types'

export const maxDuration = 60 // keep batches small enough to finish well inside this

// POST { leads: BaseLead[] }  ->  { leads: Lead[] }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const leads: BaseLead[] = Array.isArray(body.leads) ? body.leads.slice(0, 12) : []
  const results = await mapPool(leads, 5, async l => {
    try { return await enrichLead(l) } catch { return await enrichLead({ ...l, website: '' }) }
  })
  return Response.json({ leads: results })
}

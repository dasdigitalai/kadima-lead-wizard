import type { BaseLead } from './types'

/** "Pick Your Part - Orlando", "PICK YOUR PART #14", "Pick Your Part, Inc." -> "pickyourpart" */
export function brandKey(name: string): string {
  return name
    .split(/\s[-–|#]\s|\s#|,\s/)[0]
    .toLowerCase()
    .replace(/\b(inc|llc|l\.l\.c|corp|co|ltd|company|the)\b\.?/g, '')
    .replace(/[^a-z0-9]/g, '')
}

/** Count distinct Google listings sharing a brand name across the whole run (multi-location signal). */
export function markSameNameListings(leads: BaseLead[]): BaseLead[] {
  const groups = new Map<string, Set<string>>()
  for (const l of leads) {
    const k = brandKey(l.name)
    if (k.length < 4) continue
    if (!groups.has(k)) groups.set(k, new Set())
    groups.get(k)!.add(l.placeId)
  }
  return leads.map(l => ({ ...l, sameNameListings: Math.max(1, groups.get(brandKey(l.name))?.size || 1) }))
}

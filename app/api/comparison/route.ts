import { NextRequest, NextResponse } from 'next/server'
import { getAllRecords } from '@/lib/db/store'
import type { SalesRecord } from '@/types'

export const dynamic = 'force-dynamic'

type GroupBy = 'salesperson' | 'branch' | 'product' | 'customer'
type PeriodId = string // "2025-Q1" | "2025"

// ─── Period helpers ───────────────────────────────────────────────────────────

function recordPeriod(r: SalesRecord) {
  const d = new Date(r.postingDate)
  const year = d.getFullYear()
  const quarter = Math.ceil((d.getMonth() + 1) / 3)
  return { year, quarter, id: `${year}-Q${quarter}` }
}

function matchesPeriod(r: SalesRecord, p: PeriodId): boolean {
  const { year, quarter } = recordPeriod(r)
  if (p.includes('-Q')) {
    const [y, q] = p.split('-Q')
    return year === +y && quarter === +q
  }
  return year === +p
}

/** Return n periods ending at (and including) anchor */
function precedingPeriods(anchor: PeriodId, n: number): PeriodId[] {
  if (anchor.includes('-Q')) {
    let [y, q] = anchor.split('-Q').map(Number)
    const out: PeriodId[] = []
    for (let i = 0; i < n; i++) {
      out.unshift(`${y}-Q${q}`)
      q--
      if (q === 0) { q = 4; y-- }
    }
    return out
  }
  const y = +anchor
  return Array.from({ length: n }, (_, i) => String(y - n + 1 + i))
}

// ─── Entity helpers ───────────────────────────────────────────────────────────

function entityKey(r: SalesRecord, g: GroupBy): string {
  switch (g) {
    case 'salesperson': return r.salespersonCode || '(unassigned)'
    case 'branch':      return r.branchCode || '(no branch)'
    case 'product':     return r.testCode || r.productCode || '(no code)'
    case 'customer':    return r.customerNo || r.customerCode ||
                               (r.customerName ?? '').trim().toLowerCase() || '(unknown)'
  }
}

function entityLabel(r: SalesRecord, g: GroupBy): string {
  switch (g) {
    case 'salesperson': {
      const parts = [r.salespersonCode, r.salespersonName].filter(Boolean)
      return parts.join(' – ') || '(unassigned)'
    }
    case 'branch':   return r.branchCode || '(no branch)'
    case 'product':  return r.description || r.productDescription || r.testCode || r.productCode || '(no description)'
    case 'customer': return r.customerName || r.customerNo || r.customerCode || '(unknown)'
  }
}

function custKey(r: SalesRecord): string {
  return r.customerNo || r.customerCode ||
    (r.customerName ?? '').trim().toLowerCase() || ''
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const groupBy  = (sp.get('groupBy')  || 'salesperson') as GroupBy
  const periodA  =  sp.get('periodA')  || ''
  const periodB  =  sp.get('periodB')  || ''

  const records = await getAllRecords()

  // Build available quarter list from data
  const periodSet = new Set<string>()
  for (const r of records) periodSet.add(recordPeriod(r).id)
  const availablePeriods = [...periodSet].sort()

  // If periods not supplied yet — return only discovery data for dropdowns
  if (!periodA || !periodB) {
    return NextResponse.json({ availablePeriods, trendPeriods: [], rows: [], summary: null })
  }

  // 8 periods ending at periodB for trend line
  const trendPeriods = precedingPeriods(periodB, 8)

  // All periods we need to aggregate (periodA + 8-quarter trend)
  const allPeriodSet = new Set([periodA, ...trendPeriods])

  // ── Single pass ────────────────────────────────────────────────────────────

  // period → entityKey → { revenue, customers }
  const metricMap = new Map<string, Map<string, { rev: number; custs: Set<string> }>>()
  for (const p of allPeriodSet) metricMap.set(p, new Map())

  const labelMap  = new Map<string, string>()   // entityKey → label

  // customerKey → { name, salesperson } — for lost-customer details
  const custMeta  = new Map<string, { name: string; sp: string }>()

  // entityKey → customerKey → revenueInPeriodA  (for lost-customer revenue)
  const revA = new Map<string, Map<string, number>>()

  for (const r of records) {
    const ek = entityKey(r, groupBy)
    const ck = custKey(r)

    labelMap.set(ek, entityLabel(r, groupBy))

    if (!custMeta.has(ck)) {
      custMeta.set(ck, {
        name: r.customerName || r.customerNo || r.customerCode || ck,
        sp:   r.salespersonCode || '(unassigned)',
      })
    }

    for (const p of allPeriodSet) {
      if (!matchesPeriod(r, p)) continue

      const pm = metricMap.get(p)!
      if (!pm.has(ek)) pm.set(ek, { rev: 0, custs: new Set() })
      const em = pm.get(ek)!
      em.rev += r.netAmount
      em.custs.add(ck)

      if (p === periodA) {
        if (!revA.has(ek)) revA.set(ek, new Map())
        const ecm = revA.get(ek)!
        ecm.set(ck, (ecm.get(ck) || 0) + r.netAmount)
      }
    }
  }

  // ── Build comparison rows ──────────────────────────────────────────────────

  const mA = metricMap.get(periodA)!
  const mB = metricMap.get(periodB)!          // periodB === trendPeriods[last]

  const allKeys = new Set([...mA.keys(), ...mB.keys()])

  const rows = [...allKeys].map(ek => {
    const a = mA.get(ek) || { rev: 0, custs: new Set<string>() }
    const b = mB.get(ek) || { rev: 0, custs: new Set<string>() }

    const lostKeys   = [...a.custs].filter(c => !b.custs.has(c))
    const gained     = [...b.custs].filter(c => !a.custs.has(c)).length
    const retained   = [...a.custs].filter(c =>  b.custs.has(c)).length
    const change     = b.rev - a.rev
    const changePct  = a.rev !== 0 ? (change / a.rev) * 100 : null

    const ecmA = revA.get(ek) || new Map<string, number>()
    const lostCustomers = lostKeys
      .map(ck => ({
        key:       ck,
        name:      custMeta.get(ck)?.name || ck,
        salesperson: custMeta.get(ck)?.sp || '?',
        revenueA:  ecmA.get(ck) || 0,
      }))
      .sort((x, y) => y.revenueA - x.revenueA)

    const trend = trendPeriods.map(p => metricMap.get(p)?.get(ek)?.rev || 0)

    return {
      key:          ek,
      label:        labelMap.get(ek) || ek,
      revenueA:     a.rev,
      revenueB:     b.rev,
      customersA:   a.custs.size,
      customersB:   b.custs.size,
      change,
      changePct,
      retained,
      lost:         lostKeys.length,
      gained,
      trend,
      lostCustomers,
    }
  })

  rows.sort((a, b) => b.revenueB - a.revenueB)

  const totalA = rows.reduce((s, r) => s + r.revenueA, 0)
  const totalB = rows.reduce((s, r) => s + r.revenueB, 0)

  return NextResponse.json({
    availablePeriods,
    trendPeriods,
    rows: rows.slice(0, 300),
    summary: {
      totalA,
      totalB,
      change:    totalB - totalA,
      changePct: totalA ? ((totalB - totalA) / totalA) * 100 : null,
    },
  })
}

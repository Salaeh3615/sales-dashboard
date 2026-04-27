/**
 * POST /api/discounts
 *
 * Body: { filters: DashboardFilters }
 * Returns discount-focused analytics:
 *   - Summary KPIs
 *   - Monthly discount-rate trend
 *   - Branch × month heatmap
 *   - By-salesperson breakdown
 *   - By-customer-group breakdown
 */

import { NextResponse } from 'next/server'
import { getAllRecords } from '@/lib/db/store'
import { applyFilters } from '@/lib/calculations/filterUtils'
import {
  discountMonthly,
  discountHeatmap,
  discountBySalesperson,
  discountSummary,
} from '@/lib/calculations/insights'
import type { DashboardFilters, SalesRecord } from '@/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Group-level discount breakdown
function discountByCustomerGroup(records: SalesRecord[]) {
  type Agg = { discount: number; line: number; net: number; txn: number }
  const map = new Map<string, Agg>()
  for (const r of records) {
    const name = r.customerGroupName?.trim() || '(no group)'
    const cur = map.get(name) ?? { discount: 0, line: 0, net: 0, txn: 0 }
    cur.discount += Math.abs(r.discountAmount ?? 0)
    cur.line += r.lineAmount ?? 0
    cur.net += r.netAmount ?? 0
    cur.txn += 1
    map.set(name, cur)
  }
  return [...map.entries()]
    .map(([name, a]) => ({
      name,
      discountAmount: a.discount,
      lineAmount: a.line,
      netAmount: a.net,
      transactions: a.txn,
      discountPct: a.line !== 0 ? (a.discount / a.line) * 100 : 0,
    }))
    .sort((a, b) => b.discountAmount - a.discountAmount)
}

export async function POST(req: Request) {
  const { filters } = (await req.json()) as { filters: DashboardFilters }
  const allRecords = await getAllRecords()
  const filtered = applyFilters(allRecords, filters)
  const metric = filters.revenueMetric

  return NextResponse.json({
    recordCount: filtered.length,
    summary: discountSummary(filtered, metric),
    monthly: discountMonthly(filtered, metric),
    heatmap: discountHeatmap(filtered),
    bySalesperson: discountBySalesperson(filtered, metric),
    byCustomerGroup: discountByCustomerGroup(filtered),
  })
}

/**
 * health.ts — Customer Health Score engine.
 *
 * วัดสุขภาพลูกค้าแต่ละรายเป็น 0–100 จาก 4 มิติ:
 *   1) Recency — ห่างจากการซื้อล่าสุดกี่วัน
 *   2) Frequency trend — จำนวนออเดอร์ 90 วันล่าสุด vs 90 วันก่อนหน้า
 *   3) Revenue trend — รายได้ 90 วันล่าสุด vs 90 วันก่อนหน้า
 *   4) Order size trend — ขนาดออเดอร์เฉลี่ย 90 วันล่าสุด vs 90 วันก่อนหน้า
 *
 * แบ่ง 4 bucket: Healthy ≥80 · Watch 60–79 · At-Risk 40–59 · Critical <40
 */

import type { SalesRecord } from '@/types'

const DAY = 86_400_000
const WINDOW_DAYS = 90

export type HealthBucket = 'healthy' | 'watch' | 'at_risk' | 'critical'

export type CustomerHealth = {
  customerKey: string
  customerName: string
  customerNo: string
  salespersonCode: string
  branchCode: string
  groupName: string

  // Raw signals
  daysSinceLastOrder: number
  totalLifetimeRevenue: number
  ordersLast90: number
  ordersPrior90: number
  revenueLast90: number
  revenuePrior90: number
  avgOrderLast90: number
  avgOrderPrior90: number

  // Score components (0–100)
  recencyScore: number
  frequencyScore: number
  revenueScore: number
  orderSizeScore: number
  healthScore: number     // รวม weighted

  bucket: HealthBucket

  // Auto narrative bullets
  reasons: string[]

  // Trend sparkline (รายได้รายเดือน 6 เดือนล่าสุด)
  sparkline: { label: string; revenue: number }[]
}

export type HealthSummary = {
  asOfDate: string
  totalCustomers: number
  totalLifetimeRevenue: number
  buckets: Record<HealthBucket, { count: number; revenue: number }>
  topCriticalByRevenue: CustomerHealth[]
  topAtRiskByRevenue: CustomerHealth[]
  recentlyDecliningTopRevenue: CustomerHealth[]   // ลูกค้ารายใหญ่ที่ score ลดลง
  customers: CustomerHealth[]                      // เรียงตาม lifetime revenue desc, capped
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function custKey(r: SalesRecord): string {
  return r.customerNo || r.customerCode || (r.customerName ?? '').trim().toLowerCase() || '(unknown)'
}

function clampScore(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, n))
}

function bucketize(score: number): HealthBucket {
  if (score >= 80) return 'healthy'
  if (score >= 60) return 'watch'
  if (score >= 40) return 'at_risk'
  return 'critical'
}

function ratioScore(latest: number, prior: number): number {
  // 100 = แนวโน้มดีขึ้น (latest ≥ prior × 1.2)
  // 50  = เท่าเดิม
  // 0   = หดลงเหลือ 0
  if (prior === 0 && latest === 0) return 50
  if (prior === 0) return 100  // เคยไม่มี → ตอนนี้มี = ดี
  const ratio = latest / prior
  // Map: 0 → 0, 0.5 → 25, 1 → 50, 1.5 → 75, 2+ → 100
  return clampScore(ratio * 50)
}

function recencyScore(daysSince: number): number {
  // 0 วัน = 100
  // 30 วัน = 90
  // 60 วัน = 75
  // 90 วัน = 55
  // 180 วัน = 20
  // 365+ = 0
  if (daysSince <= 30) return 100 - (daysSince / 30) * 10
  if (daysSince <= 60) return 90 - ((daysSince - 30) / 30) * 15
  if (daysSince <= 90) return 75 - ((daysSince - 60) / 30) * 20
  if (daysSince <= 180) return 55 - ((daysSince - 90) / 90) * 35
  if (daysSince <= 365) return 20 - ((daysSince - 180) / 185) * 20
  return 0
}

function buildReasons(h: Omit<CustomerHealth, 'reasons' | 'sparkline'>): string[] {
  const out: string[] = []

  if (h.daysSinceLastOrder >= 180) {
    out.push(`ไม่ได้ซื้อมา ${h.daysSinceLastOrder} วัน (เกิน 6 เดือน)`)
  } else if (h.daysSinceLastOrder >= 90) {
    out.push(`ไม่ได้ซื้อมา ${h.daysSinceLastOrder} วัน`)
  } else if (h.daysSinceLastOrder <= 14) {
    out.push(`ซื้อล่าสุด ${h.daysSinceLastOrder} วันก่อน — เคลื่อนไหวดี`)
  }

  if (h.ordersPrior90 > 0 && h.ordersLast90 / h.ordersPrior90 < 0.5) {
    out.push(`จำนวนออเดอร์ลด ${h.ordersPrior90} → ${h.ordersLast90} (90 วันก่อน vs 90 วันล่าสุด)`)
  } else if (h.ordersLast90 > h.ordersPrior90 * 1.5 && h.ordersPrior90 > 0) {
    out.push(`ออเดอร์เพิ่ม ${h.ordersPrior90} → ${h.ordersLast90}`)
  }

  if (h.revenuePrior90 > 0) {
    const r = h.revenueLast90 / h.revenuePrior90
    if (r < 0.5) out.push(`รายได้ 90 วันล่าสุดลดเหลือ ${(r * 100).toFixed(0)}% ของช่วงก่อน`)
    else if (r > 1.5) out.push(`รายได้ 90 วันล่าสุดโต ${((r - 1) * 100).toFixed(0)}%`)
  }

  if (h.avgOrderPrior90 > 0 && h.avgOrderLast90 < h.avgOrderPrior90 * 0.7) {
    out.push(`ขนาดออเดอร์เฉลี่ยเล็กลง ${(((h.avgOrderLast90 - h.avgOrderPrior90) / h.avgOrderPrior90) * 100).toFixed(0)}%`)
  }

  if (out.length === 0) out.push('สัญญาณปกติ ทุกมิติคงที่')
  return out
}

// ─── Main computation ────────────────────────────────────────────────────────

export function computeCustomerHealth(records: SalesRecord[]): HealthSummary {
  if (records.length === 0) {
    return {
      asOfDate: new Date().toISOString().slice(0, 10),
      totalCustomers: 0,
      totalLifetimeRevenue: 0,
      buckets: {
        healthy: { count: 0, revenue: 0 },
        watch: { count: 0, revenue: 0 },
        at_risk: { count: 0, revenue: 0 },
        critical: { count: 0, revenue: 0 },
      },
      topCriticalByRevenue: [],
      topAtRiskByRevenue: [],
      recentlyDecliningTopRevenue: [],
      customers: [],
    }
  }

  // Use latest postingDate as "now"
  let maxTs = 0
  for (const r of records) {
    const t = new Date(r.postingDate).getTime()
    if (t > maxTs) maxTs = t
  }
  const asOf = maxTs
  const lastWindowStart = asOf - WINDOW_DAYS * DAY
  const priorWindowStart = asOf - 2 * WINDOW_DAYS * DAY
  const sparkStart = asOf - 6 * 30 * DAY

  // Group records by customer
  type Bucket = {
    customerName: string
    customerNo: string
    salespersonCode: string
    branchCode: string
    groupName: string
    lastOrderTs: number
    lifetimeRev: number
    ordersLast: number
    ordersPrior: number
    revLast: number
    revPrior: number
    docsLast: Set<string>     // unique invoices
    docsPrior: Set<string>
    monthMap: Map<string, number>  // YYYY-MM → revenue
  }

  const map = new Map<string, Bucket>()

  for (const r of records) {
    const k = custKey(r)
    const ts = new Date(r.postingDate).getTime()
    let b = map.get(k)
    if (!b) {
      b = {
        customerName: r.customerName || r.customerNo || r.customerCode || k,
        customerNo: r.customerNo || r.customerCode || '',
        salespersonCode: r.salespersonCode || '',
        branchCode: r.branchCode || '',
        groupName: r.customerGroupName || r.customerGroupCode || '',
        lastOrderTs: 0,
        lifetimeRev: 0,
        ordersLast: 0,
        ordersPrior: 0,
        revLast: 0,
        revPrior: 0,
        docsLast: new Set(),
        docsPrior: new Set(),
        monthMap: new Map(),
      }
      map.set(k, b)
    }
    b.lifetimeRev += r.netAmount
    if (ts > b.lastOrderTs) {
      b.lastOrderTs = ts
      // Refresh meta with latest
      b.customerName = r.customerName || b.customerName
      b.salespersonCode = r.salespersonCode || b.salespersonCode
      b.branchCode = r.branchCode || b.branchCode
      b.groupName = r.customerGroupName || r.customerGroupCode || b.groupName
    }

    const docId = r.documentNo || `${r.postingDate}|${r.netAmount}`

    if (ts >= lastWindowStart && ts <= asOf) {
      b.revLast += r.netAmount
      b.docsLast.add(docId)
    } else if (ts >= priorWindowStart && ts < lastWindowStart) {
      b.revPrior += r.netAmount
      b.docsPrior.add(docId)
    }

    if (ts >= sparkStart) {
      const d = new Date(ts)
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      b.monthMap.set(ym, (b.monthMap.get(ym) ?? 0) + r.netAmount)
    }
  }

  const customers: CustomerHealth[] = []
  let totalLifetimeRevenue = 0
  const buckets: Record<HealthBucket, { count: number; revenue: number }> = {
    healthy: { count: 0, revenue: 0 },
    watch: { count: 0, revenue: 0 },
    at_risk: { count: 0, revenue: 0 },
    critical: { count: 0, revenue: 0 },
  }

  for (const [k, b] of map) {
    if (b.lifetimeRev <= 0) continue   // skip noise (returns only / zero customers)
    const daysSince = Math.max(0, Math.floor((asOf - b.lastOrderTs) / DAY))
    const ordersLast = b.docsLast.size
    const ordersPrior = b.docsPrior.size
    const avgLast = ordersLast > 0 ? b.revLast / ordersLast : 0
    const avgPrior = ordersPrior > 0 ? b.revPrior / ordersPrior : 0

    const rec = recencyScore(daysSince)
    const freq = ratioScore(ordersLast, ordersPrior)
    const rev = ratioScore(b.revLast, b.revPrior)
    const size = ratioScore(avgLast, avgPrior)
    // Weighted: recency 35%, revenue 30%, frequency 20%, order size 15%
    const health = clampScore(rec * 0.35 + rev * 0.30 + freq * 0.20 + size * 0.15)
    const bucket = bucketize(health)

    // Sparkline: last 6 months
    const sparkline: { label: string; revenue: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(asOf - i * 30 * DAY)
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      sparkline.push({ label: ym, revenue: b.monthMap.get(ym) ?? 0 })
    }

    const partial: Omit<CustomerHealth, 'reasons' | 'sparkline'> = {
      customerKey: k,
      customerName: b.customerName,
      customerNo: b.customerNo,
      salespersonCode: b.salespersonCode,
      branchCode: b.branchCode,
      groupName: b.groupName,
      daysSinceLastOrder: daysSince,
      totalLifetimeRevenue: b.lifetimeRev,
      ordersLast90: ordersLast,
      ordersPrior90: ordersPrior,
      revenueLast90: b.revLast,
      revenuePrior90: b.revPrior,
      avgOrderLast90: avgLast,
      avgOrderPrior90: avgPrior,
      recencyScore: rec,
      frequencyScore: freq,
      revenueScore: rev,
      orderSizeScore: size,
      healthScore: health,
      bucket,
    }
    const reasons = buildReasons(partial)

    const row: CustomerHealth = { ...partial, reasons, sparkline }
    customers.push(row)

    totalLifetimeRevenue += b.lifetimeRev
    buckets[bucket].count++
    buckets[bucket].revenue += b.lifetimeRev
  }

  // Sort
  customers.sort((a, b) => b.totalLifetimeRevenue - a.totalLifetimeRevenue)

  const topCriticalByRevenue = customers.filter((c) => c.bucket === 'critical').slice(0, 15)
  const topAtRiskByRevenue = customers.filter((c) => c.bucket === 'at_risk').slice(0, 15)

  // Recently declining top revenue: รายใหญ่ (top 200) ที่ revenue trend ลด > 30%
  const big = customers.slice(0, 500)
  const recentlyDecliningTopRevenue = big
    .filter((c) => c.revenuePrior90 > 0 && c.revenueLast90 / c.revenuePrior90 < 0.7)
    .sort((a, b) => b.revenuePrior90 - a.revenuePrior90)
    .slice(0, 15)

  return {
    asOfDate: new Date(asOf).toISOString().slice(0, 10),
    totalCustomers: customers.length,
    totalLifetimeRevenue,
    buckets,
    topCriticalByRevenue,
    topAtRiskByRevenue,
    recentlyDecliningTopRevenue,
    customers: customers.slice(0, 500),  // cap payload
  }
}

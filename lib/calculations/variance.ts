/**
 * variance.ts — Variance Investigator engine.
 *
 * ใช้ค่า rolling baseline + standard deviation เพื่อหาช่วง (เดือน/สัปดาห์)
 * ที่รายได้แตกต่างจาก baseline เกิน 2σ → ถือว่าเป็น "anomaly"
 * จากนั้น drill-down ว่าใคร/อะไรที่ทำให้ gap นั้น
 */

import type { SalesRecord } from '@/types'

const DAY = 86_400_000

export type Granularity = 'month' | 'week'

export type VariancePoint = {
  label: string         // YYYY-MM | YYYY-WNN
  startDate: string     // YYYY-MM-DD (first day of the bucket)
  actual: number
  baseline: number      // rolling avg of last N completed buckets prior
  stddev: number
  zScore: number
  variance: number      // actual - baseline
  variancePct: number | null
  isAnomaly: boolean
  anomalyDirection: 'up' | 'down' | null
}

export type AnomalyDeepDive = {
  label: string
  startDate: string
  actual: number
  baseline: number
  variance: number
  variancePct: number | null
  zScore: number
  direction: 'up' | 'down'

  // 5-Whys-style auto narrative
  narrative: string[]

  // Drill into top contributors (vs baseline rev for each axis)
  byCustomer: ContributorRow[]
  byTest: ContributorRow[]
  byBranch: ContributorRow[]
  bySalesperson: ContributorRow[]
  newCustomerRevenue: number
  lostCustomerRevenue: number
  ordersInPeriod: number
  ordersBaseline: number
  uniqueCustomersInPeriod: number
  uniqueCustomersBaseline: number
}

export type ContributorRow = {
  key: string
  label: string
  meta?: string
  baselineRev: number
  actualRev: number
  delta: number
  share: number   // % of total variance
}

export type VarianceResult = {
  granularity: Granularity
  asOfDate: string
  series: VariancePoint[]
  anomalies: AnomalyDeepDive[]
  baselineWindow: number   // ใช้กี่ buckets ในการคำนวณ baseline
}

// ─── Bucket helpers ──────────────────────────────────────────────────────────

function bucketLabel(ts: number, g: Granularity): { label: string; startDate: string } {
  const d = new Date(ts)
  if (g === 'month') {
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const startDate = `${y}-${String(m).padStart(2, '0')}-01`
    return { label: `${y}-${String(m).padStart(2, '0')}`, startDate }
  }
  // ISO-like week (Sun-start for simplicity)
  const dayOfWeek = d.getDay()
  const start = new Date(ts - dayOfWeek * DAY)
  start.setHours(0, 0, 0, 0)
  const onejan = new Date(start.getFullYear(), 0, 1)
  const week = Math.ceil(((start.getTime() - onejan.getTime()) / DAY + onejan.getDay() + 1) / 7)
  const startDate = start.toISOString().slice(0, 10)
  return { label: `${start.getFullYear()}-W${String(week).padStart(2, '0')}`, startDate }
}

// ─── Main computation ────────────────────────────────────────────────────────

export function computeVariance(
  records: SalesRecord[],
  granularity: Granularity = 'month',
  zThreshold = 2,
): VarianceResult {
  if (records.length === 0) {
    return {
      granularity, asOfDate: new Date().toISOString().slice(0, 10),
      series: [], anomalies: [], baselineWindow: 12,
    }
  }

  // 1) Aggregate revenue per bucket
  const bucketMap = new Map<string, { startDate: string; actual: number; ts: number }>()
  let maxTs = 0
  for (const r of records) {
    const ts = new Date(r.postingDate).getTime()
    if (ts > maxTs) maxTs = ts
    const { label, startDate } = bucketLabel(ts, granularity)
    let b = bucketMap.get(label)
    if (!b) {
      b = { startDate, actual: 0, ts: new Date(startDate).getTime() }
      bucketMap.set(label, b)
    }
    b.actual += r.netAmount
  }

  // Sort buckets chronologically
  const sortedKeys = [...bucketMap.keys()].sort((a, b) => bucketMap.get(a)!.ts - bucketMap.get(b)!.ts)

  // 2) Rolling baseline: avg of previous N completed buckets
  const baselineWindow = granularity === 'month' ? 12 : 8
  const series: VariancePoint[] = []
  const actuals = sortedKeys.map((k) => bucketMap.get(k)!.actual)

  for (let i = 0; i < sortedKeys.length; i++) {
    const k = sortedKeys[i]
    const b = bucketMap.get(k)!
    const start = Math.max(0, i - baselineWindow)
    const window = actuals.slice(start, i)
    let baseline = 0
    let stddev = 0
    if (window.length > 1) {
      baseline = window.reduce((s, v) => s + v, 0) / window.length
      const sqDiff = window.reduce((s, v) => s + Math.pow(v - baseline, 2), 0)
      stddev = Math.sqrt(sqDiff / window.length)
    } else if (window.length === 1) {
      baseline = window[0]
    }
    const variance = b.actual - baseline
    const zScore = stddev > 0 ? variance / stddev : 0
    const isAnomaly = window.length >= 3 && Math.abs(zScore) >= zThreshold
    series.push({
      label: k,
      startDate: b.startDate,
      actual: b.actual,
      baseline,
      stddev,
      zScore,
      variance,
      variancePct: baseline !== 0 ? (variance / baseline) * 100 : null,
      isAnomaly,
      anomalyDirection: isAnomaly ? (zScore > 0 ? 'up' : 'down') : null,
    })
  }

  // 3) Pick anomalies (skip earliest bucket where window was tiny)
  // Take last 36 buckets, then keep anomalies, latest first
  const recent = series.slice(-36)
  const anomaliesRaw = recent.filter((p) => p.isAnomaly).reverse()

  // Limit to top 8 most extreme anomalies
  const topAnomalies = anomaliesRaw.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore)).slice(0, 8)
  // Sort back by date desc for display
  topAnomalies.sort((a, b) => b.startDate.localeCompare(a.startDate))

  // 4) For each anomaly: deep dive
  const dives: AnomalyDeepDive[] = topAnomalies.map((p) => deepDive(records, p, granularity, baselineWindow, sortedKeys, bucketMap))

  return {
    granularity,
    asOfDate: new Date(maxTs).toISOString().slice(0, 10),
    series: series.slice(-36),  // cap payload
    anomalies: dives,
    baselineWindow,
  }
}

function deepDive(
  records: SalesRecord[],
  point: VariancePoint,
  granularity: Granularity,
  baselineWindow: number,
  sortedKeys: string[],
  bucketMap: Map<string, { startDate: string; actual: number; ts: number }>,
): AnomalyDeepDive {
  // Identify range: the anomaly bucket vs the baseline buckets used to compute it
  const idx = sortedKeys.indexOf(point.label)
  const baselineLabels = sortedKeys.slice(Math.max(0, idx - baselineWindow), idx)
  const baselineLabelSet = new Set(baselineLabels)

  // Collect records into "in period" and "in baseline"
  const inPeriod: SalesRecord[] = []
  const inBaseline: SalesRecord[] = []
  for (const r of records) {
    const ts = new Date(r.postingDate).getTime()
    const lbl = bucketLabel(ts, granularity).label
    if (lbl === point.label) inPeriod.push(r)
    else if (baselineLabelSet.has(lbl)) inBaseline.push(r)
  }

  // Compute per-axis contributions
  const baselineDivisor = Math.max(1, baselineLabels.length)

  function axis(
    keyFn: (r: SalesRecord) => string,
    labelFn: (r: SalesRecord) => string,
    metaFn?: (r: SalesRecord) => string,
  ): ContributorRow[] {
    const baseRev = new Map<string, number>()
    const periodRev = new Map<string, number>()
    const lbls = new Map<string, string>()
    const metas = new Map<string, string>()
    for (const r of inBaseline) {
      const k = keyFn(r)
      baseRev.set(k, (baseRev.get(k) ?? 0) + r.netAmount)
      if (!lbls.has(k)) {
        lbls.set(k, labelFn(r))
        if (metaFn) metas.set(k, metaFn(r))
      }
    }
    for (const r of inPeriod) {
      const k = keyFn(r)
      periodRev.set(k, (periodRev.get(k) ?? 0) + r.netAmount)
      if (!lbls.has(k)) {
        lbls.set(k, labelFn(r))
        if (metaFn) metas.set(k, metaFn(r))
      }
    }
    const allKeys = new Set([...baseRev.keys(), ...periodRev.keys()])
    const totalVar = point.variance || 1
    const rows: ContributorRow[] = []
    for (const k of allKeys) {
      const base = (baseRev.get(k) ?? 0) / baselineDivisor   // average per period
      const actual = periodRev.get(k) ?? 0
      const delta = actual - base
      rows.push({
        key: k,
        label: lbls.get(k) ?? k,
        meta: metas.get(k),
        baselineRev: base,
        actualRev: actual,
        delta,
        share: (delta / totalVar) * 100,
      })
    }
    // Sort by direction matching the anomaly: down anomaly → most negative delta first
    if (point.zScore < 0) rows.sort((a, b) => a.delta - b.delta)
    else rows.sort((a, b) => b.delta - a.delta)
    return rows.slice(0, 8)
  }

  const byCustomer = axis(
    (r) => r.customerNo || r.customerCode || (r.customerName ?? '').trim().toLowerCase() || '(unknown)',
    (r) => r.customerName || r.customerNo || r.customerCode || '(unknown)',
    (r) => r.salespersonCode || '',
  )
  const byTest = axis(
    (r) => r.testCode || r.productCode || '(no-code)',
    (r) => r.description || r.productDescription || r.testCode || r.productCode || '(no-description)',
  )
  const byBranch = axis(
    (r) => r.branchCode || '(no-branch)',
    (r) => r.branchCode || '(no-branch)',
  )
  const bySalesperson = axis(
    (r) => r.salespersonCode || '(unassigned)',
    (r) => {
      const parts = [r.salespersonCode, r.salespersonName].filter(Boolean)
      return parts.join(' – ') || '(unassigned)'
    },
  )

  // Customer counts
  const periodCustKeys = new Set<string>()
  const baseCustKeys = new Set<string>()
  for (const r of inPeriod) periodCustKeys.add(r.customerNo || r.customerCode || (r.customerName ?? '').trim().toLowerCase() || '(unknown)')
  for (const r of inBaseline) baseCustKeys.add(r.customerNo || r.customerCode || (r.customerName ?? '').trim().toLowerCase() || '(unknown)')

  let newCustRev = 0, lostCustRev = 0
  // build period-rev map
  const periodCustRev = new Map<string, number>()
  for (const r of inPeriod) {
    const k = r.customerNo || r.customerCode || (r.customerName ?? '').trim().toLowerCase() || '(unknown)'
    periodCustRev.set(k, (periodCustRev.get(k) ?? 0) + r.netAmount)
  }
  const baseCustRev = new Map<string, number>()
  for (const r of inBaseline) {
    const k = r.customerNo || r.customerCode || (r.customerName ?? '').trim().toLowerCase() || '(unknown)'
    baseCustRev.set(k, (baseCustRev.get(k) ?? 0) + r.netAmount)
  }
  for (const [k, v] of periodCustRev) {
    if (!baseCustRev.has(k)) newCustRev += v
  }
  for (const [k, v] of baseCustRev) {
    if (!periodCustRev.has(k)) lostCustRev += v / baselineDivisor
  }

  // Orders
  const periodDocs = new Set<string>()
  const baseDocs = new Set<string>()
  for (const r of inPeriod) periodDocs.add(r.documentNo || `${r.postingDate}|${r.netAmount}`)
  for (const r of inBaseline) baseDocs.add(r.documentNo || `${r.postingDate}|${r.netAmount}`)

  // Build narrative (5 Whys-ish)
  const narrative = buildAnomalyNarrative({
    point,
    byCustomer, byTest, byBranch, bySalesperson,
    newCustRev, lostCustRev,
    ordersPeriod: periodDocs.size,
    ordersBaselineAvg: baseDocs.size / baselineDivisor,
    custCountPeriod: periodCustKeys.size,
    custCountBaselineAvg: baseCustKeys.size / baselineDivisor,
  })

  return {
    label: point.label,
    startDate: point.startDate,
    actual: point.actual,
    baseline: point.baseline,
    variance: point.variance,
    variancePct: point.variancePct,
    zScore: point.zScore,
    direction: point.zScore > 0 ? 'up' : 'down',
    narrative,
    byCustomer,
    byTest,
    byBranch,
    bySalesperson,
    newCustomerRevenue: newCustRev,
    lostCustomerRevenue: lostCustRev,
    ordersInPeriod: periodDocs.size,
    ordersBaseline: baseDocs.size / baselineDivisor,
    uniqueCustomersInPeriod: periodCustKeys.size,
    uniqueCustomersBaseline: baseCustKeys.size / baselineDivisor,
  }
}

// ─── Narrative builder ───────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '−' : ''
  if (abs >= 1_000_000_000) return `${sign}฿${(abs / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `${sign}฿${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}฿${(abs / 1_000).toFixed(1)}K`
  return `${sign}฿${abs.toFixed(0)}`
}

function buildAnomalyNarrative(ctx: {
  point: VariancePoint
  byCustomer: ContributorRow[]
  byTest: ContributorRow[]
  byBranch: ContributorRow[]
  bySalesperson: ContributorRow[]
  newCustRev: number
  lostCustRev: number
  ordersPeriod: number
  ordersBaselineAvg: number
  custCountPeriod: number
  custCountBaselineAvg: number
}): string[] {
  const { point, byCustomer, byTest, byBranch, newCustRev, lostCustRev, ordersPeriod, ordersBaselineAvg, custCountPeriod, custCountBaselineAvg } = ctx
  const lines: string[] = []
  const dir = point.zScore > 0 ? 'สูงกว่า' : 'ต่ำกว่า'
  const verb = point.zScore > 0 ? 'เพิ่ม' : 'ลด'

  // Why 1: Headline
  lines.push(
    `${point.label} รายได้ ${fmtMoney(point.actual)} ${dir} baseline (${fmtMoney(point.baseline)}) อยู่ ${fmtMoney(Math.abs(point.variance))} (z = ${point.zScore.toFixed(2)})`,
  )

  // Why 2: Customer concentration
  if (byCustomer[0]) {
    const c = byCustomer[0]
    const pctOfVar = Math.abs(c.delta / point.variance) * 100
    lines.push(`ลูกค้า ${c.label} ${verb} ${fmtMoney(Math.abs(c.delta))} = ${pctOfVar.toFixed(0)}% ของส่วนต่างทั้งหมด`)
  }

  // Why 3: Test driver
  if (byTest[0]) {
    const t = byTest[0]
    lines.push(`บริการที่กระทบมากสุด: ${t.label} ${verb} ${fmtMoney(Math.abs(t.delta))}`)
  }

  // Why 4: Branch
  if (byBranch[0]) {
    const br = byBranch[0]
    lines.push(`สาขา ${br.label} ${verb} ${fmtMoney(Math.abs(br.delta))}`)
  }

  // Why 5: Customer dynamics
  const custDelta = custCountPeriod - custCountBaselineAvg
  if (Math.abs(custDelta) >= 5 || newCustRev > 0 || lostCustRev > 0) {
    lines.push(
      `ลูกค้าใน period ${custCountPeriod} ราย vs baseline เฉลี่ย ${custCountBaselineAvg.toFixed(0)} ` +
      `(ใหม่ +${fmtMoney(newCustRev)} · หาย −${fmtMoney(lostCustRev)})`,
    )
  }

  // Why 6: Volume vs price-ish hint
  if (Math.abs(ordersPeriod - ordersBaselineAvg) >= 5) {
    const orderDir = ordersPeriod > ordersBaselineAvg ? 'มากกว่า' : 'น้อยกว่า'
    lines.push(`จำนวนออเดอร์ ${ordersPeriod} ${orderDir} baseline เฉลี่ย ${ordersBaselineAvg.toFixed(0)}`)
  }

  return lines
}

/**
 * targets.ts — Compute attainment, pacing, projection and variance versus
 * monthly revenue targets.
 *
 * The calendar anchor used throughout this module is the LATEST posting date
 * present in the filtered record set.  That date's month is treated as the
 * "current" month and serves as the cut-off for YTD calculations and the basis
 * for the EOY projection.
 */

import type { DashboardFilters, SalesRecord } from '@/types'
import { getRevenue } from './filterUtils'
import { getBranchTarget, getTargetsForYear } from '@/lib/targets/store'
import type { TargetRow } from '@/lib/targets/parser'
import { classifyHoLocation, SUB_PROJECTS } from '@/lib/targets/ho-mapping'

type Metric = DashboardFilters['revenueMetric']

// ─── Types ───────────────────────────────────────────────────────────────────

export type AttainmentStatus = 'ahead' | 'on_track' | 'behind' | 'at_risk'

export type MonthlyAttainment = {
  month: number                 // 1-12
  label: string                 // "Jan", "Feb", ...
  target: number
  actual: number
  attainmentPct: number
  variance: number              // actual - target
  isPast: boolean               // month has already ended
  isCurrent: boolean            // anchor month
}

export type CumulativePoint = {
  month: number
  label: string
  targetCum: number
  actualCum: number
  attainmentCumPct: number
}

export type BranchAttainment = {
  branchCode: string
  subdivision?: string
  fullYearTarget: number
  ytdTarget: number             // sum of target for months 1..anchorMonth
  ytdActual: number
  ytdAttainmentPct: number
  fullYearActual: number        // actual to date (same as ytdActual for current year)
  projectedEOY: number          // extrapolated full-year revenue
  projectedAttainmentPct: number
  gap: number                   // ytdActual - ytdTarget
  gapEOY: number                // projectedEOY - fullYearTarget
  status: AttainmentStatus
  paceMultiplier: number        // avg daily rate vs required daily rate
  requiredDailyRate: number     // needed to close YTD gap by month-end
  monthly: MonthlyAttainment[]
  cumulative: CumulativePoint[]
}

export type HoProjectRow = {
  locationCode: string
  projectName: string
  revenue: number
  transactions: number
  customers: number
  topCustomer?: string
}

export type TargetDashboardData = {
  year: number
  anchorMonth: number            // latest month with actual data (1-12)
  anchorDate: string             // latest posting date, yyyy-MM-dd
  daysInAnchorMonth: number
  dayOfAnchorMonth: number
  availableYears: number[]
  overall: BranchAttainment
  byBranch: BranchAttainment[]
  byHoSubdivision: BranchAttainment[]
  hoProjects: HoProjectRow[]      // Decomposition of the "projects & other" bucket
  // Visualisations
  heatmap: { branch: string; cells: { month: number; attainmentPct: number; actual: number; target: number }[] }[]
  waterfall: { month: number; label: string; variance: number; cumulative: number }[]
  atRisk: { branchCode: string; gap: number; projectedAttainmentPct: number; requiredUpliftPct: number }[]
  salespersonContribution: { name: string; revenue: number; branches: string[]; share: number }[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function deriveStatus(attainmentPct: number, isEOYProjection = false): AttainmentStatus {
  if (attainmentPct >= (isEOYProjection ? 100 : 102)) return 'ahead'
  if (attainmentPct >= (isEOYProjection ? 95 : 97)) return 'on_track'
  if (attainmentPct >= (isEOYProjection ? 85 : 85)) return 'behind'
  return 'at_risk'
}

function findAnchor(records: SalesRecord[], fallbackYear: number): {
  year: number
  month: number
  dayOfMonth: number
  daysInMonth: number
  dateIso: string
} {
  let latest = ''
  for (const r of records) {
    const d = r.postingDate?.slice(0, 10)
    if (d && d > latest) latest = d
  }
  if (!latest) {
    // No records — default to Jan 1 of requested year
    return { year: fallbackYear, month: 1, dayOfMonth: 1, daysInMonth: 31, dateIso: `${fallbackYear}-01-01` }
  }
  const [y, m, d] = latest.split('-').map((s) => parseInt(s))
  const daysInMonth = new Date(y, m, 0).getDate()
  return { year: y, month: m, dayOfMonth: d, daysInMonth, dateIso: latest }
}

// ─── Core computation for a single "entity" (branch or subdivision) ──────────

function buildAttainment(args: {
  branchCode: string
  subdivision?: string
  year: number
  anchorMonth: number
  dayOfAnchorMonth: number
  daysInAnchorMonth: number
  targetMonthly: number[]
  targetTotal: number
  actualByMonth: number[]     // length 12
}): BranchAttainment {
  const { anchorMonth, dayOfAnchorMonth, daysInAnchorMonth, targetMonthly, targetTotal, actualByMonth } = args

  // Monthly attainment
  const monthly: MonthlyAttainment[] = []
  for (let m = 1; m <= 12; m++) {
    const idx = m - 1
    const t = targetMonthly[idx] ?? 0
    const a = actualByMonth[idx] ?? 0
    monthly.push({
      month: m,
      label: MONTH_LABELS[idx],
      target: t,
      actual: a,
      attainmentPct: t > 0 ? (a / t) * 100 : (a > 0 ? 100 : 0),
      variance: a - t,
      isPast: m < anchorMonth,
      isCurrent: m === anchorMonth,
    })
  }

  // Cumulative
  const cumulative: CumulativePoint[] = []
  let targetCum = 0
  let actualCum = 0
  for (const m of monthly) {
    targetCum += m.target
    actualCum += m.actual
    cumulative.push({
      month: m.month,
      label: m.label,
      targetCum,
      actualCum,
      attainmentCumPct: targetCum > 0 ? (actualCum / targetCum) * 100 : 0,
    })
  }

  // YTD metrics (through anchor month)
  const ytdTarget = monthly.slice(0, anchorMonth).reduce((s, m) => s + m.target, 0)
  const ytdActual = monthly.slice(0, anchorMonth).reduce((s, m) => s + m.actual, 0)
  const ytdAttainmentPct = ytdTarget > 0 ? (ytdActual / ytdTarget) * 100 : 0

  // Projected EOY revenue
  // Past months: use actual.  Current month: extrapolate by day-of-month proportion.
  // Future months: use target as expected pace.
  const pastActual = monthly.slice(0, anchorMonth - 1).reduce((s, m) => s + m.actual, 0)
  const currentMonthActual = monthly[anchorMonth - 1]?.actual ?? 0
  const currentMonthProjected = dayOfAnchorMonth > 0
    ? (currentMonthActual / dayOfAnchorMonth) * daysInAnchorMonth
    : 0
  const futureTarget = monthly.slice(anchorMonth).reduce((s, m) => s + m.target, 0)
  const projectedEOY = pastActual + currentMonthProjected + futureTarget

  const projectedAttainmentPct = targetTotal > 0 ? (projectedEOY / targetTotal) * 100 : 0

  // Required daily rate to close YTD gap by end of current month
  const daysRemainingInMonth = daysInAnchorMonth - dayOfAnchorMonth
  const currentMonthTarget = monthly[anchorMonth - 1]?.target ?? 0
  const gap = ytdActual - ytdTarget
  const needThisMonth = currentMonthTarget - currentMonthActual
  const requiredDailyRate = daysRemainingInMonth > 0 && needThisMonth > 0
    ? needThisMonth / daysRemainingInMonth
    : 0
  const avgDailyRate = dayOfAnchorMonth > 0 ? currentMonthActual / dayOfAnchorMonth : 0
  const paceMultiplier = requiredDailyRate > 0 ? avgDailyRate / requiredDailyRate : 1

  return {
    branchCode: args.branchCode,
    subdivision: args.subdivision,
    fullYearTarget: targetTotal,
    ytdTarget,
    ytdActual,
    ytdAttainmentPct,
    fullYearActual: monthly.reduce((s, m) => s + m.actual, 0),
    projectedEOY,
    projectedAttainmentPct,
    gap,
    gapEOY: projectedEOY - targetTotal,
    status: deriveStatus(ytdAttainmentPct),
    paceMultiplier,
    requiredDailyRate,
    monthly,
    cumulative,
  }
}

// ─── HO subdivision classifier ───────────────────────────────────────────────

/**
 * Classify an HO record into one of the four subdivision buckets defined in
 * `lib/targets/ho-mapping.ts`.  Returns `null` for non-HO records.
 */
function classifyHoRecord(record: SalesRecord): { subdivision: string; projectName?: string } | null {
  if (record.branchCode !== 'HO') return null
  return classifyHoLocation(record.locationCode)
}

// ─── Main entry point ────────────────────────────────────────────────────────

export function computeTargetDashboard(
  records: SalesRecord[],
  year: number,
  metric: Metric,
  filterBranches: string[] = [],
): TargetDashboardData {
  // Restrict records to the requested year
  const yearRecords = records.filter((r) => r.year === year)

  const anchor = findAnchor(yearRecords, year)
  const anchorMonth = anchor.year === year ? anchor.month : 12
  const anchorDate = anchor.dateIso
  const daysInAnchorMonth = anchor.daysInMonth
  const dayOfAnchorMonth = anchor.year === year ? anchor.dayOfMonth : anchor.daysInMonth

  // Aggregate actuals by branch × month
  const byBranchMonth = new Map<string, number[]>()     // branchCode → [12]
  const totalByMonth = new Array(12).fill(0)
  const byHoSubMonth = new Map<string, number[]>()       // subdivision → [12]

  // HO project-level aggregation (revenue bucket outside the 3 core divisions)
  type HoProjectAgg = {
    locationCode: string
    projectName: string
    revenue: number
    transactions: number
    customers: Map<string, number>
  }
  const hoProjectMap = new Map<string, HoProjectAgg>()   // locationCode → agg

  for (const r of yearRecords) {
    const m = r.monthNumber - 1
    if (m < 0 || m > 11) continue
    const rev = getRevenue(r, metric)

    const cur = byBranchMonth.get(r.branchCode) ?? new Array(12).fill(0)
    cur[m] += rev
    byBranchMonth.set(r.branchCode, cur)

    totalByMonth[m] += rev

    const ho = classifyHoRecord(r)
    if (ho) {
      const s = byHoSubMonth.get(ho.subdivision) ?? new Array(12).fill(0)
      s[m] += rev
      byHoSubMonth.set(ho.subdivision, s)

      // Track project-level detail for the "projects & other" bucket
      if (ho.subdivision === SUB_PROJECTS) {
        const loc = (r.locationCode || '(none)').trim()
        const agg = hoProjectMap.get(loc) ?? {
          locationCode: loc,
          projectName: ho.projectName ?? `โครงการ (${loc})`,
          revenue: 0,
          transactions: 0,
          customers: new Map<string, number>(),
        }
        agg.revenue += rev
        agg.transactions += 1
        const cust = r.customerName?.trim() || '(unknown)'
        agg.customers.set(cust, (agg.customers.get(cust) ?? 0) + rev)
        hoProjectMap.set(loc, agg)
      }
    }
  }

  const hoProjects: HoProjectRow[] = [...hoProjectMap.values()]
    .map((a) => {
      const topCust = [...a.customers.entries()].sort((x, y) => y[1] - x[1])[0]
      return {
        locationCode: a.locationCode,
        projectName: a.projectName,
        revenue: a.revenue,
        transactions: a.transactions,
        customers: a.customers.size,
        topCustomer: topCust?.[0],
      }
    })
    .sort((a, b) => b.revenue - a.revenue)

  // Build branch-level attainment
  const targetRows = getTargetsForYear(year)
  const branchCodesInTargets = new Set(targetRows.map((r) => r.branchCode))
  const allBranchCodes = new Set<string>([...branchCodesInTargets, ...byBranchMonth.keys()])

  let branchList = [...allBranchCodes]
  if (filterBranches.length) branchList = branchList.filter((b) => filterBranches.includes(b))

  const byBranch: BranchAttainment[] = branchList.map((code) => {
    const { monthly: tMonthly, total: tTotal } = getBranchTarget(year, code)
    const actuals = byBranchMonth.get(code) ?? new Array(12).fill(0)
    return buildAttainment({
      branchCode: code,
      year,
      anchorMonth,
      dayOfAnchorMonth,
      daysInAnchorMonth,
      targetMonthly: tMonthly,
      targetTotal: tTotal,
      actualByMonth: actuals,
    })
  }).sort((a, b) => b.fullYearTarget - a.fullYearTarget)

  // Overall
  const overallTargetMonthly = new Array(12).fill(0)
  let overallTargetTotal = 0
  for (const b of byBranch) {
    for (let i = 0; i < 12; i++) overallTargetMonthly[i] += b.monthly[i].target
    overallTargetTotal += b.fullYearTarget
  }
  const overall = buildAttainment({
    branchCode: 'ALL',
    year,
    anchorMonth,
    dayOfAnchorMonth,
    daysInAnchorMonth,
    targetMonthly: overallTargetMonthly,
    targetTotal: overallTargetTotal,
    actualByMonth: totalByMonth,
  })

  // HO subdivisions — build one row per target + one synthetic row for "projects"
  const subdivisionTargets = targetRows.filter((r) => r.subdivision)
  const byHoSubdivision: BranchAttainment[] = subdivisionTargets.map((tr: TargetRow) => {
    const actuals = byHoSubMonth.get(tr.subdivision!) ?? new Array(12).fill(0)
    return buildAttainment({
      branchCode: 'HO',
      subdivision: tr.subdivision,
      year,
      anchorMonth,
      dayOfAnchorMonth,
      daysInAnchorMonth,
      targetMonthly: tr.monthlyTargets,
      targetTotal: tr.total,
      actualByMonth: actuals,
    })
  }).filter((a) => a.fullYearTarget > 0)

  // Add a synthetic row for "งานโครงการและอื่น ๆ" (revenue without explicit target)
  const projectActuals = byHoSubMonth.get(SUB_PROJECTS)
  if (projectActuals && projectActuals.some((v) => v > 0)) {
    byHoSubdivision.push(buildAttainment({
      branchCode: 'HO',
      subdivision: SUB_PROJECTS,
      year,
      anchorMonth,
      dayOfAnchorMonth,
      daysInAnchorMonth,
      targetMonthly: new Array(12).fill(0),
      targetTotal: 0,
      actualByMonth: projectActuals,
    }))
  }
  byHoSubdivision.sort((a, b) => (b.fullYearTarget || b.fullYearActual) - (a.fullYearTarget || a.fullYearActual))

  // Heatmap — branch × month attainment
  const heatmap = byBranch.map((b) => ({
    branch: b.branchCode,
    cells: b.monthly.map((m) => ({
      month: m.month,
      attainmentPct: m.attainmentPct,
      actual: m.actual,
      target: m.target,
    })),
  }))

  // Variance waterfall — overall
  const waterfall = (() => {
    let cum = 0
    return overall.monthly.slice(0, anchorMonth).map((m) => {
      cum += m.variance
      return { month: m.month, label: m.label, variance: m.variance, cumulative: cum }
    })
  })()

  // At-risk branches
  const atRisk = byBranch
    .filter((b) => b.projectedAttainmentPct < 95 && b.fullYearTarget > 0)
    .map((b) => ({
      branchCode: b.branchCode,
      gap: Math.abs(b.gapEOY),
      projectedAttainmentPct: b.projectedAttainmentPct,
      requiredUpliftPct: b.projectedEOY > 0
        ? ((b.fullYearTarget - b.projectedEOY) / b.projectedEOY) * 100
        : 100,
    }))
    .sort((a, b) => b.gap - a.gap)

  // Salesperson contribution — total revenue attributable
  const spMap = new Map<string, { revenue: number; branches: Set<string> }>()
  for (const r of yearRecords) {
    const name = r.salespersonName?.trim() || '(unknown)'
    const cur = spMap.get(name) ?? { revenue: 0, branches: new Set<string>() }
    cur.revenue += getRevenue(r, metric)
    cur.branches.add(r.branchCode)
    spMap.set(name, cur)
  }
  const totalActual = overall.fullYearActual
  const salespersonContribution = [...spMap.entries()]
    .map(([name, v]) => ({
      name,
      revenue: v.revenue,
      branches: [...v.branches].sort(),
      share: totalActual > 0 ? (v.revenue / totalActual) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 20)

  return {
    year,
    anchorMonth,
    anchorDate,
    daysInAnchorMonth,
    dayOfAnchorMonth,
    availableYears: [2023, 2024, 2025, 2026].filter((y) => targetRows.length > 0 || y === year),
    overall,
    byBranch,
    byHoSubdivision,
    hoProjects,
    heatmap,
    waterfall,
    atRisk,
    salespersonContribution,
  }
}

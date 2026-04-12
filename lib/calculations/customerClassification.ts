/**
 * customerClassification.ts
 *
 * Classifies customers as New / Existing / Lost based on yearly activity.
 * "Returning" is a sub-category of Existing (customers who came back after
 * exactly 1 inactive year, gap=2).
 *
 * Business rules (confirmed by user):
 *
 *   New      — first-ever appearance, OR absent for 2+ consecutive full years
 *              Examples:
 *                first appearance in 2026                              → New
 *                active 2023, absent 2024+2025, active 2026 (gap=3)   → New
 *
 *   Existing — active in adjacent year (gap=1) OR came back after 1
 *              inactive year (gap=2).  This includes "Returning" customers.
 *              Examples:
 *                active 2023, active 2024, active 2025 (gap=1)        → Existing
 *                active 2023, absent 2024, active 2025 (gap=2)        → Existing
 *
 *   Returning — sub-category of Existing: gap=2 (came back after 1 absent year).
 *               Shown as a separate filterable status but counts within Existing.
 *
 *   Lost     — was active in the previous year but absent this year.
 *
 * Customer identity priority:
 *   1. Bill-to Customer No_   (customerNo)
 *   2. CustomerCodeWinspeed   (customerCode)
 *   3. normalized Bill-to Name (customerName)
 */

import type { SalesRecord } from '@/types'

// ─── Identity helpers ────────────────────────────────────────────────────────

/** Resolve a stable customer ID using priority order */
export function customerKey(r: SalesRecord): string {
  if (r.customerNo && r.customerNo.trim()) return `no:${r.customerNo.trim()}`
  if (r.customerCode && r.customerCode.trim()) return `code:${r.customerCode.trim()}`
  if (r.customerName) return `name:${normalizeName(r.customerName)}`
  return 'unknown'
}

/** Normalize a name for fuzzy-matching of duplicate customer entries */
export function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/บริษัท|จำกัด|มหาชน|\(.*?\)|company|co\.?,?|ltd\.?|limited/gi, '')
    .trim()
}

// ─── Per-customer history index ──────────────────────────────────────────────

export type CustomerProfile = {
  key: string
  displayName: string          // best-known display name
  customerNo?: string
  customerCode?: string
  customerGroupName?: string
  yearsActive: Set<number>     // all years with any transaction
  lastActiveYear: number       // most recent year with a transaction
  branches: Set<string>
  salespersons: Set<string>
  totalRevenue: number         // lifetime revenue (using netAmount / Amount)
  revenueByYear: Map<number, number>  // year → revenue (for period comparisons)
}

export function buildCustomerProfiles(
  records: SalesRecord[],
): Map<string, CustomerProfile> {
  const map = new Map<string, CustomerProfile>()

  for (const r of records) {
    const key = customerKey(r)
    let profile = map.get(key)
    if (!profile) {
      profile = {
        key,
        displayName: r.customerName ?? r.customerCode ?? r.customerNo ?? key,
        customerNo: r.customerNo,
        customerCode: r.customerCode,
        customerGroupName: r.customerGroupName,
        yearsActive: new Set(),
        lastActiveYear: r.year,
        branches: new Set(),
        salespersons: new Set(),
        totalRevenue: 0,
        revenueByYear: new Map(),
      }
      map.set(key, profile)
    }
    profile.yearsActive.add(r.year)
    if (r.year > profile.lastActiveYear) profile.lastActiveYear = r.year
    if (r.branchCode) profile.branches.add(r.branchCode)
    if (r.salespersonName) profile.salespersons.add(r.salespersonName)
    profile.totalRevenue += r.netAmount
    profile.revenueByYear.set(r.year, (profile.revenueByYear.get(r.year) ?? 0) + r.netAmount)
    // Prefer the most descriptive (longest) display name
    if (r.customerName && r.customerName.length > (profile.displayName?.length ?? 0)) {
      profile.displayName = r.customerName
    }
  }

  return map
}

// ─── Classification ──────────────────────────────────────────────────────────

export type CustomerStatus = 'new' | 'existing' | 'lost' | 'returning'

/**
 * Classify a customer for a target year given their full activity history.
 *
 * Returns:
 *   'new'       — first-ever OR returned after ≥2 full inactive years (gap≥3)
 *   'existing'  — active in adjacent year (gap=1) OR after 1 inactive year (gap=2)
 *   'returning' — sub-category of existing: gap=2 exactly (came back after 1 year)
 *   'lost'      — was active last year, absent this year
 *   null        — neither active nor lost (inactive for 2+ years, just dormant)
 */
export function classifyForYear(
  yearsActive: Set<number>,
  targetYear: number,
): CustomerStatus | null {
  if (yearsActive.has(targetYear)) {
    const priorYears = [...yearsActive].filter((y) => y < targetYear).sort((a, b) => a - b)

    // No prior history → first-ever → New
    if (priorYears.length === 0) return 'new'

    const lastActive = priorYears[priorYears.length - 1]
    const gap = targetYear - lastActive

    // gap≥3 means 2+ full inactive years → New
    if (gap >= 3) return 'new'

    // gap=2 means exactly 1 inactive year → Returning (sub-type of Existing)
    if (gap === 2) return 'returning'

    // gap=1 → Existing (consecutive year)
    return 'existing'
  }

  // Was active last year but not this year → Lost
  if (yearsActive.has(targetYear - 1)) return 'lost'

  // Dormant for 2+ years without returning — irrelevant for this year
  return null
}

// ─── Per-target-year breakdown ───────────────────────────────────────────────

export type CustomerBreakdown = {
  /** First-ever + returned after 2+ inactive years */
  new: CustomerProfile[]
  /** Consecutive OR returned after 1-year gap (includes 'returning') */
  existing: CustomerProfile[]
  /** Sub-set of existing: came back after exactly 1 inactive year */
  returning: CustomerProfile[]
  /** Was active last year, absent this year */
  lost: CustomerProfile[]
  /** Total active this year (new + existing) */
  totalActive: number
}

/**
 * Group all customers by their classification for a target year.
 * 'returning' is a sub-set of 'existing' (also appears in existing[]).
 */
export function classifyAll(
  profiles: Map<string, CustomerProfile>,
  targetYear: number,
): CustomerBreakdown {
  const result: CustomerBreakdown = {
    new: [],
    existing: [],
    returning: [],
    lost: [],
    totalActive: 0,
  }

  for (const profile of profiles.values()) {
    const status = classifyForYear(profile.yearsActive, targetYear)
    if (!status) continue

    if (status === 'new') {
      result.new.push(profile)
    } else if (status === 'returning') {
      // Returning is a sub-type of Existing: add to BOTH lists
      result.returning.push(profile)
      result.existing.push(profile)
    } else if (status === 'existing') {
      result.existing.push(profile)
    } else if (status === 'lost') {
      result.lost.push(profile)
    }
  }

  result.totalActive = result.new.length + result.existing.length
  return result
}

// ─── Per-branch / per-salesperson customer movement ──────────────────────────

export type EntityMovement = {
  name: string
  newCustomers: number
  existingCustomers: number
  lostCustomers: number
  returningCustomers: number
  // Revenue breakdown
  newRevenue: number        // revenue from new customers this year
  retainedRevenue: number   // revenue from existing (non-new) customers this year
  lostRevenue: number       // revenue those lost customers generated LAST year
  replacementRatio: number  // newRevenue / lostRevenue (0 if no lost revenue)
  // Drill-down lists
  newCustomerList: CustomerProfile[]
  lostCustomerList: CustomerProfile[]
}

/**
 * For each branch, compute customer movement and revenue replacement metrics.
 */
export function branchMovement(
  records: SalesRecord[],
  profiles: Map<string, CustomerProfile>,
  targetYear: number,
): EntityMovement[] {
  return entityMovement(records, profiles, targetYear, 'branchCode')
}

/** Same as branchMovement but grouped by salespersonName */
export function salespersonMovement(
  records: SalesRecord[],
  profiles: Map<string, CustomerProfile>,
  targetYear: number,
): EntityMovement[] {
  return entityMovement(records, profiles, targetYear, 'salespersonName')
}

function entityMovement(
  records: SalesRecord[],
  profiles: Map<string, CustomerProfile>,
  targetYear: number,
  groupKey: 'branchCode' | 'salespersonName',
): EntityMovement[] {
  // entity → customerKey → years active with that entity
  const entityCustomerYears = new Map<string, Map<string, Set<number>>>()
  // entity → customerKey → revenue in targetYear (for new/retained revenue calc)
  const entityCustomerRevTarget = new Map<string, Map<string, number>>()
  // entity → customerKey → revenue in targetYear-1 (for lost revenue calc)
  const entityCustomerRevPrior = new Map<string, Map<string, number>>()

  for (const r of records) {
    const ent = r[groupKey]
    if (!ent) continue
    const ck = customerKey(r)

    if (!entityCustomerYears.has(ent)) entityCustomerYears.set(ent, new Map())
    const yearMap = entityCustomerYears.get(ent)!
    if (!yearMap.has(ck)) yearMap.set(ck, new Set())
    yearMap.get(ck)!.add(r.year)

    if (r.year === targetYear) {
      if (!entityCustomerRevTarget.has(ent)) entityCustomerRevTarget.set(ent, new Map())
      const m = entityCustomerRevTarget.get(ent)!
      m.set(ck, (m.get(ck) ?? 0) + r.netAmount)
    }
    if (r.year === targetYear - 1) {
      if (!entityCustomerRevPrior.has(ent)) entityCustomerRevPrior.set(ent, new Map())
      const m = entityCustomerRevPrior.get(ent)!
      m.set(ck, (m.get(ck) ?? 0) + r.netAmount)
    }
  }

  const result: EntityMovement[] = []

  for (const [ent, customerYearMap] of entityCustomerYears) {
    const revTarget = entityCustomerRevTarget.get(ent) ?? new Map<string, number>()
    const revPrior = entityCustomerRevPrior.get(ent) ?? new Map<string, number>()

    let newCustomers = 0, existingCustomers = 0, lostCustomers = 0, returningCustomers = 0
    let newRevenue = 0, retainedRevenue = 0, lostRevenue = 0
    const newCustomerList: CustomerProfile[] = []
    const lostCustomerList: CustomerProfile[] = []

    for (const [ck, yearsActive] of customerYearMap) {
      const status = classifyForYear(yearsActive, targetYear)
      if (!status) continue
      const profile = profiles.get(ck)
      if (!profile) continue

      if (status === 'new') {
        newCustomers++
        newRevenue += revTarget.get(ck) ?? 0
        newCustomerList.push(profile)
      } else if (status === 'returning') {
        returningCustomers++
        existingCustomers++   // also count in existing
        retainedRevenue += revTarget.get(ck) ?? 0
      } else if (status === 'existing') {
        existingCustomers++
        retainedRevenue += revTarget.get(ck) ?? 0
      } else if (status === 'lost') {
        lostCustomers++
        lostRevenue += revPrior.get(ck) ?? 0  // what they spent LAST year
        lostCustomerList.push(profile)
      }
    }

    const replacementRatio = lostRevenue > 0 ? newRevenue / lostRevenue : 1

    result.push({
      name: ent,
      newCustomers,
      existingCustomers,
      lostCustomers,
      returningCustomers,
      newRevenue,
      retainedRevenue,
      lostRevenue,
      replacementRatio,
      newCustomerList: newCustomerList
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 50),
      lostCustomerList: lostCustomerList
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 50),
    })
  }

  return result.sort((a, b) => b.newCustomers - a.newCustomers)
}

// ─── Salesperson full performance summary ────────────────────────────────────

export type SalespersonPerformance = {
  name: string
  totalRevenue: number      // total revenue in targetYear
  retainedRevenue: number   // from customers who were also active last year
  lostRevenue: number       // from customers who were active last year but gone now
  newRevenue: number        // from brand-new customers this year
  returningRevenue: number  // from returning (gap=2) customers
  newCustomers: number
  existingCustomers: number
  lostCustomers: number
  returningCustomers: number
  replacementRatio: number  // newRevenue / lostRevenue
  netRevenueChange: number  // totalRevenue - (retainedRevenue + lostRevenue) [prior year base]
}

/**
 * Full per-salesperson performance breakdown for a target year.
 * Useful for answering: "Did this salesperson replace lost customers with new ones?"
 */
export function salespersonPerformance(
  records: SalesRecord[],
  profiles: Map<string, CustomerProfile>,
  targetYear: number,
): SalespersonPerformance[] {
  const movements = salespersonMovement(records, profiles, targetYear)

  // Build per-salesperson total revenue in targetYear
  const revByPerson = new Map<string, number>()
  const returningRevByPerson = new Map<string, number>()

  // Build per-salesperson, per-customer year-sets (for returning revenue)
  const entityCustomerYears = new Map<string, Map<string, Set<number>>>()
  const entityCustomerRevTarget = new Map<string, Map<string, number>>()

  for (const r of records) {
    const sp = r.salespersonName
    if (!sp) continue
    if (r.year === targetYear) {
      revByPerson.set(sp, (revByPerson.get(sp) ?? 0) + r.netAmount)
    }

    if (!entityCustomerYears.has(sp)) entityCustomerYears.set(sp, new Map())
    const ym = entityCustomerYears.get(sp)!
    const ck = customerKey(r)
    if (!ym.has(ck)) ym.set(ck, new Set())
    ym.get(ck)!.add(r.year)

    if (r.year === targetYear) {
      if (!entityCustomerRevTarget.has(sp)) entityCustomerRevTarget.set(sp, new Map())
      const m = entityCustomerRevTarget.get(sp)!
      m.set(ck, (m.get(ck) ?? 0) + r.netAmount)
    }
  }

  // Compute returning revenue per salesperson
  for (const [sp, ym] of entityCustomerYears) {
    let ret = 0
    for (const [ck, yrs] of ym) {
      if (classifyForYear(yrs, targetYear) === 'returning') {
        ret += entityCustomerRevTarget.get(sp)?.get(ck) ?? 0
      }
    }
    returningRevByPerson.set(sp, ret)
  }

  return movements.map((m) => {
    const totalRevenue = revByPerson.get(m.name) ?? 0
    const returningRevenue = returningRevByPerson.get(m.name) ?? 0
    // Prior year base = retained + lost (what we "should have had")
    const priorBase = m.retainedRevenue + m.lostRevenue
    const netRevenueChange = totalRevenue - priorBase

    return {
      name: m.name,
      totalRevenue,
      retainedRevenue: m.retainedRevenue,
      lostRevenue: m.lostRevenue,
      newRevenue: m.newRevenue,
      returningRevenue,
      newCustomers: m.newCustomers,
      existingCustomers: m.existingCustomers,
      lostCustomers: m.lostCustomers,
      returningCustomers: m.returningCustomers,
      replacementRatio: m.replacementRatio,
      netRevenueChange,
    }
  }).sort((a, b) => b.totalRevenue - a.totalRevenue)
}

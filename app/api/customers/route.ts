/**
 * POST /api/customers
 *
 * Single-pass implementation — iterates over all records exactly ONCE to build:
 *   - Customer profiles with revenueByYear
 *   - Per-entity (branch/salesperson) customer-year activity maps
 *   - Per-entity revenue in targetYear and targetYear-1
 *
 * Then does a second pass over profiles (O(customers), not O(records)) to
 * classify and compute movement metrics.
 */

import { NextResponse } from 'next/server'
import { getAllRecords } from '@/lib/db/store'
import {
  customerKey,
  normalizeName,
  classifyForYear,
  type CustomerProfile,
  type CustomerStatus,
} from '@/lib/calculations/customerClassification'
import type { SalesRecord } from '@/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ─── Types ────────────────────────────────────────────────────────────────────

type TrimmedProfile = {
  key: string; displayName: string; customerNo?: string; customerCode?: string
  customerGroupName?: string; yearsActive: number[]; lastActiveYear: number
  branches: string[]; salespersons: string[]
  totalRevenue: number; revenueThisYear: number; revenuePriorYear: number
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function trimProfile(p: CustomerProfile, targetYear: number): TrimmedProfile {
  return {
    key: p.key, displayName: p.displayName,
    customerNo: p.customerNo, customerCode: p.customerCode,
    customerGroupName: p.customerGroupName,
    yearsActive: Array.from(p.yearsActive).sort(),
    lastActiveYear: p.lastActiveYear,
    branches: Array.from(p.branches),
    salespersons: Array.from(p.salespersons),
    totalRevenue: p.totalRevenue,
    revenueThisYear: p.revenueByYear.get(targetYear) ?? 0,
    revenuePriorYear: p.revenueByYear.get(targetYear - 1) ?? 0,
  }
}

// ─── Single-pass builder ──────────────────────────────────────────────────────

interface EntityData {
  // customerKey → Set<year> (for this entity only)
  custYears: Map<string, Set<number>>
  // customerKey → revenue in targetYear
  revTarget: Map<string, number>
  // customerKey → revenue in targetYear-1
  revPrior: Map<string, number>
}

function buildAllData(records: SalesRecord[], targetYear: number) {
  // Customer profiles
  const profiles = new Map<string, CustomerProfile>()
  // Branch data
  const branchData = new Map<string, EntityData>()
  // Salesperson data
  const spData = new Map<string, EntityData>()

  const getEntity = (map: Map<string, EntityData>, key: string): EntityData => {
    let d = map.get(key)
    if (!d) { d = { custYears: new Map(), revTarget: new Map(), revPrior: new Map() }; map.set(key, d) }
    return d
  }

  // ── Single pass over all records ──────────────────────────────────────────
  for (const r of records) {
    const ck = customerKey(r)

    // Update customer profile
    let p = profiles.get(ck)
    if (!p) {
      p = {
        key: ck,
        displayName: r.customerName ?? r.customerCode ?? r.customerNo ?? ck,
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
      profiles.set(ck, p)
    }
    p.yearsActive.add(r.year)
    if (r.year > p.lastActiveYear) p.lastActiveYear = r.year
    if (r.branchCode) p.branches.add(r.branchCode)
    if (r.salespersonName) p.salespersons.add(r.salespersonName)
    p.totalRevenue += r.netAmount
    p.revenueByYear.set(r.year, (p.revenueByYear.get(r.year) ?? 0) + r.netAmount)
    if (r.customerName && r.customerName.length > p.displayName.length) {
      p.displayName = r.customerName
    }

    // Update branch entity data
    if (r.branchCode) {
      const bd = getEntity(branchData, r.branchCode)
      let ys = bd.custYears.get(ck); if (!ys) { ys = new Set(); bd.custYears.set(ck, ys) }
      ys.add(r.year)
      if (r.year === targetYear) bd.revTarget.set(ck, (bd.revTarget.get(ck) ?? 0) + r.netAmount)
      if (r.year === targetYear - 1) bd.revPrior.set(ck, (bd.revPrior.get(ck) ?? 0) + r.netAmount)
    }

    // Update salesperson entity data
    if (r.salespersonName) {
      const sd = getEntity(spData, r.salespersonName)
      let ys = sd.custYears.get(ck); if (!ys) { ys = new Set(); sd.custYears.set(ck, ys) }
      ys.add(r.year)
      if (r.year === targetYear) sd.revTarget.set(ck, (sd.revTarget.get(ck) ?? 0) + r.netAmount)
      if (r.year === targetYear - 1) sd.revPrior.set(ck, (sd.revPrior.get(ck) ?? 0) + r.netAmount)
    }
  }

  return { profiles, branchData, spData }
}

// ─── Classify all customers ───────────────────────────────────────────────────

function classifyProfiles(profiles: Map<string, CustomerProfile>, targetYear: number) {
  const breakdown = {
    new: [] as CustomerProfile[], existing: [] as CustomerProfile[],
    returning: [] as CustomerProfile[], lost: [] as CustomerProfile[],
    totalActive: 0,
  }
  for (const p of profiles.values()) {
    const s = classifyForYear(p.yearsActive, targetYear)
    if (s === 'new') breakdown.new.push(p)
    else if (s === 'returning') { breakdown.returning.push(p); breakdown.existing.push(p) }
    else if (s === 'existing') breakdown.existing.push(p)
    else if (s === 'lost') breakdown.lost.push(p)
  }
  breakdown.totalActive = breakdown.new.length + breakdown.existing.length
  return breakdown
}

// ─── Entity movement from pre-built EntityData ───────────────────────────────

function computeMovement(entityMap: Map<string, EntityData>, profiles: Map<string, CustomerProfile>, targetYear: number) {
  const result = []
  for (const [name, { custYears, revTarget, revPrior }] of entityMap) {
    let newC = 0, existC = 0, lostC = 0, retC = 0
    let newRev = 0, retainRev = 0, lostRev = 0
    const newList: CustomerProfile[] = []
    const lostList: CustomerProfile[] = []

    for (const [ck, yrs] of custYears) {
      const s = classifyForYear(yrs, targetYear)
      if (!s) continue
      const p = profiles.get(ck)
      if (!p) continue
      if (s === 'new')       { newC++; newRev += revTarget.get(ck) ?? 0; newList.push(p) }
      else if (s === 'returning') { retC++; existC++; retainRev += revTarget.get(ck) ?? 0 }
      else if (s === 'existing')  { existC++; retainRev += revTarget.get(ck) ?? 0 }
      else if (s === 'lost')      { lostC++; lostRev += revPrior.get(ck) ?? 0; lostList.push(p) }
    }
    const ratio = lostRev > 0 ? newRev / lostRev : 1
    result.push({
      name, newCustomers: newC, existingCustomers: existC, lostCustomers: lostC, returningCustomers: retC,
      newRevenue: newRev, retainedRevenue: retainRev, lostRevenue: lostRev, replacementRatio: ratio,
      newCustomerList: newList.sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 20),
      lostCustomerList: lostList.sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 20),
    })
  }
  return result.sort((a, b) => b.newCustomers - a.newCustomers)
}

// ─── Salesperson performance ──────────────────────────────────────────────────

function computeSalespersonPerf(
  spData: Map<string, EntityData>,
  profiles: Map<string, CustomerProfile>,
  targetYear: number,
) {
  return computeMovement(spData, profiles, targetYear).map((m) => ({
    name: m.name,
    totalRevenue: m.newRevenue + m.retainedRevenue,
    retainedRevenue: m.retainedRevenue,
    lostRevenue: m.lostRevenue,
    newRevenue: m.newRevenue,
    newCustomers: m.newCustomers,
    existingCustomers: m.existingCustomers,
    lostCustomers: m.lostCustomers,
    returningCustomers: m.returningCustomers,
    replacementRatio: m.replacementRatio,
    netRevenueChange: (m.newRevenue + m.retainedRevenue) - (m.retainedRevenue + m.lostRevenue),
  })).sort((a, b) => b.totalRevenue - a.totalRevenue)
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const records = await getAllRecords()
  const allYears = Array.from(new Set(records.map((r) => r.year))).sort((a, b) => a - b)
  const targetYear: number = body.targetYear ?? allYears[allYears.length - 1] ?? new Date().getFullYear()

  // Single pass — build everything at once
  const { profiles, branchData, spData } = buildAllData(records, targetYear)

  const breakdown = classifyProfiles(profiles, targetYear)
  const branchMov = computeMovement(branchData, profiles, targetYear)
  const spMov = computeMovement(spData, profiles, targetYear)
  const spPerf = computeSalespersonPerf(spData, profiles, targetYear)

  // Sort named lists
  const sortActive = (arr: CustomerProfile[]) =>
    arr.sort((a, b) => (b.revenueByYear.get(targetYear) ?? 0) - (a.revenueByYear.get(targetYear) ?? 0))
  const sortLost = (arr: CustomerProfile[]) =>
    arr.sort((a, b) => (b.revenueByYear.get(targetYear - 1) ?? 0) - (a.revenueByYear.get(targetYear - 1) ?? 0))

  const lostRevenuePriorYear = breakdown.lost.reduce((s, p) => s + (p.revenueByYear.get(targetYear - 1) ?? 0), 0)
  const newRevenueThisYear   = breakdown.new.reduce((s, p)  => s + (p.revenueByYear.get(targetYear) ?? 0), 0)

  return NextResponse.json({
    targetYear, allYears,
    counts: {
      new: breakdown.new.length, existing: breakdown.existing.length,
      returning: breakdown.returning.length, lost: breakdown.lost.length,
      totalActive: breakdown.totalActive, totalCustomers: profiles.size,
    },
    revenueMetrics: {
      lostRevenuePriorYear, newRevenueThisYear,
      replacementRatio: lostRevenuePriorYear > 0 ? newRevenueThisYear / lostRevenuePriorYear : null,
    },
    namedLists: {
      new:       sortActive(breakdown.new).slice(0, 200).map((p) => trimProfile(p, targetYear)),
      existing:  sortActive(breakdown.existing).slice(0, 200).map((p) => trimProfile(p, targetYear)),
      returning: sortActive(breakdown.returning).slice(0, 200).map((p) => trimProfile(p, targetYear)),
      lost:      sortLost(breakdown.lost).slice(0, 200).map((p) => trimProfile(p, targetYear)),
    },
    branchMovement: branchMov.map((m) => ({
      ...m,
      newCustomerList: m.newCustomerList.map((p) => trimProfile(p, targetYear)),
      lostCustomerList: m.lostCustomerList.map((p) => trimProfile(p, targetYear)),
    })),
    salespersonMovement: spMov.map((m) => ({
      ...m,
      newCustomerList: m.newCustomerList.map((p) => trimProfile(p, targetYear)),
      lostCustomerList: m.lostCustomerList.map((p) => trimProfile(p, targetYear)),
    })),
    salespersonPerformance: spPerf,
  })
}

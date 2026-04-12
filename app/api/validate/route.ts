/**
 * GET /api/validate
 *
 * Runs built-in validation tests for:
 *   1. Customer classification rules (New/Existing/Returning/Lost)
 *   2. Revenue field source-of-truth checks
 *   3. Roll-up consistency: profile totals == raw record sum
 *
 * Call this after importing data to confirm correctness.
 */

import { NextResponse } from 'next/server'
import { getAllRecords } from '@/lib/db/store'
import {
  classifyForYear,
  buildCustomerProfiles,
  classifyAll,
} from '@/lib/calculations/customerClassification'
import type { SalesRecord } from '@/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type TestResult = { ok: boolean; label: string; detail?: string }

// ─── Classification unit tests ────────────────────────────────────────────────

function classifyTests(): TestResult[] {
  const t = (label: string, years: number[], target: number, expected: string | null): TestResult => {
    const got = classifyForYear(new Set(years), target)
    return { ok: got === expected, label, detail: got !== expected ? `expected ${expected}, got ${got}` : undefined }
  }

  return [
    t('first-ever appearance → new', [2026], 2026, 'new'),
    t('active 2023, absent 2024+2025, active 2026 (gap=3) → new', [2023, 2026], 2026, 'new'),
    t('active 2022, absent 2023+2024, active 2025 (gap=3) → new', [2022, 2025], 2025, 'new'),
    t('consecutive years (gap=1) → existing', [2023, 2024], 2024, 'existing'),
    t('active every year → existing', [2022, 2023, 2024, 2025], 2025, 'existing'),
    t('absent 1 year (gap=2) → returning', [2023, 2025], 2025, 'returning'),
    t('absent 1 year (gap=2, earlier) → returning', [2022, 2024], 2024, 'returning'),
    t('every-other-year pattern (gap=2) → returning', [2020, 2022, 2024], 2024, 'returning'),
    t('active 2024, absent 2025 → lost', [2024], 2025, 'lost'),
    t('active 2022-2024, absent 2025 → lost', [2022, 2023, 2024], 2025, 'lost'),
    t('dormant 5 years → null', [2020], 2025, null),
  ]
}

// ─── Integration: classifyAll returning-in-existing ──────────────────────────

function integrationTests(): TestResult[] {
  const makeRecord = (year: number, customerNo: string, name: string, amount: number): SalesRecord => ({
    postingDate: `${year}-06-01`, year, quarter: 'Q2', month: 'June', monthNumber: 6,
    branchCode: 'BK', salespersonName: 'Test SP', netAmount: amount,
    customerNo, customerName: name,
  })

  const records: SalesRecord[] = [
    makeRecord(2025, 'C001', 'Customer A', 100_000),           // new (first-ever)
    makeRecord(2024, 'C002', 'Customer B', 200_000),           // existing (consecutive)
    makeRecord(2025, 'C002', 'Customer B', 210_000),
    makeRecord(2023, 'C003', 'Customer C', 150_000),           // returning (gap=2)
    makeRecord(2025, 'C003', 'Customer C', 140_000),
    makeRecord(2022, 'C004', 'Customer D', 300_000),           // new (gap=3)
    makeRecord(2025, 'C004', 'Customer D', 280_000),
    makeRecord(2024, 'C005', 'Customer E', 120_000),           // lost
  ]

  const profiles = buildCustomerProfiles(records)
  const bd = classifyAll(profiles, 2025)

  const check = (label: string, ok: boolean, detail?: string): TestResult => ({ ok, label, detail })

  return [
    check('C001 is new', bd.new.some((p) => p.customerNo === 'C001')),
    check('C002 is existing (not returning)', bd.existing.some((p) => p.customerNo === 'C002') && !bd.returning.some((p) => p.customerNo === 'C002')),
    check('C003 is returning AND in existing list', bd.returning.some((p) => p.customerNo === 'C003') && bd.existing.some((p) => p.customerNo === 'C003')),
    check('C004 is new (gap=3)', bd.new.some((p) => p.customerNo === 'C004')),
    check('C005 is lost', bd.lost.some((p) => p.customerNo === 'C005')),
    check('totalActive = new + existing (no double-count)', bd.totalActive === bd.new.length + bd.existing.length,
      `totalActive=${bd.totalActive}, new=${bd.new.length}, existing=${bd.existing.length}`),
  ]
}

// ─── Revenue validation against live data ────────────────────────────────────

async function revenueTests(): Promise<TestResult[]> {
  const records = await getAllRecords()
  if (records.length === 0) return [{ ok: true, label: 'Revenue checks skipped (no data)' }]

  const results: TestResult[] = []

  // 1. Profile revenue sum == raw record sum
  const rawSum = records.reduce((s, r) => s + r.netAmount, 0)
  const profiles = buildCustomerProfiles(records)
  const profileSum = Array.from(profiles.values()).reduce((s, p) => s + p.totalRevenue, 0)
  const diff = Math.abs(rawSum - profileSum)
  results.push({
    ok: diff < 1,
    label: 'Profile totalRevenue sum == raw netAmount sum',
    detail: diff >= 1 ? `diff=${diff.toFixed(2)}, raw=${rawSum.toFixed(2)}, profiles=${profileSum.toFixed(2)}` : `both = ฿${rawSum.toFixed(2)}`,
  })

  // 2. revenueByYear sums to totalRevenue per profile (sample first 100 profiles)
  let byYearMismatch = 0
  let checked = 0
  for (const p of profiles.values()) {
    if (checked++ > 100) break
    const byYearSum = Array.from(p.revenueByYear.values()).reduce((s, v) => s + v, 0)
    if (Math.abs(byYearSum - p.totalRevenue) >= 1) byYearMismatch++
  }
  results.push({
    ok: byYearMismatch === 0,
    label: 'revenueByYear sums to totalRevenue (sample of 100 profiles)',
    detail: byYearMismatch > 0 ? `${byYearMismatch} profiles with mismatch` : undefined,
  })

  // 3. No record has undefined/NaN netAmount
  const badRevCount = records.filter((r) => typeof r.netAmount !== 'number' || isNaN(r.netAmount)).length
  results.push({
    ok: badRevCount === 0,
    label: 'All records have valid netAmount (Amount field)',
    detail: badRevCount > 0 ? `${badRevCount} records with bad netAmount` : `${records.length} records OK`,
  })

  // 4. Branch rollup: sum of per-branch revenues == total (no records excluded)
  const branchSum = records.reduce((acc, r) => {
    acc[r.branchCode] = (acc[r.branchCode] ?? 0) + r.netAmount
    return acc
  }, {} as Record<string, number>)
  const branchTotal = Object.values(branchSum).reduce((s, v) => s + v, 0)
  results.push({
    ok: Math.abs(branchTotal - rawSum) < 1,
    label: 'Branch revenues roll up to total',
    detail: `branches: ${Object.keys(branchSum).length}, branchTotal=${branchTotal.toFixed(2)}, rawSum=${rawSum.toFixed(2)}`,
  })

  // 5. Salesperson rollup
  const spSum = records.reduce((acc, r) => {
    acc[r.salespersonName] = (acc[r.salespersonName] ?? 0) + r.netAmount
    return acc
  }, {} as Record<string, number>)
  const spTotal = Object.values(spSum).reduce((s, v) => s + v, 0)
  results.push({
    ok: Math.abs(spTotal - rawSum) < 1,
    label: 'Salesperson revenues roll up to total',
    detail: `salespeople: ${Object.keys(spSum).length}, spTotal=${spTotal.toFixed(2)}, rawSum=${rawSum.toFixed(2)}`,
  })

  return results
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET() {
  const classification = classifyTests()
  const integration = integrationTests()
  const revenue = await revenueTests()

  const all = [
    { section: 'Classification Unit Tests', results: classification },
    { section: 'Integration Tests (classifyAll)', results: integration },
    { section: 'Revenue Validation (live data)', results: revenue },
  ]

  const totalPassed = all.reduce((s, g) => s + g.results.filter((r) => r.ok).length, 0)
  const totalFailed = all.reduce((s, g) => s + g.results.filter((r) => !r.ok).length, 0)

  return NextResponse.json({
    summary: { passed: totalPassed, failed: totalFailed, total: totalPassed + totalFailed },
    groups: all,
  })
}

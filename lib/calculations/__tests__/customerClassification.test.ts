/**
 * customerClassification.test.ts
 *
 * Validates the core customer classification business rules.
 * Run with: npx ts-node --project tsconfig.json lib/calculations/__tests__/customerClassification.test.ts
 * (or add jest / vitest to run as unit tests)
 *
 * Business rules tested:
 *   New      = first-ever appearance OR gap≥3 (2+ full inactive years)
 *   Existing = gap=1 (consecutive)
 *   Returning= gap=2 (came back after 1 absent year — sub-category of Existing)
 *   Lost     = active last year, absent this year
 */

import { classifyForYear, buildCustomerProfiles, classifyAll } from '../customerClassification'
import type { SalesRecord } from '../../../types'

// ─── Unit tests for classifyForYear ─────────────────────────────────────────

type TestCase = {
  desc: string
  yearsActive: number[]
  targetYear: number
  expected: string | null
}

const cases: TestCase[] = [
  // ── New ──────────────────────────────────────────────────────────────────
  {
    desc: 'first-ever appearance → New',
    yearsActive: [2026],
    targetYear: 2026,
    expected: 'new',
  },
  {
    desc: 'active 2023, absent 2024+2025, active 2026 (gap=3, 2 full inactive years) → New',
    yearsActive: [2023, 2026],
    targetYear: 2026,
    expected: 'new',
  },
  {
    desc: 'active 2022, absent 2023+2024, active 2025 (gap=3) → New',
    yearsActive: [2022, 2025],
    targetYear: 2025,
    expected: 'new',
  },

  // ── Existing ─────────────────────────────────────────────────────────────
  {
    desc: 'active 2023 and 2024 → Existing (gap=1, consecutive)',
    yearsActive: [2023, 2024],
    targetYear: 2024,
    expected: 'existing',
  },
  {
    desc: 'active every year → Existing',
    yearsActive: [2022, 2023, 2024, 2025],
    targetYear: 2025,
    expected: 'existing',
  },

  // ── Returning (sub-category of Existing, gap=2) ──────────────────────────
  {
    desc: 'active 2023, absent 2024, active 2025 (gap=2, 1 inactive year) → Returning',
    yearsActive: [2023, 2025],
    targetYear: 2025,
    expected: 'returning',
  },
  {
    desc: 'active 2022, absent 2023, active 2024 (gap=2) → Returning',
    yearsActive: [2022, 2024],
    targetYear: 2024,
    expected: 'returning',
  },
  {
    desc: 'active every other year (gap=2 pattern) → Returning',
    yearsActive: [2020, 2022, 2024],
    targetYear: 2024,
    expected: 'returning',
  },

  // ── Lost ─────────────────────────────────────────────────────────────────
  {
    desc: 'active 2024, absent 2025 → Lost',
    yearsActive: [2024],
    targetYear: 2025,
    expected: 'lost',
  },
  {
    desc: 'active 2022+2023+2024, absent 2025 → Lost',
    yearsActive: [2022, 2023, 2024],
    targetYear: 2025,
    expected: 'lost',
  },

  // ── Null (dormant, not relevant) ─────────────────────────────────────────
  {
    desc: 'active 2020 only, asking 2025 (gap=5) → null (dormant)',
    yearsActive: [2020],
    targetYear: 2025,
    expected: null,
  },
  {
    desc: 'absent entire period → null',
    yearsActive: [2022],
    targetYear: 2024,
    expected: null,
  },
]

// ─── Run tests ───────────────────────────────────────────────────────────────

let passed = 0
let failed = 0

console.log('=== Customer Classification Tests ===\n')

for (const tc of cases) {
  const result = classifyForYear(new Set(tc.yearsActive), tc.targetYear)
  const ok = result === tc.expected
  if (ok) {
    passed++
    console.log(`  ✓  ${tc.desc}`)
  } else {
    failed++
    console.error(`  ✗  ${tc.desc}`)
    console.error(`     expected: ${tc.expected}`)
    console.error(`     got:      ${result}`)
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${cases.length} tests.\n`)

// ─── Integration: classifyAll with returning-in-existing rule ────────────────

console.log('=== Integration: classifyAll (returning is sub-set of existing) ===\n')

const makeRecord = (
  year: number,
  customerNo: string,
  name: string,
  amount: number,
): SalesRecord => ({
  postingDate: `${year}-06-01`,
  year,
  quarter: 'Q2',
  month: 'June',
  monthNumber: 6,
  branchCode: 'BK',
  salespersonName: 'Test SP',
  netAmount: amount,
  customerNo,
  customerName: name,
})

const integRecords: SalesRecord[] = [
  // Customer A: new in 2025 (first-ever)
  makeRecord(2025, 'C001', 'Customer A', 100_000),

  // Customer B: existing in 2025 (was active 2024, consecutive)
  makeRecord(2024, 'C002', 'Customer B', 200_000),
  makeRecord(2025, 'C002', 'Customer B', 210_000),

  // Customer C: returning in 2025 (absent 2024, active 2023+2025, gap=2)
  makeRecord(2023, 'C003', 'Customer C', 150_000),
  makeRecord(2025, 'C003', 'Customer C', 140_000),

  // Customer D: new in 2025 (absent 2023+2024, last seen 2022, gap=3)
  makeRecord(2022, 'C004', 'Customer D', 300_000),
  makeRecord(2025, 'C004', 'Customer D', 280_000),

  // Customer E: lost in 2025 (active 2024, absent 2025)
  makeRecord(2024, 'C005', 'Customer E', 120_000),
]

const profiles = buildCustomerProfiles(integRecords)
const bd = classifyAll(profiles, 2025)

const checks: [string, boolean, string][] = [
  ['C001 is new', bd.new.some((p) => p.customerNo === 'C001'), 'expected C001 in new'],
  ['C002 is existing (not returning)', bd.existing.some((p) => p.customerNo === 'C002') && !bd.returning.some((p) => p.customerNo === 'C002'), 'expected C002 in existing only'],
  ['C003 is returning (in both existing and returning)', bd.returning.some((p) => p.customerNo === 'C003') && bd.existing.some((p) => p.customerNo === 'C003'), 'expected C003 in returning AND existing'],
  ['C004 is new (gap=3)', bd.new.some((p) => p.customerNo === 'C004'), 'expected C004 in new'],
  ['C005 is lost', bd.lost.some((p) => p.customerNo === 'C005'), 'expected C005 in lost'],
  ['total active = new + existing (not double-counting returning)', bd.totalActive === bd.new.length + bd.existing.length, `totalActive ${bd.totalActive} != new(${bd.new.length}) + existing(${bd.existing.length})`],
]

let intPassed = 0
let intFailed = 0
for (const [label, ok, errMsg] of checks) {
  if (ok) {
    intPassed++
    console.log(`  ✓  ${label}`)
  } else {
    intFailed++
    console.error(`  ✗  ${label} — ${errMsg}`)
  }
}

console.log(`\n${intPassed} passed, ${intFailed} failed.\n`)

// ─── Revenue validation ───────────────────────────────────────────────────────

console.log('=== Revenue Validation ===\n')

// Validate that totalRevenue in profiles sums correctly
const expectedTotal = integRecords.reduce((s, r) => s + r.netAmount, 0)
const actualTotal = Array.from(profiles.values()).reduce((s, p) => s + p.totalRevenue, 0)
const revOk = Math.abs(expectedTotal - actualTotal) < 0.01

console.log(`  ${revOk ? '✓' : '✗'}  Profile revenue totals match raw record sum (expected ${expectedTotal}, got ${actualTotal})`)

// Validate revenueByYear
const c002Profile = profiles.get('no:C002')
const c002Rev2024 = c002Profile?.revenueByYear.get(2024) ?? 0
const c002Rev2025 = c002Profile?.revenueByYear.get(2025) ?? 0
const revByYearOk = c002Rev2024 === 200_000 && c002Rev2025 === 210_000

console.log(`  ${revByYearOk ? '✓' : '✗'}  C002 revenueByYear: 2024=${c002Rev2024} (expected 200000), 2025=${c002Rev2025} (expected 210000)`)

// Lost customer prior-year revenue
const c005Profile = profiles.get('no:C005')
const c005PriorRev = c005Profile?.revenueByYear.get(2024) ?? 0
const lostRevOk = c005PriorRev === 120_000
console.log(`  ${lostRevOk ? '✓' : '✗'}  C005 (lost) prior-year revenue: ${c005PriorRev} (expected 120000)`)

const totalFailed = failed + intFailed + (revOk ? 0 : 1) + (revByYearOk ? 0 : 1) + (lostRevOk ? 0 : 1)
if (totalFailed > 0) {
  console.error(`\n❌ ${totalFailed} test(s) failed.\n`)
  process.exit(1)
} else {
  console.log('\n✅ All tests passed.\n')
}

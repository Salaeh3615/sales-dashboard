/**
 * decomposition.ts — Revenue Decomposition / PVM (Price-Volume-Mix) engine.
 *
 * เป้าหมาย: เมื่อรายได้เปลี่ยนระหว่าง 2 ช่วง (ปี/ไตรมาส/เดือน) สามารถอธิบาย
 * "ทำไม" ได้ในเชิงผู้บริหาร ไม่ใช่แค่ตัวเลขเปลี่ยนเท่าไหร่
 *
 * สิ่งที่ส่งออก:
 *   - PVM decomposition (Price × Volume × Mix)
 *   - Customer Bridge (top 5 contributors / detractors + new / lost)
 *   - Segment Bridge (new / retained / returning / lost)
 *   - Test Bridge (top growing / declining tests)
 *   - Branch Bridge (สาขาหลักที่ทำให้รายได้เปลี่ยน)
 *   - Auto narrative (ภาษาไทย — เล่าสาเหตุเชิงสาเหตุที่แท้จริง)
 */

import type { SalesRecord } from '@/types'

// ─── Period helpers ──────────────────────────────────────────────────────────

export type PeriodId = string  // "2025" | "2025-Q1" | "2025-01"

export function recordPeriod(r: SalesRecord, granularity: 'year' | 'quarter' | 'month' = 'quarter'): PeriodId {
  const d = new Date(r.postingDate)
  const y = d.getFullYear()
  if (granularity === 'year') return String(y)
  if (granularity === 'month') {
    const m = String(d.getMonth() + 1).padStart(2, '0')
    return `${y}-${m}`
  }
  const q = Math.ceil((d.getMonth() + 1) / 3)
  return `${y}-Q${q}`
}

export function matchesPeriod(r: SalesRecord, p: PeriodId): boolean {
  const d = new Date(r.postingDate)
  const y = d.getFullYear()
  if (p.includes('-Q')) {
    const [yy, q] = p.split('-Q')
    const qd = Math.ceil((d.getMonth() + 1) / 3)
    return y === +yy && qd === +q
  }
  if (/^\d{4}-\d{2}$/.test(p)) {
    const [yy, mm] = p.split('-')
    return y === +yy && (d.getMonth() + 1) === +mm
  }
  return y === +p
}

// ─── Helper: aggregate totals for a period ───────────────────────────────────

type EntityAgg = {
  revenue: number
  quantity: number
  customers: Set<string>
  txCount: number
}

function emptyAgg(): EntityAgg {
  return { revenue: 0, quantity: 0, customers: new Set(), txCount: 0 }
}

function custKey(r: SalesRecord): string {
  return r.customerNo || r.customerCode ||
    (r.customerName ?? '').trim().toLowerCase() || '(unknown)'
}

function testKey(r: SalesRecord): string {
  return r.testCode || r.productCode || '(no-code)'
}

function testLabel(r: SalesRecord): string {
  return r.description || r.productDescription || r.testCode || r.productCode || '(no-description)'
}

// ─── PVM decomposition ────────────────────────────────────────────────────────

export type PVM = {
  totalA: number
  totalB: number
  delta: number
  deltaPct: number | null
  priceEffect: number     // Σ((P_b − P_a) × Q_b)
  volumeEffect: number    // Σ((Q_b − Q_a) × P_a)  for items in both
  mixEffect: number       // ส่วนต่างเชิง mix (สินค้าใหม่ / หาย / สัดส่วนเปลี่ยน)
  newProductRevenue: number
  lostProductRevenue: number
  notes: string[]         // คำอธิบายรายการที่ assumption ใช้
}

export function computePVM(records: SalesRecord[], periodA: PeriodId, periodB: PeriodId): PVM {
  // กลุ่มต่อ test: { qty, revenue }
  const aMap = new Map<string, { qty: number; rev: number }>()
  const bMap = new Map<string, { qty: number; rev: number }>()

  let totalA = 0
  let totalB = 0

  for (const r of records) {
    const k = testKey(r)
    const qty = r.quantity ?? 1
    if (matchesPeriod(r, periodA)) {
      const e = aMap.get(k) ?? { qty: 0, rev: 0 }
      e.qty += qty
      e.rev += r.netAmount
      aMap.set(k, e)
      totalA += r.netAmount
    }
    if (matchesPeriod(r, periodB)) {
      const e = bMap.get(k) ?? { qty: 0, rev: 0 }
      e.qty += qty
      e.rev += r.netAmount
      bMap.set(k, e)
      totalB += r.netAmount
    }
  }

  let priceEffect = 0
  let volumeEffect = 0
  let newProductRevenue = 0
  let lostProductRevenue = 0

  // common products → price + volume effect
  for (const [k, b] of bMap) {
    const a = aMap.get(k)
    if (!a) {
      newProductRevenue += b.rev
      continue
    }
    const Pa = a.qty > 0 ? a.rev / a.qty : 0
    const Pb = b.qty > 0 ? b.rev / b.qty : 0
    priceEffect  += (Pb - Pa) * b.qty
    volumeEffect += (b.qty - a.qty) * Pa
  }
  for (const [k, a] of aMap) {
    if (!bMap.has(k)) lostProductRevenue += a.rev
  }

  const delta = totalB - totalA
  // mix = ส่วนที่อธิบายไม่ได้ด้วย price + volume + (new − lost)
  const mixEffect = delta - priceEffect - volumeEffect - newProductRevenue - (-lostProductRevenue)
  // หมายเหตุ: lostProductRevenue ถูกคำนวณเป็นค่าบวก แต่มีผลในเชิงลบต่อ B
  // ดังนั้นใส่เครื่องหมายลบเข้า mix formula ให้ครบ

  return {
    totalA,
    totalB,
    delta,
    deltaPct: totalA !== 0 ? (delta / totalA) * 100 : null,
    priceEffect,
    volumeEffect,
    mixEffect,
    newProductRevenue,
    lostProductRevenue,
    notes: [
      'Price effect = Σ((Pb − Pa) × Qb) สำหรับ test ที่มีทั้งสองช่วง',
      'Volume effect = Σ((Qb − Qa) × Pa) สำหรับ test ที่มีทั้งสองช่วง',
      'Mix = Δ − Price − Volume − ส่วนของสินค้าใหม่/หาย',
    ],
  }
}

// ─── Bridge: Customer ────────────────────────────────────────────────────────

export type BridgeRow = {
  key: string
  label: string
  revenueA: number
  revenueB: number
  delta: number
  deltaPct: number | null
  category: 'new' | 'lost' | 'grown' | 'declined' | 'flat'
  meta?: Record<string, string | number>
}

export type Bridge = {
  totalA: number
  totalB: number
  delta: number
  topContributors: BridgeRow[]   // ขึ้นมาก
  topDetractors: BridgeRow[]     // ลดมาก
  newEntities: BridgeRow[]
  lostEntities: BridgeRow[]
  rows: BridgeRow[]              // ทั้งหมด (sort by abs delta desc)
}

function buildBridge<T>(
  records: SalesRecord[],
  periodA: PeriodId,
  periodB: PeriodId,
  keyFn: (r: SalesRecord) => string,
  labelFn: (r: SalesRecord) => string,
  metaFn?: (r: SalesRecord) => Record<string, string | number>,
): Bridge {
  const aMap = new Map<string, number>()
  const bMap = new Map<string, number>()
  const labelMap = new Map<string, string>()
  const metaMap = new Map<string, Record<string, string | number>>()

  for (const r of records) {
    const k = keyFn(r)
    if (!labelMap.has(k)) {
      labelMap.set(k, labelFn(r))
      if (metaFn) metaMap.set(k, metaFn(r))
    }
    if (matchesPeriod(r, periodA)) aMap.set(k, (aMap.get(k) ?? 0) + r.netAmount)
    if (matchesPeriod(r, periodB)) bMap.set(k, (bMap.get(k) ?? 0) + r.netAmount)
  }

  const allKeys = new Set<string>([...aMap.keys(), ...bMap.keys()])
  const rows: BridgeRow[] = []
  for (const k of allKeys) {
    const a = aMap.get(k) ?? 0
    const b = bMap.get(k) ?? 0
    const d = b - a
    let category: BridgeRow['category'] = 'flat'
    if (a === 0 && b > 0) category = 'new'
    else if (b === 0 && a > 0) category = 'lost'
    else if (d > 0) category = 'grown'
    else if (d < 0) category = 'declined'
    rows.push({
      key: k,
      label: labelMap.get(k) ?? k,
      revenueA: a,
      revenueB: b,
      delta: d,
      deltaPct: a !== 0 ? (d / a) * 100 : null,
      category,
      meta: metaMap.get(k),
    })
  }

  rows.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))

  const totalA = [...aMap.values()].reduce((s, v) => s + v, 0)
  const totalB = [...bMap.values()].reduce((s, v) => s + v, 0)

  const topContributors = rows.filter((r) => r.delta > 0).slice(0, 5)
  const topDetractors = rows.filter((r) => r.delta < 0).slice(0, 5)
  const newEntities = rows.filter((r) => r.category === 'new').sort((a, b) => b.revenueB - a.revenueB).slice(0, 10)
  const lostEntities = rows.filter((r) => r.category === 'lost').sort((a, b) => b.revenueA - a.revenueA).slice(0, 10)

  return {
    totalA,
    totalB,
    delta: totalB - totalA,
    topContributors,
    topDetractors,
    newEntities,
    lostEntities,
    rows: rows.slice(0, 50),
  }
}

// ─── Segment Bridge (new / retained / returning / lost) ──────────────────────

export type SegmentBridge = {
  newRevenue: number
  retainedRevenue: number       // ลูกค้าที่ซื้อทั้ง A และ B
  retainedRevenueA: number      // ลูกค้าเดียวกัน ในช่วง A → ใช้ดู same-store growth
  lostRevenue: number           // เคยซื้อใน A แต่ไม่ซื้อใน B
  organicGrowth: number         // retainedB − retainedA (same-store)
  organicGrowthPct: number | null
  newCount: number
  retainedCount: number
  lostCount: number
}

export function computeSegmentBridge(records: SalesRecord[], periodA: PeriodId, periodB: PeriodId): SegmentBridge {
  const aRev = new Map<string, number>()
  const bRev = new Map<string, number>()

  for (const r of records) {
    const k = custKey(r)
    if (matchesPeriod(r, periodA)) aRev.set(k, (aRev.get(k) ?? 0) + r.netAmount)
    if (matchesPeriod(r, periodB)) bRev.set(k, (bRev.get(k) ?? 0) + r.netAmount)
  }

  let newRevenue = 0
  let retainedRevenue = 0
  let retainedRevenueA = 0
  let lostRevenue = 0
  let newCount = 0, retainedCount = 0, lostCount = 0

  const allKeys = new Set<string>([...aRev.keys(), ...bRev.keys()])
  for (const k of allKeys) {
    const a = aRev.get(k) ?? 0
    const b = bRev.get(k) ?? 0
    if (a === 0 && b > 0) { newRevenue += b; newCount++ }
    else if (a > 0 && b === 0) { lostRevenue += a; lostCount++ }
    else if (a > 0 && b > 0) {
      retainedRevenue += b
      retainedRevenueA += a
      retainedCount++
    }
  }

  const organicGrowth = retainedRevenue - retainedRevenueA
  return {
    newRevenue,
    retainedRevenue,
    retainedRevenueA,
    lostRevenue,
    organicGrowth,
    organicGrowthPct: retainedRevenueA !== 0 ? (organicGrowth / retainedRevenueA) * 100 : null,
    newCount,
    retainedCount,
    lostCount,
  }
}

// ─── Decomposition aggregator ────────────────────────────────────────────────

export type DecompositionResult = {
  periodA: PeriodId
  periodB: PeriodId
  pvm: PVM
  segment: SegmentBridge
  customerBridge: Bridge
  testBridge: Bridge
  branchBridge: Bridge
  salespersonBridge: Bridge
  narrative: string[]
  availablePeriods: PeriodId[]
}

export function computeDecomposition(
  records: SalesRecord[],
  periodA: PeriodId,
  periodB: PeriodId,
): Omit<DecompositionResult, 'availablePeriods'> {
  const pvm = computePVM(records, periodA, periodB)
  const segment = computeSegmentBridge(records, periodA, periodB)

  const customerBridge = buildBridge(
    records, periodA, periodB,
    custKey,
    (r) => r.customerName || r.customerNo || r.customerCode || '(unknown)',
    (r) => ({
      salesperson: r.salespersonCode || '(unassigned)',
      group: r.customerGroupName || r.customerGroupCode || '',
    }),
  )

  const testBridge = buildBridge(
    records, periodA, periodB,
    testKey,
    testLabel,
  )

  const branchBridge = buildBridge(
    records, periodA, periodB,
    (r) => r.branchCode || '(no-branch)',
    (r) => r.branchCode || '(no-branch)',
  )

  const salespersonBridge = buildBridge(
    records, periodA, periodB,
    (r) => r.salespersonCode || '(unassigned)',
    (r) => {
      const parts = [r.salespersonCode, r.salespersonName].filter(Boolean)
      return parts.join(' – ') || '(unassigned)'
    },
  )

  const narrative = buildNarrative(pvm, segment, customerBridge, testBridge, branchBridge, periodA, periodB)

  return {
    periodA,
    periodB,
    pvm,
    segment,
    customerBridge,
    testBridge,
    branchBridge,
    salespersonBridge,
    narrative,
  }
}

// ─── Auto narrative builder (5-Whys-ish, Thai) ───────────────────────────────

function fmt(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '−' : ''
  if (abs >= 1_000_000_000) return `${sign}฿${(abs / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `${sign}฿${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}฿${(abs / 1_000).toFixed(1)}K`
  return `${sign}฿${abs.toFixed(0)}`
}

function pct(n: number | null, digits = 1): string {
  if (n === null || !Number.isFinite(n)) return 'n/a'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(digits)}%`
}

export function buildNarrative(
  pvm: PVM,
  seg: SegmentBridge,
  cust: Bridge,
  tests: Bridge,
  branch: Bridge,
  periodA: PeriodId,
  periodB: PeriodId,
): string[] {
  const lines: string[] = []
  const direction = pvm.delta >= 0 ? 'เพิ่มขึ้น' : 'ลดลง'
  const absDelta = Math.abs(pvm.delta)

  // Headline
  lines.push(
    `รายได้ ${periodB} ${direction} ${fmt(absDelta)} (${pct(pvm.deltaPct)}) เทียบ ${periodA} — จาก ${fmt(pvm.totalA)} เป็น ${fmt(pvm.totalB)}`,
  )

  // Why #1 — PVM breakdown
  const effects: { name: string; v: number }[] = [
    { name: 'ราคา (Price)', v: pvm.priceEffect },
    { name: 'ปริมาณ (Volume)', v: pvm.volumeEffect },
    { name: 'mix สินค้า', v: pvm.mixEffect },
    { name: 'test ใหม่', v: pvm.newProductRevenue },
    { name: 'test ที่หายไป', v: -pvm.lostProductRevenue },
  ]
  effects.sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
  const top = effects[0]
  lines.push(
    `สาเหตุหลัก: ${top.name} ${top.v >= 0 ? 'เพิ่ม' : 'หด'} ${fmt(Math.abs(top.v))} ` +
    `(price ${fmt(pvm.priceEffect)} · volume ${fmt(pvm.volumeEffect)} · mix ${fmt(pvm.mixEffect)})`,
  )

  // Why #2 — Customer dynamics
  lines.push(
    `ลูกค้า: ใหม่ ${seg.newCount} ราย (+${fmt(seg.newRevenue)}) · เก่ากลับมาซื้อ ${seg.retainedCount} ราย ` +
    `(same-store ${pct(seg.organicGrowthPct)}) · หายไป ${seg.lostCount} ราย (−${fmt(seg.lostRevenue)})`,
  )

  // Why #3 — Top movers (customer)
  if (cust.topContributors.length > 0) {
    const c0 = cust.topContributors[0]
    lines.push(`ลูกค้าที่ดันรายได้ขึ้นสูงสุด: ${c0.label} (+${fmt(c0.delta)})`)
  }
  if (cust.topDetractors.length > 0) {
    const d0 = cust.topDetractors[0]
    lines.push(`ลูกค้าที่ฉุดรายได้ลงสูงสุด: ${d0.label} (${fmt(d0.delta)})`)
  }

  // Why #4 — Test
  if (tests.topContributors.length > 0) {
    const t0 = tests.topContributors[0]
    lines.push(`บริการที่ขายเพิ่มที่สุด: ${t0.label} (+${fmt(t0.delta)})`)
  }
  if (tests.topDetractors.length > 0) {
    const t1 = tests.topDetractors[0]
    lines.push(`บริการที่ขายลดที่สุด: ${t1.label} (${fmt(t1.delta)})`)
  }

  // Why #5 — Branch
  if (branch.topContributors.length > 0 || branch.topDetractors.length > 0) {
    const parts: string[] = []
    if (branch.topContributors[0]) parts.push(`สาขา ${branch.topContributors[0].label} โต ${fmt(branch.topContributors[0].delta)}`)
    if (branch.topDetractors[0]) parts.push(`สาขา ${branch.topDetractors[0].label} ${fmt(branch.topDetractors[0].delta)}`)
    if (parts.length > 0) lines.push(`สาขาหลัก: ${parts.join(' · ')}`)
  }

  return lines
}

// ─── Available periods discovery ─────────────────────────────────────────────

export function discoverPeriods(records: SalesRecord[]): {
  years: PeriodId[]
  quarters: PeriodId[]
  months: PeriodId[]
} {
  const ys = new Set<string>()
  const qs = new Set<string>()
  const ms = new Set<string>()
  for (const r of records) {
    const d = new Date(r.postingDate)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const q = Math.ceil(m / 3)
    ys.add(String(y))
    qs.add(`${y}-Q${q}`)
    ms.add(`${y}-${String(m).padStart(2, '0')}`)
  }
  return {
    years: [...ys].sort(),
    quarters: [...qs].sort(),
    months: [...ms].sort(),
  }
}

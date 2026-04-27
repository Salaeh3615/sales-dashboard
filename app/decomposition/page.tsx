'use client'

/**
 * /decomposition — Revenue Decomposition Dashboard.
 *
 * แตกการเปลี่ยนแปลงรายได้ระหว่าง 2 ช่วงออกเป็น: ราคา, ปริมาณ, mix,
 * ลูกค้าใหม่/หาย, test ใหม่/หาย, สาขาไหนดัน/ฉุด
 */

import { useEffect, useMemo, useState } from 'react'
import {
  RefreshCw, Activity, Calendar, Sparkles, ArrowRight,
  TrendingUp, TrendingDown, UserPlus, UserX, FlaskConical, MapPin, Users,
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell, ReferenceLine,
} from 'recharts'
import type { DashboardFilters, FilterOptions } from '@/types'
import { FilterPanel } from '@/components/filters/FilterPanel'
import { CLT_AXIS, CLT_TOOLTIP } from '@/lib/chartTheme'
import { BentoCard } from '@/components/charts/BentoCard'
import { Glossary } from '@/components/charts/Glossary'
import { DECOMPOSITION_GLOSSARY } from '@/lib/glossary-items'

// ─── Types matching API response ─────────────────────────────────────────────

type BridgeRow = {
  key: string
  label: string
  revenueA: number
  revenueB: number
  delta: number
  deltaPct: number | null
  category: 'new' | 'lost' | 'grown' | 'declined' | 'flat'
  meta?: Record<string, string | number>
}

type Bridge = {
  totalA: number
  totalB: number
  delta: number
  topContributors: BridgeRow[]
  topDetractors: BridgeRow[]
  newEntities: BridgeRow[]
  lostEntities: BridgeRow[]
  rows: BridgeRow[]
}

type PVM = {
  totalA: number
  totalB: number
  delta: number
  deltaPct: number | null
  priceEffect: number
  volumeEffect: number
  mixEffect: number
  newProductRevenue: number
  lostProductRevenue: number
  notes: string[]
}

type SegmentBridge = {
  newRevenue: number
  retainedRevenue: number
  retainedRevenueA: number
  lostRevenue: number
  organicGrowth: number
  organicGrowthPct: number | null
  newCount: number
  retainedCount: number
  lostCount: number
}

type DecompositionResponse = {
  periodA: string
  periodB: string
  pvm: PVM
  segment: SegmentBridge
  customerBridge: Bridge
  testBridge: Bridge
  branchBridge: Bridge
  salespersonBridge: Bridge
  narrative: string[]
  availablePeriods: { years: string[]; quarters: string[]; months: string[] }
  recordCount: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: DashboardFilters = {
  years: [], quarters: [], months: [], branches: [],
  salespersons: [], documentTypes: [], customerGroups: [],
  revenueMetric: 'netAmount',
}

function fmt(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '−' : ''
  if (abs >= 1_000_000_000) return `${sign}฿${(abs / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `${sign}฿${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}฿${(abs / 1_000).toFixed(1)}K`
  return `${sign}฿${abs.toFixed(0)}`
}

function pct(n: number | null, digits = 1): string {
  if (n === null || !Number.isFinite(n)) return '—'
  const sign = n > 0 ? '+' : ''
  return `${sign}${n.toFixed(digits)}%`
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DecompositionPage() {
  const [options, setOptions] = useState<FilterOptions | null>(null)
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS)
  const [granularity, setGranularity] = useState<'year' | 'quarter' | 'month'>('quarter')
  const [periodA, setPeriodA] = useState<string>('')
  const [periodB, setPeriodB] = useState<string>('')
  const [periodList, setPeriodList] = useState<{ years: string[]; quarters: string[]; months: string[] } | null>(null)
  const [data, setData] = useState<DecompositionResponse | null>(null)
  const [loading, setLoading] = useState(true)

  // Bootstrap: load options + period list, default to last 2 quarters
  useEffect(() => {
    fetch('/api/options').then((r) => r.json()).then(setOptions).catch(() => setOptions(null))
    fetch('/api/decomposition').then((r) => r.json())
      .then((j) => {
        setPeriodList({
          years: j.availableYears ?? [],
          quarters: j.availableQuarters ?? [],
          months: j.availableMonths ?? [],
        })
        const qs: string[] = j.availableQuarters ?? []
        if (qs.length >= 2) {
          setPeriodA(qs[qs.length - 2])
          setPeriodB(qs[qs.length - 1])
        } else if (qs.length === 1) {
          setPeriodA(qs[0])
          setPeriodB(qs[0])
        }
      })
      .catch(() => setPeriodList(null))
  }, [])

  // Fetch decomposition whenever inputs change
  useEffect(() => {
    if (!options || !periodA || !periodB) return
    setLoading(true)
    fetch('/api/decomposition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodA, periodB, filters }),
    })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [options, periodA, periodB, filters])

  // When granularity changes, reset to last two of the corresponding list
  useEffect(() => {
    if (!periodList) return
    const list =
      granularity === 'year' ? periodList.years
      : granularity === 'month' ? periodList.months
      : periodList.quarters
    if (list.length >= 2) {
      setPeriodA(list[list.length - 2])
      setPeriodB(list[list.length - 1])
    } else if (list.length === 1) {
      setPeriodA(list[0])
      setPeriodB(list[0])
    }
  }, [granularity, periodList])

  if (!options || !periodList) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <RefreshCw className="text-navy-400 animate-spin" size={28} />
      </main>
    )
  }

  const periodOptions =
    granularity === 'year' ? periodList.years
    : granularity === 'month' ? periodList.months
    : periodList.quarters

  return (
    <div className="flex flex-1 overflow-hidden bg-[#F8FAFC]">
      <div className="hidden lg:block p-4 shrink-0">
        <FilterPanel options={options} filters={filters} onChange={setFilters} />
      </div>

      <main className="flex-1 overflow-y-auto p-4 lg:p-5 space-y-5 min-w-0 animate-fade-in">
        <Header
          granularity={granularity}
          onGranularityChange={setGranularity}
          periods={periodOptions}
          periodA={periodA}
          periodB={periodB}
          onPeriodA={setPeriodA}
          onPeriodB={setPeriodB}
          loading={loading}
          recordCount={data?.recordCount ?? 0}
        />

        <Glossary items={DECOMPOSITION_GLOSSARY} title="How to read · Revenue Decomposition" />

        {!data ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="text-navy-400 animate-spin" size={28} />
          </div>
        ) : (
          <>
            {/* Layer 1 — Executive Summary + Narrative */}
            <ExecutiveSummary data={data} />

            {/* Layer 2 — PVM Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <BentoCard
                title="PVM Bridge — แตกการเปลี่ยนแปลงรายได้"
                subtitle={`${data.periodA} → ${data.periodB}`}
                colSpan={8}
                status={data.pvm.delta >= 0 ? 'ahead' : 'at_risk'}
              >
                <PVMBridge pvm={data.pvm} />
              </BentoCard>

              <BentoCard
                title="Same-Store Growth"
                subtitle="ลูกค้าที่อยู่ทั้งสองช่วง — ตัด noise ลูกค้าใหม่/หาย"
                colSpan={4}
                status={
                  data.segment.organicGrowthPct !== null && data.segment.organicGrowthPct >= 0
                    ? 'ahead' : 'at_risk'
                }
              >
                <SameStoreCard seg={data.segment} />
              </BentoCard>
            </div>

            {/* Layer 3 — Customer Bridge */}
            <BridgeSection
              title="Customer Bridge"
              subtitle="ลูกค้าที่ดัน/ฉุดรายได้มากที่สุด"
              icon={Users}
              bridge={data.customerBridge}
              entityLabel="ลูกค้า"
            />

            {/* Layer 4 — Test (product) Bridge */}
            <BridgeSection
              title="Test / Product Bridge"
              subtitle="บริการทดสอบที่ขายเพิ่ม/ลด"
              icon={FlaskConical}
              bridge={data.testBridge}
              entityLabel="บริการ"
            />

            {/* Layer 5 — Branch + Salesperson */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <CompactBridge
                title="Branch Bridge"
                subtitle="สาขาหลักที่เปลี่ยน"
                icon={MapPin}
                bridge={data.branchBridge}
              />
              <CompactBridge
                title="Salesperson Bridge"
                subtitle="เซลส์หลักที่เปลี่ยน"
                icon={Users}
                bridge={data.salespersonBridge}
              />
            </div>
          </>
        )}
      </main>
    </div>
  )
}

// ─── Header ──────────────────────────────────────────────────────────────────

function Header({
  granularity, onGranularityChange,
  periods, periodA, periodB, onPeriodA, onPeriodB,
  loading, recordCount,
}: {
  granularity: 'year' | 'quarter' | 'month'
  onGranularityChange: (g: 'year' | 'quarter' | 'month') => void
  periods: string[]
  periodA: string; periodB: string
  onPeriodA: (p: string) => void; onPeriodB: (p: string) => void
  loading: boolean; recordCount: number
}) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-3">
        <span className="inline-flex w-10 h-10 rounded-xl bg-gradient-to-br from-navy-900 to-navy-700 text-gold-400 items-center justify-center shadow-card">
          <Activity size={18} />
        </span>
        <div>
          <h1 className="text-lg font-bold text-navy-900">Revenue Decomposition · Why?</h1>
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <Calendar size={11} />
            แตกรายได้ระหว่าง 2 ช่วง · {recordCount.toLocaleString()} records
            {loading && <RefreshCw className="ml-2 animate-spin" size={10} />}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {/* Granularity toggle */}
        <div className="flex gap-1 bg-white rounded-xl p-1 border border-slate-200 shadow-sm">
          {(['year', 'quarter', 'month'] as const).map((g) => (
            <button
              key={g}
              onClick={() => onGranularityChange(g)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                granularity === g
                  ? 'bg-navy-900 text-gold-400 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-navy-900'
              }`}
            >
              {g === 'year' ? 'Year' : g === 'quarter' ? 'Quarter' : 'Month'}
            </button>
          ))}
        </div>

        {/* A → B period selectors */}
        <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-1.5 border border-slate-200 shadow-sm">
          <select
            value={periodA}
            onChange={(e) => onPeriodA(e.target.value)}
            className="text-xs font-semibold text-navy-900 bg-transparent focus:outline-none"
          >
            {periods.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <ArrowRight size={14} className="text-slate-400" />
          <select
            value={periodB}
            onChange={(e) => onPeriodB(e.target.value)}
            className="text-xs font-semibold text-navy-900 bg-transparent focus:outline-none"
          >
            {periods.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}

// ─── Executive Summary ───────────────────────────────────────────────────────

function ExecutiveSummary({ data }: { data: DecompositionResponse }) {
  const { pvm, narrative } = data
  const gain = pvm.delta >= 0
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Headline KPIs */}
      <BentoCard colSpan={5} status={gain ? 'ahead' : 'at_risk'} headless padding="p-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-navy-700">
            <Sparkles size={12} className="text-gold-500" />
            Executive Summary · {data.periodA} → {data.periodB}
          </div>

          <div className="flex items-baseline gap-3 flex-wrap">
            <p className="text-3xl font-bold font-num text-navy-900">{fmt(pvm.totalB)}</p>
            <span className={`text-sm font-semibold ${gain ? 'text-emerald-700' : 'text-red-700'}`}>
              {gain ? <TrendingUp size={14} className="inline mr-0.5" /> : <TrendingDown size={14} className="inline mr-0.5" />}
              {fmt(pvm.delta)} ({pct(pvm.deltaPct)})
            </span>
          </div>
          <p className="text-xs text-slate-500">เทียบ {data.periodA} ที่ทำได้ {fmt(pvm.totalA)}</p>

          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100">
            <MicroStat label="Price" value={pvm.priceEffect} />
            <MicroStat label="Volume" value={pvm.volumeEffect} />
            <MicroStat label="Mix" value={pvm.mixEffect} />
          </div>
        </div>
      </BentoCard>

      {/* Narrative bullets */}
      <BentoCard colSpan={7} title="Auto Narrative" subtitle={`สรุปการเปลี่ยนแปลง ${data.periodA} → ${data.periodB}`} status="neutral">
        <ul className="space-y-2 mt-1">
          {narrative.map((line, i) => (
            <li key={i} className="flex gap-2 text-xs leading-relaxed text-slate-700">
              <span className="inline-flex items-center justify-center shrink-0 w-5 h-5 rounded-full bg-gold-100 text-gold-700 text-[10px] font-bold">
                {i + 1}
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </BentoCard>
    </div>
  )
}

function MicroStat({ label, value }: { label: string; value: number }) {
  const positive = value >= 0
  return (
    <div>
      <p className="text-[10px] font-semibold text-slate-500 uppercase">{label}</p>
      <p className={`text-sm font-bold font-num mt-0.5 ${positive ? 'text-emerald-700' : 'text-red-700'}`}>
        {fmt(value)}
      </p>
    </div>
  )
}

// ─── PVM Bridge chart ────────────────────────────────────────────────────────

function PVMBridge({ pvm }: { pvm: PVM }) {
  const data = useMemo(() => {
    // Cascade: A → +/- effects → B
    const segs = [
      { name: pvm.totalA >= 0 ? `Period A` : 'Period A', value: pvm.totalA, color: '#0a3d2a', isAnchor: true },
      { name: 'Price', value: pvm.priceEffect, color: pvm.priceEffect >= 0 ? '#10B981' : '#EF4444' },
      { name: 'Volume', value: pvm.volumeEffect, color: pvm.volumeEffect >= 0 ? '#10B981' : '#EF4444' },
      { name: 'Mix', value: pvm.mixEffect, color: pvm.mixEffect >= 0 ? '#10B981' : '#EF4444' },
      { name: 'New tests', value: pvm.newProductRevenue, color: '#10B981' },
      { name: 'Lost tests', value: -pvm.lostProductRevenue, color: '#EF4444' },
      { name: 'Period B', value: pvm.totalB, color: '#0a3d2a', isAnchor: true },
    ]
    // Build floating bar coords
    let cum = 0
    return segs.map((s) => {
      if (s.isAnchor) {
        const start = 0
        const end = s.value
        cum = end
        return { ...s, base: 0, top: end, abs: s.value }
      } else {
        const start = cum
        const end = cum + s.value
        cum = end
        const base = Math.min(start, end)
        const top = Math.max(start, end)
        return { ...s, base, top, abs: s.value }
      }
    })
  }, [pvm])

  return (
    <div style={{ width: '100%', height: 320 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
          <XAxis dataKey="name" {...CLT_AXIS} interval={0} angle={-15} textAnchor="end" height={50} />
          <YAxis {...CLT_AXIS} tickFormatter={(v) => fmt(v)} />
          <Tooltip
            {...CLT_TOOLTIP}
            formatter={(_v: unknown, _n: unknown, p: { payload?: { abs?: number } }) =>
              [fmt(p.payload?.abs ?? 0), 'Effect']
            }
          />
          <ReferenceLine y={0} stroke="#94A3B8" />
          {/* invisible base */}
          <Bar dataKey="base" stackId="pvm" fill="transparent" isAnimationActive={false} />
          <Bar dataKey={(d: { top: number; base: number }) => d.top - d.base} stackId="pvm" radius={[6, 6, 0, 0]}>
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Same-store card ─────────────────────────────────────────────────────────

function SameStoreCard({ seg }: { seg: SegmentBridge }) {
  const ssPositive = (seg.organicGrowthPct ?? 0) >= 0
  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] font-semibold text-slate-500 uppercase">Same-store growth</p>
        <p className={`text-2xl font-bold font-num ${ssPositive ? 'text-emerald-700' : 'text-red-700'}`}>
          {pct(seg.organicGrowthPct)}
        </p>
        <p className="text-[11px] text-slate-500 mt-0.5">{fmt(seg.organicGrowth)} จาก {seg.retainedCount.toLocaleString()} ลูกค้าเดิม</p>
      </div>

      <div className="grid grid-cols-1 gap-2 pt-2 border-t border-slate-100">
        <MiniRow icon={UserPlus} color="emerald" label={`ลูกค้าใหม่ ${seg.newCount}`} value={`+${fmt(seg.newRevenue)}`} />
        <MiniRow icon={Users} color="navy" label={`เก่ากลับมาซื้อ ${seg.retainedCount}`} value={fmt(seg.retainedRevenue)} />
        <MiniRow icon={UserX} color="red" label={`ลูกค้าหาย ${seg.lostCount}`} value={`−${fmt(seg.lostRevenue)}`} />
      </div>
    </div>
  )
}

function MiniRow({
  icon: Icon, color, label, value,
}: {
  icon: React.ElementType; color: 'emerald' | 'navy' | 'red'; label: string; value: string
}) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700',
    navy: 'bg-navy-50 text-navy-900',
    red: 'bg-red-50 text-red-700',
  }
  return (
    <div className="flex items-center gap-2">
      <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${colors[color]}`}>
        <Icon size={13} />
      </span>
      <p className="text-[11px] flex-1 text-slate-700 truncate">{label}</p>
      <p className={`text-xs font-bold font-num ${colors[color].split(' ')[1]}`}>{value}</p>
    </div>
  )
}

// ─── Bridge Section (full) ───────────────────────────────────────────────────

function BridgeSection({
  title, subtitle, icon: Icon, bridge, entityLabel,
}: {
  title: string; subtitle: string; icon: React.ElementType; bridge: Bridge; entityLabel: string
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className="inline-flex w-7 h-7 rounded-lg bg-navy-900 text-gold-400 items-center justify-center">
          <Icon size={13} />
        </span>
        <div>
          <p className="text-sm font-semibold text-navy-900">{title}</p>
          <p className="text-[11px] text-slate-500">{subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <BentoCard
          title={`Top contributors — ${entityLabel}ที่ดันรายได้`}
          subtitle="5 อันดับ delta บวก"
          colSpan={6}
          status="ahead"
        >
          <BridgeRowsList rows={bridge.topContributors} positive />
        </BentoCard>

        <BentoCard
          title={`Top detractors — ${entityLabel}ที่ฉุดรายได้`}
          subtitle="5 อันดับ delta ลบ"
          colSpan={6}
          status="at_risk"
        >
          <BridgeRowsList rows={bridge.topDetractors} positive={false} />
        </BentoCard>

        {(bridge.newEntities.length > 0 || bridge.lostEntities.length > 0) && (
          <>
            <BentoCard
              title={`${entityLabel}ใหม่ในช่วง B`}
              subtitle="ไม่เคยปรากฏใน A"
              colSpan={6}
              status="ahead"
            >
              <BridgeRowsList rows={bridge.newEntities} positive showPeriodB />
            </BentoCard>

            <BentoCard
              title={`${entityLabel}ที่หายไปใน B`}
              subtitle="เคยมีใน A แต่ไม่มีใน B"
              colSpan={6}
              status="at_risk"
            >
              <BridgeRowsList rows={bridge.lostEntities} positive={false} showPeriodA />
            </BentoCard>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Compact Bridge (small side-by-side) ─────────────────────────────────────

function CompactBridge({
  title, subtitle, icon: Icon, bridge,
}: {
  title: string; subtitle: string; icon: React.ElementType; bridge: Bridge
}) {
  return (
    <BentoCard
      title={title}
      subtitle={subtitle}
      right={<Icon size={14} className="text-navy-700" />}
      status={bridge.delta >= 0 ? 'on_track' : 'behind'}
    >
      <div className="space-y-3">
        <div>
          <p className="text-[10px] font-semibold text-emerald-700 uppercase mb-1.5">Top contributors</p>
          <BridgeRowsList rows={bridge.topContributors.slice(0, 3)} positive compact />
        </div>
        <div className="border-t border-slate-100 pt-2">
          <p className="text-[10px] font-semibold text-red-700 uppercase mb-1.5">Top detractors</p>
          <BridgeRowsList rows={bridge.topDetractors.slice(0, 3)} positive={false} compact />
        </div>
      </div>
    </BentoCard>
  )
}

// ─── Reusable rows list ──────────────────────────────────────────────────────

function BridgeRowsList({
  rows, positive, compact = false, showPeriodA = false, showPeriodB = false,
}: {
  rows: BridgeRow[]
  positive: boolean
  compact?: boolean
  showPeriodA?: boolean
  showPeriodB?: boolean
}) {
  if (rows.length === 0) {
    return <p className="text-xs text-slate-400 italic py-2">— ไม่มีรายการ —</p>
  }

  // Find max abs delta for bar scaling
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.delta)), 1)

  return (
    <ul className={`space-y-${compact ? '1.5' : '2'}`}>
      {rows.map((r) => {
        const widthPct = (Math.abs(r.delta) / maxAbs) * 100
        const barColor = positive ? 'bg-emerald-500' : 'bg-red-500'
        const textColor = positive ? 'text-emerald-700' : 'text-red-700'
        const showVal =
          showPeriodB ? r.revenueB
          : showPeriodA ? r.revenueA
          : r.delta
        return (
          <li key={r.key} className="group">
            <div className="flex items-center gap-2 mb-0.5">
              <p className={`flex-1 text-[11px] font-medium text-navy-900 truncate ${compact ? 'text-[10.5px]' : ''}`} title={r.label}>
                {r.label}
              </p>
              <p className={`text-[11px] font-bold font-num shrink-0 ${textColor}`}>
                {showVal >= 0 && !showPeriodA ? '+' : ''}{fmt(showVal)}
              </p>
            </div>
            <div className="relative h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <span
                className={`absolute left-0 top-0 bottom-0 ${barColor} rounded-full transition-all`}
                style={{ width: `${widthPct}%` }}
              />
            </div>
            {!compact && (r.deltaPct !== null) && (
              <p className="text-[10px] text-slate-400 mt-0.5">
                {fmt(r.revenueA)} → {fmt(r.revenueB)} · {pct(r.deltaPct)}
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}

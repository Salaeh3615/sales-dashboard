'use client'

/**
 * /variance — Variance Investigator.
 *
 * หา period ที่รายได้แตกต่างจาก baseline เกิน 2σ และ drill ลึกว่าใคร/อะไร
 * ที่กระทบมากที่สุด พร้อมสรุปอัตโนมัติ
 */

import { useEffect, useState } from 'react'
import {
  RefreshCw, Search, Calendar, AlertTriangle, TrendingUp, TrendingDown,
  Users, FlaskConical, MapPin, ChevronRight,
} from 'lucide-react'
import {
  ResponsiveContainer, ComposedChart, Line, Area, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Cell,
} from 'recharts'
import type { DashboardFilters, FilterOptions } from '@/types'
import { FilterPanel } from '@/components/filters/FilterPanel'
import { CLT_AXIS, CLT_TOOLTIP } from '@/lib/chartTheme'
import { BentoCard } from '@/components/charts/BentoCard'
import { Glossary } from '@/components/charts/Glossary'
import { VARIANCE_GLOSSARY } from '@/lib/glossary-items'

// ─── Types ───────────────────────────────────────────────────────────────────

type ContributorRow = {
  key: string
  label: string
  meta?: string
  baselineRev: number
  actualRev: number
  delta: number
  share: number
}

type VariancePoint = {
  label: string
  startDate: string
  actual: number
  baseline: number
  stddev: number
  zScore: number
  variance: number
  variancePct: number | null
  isAnomaly: boolean
  anomalyDirection: 'up' | 'down' | null
}

type AnomalyDeepDive = {
  label: string
  startDate: string
  actual: number
  baseline: number
  variance: number
  variancePct: number | null
  zScore: number
  direction: 'up' | 'down'
  narrative: string[]
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

type VarianceResponse = {
  granularity: 'month' | 'week'
  asOfDate: string
  series: VariancePoint[]
  anomalies: AnomalyDeepDive[]
  baselineWindow: number
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

export default function VariancePage() {
  const [options, setOptions] = useState<FilterOptions | null>(null)
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS)
  const [granularity, setGranularity] = useState<'month' | 'week'>('month')
  const [zThreshold, setZThreshold] = useState<number>(2)
  const [data, setData] = useState<VarianceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<AnomalyDeepDive | null>(null)

  useEffect(() => {
    fetch('/api/options').then((r) => r.json()).then(setOptions).catch(() => setOptions(null))
  }, [])

  useEffect(() => {
    if (!options) return
    setLoading(true)
    fetch('/api/variance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filters, granularity, zThreshold }),
    })
      .then((r) => r.json())
      .then((j: VarianceResponse) => {
        setData(j)
        // auto-select latest anomaly for a useful default view
        if (j.anomalies.length > 0) setSelected(j.anomalies[0])
        else setSelected(null)
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [options, filters, granularity, zThreshold])

  if (!options) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <RefreshCw className="text-navy-400 animate-spin" size={28} />
      </main>
    )
  }

  return (
    <div className="flex flex-1 overflow-hidden bg-[#F8FAFC]">
      <div className="hidden lg:block p-4 shrink-0">
        <FilterPanel options={options} filters={filters} onChange={setFilters} />
      </div>

      <main className="flex-1 overflow-y-auto p-4 lg:p-5 space-y-5 min-w-0 animate-fade-in">
        <Header
          asOfDate={data?.asOfDate}
          recordCount={data?.recordCount ?? 0}
          loading={loading}
          granularity={granularity}
          onGranularityChange={setGranularity}
          zThreshold={zThreshold}
          onZThresholdChange={setZThreshold}
        />

        <Glossary items={VARIANCE_GLOSSARY} title="How to read · Variance Investigator" />

        {!data ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="text-navy-400 animate-spin" size={28} />
          </div>
        ) : (
          <>
            {/* Trend chart with anomaly markers */}
            <BentoCard
              title={`รายได้ vs baseline (${granularity === 'month' ? 'รายเดือน' : 'รายสัปดาห์'})`}
              subtitle={`baseline = rolling avg ${data.baselineWindow} ${granularity === 'month' ? 'เดือน' : 'สัปดาห์'}ก่อนหน้า · z ≥ ${zThreshold}`}
              status="neutral"
            >
              <TrendChart series={data.series} onClick={(label) => {
                const a = data.anomalies.find((x) => x.label === label)
                if (a) setSelected(a)
              }} />
            </BentoCard>

            {/* Layout: anomaly list + deep dive */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <BentoCard
                title={`Anomalies — ${data.anomalies.length} period`}
                subtitle="z-score ≥ 2 หรือ ≤ -2 — เลือกเพื่อดู deep-dive"
                colSpan={4}
                status={data.anomalies.length > 0 ? 'behind' : 'ahead'}
                right={<AlertTriangle size={14} className={data.anomalies.length > 0 ? 'text-gold-700' : 'text-emerald-600'} />}
              >
                <AnomalyList
                  anomalies={data.anomalies}
                  selectedKey={selected?.label}
                  onSelect={setSelected}
                />
              </BentoCard>

              <div className="lg:col-span-8 space-y-4">
                {selected ? (
                  <DeepDive dive={selected} />
                ) : (
                  <BentoCard title="ไม่พบ anomaly ในช่วงนี้" subtitle="ลองลด z threshold หรือเปลี่ยน granularity" status="ahead">
                    <p className="text-xs text-slate-500 py-6 text-center">รายได้ทุก period อยู่ในช่วง normal (±{zThreshold}σ จาก baseline)</p>
                  </BentoCard>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

// ─── Header ──────────────────────────────────────────────────────────────────

function Header({
  asOfDate, recordCount, loading,
  granularity, onGranularityChange,
  zThreshold, onZThresholdChange,
}: {
  asOfDate?: string; recordCount: number; loading: boolean
  granularity: 'month' | 'week'; onGranularityChange: (g: 'month' | 'week') => void
  zThreshold: number; onZThresholdChange: (z: number) => void
}) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-3">
        <span className="inline-flex w-10 h-10 rounded-xl bg-gradient-to-br from-navy-900 to-navy-700 text-gold-400 items-center justify-center shadow-card">
          <Search size={18} />
        </span>
        <div>
          <h1 className="text-lg font-bold text-navy-900">Variance Investigator</h1>
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <Calendar size={11} />
            ข้อมูลล่าสุด {asOfDate ?? '—'} · {recordCount.toLocaleString()} records
            {loading && <RefreshCw className="ml-2 animate-spin" size={10} />}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 bg-white rounded-xl p-1 border border-slate-200 shadow-sm">
          {(['month', 'week'] as const).map((g) => (
            <button
              key={g}
              onClick={() => onGranularityChange(g)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                granularity === g
                  ? 'bg-navy-900 text-gold-400 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-navy-900'
              }`}
            >
              {g === 'month' ? 'Monthly' : 'Weekly'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 bg-white rounded-xl p-1 border border-slate-200 shadow-sm">
          <span className="text-[10px] text-slate-500 px-2">z ≥</span>
          {[1.5, 2, 2.5, 3].map((z) => (
            <button
              key={z}
              onClick={() => onZThresholdChange(z)}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                zThreshold === z
                  ? 'bg-navy-900 text-gold-400 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-navy-900'
              }`}
            >
              {z}σ
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Trend chart ─────────────────────────────────────────────────────────────

function TrendChart({ series, onClick }: { series: VariancePoint[]; onClick: (label: string) => void }) {
  const data = series.map((p) => ({
    ...p,
    upper: p.baseline + 2 * p.stddev,
    lower: Math.max(0, p.baseline - 2 * p.stddev),
  }))

  return (
    <div style={{ width: '100%', height: 320 }}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
          <XAxis dataKey="label" {...CLT_AXIS} interval={Math.ceil(data.length / 12)} />
          <YAxis {...CLT_AXIS} tickFormatter={(v) => fmt(v)} />
          <Tooltip
            {...CLT_TOOLTIP}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const p = payload[0].payload as VariancePoint & { upper: number; lower: number }
              return (
                <div className="bg-white border border-slate-200 rounded-lg p-2 shadow-md text-[11px] space-y-0.5">
                  <p className="font-bold text-navy-900">{p.label}</p>
                  <p>Actual: <span className="font-num">{fmt(p.actual)}</span></p>
                  <p>Baseline: <span className="font-num">{fmt(p.baseline)}</span></p>
                  <p>Variance: <span className={p.variance >= 0 ? 'text-emerald-700' : 'text-red-700'}>{fmt(p.variance)} ({pct(p.variancePct)})</span></p>
                  <p>z-score: <span className="font-num">{p.zScore.toFixed(2)}</span>{p.isAnomaly && <span className="ml-1 text-red-600">⚠</span>}</p>
                </div>
              )
            }}
          />
          {/* baseline band — upper / lower as area */}
          <Area type="monotone" dataKey="upper" stroke="none" fill="#94A3B8" fillOpacity={0.08} />
          <Area type="monotone" dataKey="lower" stroke="none" fill="#FFFFFF" fillOpacity={1} />
          <Line type="monotone" dataKey="baseline" stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
          <Bar dataKey="actual" radius={[6, 6, 0, 0]} onClick={(d: { label: string }) => onClick(d.label)} cursor="pointer">
            {data.map((d, i) => (
              <Cell key={i} fill={
                d.isAnomaly && d.zScore < 0 ? '#EF4444'
                : d.isAnomaly && d.zScore > 0 ? '#10B981'
                : '#0a3d2a'
              } />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Anomaly list (left rail) ────────────────────────────────────────────────

function AnomalyList({
  anomalies, selectedKey, onSelect,
}: {
  anomalies: AnomalyDeepDive[]
  selectedKey?: string
  onSelect: (a: AnomalyDeepDive) => void
}) {
  if (anomalies.length === 0) {
    return <p className="text-xs text-slate-400 italic py-6 text-center">— ไม่มี anomaly ในช่วงนี้ —</p>
  }
  return (
    <ul className="divide-y divide-slate-100">
      {anomalies.map((a) => {
        const active = a.label === selectedKey
        const isUp = a.zScore > 0
        return (
          <li key={a.label}>
            <button
              onClick={() => onSelect(a)}
              className={`w-full text-left py-2.5 px-2 rounded-lg transition-colors flex items-start gap-2 ${
                active ? 'bg-navy-50' : 'hover:bg-slate-50'
              }`}
            >
              <span className={`shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg ${isUp ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-navy-900">{a.label}</p>
                <p className="text-[10px] text-slate-500 truncate">
                  {fmt(a.actual)} · vs {fmt(a.baseline)} · z {a.zScore.toFixed(2)}
                </p>
              </div>
              <ChevronRight size={14} className={`shrink-0 ${active ? 'text-navy-700' : 'text-slate-300'}`} />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// ─── Deep-dive panel ─────────────────────────────────────────────────────────

function DeepDive({ dive }: { dive: AnomalyDeepDive }) {
  const isUp = dive.zScore > 0
  return (
    <div className="space-y-4">
      <BentoCard
        headless
        padding="p-5"
        status={isUp ? 'ahead' : 'at_risk'}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-navy-700">
            {isUp ? <TrendingUp size={12} className="text-emerald-600" /> : <TrendingDown size={12} className="text-red-600" />}
            Anomaly · {dive.label}
          </div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <p className="text-3xl font-bold font-num text-navy-900">{fmt(dive.actual)}</p>
            <span className={`text-sm font-semibold ${isUp ? 'text-emerald-700' : 'text-red-700'}`}>
              {fmt(dive.variance)} ({pct(dive.variancePct)}) vs baseline
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Baseline {fmt(dive.baseline)} · z = {dive.zScore.toFixed(2)} ·
            ออเดอร์ {dive.ordersInPeriod} (vs avg {dive.ordersBaseline.toFixed(0)}) ·
            ลูกค้า {dive.uniqueCustomersInPeriod} (vs avg {dive.uniqueCustomersBaseline.toFixed(0)})
          </p>

          {/* Narrative */}
          <ul className="space-y-2 mt-3 pt-3 border-t border-slate-100">
            {dive.narrative.map((line, i) => (
              <li key={i} className="flex gap-2 text-xs leading-relaxed text-slate-700">
                <span className="inline-flex items-center justify-center shrink-0 w-5 h-5 rounded-full bg-gold-100 text-gold-700 text-[10px] font-bold">
                  {i + 1}
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </BentoCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BentoCard title="Top customer contributors" subtitle="ลูกค้าที่ทำให้ variance นี้มากสุด" status="neutral" right={<Users size={13} className="text-navy-700" />}>
          <ContributorList rows={dive.byCustomer} direction={dive.direction} />
        </BentoCard>

        <BentoCard title="Top test contributors" subtitle="บริการทดสอบที่กระทบ" status="neutral" right={<FlaskConical size={13} className="text-navy-700" />}>
          <ContributorList rows={dive.byTest} direction={dive.direction} />
        </BentoCard>

        <BentoCard title="By branch" subtitle="สาขาที่ผลกระทบสูงสุด" status="neutral" right={<MapPin size={13} className="text-navy-700" />}>
          <ContributorList rows={dive.byBranch} direction={dive.direction} />
        </BentoCard>

        <BentoCard title="By salesperson" subtitle="เซลส์ที่กระทบ" status="neutral" right={<Users size={13} className="text-navy-700" />}>
          <ContributorList rows={dive.bySalesperson} direction={dive.direction} />
        </BentoCard>
      </div>
    </div>
  )
}

function ContributorList({ rows, direction }: { rows: ContributorRow[]; direction: 'up' | 'down' }) {
  if (rows.length === 0) {
    return <p className="text-xs text-slate-400 italic py-2">— ไม่มีรายการ —</p>
  }
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.delta)), 1)
  return (
    <ul className="space-y-2">
      {rows.slice(0, 6).map((r) => {
        const widthPct = (Math.abs(r.delta) / maxAbs) * 100
        const isAligned = (direction === 'up' && r.delta > 0) || (direction === 'down' && r.delta < 0)
        const barColor = isAligned ? (direction === 'up' ? 'bg-emerald-500' : 'bg-red-500') : 'bg-slate-300'
        const textColor = r.delta >= 0 ? 'text-emerald-700' : 'text-red-700'
        return (
          <li key={r.key}>
            <div className="flex items-center gap-2 mb-0.5">
              <p className="flex-1 text-[11px] font-medium text-navy-900 truncate" title={r.label}>{r.label}</p>
              <p className={`text-[11px] font-bold font-num shrink-0 ${textColor}`}>
                {r.delta >= 0 ? '+' : ''}{fmt(r.delta)}
              </p>
            </div>
            <div className="relative h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <span className={`absolute left-0 top-0 bottom-0 ${barColor} rounded-full`} style={{ width: `${widthPct}%` }} />
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              actual {fmt(r.actualRev)} · baseline avg {fmt(r.baselineRev)}
              {Number.isFinite(r.share) && ` · ${r.share.toFixed(0)}% ของ variance`}
            </p>
          </li>
        )
      })}
    </ul>
  )
}

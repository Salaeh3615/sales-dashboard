'use client'

/**
 * /targets — Target Attainment Dashboard.
 *
 * Bento-grid analytical layout combining executive glance (attainment ring,
 * KPI strip), analytical depth (branch heatmap, variance waterfall, cumulative
 * chart), and action cards (at-risk branches, HO subdivisions, HO projects).
 */

import { useEffect, useMemo, useState } from 'react'
import {
  RefreshCw, Target, AlertTriangle, TrendingUp, Calendar, BarChart3,
  Layers, Briefcase,
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, LineChart, ComposedChart, BarChart, Bar, Cell,
} from 'recharts'
import type { DashboardFilters, FilterOptions } from '@/types'
import { FilterPanel } from '@/components/filters/FilterPanel'
import { CLT_AXIS, CLT_TOOLTIP, fmtY, fmtCurrency } from '@/lib/chartTheme'
import { BentoCard, StatusPill, useCountUp } from '@/components/charts/BentoCard'
import { AttainmentRing } from '@/components/charts/AttainmentRing'
import { TargetHeatmap } from '@/components/charts/TargetHeatmap'
import { VarianceWaterfall } from '@/components/charts/VarianceWaterfall'
import { Glossary } from '@/components/charts/Glossary'

// ─── Types mirroring /api/targets response ────────────────────────────────────

type AttainmentStatus = 'ahead' | 'on_track' | 'behind' | 'at_risk'

type MonthlyAttainment = {
  month: number; label: string; target: number; actual: number
  attainmentPct: number; variance: number; isPast: boolean; isCurrent: boolean
}
type CumulativePoint = {
  month: number; label: string; targetCum: number; actualCum: number; attainmentCumPct: number
}
type BranchAttainment = {
  branchCode: string
  subdivision?: string
  fullYearTarget: number
  ytdTarget: number
  ytdActual: number
  ytdAttainmentPct: number
  fullYearActual: number
  projectedEOY: number
  projectedAttainmentPct: number
  gap: number
  gapEOY: number
  status: AttainmentStatus
  paceMultiplier: number
  requiredDailyRate: number
  monthly: MonthlyAttainment[]
  cumulative: CumulativePoint[]
}
type HoProjectRow = {
  locationCode: string
  projectName: string
  revenue: number
  transactions: number
  customers: number
  topCustomer?: string
}

type TargetsData = {
  year: number
  anchorMonth: number
  anchorDate: string
  daysInAnchorMonth: number
  dayOfAnchorMonth: number
  availableYears: number[]
  overall: BranchAttainment
  byBranch: BranchAttainment[]
  byHoSubdivision: BranchAttainment[]
  hoProjects: HoProjectRow[]
  heatmap: { branch: string; cells: { month: number; attainmentPct: number; actual: number; target: number }[] }[]
  waterfall: { month: number; label: string; variance: number; cumulative: number }[]
  atRisk: { branchCode: string; gap: number; projectedAttainmentPct: number; requiredUpliftPct: number }[]
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
  if (abs >= 1_000_000_000) return `฿${(n / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `฿${(n / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `฿${(n / 1_000).toFixed(1)}K`
  return `฿${n.toFixed(0)}`
}

function pct(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`
}

const STATUS_DESC: Record<AttainmentStatus, string> = {
  ahead: 'ทำได้เกินเป้า (≥102%) รักษาโมเมนตัม',
  on_track: 'ใกล้เป้ามาก (95–101%) ประคองให้ถึงเป้าได้',
  behind: 'ต่ำกว่าเป้าเล็กน้อย (85–94%) ต้องเร่ง',
  at_risk: 'ต่ำกว่าเป้ามาก (<85%) ต้องมี action plan',
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TargetsPage() {
  const [options, setOptions] = useState<FilterOptions | null>(null)
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS)
  const [data, setData] = useState<TargetsData | null>(null)
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/options').then((r) => r.json()).then(setOptions).catch(() => setOptions(null))
    fetch('/api/targets').then((r) => r.json())
      .then((j) => {
        setAvailableYears(j.availableYears ?? [])
        if (j.availableYears?.length) setYear(j.availableYears[j.availableYears.length - 1])
      })
      .catch(() => setAvailableYears([]))
  }, [])

  useEffect(() => {
    if (!options) return
    setLoading(true)
    fetch('/api/targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filters, year }),
    })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [filters, year, options])

  if (!options || !data) {
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
          year={year}
          availableYears={availableYears}
          onYearChange={setYear}
          anchorDate={data.anchorDate}
          recordCount={data.recordCount}
          loading={loading}
        />

        <Glossary />

        {/* Layer 1: Executive Glance */}
        <ExecutiveGlance data={data} />

        {/* Layer 2: Analytical Depth */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <BentoCard
            title="Cumulative Revenue vs Target"
            subtitle={`Actual ต่อเนื่อง vs เป้าสะสม ถึงเดือน ${data.anchorMonth}/${data.year}`}
            colSpan={8}
            status={data.overall.status}
          >
            <CumulativeChart data={data.overall.cumulative} anchorMonth={data.anchorMonth} />
          </BentoCard>

          <BentoCard
            title="Monthly Variance Waterfall"
            subtitle="เดือนไหนชดเชย/หลุด เป้า"
            colSpan={4}
            status={data.waterfall.some((w) => w.cumulative < 0) ? 'behind' : 'on_track'}
          >
            <VarianceWaterfall data={data.waterfall} />
          </BentoCard>

          <BentoCard
            title="Branch × Month Attainment Heatmap"
            subtitle="เปอร์เซ็นต์การทำได้ต่อเดือน (เฉลี่ยโรลโอเวอร์)"
            colSpan={12}
            status="on_track"
          >
            <TargetHeatmap rows={data.heatmap} anchorMonth={data.anchorMonth} />
          </BentoCard>
        </div>

        {/* Layer 3: Branch Leaderboard Bento */}
        <div>
          <SectionTitle icon={BarChart3} title="Branch Leaderboard" subtitle="เรียงตามขนาดเป้าประจำปี" />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 mt-3">
            {data.byBranch.map((b) => (
              <BranchCard key={b.branchCode} branch={b} />
            ))}
          </div>
        </div>

        {/* Layer 4: HO Drill-down (subdivisions + projects) */}
        <div>
          <SectionTitle icon={Layers} title="HO Breakdown" subtitle="แยกตามหน่วยงานภายใน HO" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mt-3">
            <BentoCard title="HO Subdivisions" subtitle="เป้าแยกตามส่วนงาน" colSpan={7}>
              <HoSubdivisionTable subdivisions={data.byHoSubdivision} />
            </BentoCard>

            <BentoCard title="งานโครงการและอื่น ๆ (Project Detail)" subtitle="รายได้ที่อยู่นอกเหนือจาก 3 ส่วนหลัก" colSpan={5}>
              <HoProjectsTable projects={data.hoProjects} />
            </BentoCard>
          </div>
        </div>

        {/* Layer 5: At Risk & Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <BentoCard
            title="At-Risk Branches"
            subtitle="สาขาที่ projection ต่ำกว่า 95%"
            colSpan={6}
            status={data.atRisk.length > 0 ? 'at_risk' : 'on_track'}
            right={<AlertTriangle size={16} className={data.atRisk.length > 0 ? 'text-red-500' : 'text-slate-300'} />}
          >
            <AtRiskList atRisk={data.atRisk} />
          </BentoCard>

          <BentoCard
            title="Status Legend"
            subtitle="เกณฑ์การจัดระดับ attainment"
            colSpan={6}
            status="neutral"
          >
            <StatusLegend />
          </BentoCard>
        </div>
      </main>
    </div>
  )
}

// ─── Header ──────────────────────────────────────────────────────────────────

function Header({
  year, availableYears, onYearChange, anchorDate, recordCount, loading,
}: {
  year: number; availableYears: number[]; onYearChange: (y: number) => void
  anchorDate: string; recordCount: number; loading: boolean
}) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-3">
        <span className="inline-flex w-10 h-10 rounded-xl bg-gradient-to-br from-navy-900 to-navy-700 text-gold-400 items-center justify-center shadow-card">
          <Target size={18} />
        </span>
        <div>
          <h1 className="text-lg font-bold text-navy-900">Target Attainment</h1>
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <Calendar size={11} />
            ข้อมูลล่าสุด {anchorDate} · {recordCount.toLocaleString()} records
            {loading && <RefreshCw className="ml-2 animate-spin" size={10} />}
          </p>
        </div>
      </div>
      <div className="flex gap-1 bg-white rounded-xl p-1 border border-slate-200 shadow-sm">
        {availableYears.map((y) => (
          <button
            key={y}
            onClick={() => onYearChange(y)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              year === y
                ? 'bg-navy-900 text-gold-400 shadow-sm'
                : 'text-slate-600 hover:bg-slate-50 hover:text-navy-900'
            }`}
          >
            {y}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Executive Glance ────────────────────────────────────────────────────────

function ExecutiveGlance({ data }: { data: TargetsData }) {
  const o = data.overall
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Attainment Ring */}
      <BentoCard colSpan={4} status={o.status} headless padding="p-6">
        <div className="flex flex-col items-center">
          <AttainmentRing
            percentage={o.ytdAttainmentPct}
            secondary={o.projectedAttainmentPct}
            secondaryLabel="EOY proj."
            size={240}
          />
          <StatusPill status={o.status} className="mt-4" />
          <p className="text-[11px] text-slate-500 mt-2 text-center max-w-xs">
            {STATUS_DESC[o.status]}
          </p>
        </div>
      </BentoCard>

      {/* KPI grid */}
      <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiTile
          label="YTD Actual"
          value={o.ytdActual}
          subtitle={`vs เป้า YTD ${fmt(o.ytdTarget)}`}
          accent="navy"
          animated
        />
        <KpiTile
          label="YTD Gap"
          value={o.gap}
          subtitle={o.gap >= 0 ? 'เกินเป้าสะสม' : 'ขาดเป้าสะสม'}
          accent={o.gap >= 0 ? 'emerald' : 'red'}
          animated
          sign
        />
        <KpiTile
          label="Full-Year Target"
          value={o.fullYearTarget}
          subtitle={`ตามแผนปี ${data.year}`}
          accent="gold"
          animated
        />
        <KpiTile
          label="Projected EOY"
          value={o.projectedEOY}
          subtitle={`${pct(o.projectedAttainmentPct)} ของเป้า`}
          accent={o.projectedAttainmentPct >= 100 ? 'emerald' : o.projectedAttainmentPct >= 95 ? 'navy' : 'red'}
          animated
        />
        <KpiTile
          label="Required Daily Rate"
          value={o.requiredDailyRate}
          subtitle={`เดือนนี้ต้องทำต่อวัน`}
          accent="navy"
          animated
        />
        <KpiTile
          label="Pace vs. Plan"
          value={o.paceMultiplier}
          subtitle={o.paceMultiplier >= 1 ? 'เร็วกว่าเป้า' : 'ช้ากว่าเป้า'}
          accent={o.paceMultiplier >= 1 ? 'emerald' : 'red'}
          animated
          format="multiplier"
        />
      </div>
    </div>
  )
}

function KpiTile({
  label, value, subtitle, accent, animated = false, sign = false, format = 'money',
}: {
  label: string; value: number; subtitle?: string
  accent: 'navy' | 'gold' | 'emerald' | 'red'
  animated?: boolean; sign?: boolean
  format?: 'money' | 'multiplier'
}) {
  const display = useCountUp(animated && Number.isFinite(value) ? value : 0)
  const shown = animated ? display : value
  const formatted = format === 'multiplier'
    ? `${shown.toFixed(2)}×`
    : fmt(shown)
  const textColors: Record<string, string> = {
    navy: 'text-navy-900',
    gold: 'text-gold-800',
    emerald: 'text-emerald-700',
    red: 'text-red-700',
  }
  const stripColors: Record<string, string> = {
    navy: 'from-navy-700 to-navy-900',
    gold: 'from-gold-400 to-gold-600',
    emerald: 'from-emerald-400 to-emerald-600',
    red: 'from-red-400 to-red-600',
  }
  return (
    <div className="relative bg-white rounded-2xl border border-slate-200 shadow-card p-4 hover-lift overflow-hidden">
      <span className={`absolute left-0 top-3 bottom-3 w-1 rounded-full bg-gradient-to-b ${stripColors[accent]}`} />
      <p className="text-[10px] font-semibold text-navy-700 uppercase tracking-wider pl-2">{label}</p>
      <p className={`text-2xl font-bold font-num mt-1.5 pl-2 ${textColors[accent]}`}>
        {sign && shown >= 0 ? '+' : ''}{formatted}
      </p>
      {subtitle && <p className="text-[10px] text-slate-400 mt-1 pl-2 truncate">{subtitle}</p>}
    </div>
  )
}

// ─── Cumulative Chart ────────────────────────────────────────────────────────

function CumulativeChart({ data, anchorMonth }: { data: CumulativePoint[]; anchorMonth: number }) {
  // Zero out actualCum for future months so the line stops at "today"
  const enhanced = data.map((p) => ({
    ...p,
    actualCumDisplay: p.month <= anchorMonth ? p.actualCum : null,
    gap: p.month <= anchorMonth ? p.actualCum - p.targetCum : null,
  }))
  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={enhanced} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="actualFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0a3d2a" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#0a3d2a" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
        <XAxis dataKey="label" {...CLT_AXIS} />
        <YAxis tickFormatter={fmtY} {...CLT_AXIS} />
        <Tooltip {...CLT_TOOLTIP} formatter={(v: number | null, name: string) => v === null ? ['—', name] : [fmtCurrency(v), name]} />
        <Area type="monotone" dataKey="actualCumDisplay" name="Actual cum." stroke="#0a3d2a" strokeWidth={2.5}
          fill="url(#actualFill)" activeDot={{ r: 5 }} />
        <Line type="monotone" dataKey="targetCum" name="Target cum." stroke="#FFCC00" strokeWidth={2.5}
          strokeDasharray="6 4" dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

// ─── Branch Card ─────────────────────────────────────────────────────────────

function BranchCard({ branch }: { branch: BranchAttainment }) {
  return (
    <BentoCard
      title={branch.branchCode}
      subtitle={`เป้าปี ${fmt(branch.fullYearTarget)}`}
      status={branch.status}
      right={<StatusPill status={branch.status} />}
    >
      <div className="flex items-center gap-4">
        <AttainmentRing
          percentage={branch.ytdAttainmentPct}
          secondary={branch.projectedAttainmentPct}
          size={110}
          strokeWidth={10}
          label="YTD"
        />
        <div className="flex-1 min-w-0 space-y-1.5 text-xs">
          <Row label="YTD Actual" value={fmt(branch.ytdActual)} />
          <Row label="YTD Target" value={fmt(branch.ytdTarget)} />
          <Row label="Gap" value={`${branch.gap >= 0 ? '+' : ''}${fmt(branch.gap)}`}
            valueClass={branch.gap >= 0 ? 'text-emerald-600' : 'text-red-500'} />
          <Row label="Projected EOY" value={fmt(branch.projectedEOY)} />
        </div>
      </div>
      {/* Mini sparkline: actual per month */}
      <div className="mt-3 h-12">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={branch.monthly}>
            <Tooltip {...CLT_TOOLTIP} formatter={(v: number) => [fmtCurrency(v), '']}
              labelFormatter={(l) => l} />
            <Bar dataKey="actual" radius={[3, 3, 0, 0]}>
              {branch.monthly.map((m, i) => (
                <Cell
                  key={i}
                  fill={
                    m.isCurrent
                      ? '#FFCC00'
                      : m.target > 0 && m.actual >= m.target
                      ? '#10B981'
                      : m.isPast
                      ? '#0a3d2a'
                      : '#CBD5E1'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </BentoCard>
  )
}

function Row({ label, value, valueClass = 'text-navy-900' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className={`font-num tabular-nums font-semibold ${valueClass}`}>{value}</span>
    </div>
  )
}

// ─── HO Subdivision Table ────────────────────────────────────────────────────

function HoSubdivisionTable({ subdivisions }: { subdivisions: BranchAttainment[] }) {
  if (subdivisions.length === 0) {
    return <p className="text-xs text-slate-400 py-6 text-center">ไม่มีข้อมูล subdivision สำหรับปีนี้</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-slate-50 border-b border-slate-100">
          <tr>
            <th className="px-3 py-2 text-left font-semibold text-navy-700">หน่วยงาน</th>
            <th className="px-3 py-2 text-right font-semibold text-navy-700">เป้าปี</th>
            <th className="px-3 py-2 text-right font-semibold text-navy-700">YTD Actual</th>
            <th className="px-3 py-2 text-right font-semibold text-navy-700">YTD%</th>
            <th className="px-3 py-2 text-right font-semibold text-navy-700">EOY Proj.</th>
            <th className="px-3 py-2 text-right font-semibold text-navy-700">Status</th>
          </tr>
        </thead>
        <tbody>
          {subdivisions.map((s) => {
            const hasTarget = s.fullYearTarget > 0
            return (
              <tr key={(s.subdivision ?? s.branchCode)} className="border-b border-slate-50 hover:bg-navy-50/40 transition-colors">
                <td className="px-3 py-2 font-medium text-navy-900 max-w-[220px]">{s.subdivision ?? s.branchCode}</td>
                <td className="px-3 py-2 text-right tabular-nums text-navy-700 font-num">
                  {hasTarget ? fmt(s.fullYearTarget) : <span className="text-slate-400">ไม่มีเป้า</span>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-navy-900 font-num">{fmt(s.ytdActual)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-semibold font-num">
                  {hasTarget ? pct(s.ytdAttainmentPct) : '—'}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-navy-700 font-num">
                  {hasTarget ? fmt(s.projectedEOY) : fmt(s.fullYearActual)}
                </td>
                <td className="px-3 py-2 text-right">
                  {hasTarget
                    ? <StatusPill status={s.status} />
                    : <span className="text-[10px] text-slate-400 uppercase tracking-wider">Revenue-only</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── HO Projects Table ───────────────────────────────────────────────────────

function HoProjectsTable({ projects }: { projects: HoProjectRow[] }) {
  if (projects.length === 0) {
    return <p className="text-xs text-slate-400 py-6 text-center">ไม่มีรายได้จากงานโครงการสำหรับปีนี้</p>
  }
  const total = projects.reduce((s, p) => s + p.revenue, 0)
  return (
    <div>
      <p className="text-[11px] text-slate-500 mb-2 pl-1">
        รายได้จากงานโครงการและอื่น ๆ ที่ไม่ได้ตั้งเป้าแยก (รวม {fmt(total)})
      </p>
      <ul className="space-y-2">
        {projects.map((p) => {
          const share = total > 0 ? (p.revenue / total) * 100 : 0
          return (
            <li key={p.locationCode} className="bg-gradient-to-r from-slate-50 to-white rounded-lg border border-slate-100 p-2.5">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-navy-900 truncate" title={p.projectName}>
                    <Briefcase size={11} className="inline mr-1 text-gold-600" />
                    {p.projectName}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate mt-0.5">
                    รหัส {p.locationCode} · {p.transactions.toLocaleString()} txn · {p.customers.toLocaleString()} cust
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-navy-900 font-num">{fmt(p.revenue)}</p>
                  <p className="text-[10px] text-slate-400 font-num">{share.toFixed(1)}%</p>
                </div>
              </div>
              {p.topCustomer && (
                <p className="text-[10px] text-slate-500 truncate pl-1 border-l-2 border-gold-300 ml-1">
                  ลูกค้าหลัก: {p.topCustomer}
                </p>
              )}
              <div className="mt-1.5 h-1 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-navy-700 to-gold-500" style={{ width: `${share}%` }} />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ─── At-Risk List ────────────────────────────────────────────────────────────

function AtRiskList({ atRisk }: { atRisk: TargetsData['atRisk'] }) {
  if (atRisk.length === 0) {
    return (
      <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-xl">
        <span className="text-2xl">🟢</span>
        <div>
          <p className="text-sm font-semibold text-emerald-800">ทุกสาขา projection ≥ 95%</p>
          <p className="text-[11px] text-emerald-700">ไม่มีสาขาที่เสี่ยงไม่ถึงเป้า</p>
        </div>
      </div>
    )
  }
  return (
    <ul className="space-y-2">
      {atRisk.map((a) => (
        <li key={a.branchCode} className="flex items-center justify-between gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-flex w-10 h-10 rounded-lg bg-red-500 text-white items-center justify-center font-bold text-sm">
              {a.branchCode}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-red-800">Projected {pct(a.projectedAttainmentPct)}</p>
              <p className="text-[10px] text-red-700">Gap {fmt(a.gap)} · ต้องเพิ่ม +{pct(a.requiredUpliftPct)}</p>
            </div>
          </div>
          <TrendingUp size={16} className="text-red-500 shrink-0" />
        </li>
      ))}
    </ul>
  )
}

// ─── Status Legend ───────────────────────────────────────────────────────────

function StatusLegend() {
  const items: { status: AttainmentStatus; range: string }[] = [
    { status: 'ahead',    range: '≥ 102% (YTD) / ≥ 100% (EOY proj.)' },
    { status: 'on_track', range: '97–101% (YTD) / 95–99% (EOY proj.)' },
    { status: 'behind',   range: '85–96%' },
    { status: 'at_risk',  range: '< 85%' },
  ]
  return (
    <div className="space-y-2.5">
      {items.map((it) => (
        <div key={it.status} className="flex items-center gap-3">
          <StatusPill status={it.status} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-slate-700 font-mono">{it.range}</p>
            <p className="text-[10px] text-slate-500 leading-snug">{STATUS_DESC[it.status]}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Section Title ───────────────────────────────────────────────────────────

function SectionTitle({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex w-8 h-8 rounded-lg bg-navy-900 text-gold-400 items-center justify-center shrink-0">
        <Icon size={14} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-navy-900">{title}</p>
        {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
      </div>
    </div>
  )
}

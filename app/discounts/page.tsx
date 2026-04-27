'use client'

/**
 * /discounts
 *
 * Discount Analytics.
 * Visualises how much revenue is being given away in discounts,
 * which months, branches, salespersons, and customer groups concentrate
 * the most discount, and highlights outliers.
 */

import { useEffect, useMemo, useState } from 'react'
import { RefreshCw, Percent, TrendingUp, Users, AlertTriangle } from 'lucide-react'
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'
import type { DashboardFilters, FilterOptions } from '@/types'
import { FilterPanel } from '@/components/filters/FilterPanel'
import { CLT_COLORS, CLT_SINGLE, CLT_AXIS, CLT_TOOLTIP, fmtY, fmtCurrency } from '@/lib/chartTheme'
import { Glossary } from '@/components/charts/Glossary'
import { DISCOUNTS_GLOSSARY } from '@/lib/glossary-items'
import type {
  DiscountMonthlyPoint, DiscountHeatmapCell, DiscountBySalesperson,
} from '@/lib/calculations/insights'

// ─── Types ────────────────────────────────────────────────────────────────────

type DiscountSummary = {
  totalDiscount: number
  totalLine: number
  totalNet: number
  effectiveRate: number
  avgPerTransaction: number
  transactionsWithDiscount: number
  totalTransactions: number
}

type DiscountGroupRow = {
  name: string
  discountAmount: number
  lineAmount: number
  netAmount: number
  transactions: number
  discountPct: number
}

type DiscountsData = {
  recordCount: number
  summary: DiscountSummary
  monthly: DiscountMonthlyPoint[]
  heatmap: DiscountHeatmapCell[]
  bySalesperson: DiscountBySalesperson[]
  byCustomerGroup: DiscountGroupRow[]
}

const DEFAULT_FILTERS: DashboardFilters = {
  years: [], quarters: [], months: [], branches: [],
  salespersons: [], documentTypes: [], customerGroups: [],
  revenueMetric: 'netAmount',
}

function fmt(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `฿${(n / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `฿${(n / 1_000).toFixed(1)}K`
  return `฿${n.toFixed(0)}`
}

function pct(n: number, digits = 1): string {
  return `${n.toFixed(digits)}%`
}

// Map a 0..100 rate into an intensity 0..4 for heatmap colour
function rateIntensity(rate: number): number {
  if (rate <= 0) return 0
  if (rate < 3) return 1
  if (rate < 7) return 2
  if (rate < 15) return 3
  return 4
}

const HEAT_BG = [
  'bg-slate-100',
  'bg-gold-100',
  'bg-gold-300',
  'bg-gold-500',
  'bg-red-500',
]
const HEAT_TEXT = ['text-slate-400', 'text-navy-900', 'text-navy-900', 'text-navy-900', 'text-white']

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DiscountsPage() {
  const [options, setOptions] = useState<FilterOptions | null>(null)
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS)
  const [data, setData] = useState<DiscountsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/options').then((r) => r.json()).then(setOptions).catch(() => setOptions(null))
  }, [])

  useEffect(() => {
    if (!options) return
    setLoading(true)
    fetch('/api/discounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filters }),
    })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [filters, options])

  // Unique branch + month lists from heatmap data
  const { branches, months, heatmapMap, overallAvg } = useMemo(() => {
    if (!data) return { branches: [] as string[], months: [] as string[], heatmapMap: new Map<string, DiscountHeatmapCell>(), overallAvg: 0 }
    const branchSet = new Set<string>()
    const monthSet = new Set<string>()
    const map = new Map<string, DiscountHeatmapCell>()
    for (const c of data.heatmap) {
      branchSet.add(c.branch)
      monthSet.add(c.month)
      map.set(`${c.branch}::${c.month}`, c)
    }
    return {
      branches: [...branchSet].sort(),
      months: [...monthSet].sort(),
      heatmapMap: map,
      overallAvg: data.summary.effectiveRate,
    }
  }, [data])

  if (!options || !data) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <RefreshCw className="text-navy-400 animate-spin" size={28} />
      </main>
    )
  }

  const s = data.summary
  const topSP = [...data.bySalesperson].sort((a, b) => b.discountPct - a.discountPct).slice(0, 10)
  const topGroups = data.byCustomerGroup.slice(0, 10)

  return (
    <div className="flex flex-1 overflow-hidden bg-[#F8FAFC]">
      {/* Sidebar */}
      <div className="hidden lg:block p-4 shrink-0">
        <FilterPanel options={options} filters={filters} onChange={setFilters} />
      </div>

      <main className="flex-1 overflow-y-auto p-4 lg:p-5 space-y-5 min-w-0 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex w-10 h-10 rounded-xl bg-gradient-to-br from-navy-900 to-navy-700 text-gold-400 items-center justify-center shadow-card">
              <Percent size={18} />
            </span>
            <div>
              <h1 className="text-lg font-bold text-navy-900">Discount Analytics</h1>
              <p className="text-xs text-slate-500">
                {data.recordCount.toLocaleString()} records
                {loading && <RefreshCw className="inline ml-2 animate-spin" size={10} />}
              </p>
            </div>
          </div>
        </div>

        {/* Glossary — help panel */}
        <Glossary items={DISCOUNTS_GLOSSARY} />

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Total Discount Given"
            value={fmt(s.totalDiscount)}
            subtitle={`${pct(s.effectiveRate)} of line revenue`}
            accent="red"
            icon={TrendingUp}
          />
          <KpiCard
            label="Effective Discount Rate"
            value={pct(s.effectiveRate, 2)}
            subtitle={`${fmt(s.totalLine)} gross · ${fmt(s.totalNet)} net`}
            accent="gold"
            icon={Percent}
          />
          <KpiCard
            label="Transactions w/ Discount"
            value={s.transactionsWithDiscount.toLocaleString()}
            subtitle={s.totalTransactions > 0
              ? `${pct((s.transactionsWithDiscount / s.totalTransactions) * 100)} of all txns`
              : '—'}
            accent="navy"
            icon={Users}
          />
          <KpiCard
            label="Avg Discount / Txn"
            value={fmt(s.avgPerTransaction)}
            subtitle={`Across ${s.totalTransactions.toLocaleString()} txns`}
            accent="emerald"
            icon={AlertTriangle}
          />
        </div>

        {/* Monthly trend */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-card p-5 hover-lift">
          <p className="text-sm font-semibold text-navy-900">Monthly Discount Trend</p>
          <p className="text-xs text-slate-400 mt-0.5 mb-4">Discount amount (bars) vs effective discount rate (line)</p>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={data.monthly} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="label" {...CLT_AXIS} />
              <YAxis
                yAxisId="left"
                tickFormatter={fmtY}
                {...CLT_AXIS}
                label={{ value: 'Discount (฿)', angle: -90, position: 'insideLeft', fill: '#64748B', fontSize: 11 }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tickFormatter={(v) => `${v.toFixed(0)}%`}
                {...CLT_AXIS}
                label={{ value: 'Rate %', angle: 90, position: 'insideRight', fill: '#64748B', fontSize: 11 }}
              />
              <Tooltip
                {...CLT_TOOLTIP}
                formatter={(value: number, name: string) => {
                  if (name === 'Discount rate') return [`${value.toFixed(2)}%`, name]
                  return [fmtCurrency(value), name]
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar yAxisId="left" dataKey="discountAmount" name="Discount amount" fill={CLT_SINGLE.danger} radius={[6, 6, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="discountRate" name="Discount rate" stroke={CLT_SINGLE.accent} strokeWidth={2.5} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Heatmap — Branch × Month */}
        {branches.length > 0 && months.length > 0 && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-card p-5 hover-lift">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <div>
                <p className="text-sm font-semibold text-navy-900">Branch × Month Discount Heatmap</p>
                <p className="text-xs text-slate-400 mt-0.5">Darker = higher discount rate. Red cells exceed 15%.</p>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                <span>0%</span>
                {HEAT_BG.map((c, i) => (
                  <span key={i} className={`inline-block w-4 h-4 rounded ${c} border border-slate-200`} />
                ))}
                <span>15%+</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="text-[11px] border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-white z-10 text-left text-navy-700 font-semibold px-2 py-1 border-b border-slate-200">Branch</th>
                    {months.map((m) => (
                      <th key={m} className="text-navy-700 font-semibold px-1.5 py-1 border-b border-slate-200 whitespace-nowrap">{m.slice(2)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {branches.map((b) => (
                    <tr key={b}>
                      <td className="sticky left-0 bg-white z-10 px-2 py-1 font-medium text-navy-900 border-b border-slate-100 whitespace-nowrap">{b}</td>
                      {months.map((m) => {
                        const cell = heatmapMap.get(`${b}::${m}`)
                        if (!cell || cell.lineAmount === 0) {
                          return (
                            <td key={m} className="border-b border-slate-100 px-0.5 py-0.5">
                              <div className="w-10 h-7 rounded bg-slate-50" />
                            </td>
                          )
                        }
                        const intensity = rateIntensity(cell.discountRate)
                        return (
                          <td key={m} className="border-b border-slate-100 px-0.5 py-0.5">
                            <div
                              className={`w-10 h-7 rounded flex items-center justify-center font-num ${HEAT_BG[intensity]} ${HEAT_TEXT[intensity]}`}
                              title={`${b} · ${m}\nRate: ${cell.discountRate.toFixed(2)}%\nLine: ${fmt(cell.lineAmount)}`}
                            >
                              {cell.discountRate.toFixed(1)}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Salesperson discount table */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-card overflow-hidden hover-lift">
            <div className="px-5 py-4 bg-gradient-to-r from-navy-900 to-navy-700">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <span className="inline-block w-1 h-4 bg-gold-500 rounded-full" />
                Top Salespersons by Discount Rate
              </h2>
              <p className="text-xs text-slate-300 mt-0.5 pl-3">Higher rates may indicate price erosion. Overall avg: {pct(overallAvg, 2)}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-navy-700">Salesperson</th>
                    <th className="px-3 py-2 text-right font-semibold text-navy-700">Revenue</th>
                    <th className="px-3 py-2 text-right font-semibold text-red-500">Discount</th>
                    <th className="px-3 py-2 text-right font-semibold text-navy-700">Rate</th>
                    <th className="px-3 py-2 text-right font-semibold text-navy-700">Txns</th>
                  </tr>
                </thead>
                <tbody>
                  {topSP.map((sp) => {
                    const hot = sp.discountPct > overallAvg * 2
                    return (
                      <tr key={sp.name} className="border-b border-slate-50 hover:bg-navy-50/40 transition-colors">
                        <td className="px-4 py-2 font-medium text-navy-900 max-w-[180px] truncate">{sp.name}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-navy-900 font-num">{fmt(sp.revenue)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-red-500 font-num">{fmt(sp.discountAmount)}</td>
                        <td className={`px-3 py-2 text-right tabular-nums font-semibold font-num ${hot ? 'text-red-500' : 'text-navy-700'}`}>
                          {pct(sp.discountPct, 2)}
                          {hot && ' !'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-500 font-num">{sp.transactions.toLocaleString()}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Customer group discount table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-card overflow-hidden hover-lift">
            <div className="px-5 py-4 bg-gradient-to-r from-navy-900 to-navy-700">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <span className="inline-block w-1 h-4 bg-gold-500 rounded-full" />
                Customer Groups — Discount Given
              </h2>
              <p className="text-xs text-slate-300 mt-0.5 pl-3">Which segments absorb the most discount</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-navy-700">Customer Group</th>
                    <th className="px-3 py-2 text-right font-semibold text-navy-700">Net Rev</th>
                    <th className="px-3 py-2 text-right font-semibold text-red-500">Discount</th>
                    <th className="px-3 py-2 text-right font-semibold text-navy-700">Rate</th>
                    <th className="px-3 py-2 text-right font-semibold text-navy-700">Txns</th>
                  </tr>
                </thead>
                <tbody>
                  {topGroups.map((g) => {
                    const hot = g.discountPct > overallAvg * 2
                    return (
                      <tr key={g.name} className="border-b border-slate-50 hover:bg-navy-50/40 transition-colors">
                        <td className="px-4 py-2 font-medium text-navy-900 max-w-[180px] truncate">{g.name}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-navy-900 font-num">{fmt(g.netAmount)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-red-500 font-num">{fmt(g.discountAmount)}</td>
                        <td className={`px-3 py-2 text-right tabular-nums font-semibold font-num ${hot ? 'text-red-500' : 'text-navy-700'}`}>
                          {pct(g.discountPct, 2)}
                          {hot && ' !'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-500 font-num">{g.transactions.toLocaleString()}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, subtitle, accent, icon: Icon,
}: {
  label: string; value: string; subtitle?: string
  accent: 'navy' | 'gold' | 'red' | 'emerald'
  icon: React.ElementType
}) {
  const colors: Record<string, { bg: string; text: string; border: string; icon: string; strip: string }> = {
    navy:    { bg: 'bg-navy-50',    text: 'text-navy-900',    border: 'border-navy-200',    icon: 'text-navy-900',    strip: 'bg-navy-700' },
    gold:    { bg: 'bg-gold-50',    text: 'text-gold-800',    border: 'border-gold-200',    icon: 'text-gold-700',    strip: 'bg-gold-500' },
    red:     { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     icon: 'text-red-500',     strip: 'bg-red-500' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: 'text-emerald-600', strip: 'bg-emerald-500' },
  }
  const c = colors[accent]
  return (
    <div className={`relative bg-white rounded-3xl border ${c.border} shadow-card p-4 hover-lift overflow-hidden`}>
      <span className={`absolute left-0 top-3 bottom-3 w-1 rounded-full ${c.strip}`} />
      <div className="flex items-center justify-between mb-2 pl-1">
        <p className="text-[10px] font-semibold text-navy-700 uppercase tracking-wider">{label}</p>
        <span className={`p-1.5 rounded-lg ${c.bg}`}><Icon size={14} className={c.icon} /></span>
      </div>
      <p className={`text-2xl font-bold font-num pl-1 ${c.text}`}>{value}</p>
      {subtitle && <p className="text-[10px] text-slate-400 mt-1 pl-1">{subtitle}</p>}
    </div>
  )
}

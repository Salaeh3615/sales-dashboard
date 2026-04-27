'use client'

/**
 * /test-analytics
 *
 * Revenue analysis broken down by Test Code / Product Code.
 * Shows which tests drive revenue, which are growing/declining,
 * plus Customer Group and Document Type breakdowns.
 */

import { useEffect, useState } from 'react'
import { RefreshCw, FlaskConical, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts'
import type { DashboardFilters, FilterOptions } from '@/types'
import { FilterPanel } from '@/components/filters/FilterPanel'
import { CLT_COLORS, CLT_AXIS, CLT_TOOLTIP, fmtY, fmtCurrency } from '@/lib/chartTheme'
import { ParetoChart } from '@/components/charts/ParetoChart'
import type { ParetoRow } from '@/lib/calculations/insights'
import { Glossary } from '@/components/charts/Glossary'
import { TESTS_GLOSSARY } from '@/lib/glossary-items'

// ─── Types ────────────────────────────────────────────────────────────────────

type TestCodeRow = {
  name: string
  revenue: number
  share: number
  count: number
  description?: string
}

type GrowthItem = {
  code: string
  prevRev: number
  currRev: number
  pct: number
}

type GroupRow = {
  name: string
  revenue: number
  share: number
  count: number
}

type DocTypeRow = {
  type: string
  revenue: number
  count: number
  share: number
}

type TestAnalyticsData = {
  recordCount: number
  allYears: number[]
  testCodes: TestCodeRow[]
  testTrend: { label: string; [code: string]: number | string }[]
  topCodes: string[]
  yearComparison: { code: string; [year: string]: number | string }[]
  topGrowing: GrowthItem[]
  topDeclining: GrowthItem[]
  customerGroups: GroupRow[]
  customerGroupTrend: { label: string; [group: string]: number | string }[]
  topCustomerGroups: string[]
  docTypes: DocTypeRow[]
  pareto: { rows: ParetoRow[]; total: number; top20PctShare: number; top20Count: number }
}

function fmt(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `฿${(n / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `฿${(n / 1_000).toFixed(1)}K`
  return `฿${n.toFixed(0)}`
}

const DEFAULT_FILTERS: DashboardFilters = {
  years: [], quarters: [], months: [], branches: [],
  salespersons: [], documentTypes: [], customerGroups: [],
  revenueMetric: 'netAmount',
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-card p-5 hover-lift">
      <p className="text-sm font-semibold text-navy-900">{title}</p>
      {subtitle && <p className="text-xs text-slate-400 mt-0.5 mb-4">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TestAnalyticsPage() {
  const [options, setOptions]   = useState<FilterOptions | null>(null)
  const [filters, setFilters]   = useState<DashboardFilters>(DEFAULT_FILTERS)
  const [data, setData]         = useState<TestAnalyticsData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState<'tests' | 'groups' | 'doctype'>('tests')

  useEffect(() => {
    fetch('/api/options').then((r) => r.json()).then(setOptions).catch(() => setOptions(null))
  }, [])

  useEffect(() => {
    if (!options) return
    setLoading(true)
    fetch('/api/test-analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filters }),
    })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [filters, options])

  if (!options || !data) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <RefreshCw className="text-navy-400 animate-spin" size={28} />
      </main>
    )
  }

  const topTests   = data.testCodes.slice(0, 10)
  const topPie     = data.testCodes.slice(0, 8)
  const totalRev   = data.testCodes.reduce((s, t) => s + t.revenue, 0)

  // Credit memo metrics
  const invoices   = data.docTypes.find((d) => /invoice/i.test(d.type))
  const credits    = data.docTypes.find((d) => /credit/i.test(d.type))
  const creditRate = invoices && credits
    ? (Math.abs(credits.revenue) / Math.abs(invoices.revenue)) * 100
    : null

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
              <FlaskConical size={18} />
            </span>
            <div>
              <h1 className="text-lg font-bold text-navy-900">Test &amp; Product Analytics</h1>
              <p className="text-xs text-slate-500">
                {data.recordCount.toLocaleString()} records
                {loading && <RefreshCw className="inline ml-2 animate-spin" size={10} />}
              </p>
            </div>
          </div>
          <nav className="flex gap-1 bg-white rounded-xl p-1 border border-slate-200 shadow-sm">
            {(['tests', 'groups', 'doctype'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-all ${
                  tab === t
                    ? 'bg-navy-900 text-gold-400 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-navy-900'
                }`}
              >
                {t === 'tests' ? 'Test Codes' : t === 'groups' ? 'Customer Groups' : 'Doc Types'}
              </button>
            ))}
          </nav>
        </div>

        {/* Glossary — help panel */}
        <Glossary items={TESTS_GLOSSARY} />

        {/* ── TEST CODES TAB ── */}
        {tab === 'tests' && (
          <div className="space-y-6 animate-slide-up">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard label="Total Revenue" value={fmt(totalRev)} tone="navy" />
              <KpiCard label="Unique Test Codes" value={data.testCodes.length.toLocaleString()} tone="gold" />
              {data.testCodes[0] && (
                <KpiCard
                  label="Top Test Code"
                  value={data.testCodes[0].name}
                  sub={fmt(data.testCodes[0].revenue)}
                  tone="emerald"
                />
              )}
              {creditRate !== null && (
                <KpiCard
                  label="Credit Memo Rate"
                  value={`${creditRate.toFixed(1)}%`}
                  tone={creditRate > 10 ? 'red' : 'slate'}
                  warn={creditRate > 10}
                />
              )}
            </div>

            {/* Growth / Decline alerts */}
            {data.allYears.length >= 2 && (data.topGrowing.length > 0 || data.topDeclining.length > 0) && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {data.topGrowing.length > 0 && (
                  <GrowthCard title="Fastest Growing Tests" items={data.topGrowing} positive />
                )}
                {data.topDeclining.length > 0 && (
                  <GrowthCard title="Fastest Declining Tests" items={data.topDeclining} positive={false} />
                )}
              </div>
            )}

            {/* Top Tests Bar + Pie */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <ChartCard title="Top 10 Test Codes by Revenue">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topTests} layout="vertical" margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CLT_AXIS.grid} horizontal={false} />
                    <XAxis type="number" tickFormatter={fmtY} tick={CLT_AXIS.tick} tickLine={CLT_AXIS.tickLine} axisLine={CLT_AXIS.axisLine} />
                    <YAxis type="category" dataKey="name" tick={CLT_AXIS.tick} tickLine={CLT_AXIS.tickLine} axisLine={CLT_AXIS.axisLine} width={70} />
                    <Tooltip formatter={(v) => [fmtCurrency(v as number), 'Revenue']} {...CLT_TOOLTIP} />
                    <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                      {topTests.map((_, i) => <Cell key={i} fill={CLT_COLORS[i % CLT_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Revenue Share by Test Code">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={topPie}
                      dataKey="revenue"
                      nameKey="name"
                      cx="50%"
                      cy="45%"
                      outerRadius={95}
                      innerRadius={50}
                      paddingAngle={2}
                      label={({ name, share }) => `${name} ${(share as number).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {topPie.map((_, i) => <Cell key={i} fill={CLT_COLORS[i % CLT_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => [fmtCurrency(v as number), 'Revenue']} {...CLT_TOOLTIP} />
                    <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: '#475569' }}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            {/* Test Trend Over Time */}
            {data.testTrend.length > 0 && (
              <ChartCard title="Test Code Revenue Over Time (Top 8)" subtitle="Monthly trend for the highest-revenue test codes">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={data.testTrend} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CLT_AXIS.grid} />
                    <XAxis dataKey="label" tick={CLT_AXIS.tick} tickLine={CLT_AXIS.tickLine} axisLine={CLT_AXIS.axisLine} interval="preserveStartEnd" />
                    <YAxis tickFormatter={fmtY} tick={CLT_AXIS.tick} tickLine={CLT_AXIS.tickLine} axisLine={CLT_AXIS.axisLine} width={58} />
                    <Tooltip formatter={(v, name) => [fmtCurrency(v as number), name]} {...CLT_TOOLTIP} />
                    <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: '#475569' }}>{v}</span>} />
                    {data.topCodes.map((code, i) => (
                      <Line key={code} type="monotone" dataKey={code} stroke={CLT_COLORS[i % CLT_COLORS.length]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {/* Pareto 80/20 */}
            {data.pareto && data.pareto.rows.length > 0 && (
              <ParetoChart
                rows={data.pareto.rows}
                title="Pareto · 80/20 revenue concentration (test codes)"
                dimension="test codes"
                top20PctShare={data.pareto.top20PctShare}
                top20Count={data.pareto.top20Count}
                totalCount={data.testCodes.length}
              />
            )}

            {/* Full ranking table */}
            <TestRankingTable data={data.testCodes} />
          </div>
        )}

        {/* ── CUSTOMER GROUPS TAB ── */}
        {tab === 'groups' && (
          <div className="space-y-6 animate-slide-up">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <ChartCard title="Revenue by Customer Group">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.customerGroups.slice(0, 12)} layout="vertical" margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CLT_AXIS.grid} horizontal={false} />
                    <XAxis type="number" tickFormatter={fmtY} tick={CLT_AXIS.tick} tickLine={CLT_AXIS.tickLine} axisLine={CLT_AXIS.axisLine} />
                    <YAxis type="category" dataKey="name" tick={CLT_AXIS.tick} tickLine={CLT_AXIS.tickLine} axisLine={CLT_AXIS.axisLine} width={90} />
                    <Tooltip formatter={(v) => [fmtCurrency(v as number), 'Revenue']} {...CLT_TOOLTIP} />
                    <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                      {data.customerGroups.slice(0, 12).map((_, i) => <Cell key={i} fill={CLT_COLORS[i % CLT_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Customer Group Share">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.customerGroups.filter((g) => g.revenue > 0).slice(0, 8)}
                      dataKey="revenue"
                      nameKey="name"
                      cx="50%"
                      cy="45%"
                      outerRadius={95}
                      innerRadius={50}
                      paddingAngle={2}
                      label={({ name, share }) => `${(name as string).slice(0, 10)} ${(share as number).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {data.customerGroups.slice(0, 8).map((_, i) => <Cell key={i} fill={CLT_COLORS[i % CLT_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => [fmtCurrency(v as number), 'Revenue']} {...CLT_TOOLTIP} />
                    <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: '#475569' }}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            {data.customerGroupTrend.length > 0 && (
              <ChartCard title="Customer Group Trend Over Time">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={data.customerGroupTrend} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CLT_AXIS.grid} />
                    <XAxis dataKey="label" tick={CLT_AXIS.tick} tickLine={CLT_AXIS.tickLine} axisLine={CLT_AXIS.axisLine} interval="preserveStartEnd" />
                    <YAxis tickFormatter={fmtY} tick={CLT_AXIS.tick} tickLine={CLT_AXIS.tickLine} axisLine={CLT_AXIS.axisLine} width={58} />
                    <Tooltip formatter={(v, name) => [fmtCurrency(v as number), name]} {...CLT_TOOLTIP} />
                    <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: '#475569' }}>{v}</span>} />
                    {data.topCustomerGroups.map((g, i) => (
                      <Line key={g} type="monotone" dataKey={g} stroke={CLT_COLORS[i % CLT_COLORS.length]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {/* Group ranking table */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-card overflow-hidden hover-lift">
              <div className="px-5 py-4 bg-gradient-to-r from-navy-900 to-navy-700">
                <p className="text-sm font-semibold text-white flex items-center gap-2">
                  <span className="inline-block w-1 h-4 bg-gold-500 rounded-full" />
                  Customer Group Ranking
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-4 py-2.5 text-navy-700 font-semibold">#</th>
                      <th className="text-left px-4 py-2.5 text-navy-700 font-semibold">Group</th>
                      <th className="text-right px-4 py-2.5 text-navy-700 font-semibold">Revenue</th>
                      <th className="text-right px-4 py-2.5 text-navy-700 font-semibold">Share</th>
                      <th className="text-right px-4 py-2.5 text-navy-700 font-semibold">Txns</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.customerGroups.map((g, i) => (
                      <tr key={g.name} className="border-b border-slate-50 hover:bg-navy-50/40 transition-colors">
                        <td className="px-4 py-2.5 text-slate-400">{i + 1}</td>
                        <td className="px-4 py-2.5 font-medium text-navy-900">{g.name}</td>
                        <td className="px-4 py-2.5 text-right text-navy-900 font-semibold font-num">{fmt(g.revenue)}</td>
                        <td className="px-4 py-2.5 text-right text-slate-500 font-num">{g.share.toFixed(1)}%</td>
                        <td className="px-4 py-2.5 text-right text-slate-400 font-num">{g.count.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── DOCUMENT TYPES TAB ── */}
        {tab === 'doctype' && (
          <div className="space-y-6 animate-slide-up">
            {/* Credit memo alert */}
            {creditRate !== null && creditRate > 10 && (
              <div className="bg-amber-50 border border-amber-200 rounded-3xl p-4 flex items-start gap-3 shadow-card">
                <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">High Credit Memo Rate: {creditRate.toFixed(1)}%</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Credit memos are {creditRate.toFixed(1)}% of invoice revenue. Rates above 10% may indicate billing errors, returns, or service quality issues.
                  </p>
                </div>
              </div>
            )}

            {/* Doc type cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.docTypes.map((d, i) => {
                const isCredit = /credit/i.test(d.type)
                return (
                  <div key={d.type} className="bg-white rounded-3xl border border-slate-200 shadow-card p-4 hover-lift">
                    <p className="text-[10px] font-semibold text-navy-700 uppercase tracking-wider">{d.type || '(unknown)'}</p>
                    <p className={`text-xl font-bold mt-1 font-num ${isCredit ? 'text-red-600' : 'text-navy-900'}`}>
                      {fmt(d.revenue)}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{d.count.toLocaleString()} transactions · {d.share.toFixed(1)}% of gross</p>
                    <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(d.share, 100)}%`, background: isCredit ? '#ef4444' : CLT_COLORS[i % CLT_COLORS.length] }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Doc type bar */}
            <ChartCard title="Revenue by Document Type">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.docTypes} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CLT_AXIS.grid} vertical={false} />
                  <XAxis dataKey="type" tick={{ ...CLT_AXIS.tick, fill: '#1e293b', fontSize: 12 }} tickLine={CLT_AXIS.tickLine} axisLine={CLT_AXIS.axisLine} />
                  <YAxis tickFormatter={fmtY} tick={CLT_AXIS.tick} tickLine={CLT_AXIS.tickLine} axisLine={CLT_AXIS.axisLine} width={58} />
                  <Tooltip formatter={(v) => [fmtCurrency(v as number), 'Revenue']} {...CLT_TOOLTIP} />
                  <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                    {data.docTypes.map((d, i) => (
                      <Cell key={i} fill={/credit/i.test(d.type) ? '#ef4444' : CLT_COLORS[i % CLT_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        )}
      </main>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const TONES: Record<string, { value: string; border: string; accent: string }> = {
  navy:    { value: 'text-navy-900',    border: 'border-slate-200',  accent: 'bg-navy-900' },
  gold:    { value: 'text-gold-600',    border: 'border-gold-100',   accent: 'bg-gold-500' },
  emerald: { value: 'text-emerald-600', border: 'border-emerald-100',accent: 'bg-emerald-500' },
  red:     { value: 'text-red-600',     border: 'border-red-100',    accent: 'bg-red-500' },
  slate:   { value: 'text-navy-900',    border: 'border-slate-200',  accent: 'bg-slate-400' },
}

function KpiCard({ label, value, sub, tone = 'navy', warn }: {
  label: string; value: string; sub?: string
  tone?: 'navy' | 'gold' | 'emerald' | 'red' | 'slate'
  warn?: boolean
}) {
  const t = TONES[tone]
  return (
    <div className={`relative bg-white rounded-3xl border shadow-card p-4 hover-lift overflow-hidden ${warn ? 'border-amber-200' : t.border}`}>
      <span className={`absolute left-0 top-3 bottom-3 w-1 rounded-full ${t.accent}`} />
      <p className="text-[10px] font-semibold text-navy-700 uppercase tracking-wider pl-1">{label}</p>
      <p className={`text-lg font-bold mt-1 truncate pl-1 font-num ${t.value}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5 pl-1 font-num">{sub}</p>}
    </div>
  )
}

function GrowthCard({ title, items, positive }: { title: string; items: GrowthItem[]; positive: boolean }) {
  return (
    <div className={`bg-white rounded-3xl border shadow-card p-5 hover-lift ${positive ? 'border-emerald-100' : 'border-red-100'}`}>
      <div className="flex items-center gap-2 mb-4">
        <span className={`inline-flex w-8 h-8 rounded-lg items-center justify-center ${positive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
          {positive ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
        </span>
        <p className="text-sm font-semibold text-navy-900">{title}</p>
        <span className="text-xs text-slate-400">(vs prior year)</span>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.code} className="flex items-center justify-between gap-2 py-1 border-b border-slate-50 last:border-0">
            <p className="text-xs font-medium text-navy-900 truncate flex-1">{item.code}</p>
            <div className="text-right shrink-0">
              <span className={`text-xs font-bold font-num ${item.pct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {item.pct >= 0 ? '+' : ''}{item.pct.toFixed(1)}%
              </span>
              <p className="text-xs text-slate-400 font-num">
                {fmt(item.prevRev)} → {fmt(item.currRev)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TestRankingTable({ data }: { data: TestCodeRow[] }) {
  const [showAll, setShowAll] = useState(false)
  const rows = showAll ? data : data.slice(0, 20)

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-card overflow-hidden hover-lift">
      <div className="px-5 py-4 bg-gradient-to-r from-navy-900 to-navy-700">
        <p className="text-sm font-semibold text-white flex items-center gap-2">
          <span className="inline-block w-1 h-4 bg-gold-500 rounded-full" />
          All Test Codes ({data.length})
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left px-4 py-2.5 text-navy-700 font-semibold">#</th>
              <th className="text-left px-4 py-2.5 text-navy-700 font-semibold">Code</th>
              <th className="text-left px-4 py-2.5 text-navy-700 font-semibold">Description</th>
              <th className="text-right px-4 py-2.5 text-navy-700 font-semibold">Revenue</th>
              <th className="text-right px-4 py-2.5 text-navy-700 font-semibold">Share</th>
              <th className="text-right px-4 py-2.5 text-navy-700 font-semibold">Txns</th>
              <th className="px-4 py-2.5 text-navy-700 font-semibold">Bar</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => (
              <tr key={t.name} className="border-b border-slate-50 hover:bg-navy-50/40 transition-colors">
                <td className="px-4 py-2.5 text-slate-400">{i + 1}</td>
                <td className="px-4 py-2.5 font-medium text-navy-900">{t.name}</td>
                <td className="px-4 py-2.5 text-slate-500 max-w-[200px] truncate">{t.description || '—'}</td>
                <td className="px-4 py-2.5 text-right font-semibold text-navy-900 font-num">{fmt(t.revenue)}</td>
                <td className="px-4 py-2.5 text-right text-slate-500 font-num">{t.share.toFixed(1)}%</td>
                <td className="px-4 py-2.5 text-right text-slate-400 font-num">{t.count.toLocaleString()}</td>
                <td className="px-4 py-2.5 w-24">
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-navy-900 to-gold-500"
                      style={{ width: `${Math.min(t.share, 100)}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length > 20 && (
        <div className="p-3 border-t border-slate-100 text-center">
          <button
            onClick={() => setShowAll((v) => !v)}
            className="text-xs text-navy-900 hover:text-gold-600 font-semibold transition-colors"
          >
            {showAll ? 'Show less' : `Show all ${data.length} test codes`}
          </button>
        </div>
      )}
    </div>
  )
}

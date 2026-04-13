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
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from 'recharts'
import type { DashboardFilters, FilterOptions } from '@/types'
import { FilterPanel } from '@/components/filters/FilterPanel'

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
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const COLORS = [
  '#3b82f6', '#7c3aed', '#0d9488', '#f59e0b',
  '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16',
  '#f97316', '#ec4899',
]

function fmt(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `฿${(n / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `฿${(n / 1_000).toFixed(1)}K`
  return `฿${n.toFixed(0)}`
}

function fmtY(v: number) {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}

function fmtTooltip(v: number | string) {
  const n = Number(v)
  return isNaN(n) ? String(v) : `฿${n.toLocaleString()}`
}

const DEFAULT_FILTERS: DashboardFilters = {
  years: [], quarters: [], months: [], branches: [],
  salespersons: [], documentTypes: [], customerGroups: [],
  revenueMetric: 'netAmount',
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
        <RefreshCw className="text-slate-400 animate-spin" size={28} />
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
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar */}
      <div className="hidden lg:block p-4 shrink-0">
        <FilterPanel options={options} filters={filters} onChange={setFilters} />
      </div>

      <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-8 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <FlaskConical size={20} className="text-violet-600" />
            <div>
              <h1 className="text-base font-bold text-slate-800">Test & Product Analytics</h1>
              <p className="text-xs text-slate-400">
                {data.recordCount.toLocaleString()} records
                {loading && <RefreshCw className="inline ml-2 animate-spin" size={10} />}
              </p>
            </div>
          </div>
          <nav className="flex gap-1">
            {(['tests', 'groups', 'doctype'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${
                  tab === t ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t === 'tests' ? 'Test Codes' : t === 'groups' ? 'Customer Groups' : 'Doc Types'}
              </button>
            ))}
          </nav>
        </div>

        {/* ── TEST CODES TAB ── */}
        {tab === 'tests' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard label="Total Revenue" value={fmt(totalRev)} accent="text-slate-800" />
              <KpiCard label="Unique Test Codes" value={data.testCodes.length.toLocaleString()} accent="text-violet-600" />
              {data.testCodes[0] && (
                <KpiCard
                  label="Top Test Code"
                  value={data.testCodes[0].name}
                  sub={fmt(data.testCodes[0].revenue)}
                  accent="text-emerald-600"
                />
              )}
              {creditRate !== null && (
                <KpiCard
                  label="Credit Memo Rate"
                  value={`${creditRate.toFixed(1)}%`}
                  accent={creditRate > 10 ? 'text-red-600' : 'text-slate-800'}
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
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <p className="text-sm font-semibold text-slate-700 mb-4">Top 10 Test Codes by Revenue</p>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topTests} layout="vertical" margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tickFormatter={fmtY} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} tickLine={false} axisLine={false} width={70} />
                    <Tooltip formatter={(v) => [fmtTooltip(v as number), 'Revenue']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                    <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                      {topTests.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <p className="text-sm font-semibold text-slate-700 mb-4">Revenue Share by Test Code</p>
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
                      {topPie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => [fmtTooltip(v as number), 'Revenue']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                    <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: '#475569' }}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Test Trend Over Time */}
            {data.testTrend.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <p className="text-sm font-semibold text-slate-700 mb-1">Test Code Revenue Over Time (Top 8)</p>
                <p className="text-xs text-slate-400 mb-4">Monthly trend for the highest-revenue test codes</p>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={data.testTrend} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tickFormatter={fmtY} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={58} />
                    <Tooltip formatter={(v, name) => [fmtTooltip(v as number), name]} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                    <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: '#475569' }}>{v}</span>} />
                    {data.topCodes.map((code, i) => (
                      <Line key={code} type="monotone" dataKey={code} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Full ranking table */}
            <TestRankingTable data={data.testCodes} />
          </div>
        )}

        {/* ── CUSTOMER GROUPS TAB ── */}
        {tab === 'groups' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <p className="text-sm font-semibold text-slate-700 mb-4">Revenue by Customer Group</p>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.customerGroups.slice(0, 12)} layout="vertical" margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tickFormatter={fmtY} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} tickLine={false} axisLine={false} width={90} />
                    <Tooltip formatter={(v) => [fmtTooltip(v as number), 'Revenue']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                    <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                      {data.customerGroups.slice(0, 12).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <p className="text-sm font-semibold text-slate-700 mb-4">Customer Group Share</p>
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
                      {data.customerGroups.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => [fmtTooltip(v as number), 'Revenue']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                    <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: '#475569' }}>{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {data.customerGroupTrend.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <p className="text-sm font-semibold text-slate-700 mb-4">Customer Group Trend Over Time</p>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={data.customerGroupTrend} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tickFormatter={fmtY} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={58} />
                    <Tooltip formatter={(v, name) => [fmtTooltip(v as number), name]} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                    <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: '#475569' }}>{v}</span>} />
                    {data.topCustomerGroups.map((g, i) => (
                      <Line key={g} type="monotone" dataKey={g} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Group ranking table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <p className="text-sm font-semibold text-slate-700">Customer Group Ranking</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-4 py-2.5 text-slate-500 font-medium">#</th>
                      <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Group</th>
                      <th className="text-right px-4 py-2.5 text-slate-500 font-medium">Revenue</th>
                      <th className="text-right px-4 py-2.5 text-slate-500 font-medium">Share</th>
                      <th className="text-right px-4 py-2.5 text-slate-500 font-medium">Txns</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.customerGroups.map((g, i) => (
                      <tr key={g.name} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2.5 text-slate-400">{i + 1}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-700">{g.name}</td>
                        <td className="px-4 py-2.5 text-right text-slate-700 font-semibold">{fmt(g.revenue)}</td>
                        <td className="px-4 py-2.5 text-right text-slate-500">{g.share.toFixed(1)}%</td>
                        <td className="px-4 py-2.5 text-right text-slate-400">{g.count.toLocaleString()}</td>
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
          <div className="space-y-6">
            {/* Credit memo alert */}
            {creditRate !== null && creditRate > 10 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
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
                  <div key={d.type} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{d.type || '(unknown)'}</p>
                    <p className={`text-xl font-bold mt-1 ${isCredit ? 'text-red-600' : 'text-slate-800'}`}>
                      {fmt(d.revenue)}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{d.count.toLocaleString()} transactions · {d.share.toFixed(1)}% of gross</p>
                    <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(d.share, 100)}%`, background: COLORS[i % COLORS.length] }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Doc type bar */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <p className="text-sm font-semibold text-slate-700 mb-4">Revenue by Document Type</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.docTypes} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="type" tick={{ fontSize: 12, fill: '#475569' }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={fmtY} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={58} />
                  <Tooltip formatter={(v) => [fmtTooltip(v as number), 'Revenue']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                  <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                    {data.docTypes.map((d, i) => (
                      <Cell key={i} fill={/credit/i.test(d.type) ? '#ef4444' : COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent, warn }: { label: string; value: string; sub?: string; accent: string; warn?: boolean }) {
  return (
    <div className={`bg-white rounded-xl border shadow-sm p-4 ${warn ? 'border-amber-200' : 'border-slate-200'}`}>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`text-lg font-bold mt-1 truncate ${accent}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function GrowthCard({ title, items, positive }: { title: string; items: GrowthItem[]; positive: boolean }) {
  return (
    <div className={`bg-white rounded-xl border shadow-sm p-5 ${positive ? 'border-emerald-100' : 'border-red-100'}`}>
      <div className="flex items-center gap-2 mb-4">
        {positive
          ? <TrendingUp size={15} className="text-emerald-500" />
          : <TrendingDown size={15} className="text-red-500" />}
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        <span className="text-xs text-slate-400">(vs prior year)</span>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.code} className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-700 truncate flex-1">{item.code}</p>
            <div className="text-right shrink-0">
              <span className={`text-xs font-bold ${item.pct >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {item.pct >= 0 ? '+' : ''}{item.pct.toFixed(1)}%
              </span>
              <p className="text-xs text-slate-400">
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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100">
        <p className="text-sm font-semibold text-slate-700">All Test Codes ({data.length})</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="text-left px-4 py-2.5 text-slate-500 font-medium">#</th>
              <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Code</th>
              <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Description</th>
              <th className="text-right px-4 py-2.5 text-slate-500 font-medium">Revenue</th>
              <th className="text-right px-4 py-2.5 text-slate-500 font-medium">Share</th>
              <th className="text-right px-4 py-2.5 text-slate-500 font-medium">Txns</th>
              <th className="px-4 py-2.5 text-slate-500 font-medium">Bar</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => (
              <tr key={t.name} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-2.5 text-slate-400">{i + 1}</td>
                <td className="px-4 py-2.5 font-medium text-slate-700">{t.name}</td>
                <td className="px-4 py-2.5 text-slate-400 max-w-[200px] truncate">{t.description || '—'}</td>
                <td className="px-4 py-2.5 text-right font-semibold text-slate-700">{fmt(t.revenue)}</td>
                <td className="px-4 py-2.5 text-right text-slate-500">{t.share.toFixed(1)}%</td>
                <td className="px-4 py-2.5 text-right text-slate-400">{t.count.toLocaleString()}</td>
                <td className="px-4 py-2.5 w-24">
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-500 rounded-full"
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
            className="text-xs text-violet-600 hover:text-violet-800 font-medium"
          >
            {showAll ? 'Show less' : `Show all ${data.length} test codes`}
          </button>
        </div>
      )}
    </div>
  )
}

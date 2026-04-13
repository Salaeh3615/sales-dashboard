'use client'

/**
 * Main dashboard page.
 *
 * Fetches all data from server APIs (no client-side file parsing).  Viewers
 * just open this URL — admin uploads happen on /admin.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { RefreshCw, Upload, AlertTriangle } from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts'

import type { DashboardFilters, FilterOptions, Insight, KPISummary } from '@/types'
import type { WaterfallBar } from '@/lib/calculations/aggregations'
import { FilterPanel } from '@/components/filters/FilterPanel'
import { KPICards } from '@/components/dashboard/KPICards'
import { InsightPanel } from '@/components/dashboard/InsightCard'
import { RevenueChart } from '@/components/charts/RevenueChart'
import { BranchBarChart, BranchPieChart, BranchTrendChart } from '@/components/charts/BranchChart'
import { SalespersonBarChart, SalespersonPieChart } from '@/components/charts/SalespersonChart'
import { QuarterComparisonChart, MonthComparisonChart, YearComparisonChart } from '@/components/charts/ComparisonChart'
import { RankingTable } from '@/components/tables/RankingTable'
import { WaterfallChart } from '@/components/charts/WaterfallChart'

const DEFAULT_FILTERS: DashboardFilters = {
  years: [], quarters: [], months: [], branches: [],
  salespersons: [], documentTypes: [], customerGroups: [],
  revenueMetric: 'netAmount',
}

const COLORS = [
  '#3b82f6', '#7c3aed', '#0d9488', '#f59e0b',
  '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16',
]

function fmt(n: number) {
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

type GroupRow = { name: string; revenue: number; share: number; count: number }
type DocTypeRow = { type: string; revenue: number; count: number; share: number }

type DashboardData = {
  recordCount: number
  totalRecords: number
  kpis: KPISummary & {
    totalCustomers: number
    newCustomers: number
    existingCustomers: number
    lostCustomers: number
    returningCustomers: number
  }
  monthly: { label: string; revenue: number; count: number }[]
  quarterly: { label: string; revenue: number; count: number }[]
  yearly: { label: string; revenue: number; count: number }[]
  branches: { name: string; revenue: number; share: number; count: number }[]
  salespeople: { name: string; revenue: number; share: number; count: number }[]
  branchTrend: { label: string; [k: string]: number | string }[]
  topBranches: string[]
  yearComparison: { year: number; revenue: number }[]
  quarterComparison: { quarter: string; [k: string]: number | string }[]
  monthComparison: { month: string; monthNumber: number; [k: string]: number | string }[]
  allYears: number[]
  insights: Insight[]
  customerGroups: GroupRow[]
  customerGroupTrend: { label: string; [k: string]: number | string }[]
  topCustomerGroups: string[]
  docTypes: DocTypeRow[]
  waterfallData: WaterfallBar[] | null
  waterfallLabel: { prev: string; curr: string }
}

export default function DashboardPage() {
  const [options, setOptions] = useState<FilterOptions | null>(null)
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<
    'overview' | 'branch' | 'salesperson' | 'groups' | 'comparison' | 'insights'
  >('overview')

  useEffect(() => {
    fetch('/api/options').then((r) => r.json()).then(setOptions).catch(() => setOptions(null))
  }, [])

  useEffect(() => {
    if (!options) return
    setLoading(true)
    fetch('/api/dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filters }),
    })
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [filters, options])

  const empty = options && options.years && options.years.length === 0

  if (empty) {
    return (
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <Upload size={48} className="text-slate-300 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-800">No data yet</h1>
          <p className="text-sm text-slate-500 mt-2">
            The database is empty. An administrator needs to upload data files first.
          </p>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            <Upload size={14} />
            Go to Admin
          </Link>
        </div>
      </main>
    )
  }

  if (!options || !data) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <RefreshCw className="text-slate-400 animate-spin" size={28} />
      </main>
    )
  }

  // Credit memo alert
  const invoices  = data.docTypes.find((d) => /invoice/i.test(d.type))
  const credits   = data.docTypes.find((d) => /credit/i.test(d.type))
  const creditRate = invoices && credits
    ? (Math.abs(credits.revenue) / Math.abs(invoices.revenue)) * 100
    : null

  const SECTIONS = ['overview', 'branch', 'salesperson', 'groups', 'comparison', 'insights'] as const

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="hidden lg:block p-4 shrink-0">
        <FilterPanel options={options} filters={filters} onChange={setFilters} />
      </div>

      <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-8 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs text-slate-500">
            Showing{' '}
            <span className="font-semibold text-slate-700">{data.recordCount.toLocaleString()}</span>
            {' '}of{' '}
            <span className="font-semibold text-slate-700">{data.totalRecords.toLocaleString()}</span>
            {' '}records
            {loading && <RefreshCw className="inline ml-2 animate-spin" size={11} />}
          </p>
          <nav className="flex gap-1 overflow-x-auto">
            {SECTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setActiveSection(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize whitespace-nowrap transition-colors ${
                  activeSection === s ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-200'
                }`}
              >
                {s === 'groups' ? 'Cust. Groups' : s}
              </button>
            ))}
          </nav>
        </div>

        {/* Credit memo alert banner */}
        {creditRate !== null && creditRate > 10 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2.5">
            <AlertTriangle size={15} className="text-amber-500 shrink-0" />
            <p className="text-xs text-amber-800">
              <span className="font-semibold">Credit Memo Rate: {creditRate.toFixed(1)}%</span>
              {' '}— Credit memos are unusually high relative to invoices. Check for returns or billing corrections.
            </p>
          </div>
        )}

        {/* KPIs */}
        <section>
          <SectionHeading title="Key Performance Indicators" />
          <KPICards kpis={data.kpis} recordCount={data.recordCount} />
          <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <CustomerKpiCard label="Total Customers" value={data.kpis.totalCustomers} accent="bg-slate-50 text-slate-600" />
            <CustomerKpiCard label="New Customers" value={data.kpis.newCustomers} accent="bg-emerald-50 text-emerald-600" />
            <CustomerKpiCard label="Returning" value={data.kpis.returningCustomers} accent="bg-blue-50 text-blue-600" />
            <CustomerKpiCard label="Lost Customers" value={data.kpis.lostCustomers} accent="bg-red-50 text-red-500" />
          </div>
        </section>

        {/* ── OVERVIEW ── */}
        {activeSection === 'overview' && (
          <section>
            <SectionHeading title="Revenue Trends" sub="Monthly, quarterly, and annual" />
            <RevenueChart monthly={data.monthly} quarterly={data.quarterly} yearly={data.yearly} />
          </section>
        )}

        {/* ── BRANCH ── */}
        {activeSection === 'branch' && (
          <div className="space-y-6">
            <section>
              <SectionHeading title="Branch Performance" />
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <BranchBarChart data={data.branches} />
                <BranchPieChart data={data.branches} />
              </div>
            </section>
            <section>
              <SectionHeading title="Branch Revenue Over Time" />
              <BranchTrendChart data={data.branchTrend} branches={data.topBranches} />
            </section>
            <section>
              <SectionHeading title="Branch Ranking" />
              <RankingTable title="All Branches" data={data.branches} />
            </section>
          </div>
        )}

        {/* ── SALESPERSON ── */}
        {activeSection === 'salesperson' && (
          <div className="space-y-6">
            <section>
              <SectionHeading title="Salesperson Performance" />
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <SalespersonBarChart data={data.salespeople} topN={10} />
                <SalespersonPieChart data={data.salespeople} topN={8} />
              </div>
            </section>
            <section>
              <SectionHeading title="Salesperson Ranking" />
              <RankingTable title="All Salespeople" data={data.salespeople} topN={30} />
            </section>
          </div>
        )}

        {/* ── CUSTOMER GROUPS ── */}
        {activeSection === 'groups' && (
          <div className="space-y-6">
            <section>
              <SectionHeading title="Customer Group Performance" sub="Revenue breakdown by customer segment" />
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {/* Bar chart */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <p className="text-sm font-semibold text-slate-700 mb-4">Revenue by Customer Group</p>
                  <ResponsiveContainer width="100%" height={280}>
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
                {/* Pie chart */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                  <p className="text-sm font-semibold text-slate-700 mb-4">Customer Group Share</p>
                  <ResponsiveContainer width="100%" height={280}>
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
            </section>

            {data.customerGroupTrend.length > 0 && (
              <section>
                <SectionHeading title="Customer Group Trend Over Time" />
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
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
              </section>
            )}

            <section>
              <SectionHeading title="Customer Group Ranking" />
              <RankingTable title="All Customer Groups" data={data.customerGroups} />
            </section>

            {/* Document type breakdown */}
            <section>
              <SectionHeading title="Document Type Breakdown" sub="Invoice vs Credit Memo analysis" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.docTypes.map((d, i) => {
                  const isCredit = /credit/i.test(d.type)
                  return (
                    <div key={d.type} className={`bg-white rounded-xl border shadow-sm p-4 ${isCredit && (creditRate ?? 0) > 10 ? 'border-amber-200' : 'border-slate-200'}`}>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{d.type || '(unknown)'}</p>
                      <p className={`text-xl font-bold mt-1 ${isCredit ? 'text-red-600' : 'text-slate-800'}`}>{fmt(d.revenue)}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{d.count.toLocaleString()} txns · {d.share.toFixed(1)}% of gross</p>
                      <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(d.share, 100)}%`, background: COLORS[i % COLORS.length] }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          </div>
        )}

        {/* ── COMPARISON ── */}
        {activeSection === 'comparison' && (
          <div className="space-y-6">
            {data.waterfallData && data.waterfallData.length > 0 && (
              <section>
                <SectionHeading
                  title={`Revenue Bridge: ${data.waterfallLabel.prev} → ${data.waterfallLabel.curr}`}
                  sub="What drove the change between the two most recent years in the current filter"
                />
                <WaterfallChart data={data.waterfallData} />
              </section>
            )}
            <section>
              <SectionHeading title="Year vs Year" />
              <YearComparisonChart data={data.yearComparison} />
            </section>
            <section>
              <SectionHeading title="Quarter vs Quarter" />
              <QuarterComparisonChart data={data.quarterComparison} years={data.allYears} />
            </section>
            <section>
              <SectionHeading title="Month vs Month" />
              <MonthComparisonChart data={data.monthComparison} years={data.allYears} />
            </section>
          </div>
        )}

        {/* ── INSIGHTS ── */}
        {activeSection === 'insights' && (
          <section>
            <SectionHeading title="Business Insights" />
            <InsightPanel insights={data.insights} />
          </section>
        )}
      </main>
    </div>
  )
}

function SectionHeading({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function CustomerKpiCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
        <span className={`w-2 h-2 rounded-full ${accent.split(' ')[0]}`} />
      </div>
      <p className={`text-xl font-bold ${accent.split(' ').slice(1).join(' ')}`}>
        {value.toLocaleString()}
      </p>
    </div>
  )
}

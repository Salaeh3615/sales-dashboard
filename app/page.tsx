'use client'

/**
 * Main dashboard page — CLT bento-grid redesign.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  RefreshCw, Upload, Activity, TrendingUp, Users as UsersIcon,
  UserPlus, UserCheck, UserX, LayoutDashboard, Building2,
  User as UserIcon, Tag, ArrowLeftRight, Lightbulb, SlidersHorizontal, X,
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts'

import type { DashboardFilters, FilterOptions, Insight, KPISummary } from '@/types'
import type { WaterfallBar } from '@/lib/calculations/aggregations'
import { FilterPanel } from '@/components/filters/FilterPanel'
import { KPICards, CreditMemoBanner } from '@/components/dashboard/KPICards'
import { InsightPanel } from '@/components/dashboard/InsightCard'
import { RevenueChart } from '@/components/charts/RevenueChart'
import { BranchBarChart, BranchPieChart, BranchTrendChart } from '@/components/charts/BranchChart'
import { SalespersonBarChart, SalespersonPieChart } from '@/components/charts/SalespersonChart'
import { QuarterComparisonChart, MonthComparisonChart, YearComparisonChart } from '@/components/charts/ComparisonChart'
import { RankingTable } from '@/components/tables/RankingTable'
import { WaterfallChart } from '@/components/charts/WaterfallChart'
import { CalendarHeatmap } from '@/components/charts/CalendarHeatmap'
import { RunRateCard } from '@/components/charts/RunRateCard'
import type { DailyPoint, RunRateResult } from '@/lib/calculations/insights'
import { Glossary } from '@/components/charts/Glossary'
import { OVERVIEW_GLOSSARY } from '@/lib/glossary-items'

const DEFAULT_FILTERS: DashboardFilters = {
  years: [], quarters: [], months: [], branches: [],
  salespersons: [], documentTypes: [], customerGroups: [],
  revenueMetric: 'netAmount',
}

// CLT brand palette — emerald + gold as primary; supporting tones harmonize
const COLORS = [
  '#0a3d2a', // emerald 900 (primary)
  '#FFCC00', // gold 500 (accent)
  '#1c6c4c', // emerald 600
  '#d9a900', // gold 600
  '#4ba078', // emerald 400
  '#2d8660', // emerald 500
  '#ffd11a', // gold 400
  '#13543c', // emerald 700
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
  daily: DailyPoint[]
  runRate: RunRateResult | null
}

const SECTIONS = [
  { id: 'overview',    label: 'Overview',     icon: LayoutDashboard },
  { id: 'branch',      label: 'Branch',       icon: Building2 },
  { id: 'salesperson', label: 'Salesperson',  icon: UserIcon },
  { id: 'groups',      label: 'Cust. Groups', icon: Tag },
  { id: 'comparison',  label: 'Comparison',   icon: ArrowLeftRight },
  { id: 'insights',    label: 'Insights',     icon: Lightbulb },
] as const
type SectionId = typeof SECTIONS[number]['id']

export default function DashboardPage() {
  const [options, setOptions] = useState<FilterOptions | null>(null)
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<SectionId>('overview')
  const [filtersOpen, setFiltersOpen] = useState(false)

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
        <div className="text-center max-w-md bg-white rounded-2xl shadow-card p-8 border border-slate-200">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-navy-50 flex items-center justify-center mb-4">
            <Upload size={28} className="text-navy-700" />
          </div>
          <h1 className="text-xl font-bold text-navy-900">ยังไม่มีข้อมูล</h1>
          <p className="text-sm text-slate-500 mt-2">
            ฐานข้อมูลว่าง — ผู้ดูแลระบบต้องอัพโหลดไฟล์ข้อมูลก่อน
          </p>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 bg-navy-900 text-white text-sm font-medium rounded-xl hover:bg-navy-700 transition-colors shadow-card"
          >
            <Upload size={16} />
            ไปที่ Admin
          </Link>
        </div>
      </main>
    )
  }

  if (!options || !data) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="text-navy-700 animate-spin" size={32} />
          <p className="text-xs text-slate-500 uppercase tracking-widest">Loading dashboard</p>
        </div>
      </main>
    )
  }

  const invoices  = data.docTypes.find((d) => /invoice/i.test(d.type))
  const credits   = data.docTypes.find((d) => /credit/i.test(d.type))
  const creditRate = invoices && credits
    ? (Math.abs(credits.revenue) / Math.abs(invoices.revenue)) * 100
    : null

  return (
    <div className="flex flex-1">
      {/* Filter rail — only on very wide screens (≥1536px) so charts have room on laptops */}
      <div className="hidden 2xl:block p-4 shrink-0">
        <FilterPanel options={options} filters={filters} onChange={setFilters} />
      </div>

      <main className="flex-1 overflow-y-auto min-w-0 p-4 lg:p-5 2xl:p-6 space-y-5">
        {/* Page header */}
        <header className="flex items-center justify-between flex-wrap gap-2 animate-fade-in">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="relative inline-flex w-9 h-9 rounded-xl bg-gradient-to-br from-navy-900 via-navy-800 to-navy-950 text-gold-400 items-center justify-center shadow-luxe shrink-0">
              <LayoutDashboard size={16} strokeWidth={2.2} />
              <span className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10 pointer-events-none" />
            </span>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-navy-900 tracking-tight leading-tight">Dashboard Overview</h1>
              <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-[10px] font-semibold text-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live
                </span>
                <span>
                  <span className="font-semibold text-navy-900 font-num">{data.recordCount.toLocaleString()}</span>
                  {' / '}
                  <span className="text-slate-500 font-num">{data.totalRecords.toLocaleString()}</span>
                  {' รายการ'}
                </span>
                {loading && <RefreshCw className="inline animate-spin text-navy-700" size={11} />}
              </p>
            </div>
          </div>
          {/* Filters toggle — visible only when side rail is hidden */}
          <button
            onClick={() => setFiltersOpen(true)}
            className="2xl:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-navy-800 bg-white border border-slate-200 shadow-luxe hover:bg-navy-50 transition-colors"
          >
            <SlidersHorizontal size={13} strokeWidth={2.2} />
            Filters
          </button>
          {/* Section tabs */}
          <nav className="flex items-center gap-0.5 bg-white/80 backdrop-blur border border-slate-200 rounded-xl p-1 shadow-luxe overflow-x-auto max-w-full">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg whitespace-nowrap transition-all duration-200 ${
                  activeSection === id
                    ? 'bg-gradient-to-br from-navy-800 to-navy-950 text-gold-300 shadow-md'
                    : 'text-navy-700 hover:bg-navy-50'
                }`}
              >
                <Icon size={13} strokeWidth={activeSection === id ? 2.4 : 2} />
                {label}
              </button>
            ))}
          </nav>
        </header>

        {/* Glossary — help panel */}
        <Glossary items={OVERVIEW_GLOSSARY} />

        {/* Credit memo banner */}
        {creditRate !== null && creditRate > 10 && (
          <CreditMemoBanner rate={creditRate} />
        )}

        {/* ─── Bento Grid: KPIs ─── */}
        <section className="animate-slide-up">
          <SectionHeading title="Key Performance Indicators" icon={Activity} />
          <KPICards kpis={data.kpis} recordCount={data.recordCount} />

          {/* Customer lifecycle mini-cards */}
          <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <CustomerKpiCard
              label="Total Customers"
              value={data.kpis.totalCustomers}
              icon={UsersIcon}
              color="slate"
            />
            <CustomerKpiCard
              label="New"
              value={data.kpis.newCustomers}
              icon={UserPlus}
              color="emerald"
            />
            <CustomerKpiCard
              label="Returning"
              value={data.kpis.returningCustomers}
              icon={UserCheck}
              color="navy"
            />
            <CustomerKpiCard
              label="Lost"
              value={data.kpis.lostCustomers}
              icon={UserX}
              color="red"
            />
          </div>
        </section>

        {/* ── OVERVIEW ── */}
        {activeSection === 'overview' && (
          <section className="animate-fade-in space-y-6">
            {/* Run-rate + calendar heatmap — top row */}
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
              {data.runRate && (
                <div className="xl:col-span-2">
                  <RunRateCard data={data.runRate} />
                </div>
              )}
              <div className={data.runRate ? 'xl:col-span-3' : 'xl:col-span-5'}>
                <CalendarHeatmap data={data.daily} metricLabel="Revenue" />
              </div>
            </div>

            {/* At-a-glance Top-5 snapshots */}
            <SectionHeading
              title="At-a-Glance Leaders"
              sub="Top performers across the current selection"
              icon={Activity}
            />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <TopListCard
                title="Top Branches"
                icon={Building2}
                rows={data.branches.slice(0, 5)}
                onMore={() => setActiveSection('branch')}
              />
              <TopListCard
                title="Top Salespeople"
                icon={UserIcon}
                rows={data.salespeople.slice(0, 5)}
                onMore={() => setActiveSection('salesperson')}
              />
              <TopListCard
                title="Top Customer Groups"
                icon={Tag}
                rows={data.customerGroups.slice(0, 5)}
                onMore={() => setActiveSection('groups')}
              />
            </div>

            {/* Document-type compact strip */}
            {data.docTypes.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.docTypes.slice(0, 3).map((d, i) => {
                  const isCredit = /credit/i.test(d.type)
                  return (
                    <div
                      key={d.type}
                      className={`rounded-2xl p-4 shadow-card hover-lift border ${
                        isCredit && (creditRate ?? 0) > 10
                          ? 'bg-gold-50 border-gold-300'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{d.type || '(unknown)'}</p>
                      <p className={`text-2xl font-bold mt-1 font-num ${isCredit ? 'text-red-600' : 'text-navy-900'}`}>{fmt(d.revenue)}</p>
                      <p className="text-xs text-slate-400 mt-0.5 font-num">{d.count.toLocaleString()} txns · {d.share.toFixed(1)}% of gross</p>
                      <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(d.share, 100)}%`, background: COLORS[i % COLORS.length] }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <SectionHeading
              title="Revenue Trends"
              sub="Monthly, quarterly, and annual performance"
              icon={TrendingUp}
            />
            <Card>
              <RevenueChart monthly={data.monthly} quarterly={data.quarterly} yearly={data.yearly} />
            </Card>

            {/* Year-over-Year quick view */}
            {data.yearComparison.length > 1 && (
              <>
                <SectionHeading
                  title="Year-over-Year"
                  sub="Annual revenue trajectory"
                  icon={ArrowLeftRight}
                />
                <Card>
                  <YearComparisonChart data={data.yearComparison} />
                </Card>
              </>
            )}

            {/* Top insights teaser */}
            {data.insights.length > 0 && (
              <>
                <SectionHeading
                  title="Key Insights"
                  sub="Highlights surfaced from the data"
                  icon={Lightbulb}
                />
                <InsightPanel insights={data.insights.slice(0, 3)} />
              </>
            )}
          </section>
        )}

        {/* ── BRANCH ── */}
        {activeSection === 'branch' && (
          <div className="space-y-6 animate-fade-in">
            <section>
              <SectionHeading title="Branch Performance" icon={Building2} />
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <Card><BranchBarChart data={data.branches} /></Card>
                <Card><BranchPieChart data={data.branches} /></Card>
              </div>
            </section>
            <section>
              <SectionHeading title="Branch Revenue Over Time" />
              <Card><BranchTrendChart data={data.branchTrend} branches={data.topBranches} /></Card>
            </section>
            <section>
              <SectionHeading title="Branch Ranking" />
              <Card><RankingTable title="All Branches" data={data.branches} /></Card>
            </section>
          </div>
        )}

        {/* ── SALESPERSON ── */}
        {activeSection === 'salesperson' && (
          <div className="space-y-6 animate-fade-in">
            <section>
              <SectionHeading title="Salesperson Performance" icon={UserIcon} />
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <Card><SalespersonBarChart data={data.salespeople} topN={10} /></Card>
                <Card><SalespersonPieChart data={data.salespeople} topN={8} /></Card>
              </div>
            </section>
            <section>
              <SectionHeading title="Salesperson Ranking" />
              <Card><RankingTable title="All Salespeople" data={data.salespeople} topN={30} /></Card>
            </section>
          </div>
        )}

        {/* ── CUSTOMER GROUPS ── */}
        {activeSection === 'groups' && (
          <div className="space-y-6 animate-fade-in">
            <section>
              <SectionHeading
                title="Customer Group Performance"
                sub="Revenue breakdown by customer segment"
                icon={Tag}
              />
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <Card>
                  <p className="text-sm font-semibold text-navy-900 mb-4">Revenue by Customer Group</p>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data.customerGroups.slice(0, 12)} layout="vertical" margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" tickFormatter={fmtY} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} tickLine={false} axisLine={false} width={90} />
                      <Tooltip formatter={(v) => [fmtTooltip(v as number), 'Revenue']} contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(10,61,42,0.08)' }} />
                      <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                        {data.customerGroups.slice(0, 12).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
                <Card>
                  <p className="text-sm font-semibold text-navy-900 mb-4">Customer Group Share</p>
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
                      <Tooltip formatter={(v) => [fmtTooltip(v as number), 'Revenue']} contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(10,61,42,0.08)' }} />
                      <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: '#475569' }}>{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </Card>
              </div>
            </section>

            {data.customerGroupTrend.length > 0 && (
              <section>
                <SectionHeading title="Customer Group Trend Over Time" />
                <Card>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={data.customerGroupTrend} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis tickFormatter={fmtY} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={58} />
                      <Tooltip formatter={(v, name) => [fmtTooltip(v as number), name]} contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(10,61,42,0.08)' }} />
                      <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: '#475569' }}>{v}</span>} />
                      {data.topCustomerGroups.map((g, i) => (
                        <Line key={g} type="monotone" dataKey={g} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              </section>
            )}

            <section>
              <SectionHeading title="Customer Group Ranking" />
              <Card><RankingTable title="All Customer Groups" data={data.customerGroups} /></Card>
            </section>

            {/* Document type breakdown */}
            <section>
              <SectionHeading title="Document Type Breakdown" sub="Invoice vs Credit Memo analysis" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.docTypes.map((d, i) => {
                  const isCredit = /credit/i.test(d.type)
                  return (
                    <div
                      key={d.type}
                      className={`rounded-2xl p-4 shadow-card hover-lift border ${
                        isCredit && (creditRate ?? 0) > 10
                          ? 'bg-gold-50 border-gold-300'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{d.type || '(unknown)'}</p>
                      <p className={`text-2xl font-bold mt-1 font-num ${isCredit ? 'text-red-600' : 'text-navy-900'}`}>{fmt(d.revenue)}</p>
                      <p className="text-xs text-slate-400 mt-0.5 font-num">{d.count.toLocaleString()} txns · {d.share.toFixed(1)}% of gross</p>
                      <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(d.share, 100)}%`, background: COLORS[i % COLORS.length] }} />
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
          <div className="space-y-6 animate-fade-in">
            {data.waterfallData && data.waterfallData.length > 0 && (
              <section>
                <SectionHeading
                  title={`Revenue Bridge: ${data.waterfallLabel.prev} → ${data.waterfallLabel.curr}`}
                  sub="What drove the change between the two most recent years"
                  icon={ArrowLeftRight}
                />
                <Card><WaterfallChart data={data.waterfallData} /></Card>
              </section>
            )}
            <section>
              <SectionHeading title="Year vs Year" />
              <Card><YearComparisonChart data={data.yearComparison} /></Card>
            </section>
            <section>
              <SectionHeading title="Quarter vs Quarter" />
              <Card><QuarterComparisonChart data={data.quarterComparison} years={data.allYears} /></Card>
            </section>
            <section>
              <SectionHeading title="Month vs Month" />
              <Card><MonthComparisonChart data={data.monthComparison} years={data.allYears} /></Card>
            </section>
          </div>
        )}

        {/* ── INSIGHTS ── */}
        {activeSection === 'insights' && (
          <section className="animate-fade-in">
            <SectionHeading title="Business Insights" icon={Lightbulb} />
            <InsightPanel insights={data.insights} />
          </section>
        )}
      </main>

      {/* Mobile / laptop filter drawer — visible only when screen <1536px */}
      {filtersOpen && (
        <div className="2xl:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setFiltersOpen(false)}
          />
          <div className="relative ml-auto h-full w-[88vw] max-w-sm bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-slide-up">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={15} className="text-navy-800" />
                <h3 className="text-sm font-bold text-navy-900">Filters</h3>
              </div>
              <button
                onClick={() => setFiltersOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <FilterPanel options={options} filters={filters} onChange={setFilters} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Helper components ───────────────────────────────────────────────────────

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-card p-4 lg:p-5 hover-lift ${className}`}>
      {children}
    </div>
  )
}

function SectionHeading({
  title, sub, icon: Icon,
}: { title: string; sub?: string; icon?: React.ElementType }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      {Icon && (
        <div className="w-9 h-9 rounded-xl bg-navy-900 text-gold-500 flex items-center justify-center shrink-0 shadow-card">
          <Icon size={16} />
        </div>
      )}
      <div>
        <h2 className="text-base font-bold text-navy-900">{title}</h2>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

const COLOR_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  slate:   { bg: 'bg-slate-50',    text: 'text-slate-700',   dot: 'bg-slate-400' },
  emerald: { bg: 'bg-emerald-50',  text: 'text-emerald-700', dot: 'bg-emerald-500' },
  navy:    { bg: 'bg-navy-50',     text: 'text-navy-900',    dot: 'bg-navy-900' },
  red:     { bg: 'bg-red-50',      text: 'text-red-600',     dot: 'bg-red-500' },
}

function TopListCard({
  title, icon: Icon, rows, onMore,
}: {
  title: string
  icon: React.ElementType
  rows: { name: string; revenue: number; share: number; count: number }[]
  onMore?: () => void
}) {
  const max = rows.length ? Math.max(...rows.map((r) => r.revenue)) : 0
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-card p-4 hover-lift flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-navy-900 text-gold-400 flex items-center justify-center shrink-0">
            <Icon size={14} />
          </div>
          <p className="text-sm font-bold text-navy-900">{title}</p>
        </div>
        {onMore && (
          <button
            onClick={onMore}
            className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 hover:underline"
          >
            View all →
          </button>
        )}
      </div>
      <ul className="space-y-2.5 flex-1">
        {rows.length === 0 && (
          <li className="text-xs text-slate-400 italic">No data</li>
        )}
        {rows.map((r, i) => {
          const pct = max > 0 ? (r.revenue / max) * 100 : 0
          return (
            <li key={r.name + i} className="text-xs">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="inline-flex w-5 h-5 rounded-md bg-navy-50 text-navy-800 items-center justify-center text-[10px] font-bold shrink-0">
                    {i + 1}
                  </span>
                  <span className="font-medium text-navy-900 truncate" title={r.name}>{r.name || '(unknown)'}</span>
                </div>
                <span className="font-num font-semibold text-navy-900 shrink-0">{fmt(r.revenue)}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }}
                  />
                </div>
                <span className="text-[10px] font-num text-slate-500 w-10 text-right">{r.share.toFixed(1)}%</span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function CustomerKpiCard({
  label, value, icon: Icon, color,
}: {
  label: string
  value: number
  icon: React.ElementType
  color: 'slate' | 'emerald' | 'navy' | 'red'
}) {
  const c = COLOR_STYLES[color]
  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-card p-4 hover-lift">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
        <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center`}>
          <Icon size={14} className={c.text} />
        </div>
      </div>
      <p className={`text-2xl font-bold font-num ${c.text}`}>
        {value.toLocaleString()}
      </p>
    </div>
  )
}

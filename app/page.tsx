'use client'

/**
 * Main dashboard page.
 *
 * Fetches all data from server APIs (no client-side file parsing).  Viewers
 * just open this URL — admin uploads happen on /admin.
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { RefreshCw, Upload } from 'lucide-react'

import type { DashboardFilters, FilterOptions, Insight, KPISummary } from '@/types'
import { FilterPanel } from '@/components/filters/FilterPanel'
import { KPICards } from '@/components/dashboard/KPICards'
import { InsightPanel } from '@/components/dashboard/InsightCard'
import { RevenueChart } from '@/components/charts/RevenueChart'
import {
  BranchBarChart,
  BranchPieChart,
  BranchTrendChart,
} from '@/components/charts/BranchChart'
import {
  SalespersonBarChart,
  SalespersonPieChart,
} from '@/components/charts/SalespersonChart'
import {
  QuarterComparisonChart,
  MonthComparisonChart,
  YearComparisonChart,
} from '@/components/charts/ComparisonChart'
import { RankingTable } from '@/components/tables/RankingTable'

const DEFAULT_FILTERS: DashboardFilters = {
  years: [],
  quarters: [],
  months: [],
  branches: [],
  salespersons: [],
  documentTypes: [],
  customerGroups: [],
  revenueMetric: 'netAmount',
}

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
}

export default function DashboardPage() {
  const [options, setOptions] = useState<FilterOptions | null>(null)
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<
    'overview' | 'branch' | 'salesperson' | 'comparison' | 'insights'
  >('overview')

  // Load filter options once
  useEffect(() => {
    fetch('/api/options')
      .then((r) => r.json())
      .then(setOptions)
      .catch(() => setOptions(null))
  }, [])

  // Reload dashboard data whenever filters change
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

  // ── Empty state ─────────────────────────────────────────────────────────────
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

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar */}
      <div className="hidden lg:block p-4 shrink-0">
        <FilterPanel options={options} filters={filters} onChange={setFilters} />
      </div>

      <main className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-8 min-w-0">
        {/* Header row */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs text-slate-500">
            Showing{' '}
            <span className="font-semibold text-slate-700">
              {data.recordCount.toLocaleString()}
            </span>{' '}
            of{' '}
            <span className="font-semibold text-slate-700">
              {data.totalRecords.toLocaleString()}
            </span>{' '}
            records
            {loading && <RefreshCw className="inline ml-2 animate-spin" size={11} />}
          </p>
          <nav className="flex gap-1 overflow-x-auto">
            {(['overview', 'branch', 'salesperson', 'comparison', 'insights'] as const).map(
              (s) => (
                <button
                  key={s}
                  onClick={() => setActiveSection(s)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize whitespace-nowrap transition-colors ${
                    activeSection === s
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {s}
                </button>
              ),
            )}
          </nav>
        </div>

        {/* KPIs */}
        <section>
          <SectionHeading title="Key Performance Indicators" />
          <KPICards kpis={data.kpis} recordCount={data.recordCount} />
          {/* Customer movement KPIs */}
          <div className="mt-3 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <CustomerKpiCard label="Total Customers" value={data.kpis.totalCustomers} accent="bg-slate-50 text-slate-600" />
            <CustomerKpiCard label="New Customers" value={data.kpis.newCustomers} accent="bg-emerald-50 text-emerald-600" />
            <CustomerKpiCard label="Returning" value={data.kpis.returningCustomers} accent="bg-blue-50 text-blue-600" />
            <CustomerKpiCard label="Lost Customers" value={data.kpis.lostCustomers} accent="bg-red-50 text-red-500" />
          </div>
        </section>

        {/* Section content */}
        {activeSection === 'overview' && (
          <section>
            <SectionHeading title="Revenue Trends" sub="Monthly, quarterly, and annual" />
            <RevenueChart monthly={data.monthly} quarterly={data.quarterly} yearly={data.yearly} />
          </section>
        )}

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

        {activeSection === 'comparison' && (
          <div className="space-y-6">
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

function CustomerKpiCard({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent: string
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
        <span className={`w-2 h-2 rounded-full ${accent.split(' ')[0].replace('bg-', 'bg-')}`} />
      </div>
      <p className={`text-xl font-bold ${accent.split(' ').slice(1).join(' ')}`}>
        {value.toLocaleString()}
      </p>
    </div>
  )
}

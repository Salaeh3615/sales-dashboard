'use client'

/**
 * /customers
 *
 * Customer movement analysis: New / Existing / Returning / Lost
 * with:
 *   - exportable named lists per status
 *   - prior-year revenue shown for lost customers
 *   - salesperson revenue replacement metrics (did they replace lost revenue?)
 *   - per-branch and per-salesperson movement breakdown
 */

import { useEffect, useState } from 'react'
import {
  Users, UserPlus, UserMinus, Repeat, RefreshCw,
  Building2, ChevronRight, Download, Sparkles, Target,
} from 'lucide-react'
import { RFMMatrix } from '@/components/charts/RFMMatrix'
import { SalespersonBubbleChart } from '@/components/charts/SalespersonBubbleChart'
import type { RFMCustomer, RFMSegment, SalespersonBubble as SalespersonBubbleType } from '@/lib/calculations/insights'
import { Glossary } from '@/components/charts/Glossary'
import { CUSTOMERS_GLOSSARY } from '@/lib/glossary-items'

// ─── Types ────────────────────────────────────────────────────────────────────

type Profile = {
  key: string
  displayName: string
  customerNo?: string
  customerCode?: string
  customerGroupName?: string
  yearsActive: number[]
  lastActiveYear: number
  branches: string[]
  salespersons: string[]
  totalRevenue: number
  revenueThisYear?: number
  revenuePriorYear?: number
}

type Movement = {
  name: string
  newCustomers: number
  existingCustomers: number
  lostCustomers: number
  returningCustomers: number
  newRevenue: number
  retainedRevenue: number
  lostRevenue: number
  replacementRatio: number
  newCustomerList: Profile[]
  lostCustomerList: Profile[]
}

type SalespersonPerf = {
  name: string
  totalRevenue: number
  retainedRevenue: number
  lostRevenue: number
  newRevenue: number
  returningRevenue: number
  newCustomers: number
  existingCustomers: number
  lostCustomers: number
  returningCustomers: number
  replacementRatio: number
  netRevenueChange: number
}

type CustomersResponse = {
  targetYear: number
  allYears: number[]
  counts: {
    new: number
    existing: number
    returning: number
    lost: number
    totalActive: number
    totalCustomers: number
  }
  revenueMetrics: {
    lostRevenuePriorYear: number
    newRevenueThisYear: number
    replacementRatio: number | null
  }
  namedLists: {
    new: Profile[]
    existing: Profile[]
    returning: Profile[]
    lost: Profile[]
  }
  branchMovement: Movement[]
  salespersonMovement: Movement[]
  salespersonPerformance: SalespersonPerf[]
  rfm?: {
    customers: RFMCustomer[]
    segmentSummary: { segment: RFMSegment; count: number; revenue: number }[]
  }
  salespersonBubble?: SalespersonBubbleType[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `฿${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `฿${(n / 1_000).toFixed(1)}K`
  return `฿${n.toLocaleString()}`
}

function exportCustomersCsv(profiles: Profile[], status: string, targetYear: number) {
  const cols = [
    'status', 'customerNo', 'customerCode', 'displayName', 'customerGroup',
    'revenueThisYear', 'revenuePriorYear', 'totalRevenue',
    'lastActiveYear', 'yearsActive', 'branches', 'salespersons',
  ]
  const header = cols.join(',')
  const rows = profiles.map((p) => {
    const vals = [
      status,
      p.customerNo ?? '',
      p.customerCode ?? '',
      `"${(p.displayName ?? '').replace(/"/g, '""')}"`,
      `"${(p.customerGroupName ?? '').replace(/"/g, '""')}"`,
      p.revenueThisYear ?? '',
      p.revenuePriorYear ?? '',
      p.totalRevenue,
      p.lastActiveYear,
      `"${p.yearsActive.join(', ')}"`,
      `"${p.branches.join(', ')}"`,
      `"${p.salespersons.join(', ')}"`,
    ]
    return vals.join(',')
  })
  const csv = [header, ...rows].join('\n')
  const bom = '\uFEFF'
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `customers-${status}-${targetYear}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type StatusTab = 'new' | 'existing' | 'returning' | 'lost'

export default function CustomersPage() {
  const [data, setData] = useState<CustomersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [targetYear, setTargetYear] = useState<number | null>(null)
  const [activeStatus, setActiveStatus] = useState<StatusTab>('new')
  const [groupBy, setGroupBy] = useState<'branch' | 'salesperson'>('branch')
  const [activeTab, setActiveTab] = useState<'movement' | 'salesperson' | 'rfm' | 'behaviour'>('movement')

  useEffect(() => {
    setLoading(true)
    fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetYear }),
    })
      .then((r) => r.json())
      .then((d: CustomersResponse) => {
        setData(d)
        if (targetYear === null) setTargetYear(d.targetYear)
      })
      .finally(() => setLoading(false))
  }, [targetYear])

  if (!data) {
    return (
      <main className="flex-1 flex items-center justify-center bg-[#F8FAFC]">
        <RefreshCw className="text-navy-400 animate-spin" size={28} />
      </main>
    )
  }

  if (data.counts.totalCustomers === 0) {
    return (
      <main className="flex-1 flex items-center justify-center p-8 bg-[#F8FAFC]">
        <div className="text-center">
          <Users size={48} className="text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 text-sm">No customer data yet. Upload files via /admin first.</p>
        </div>
      </main>
    )
  }

  const namedList = data.namedLists[activeStatus] ?? []
  const movements = groupBy === 'branch' ? data.branchMovement : data.salespersonMovement
  const yr = targetYear ?? data.targetYear

  return (
    <main className="flex-1 bg-[#F8FAFC] p-4 lg:p-5 space-y-5 overflow-y-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex w-10 h-10 rounded-xl bg-gradient-to-br from-navy-900 to-navy-700 text-gold-400 items-center justify-center shadow-card">
            <Users size={18} />
          </span>
          <div>
            <h1 className="text-lg font-bold text-navy-900">Customer Movement</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              New / Existing / Lost / Returning for {data.targetYear}
              {loading && <RefreshCw className="inline ml-2 animate-spin" size={11} />}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-semibold text-navy-700 uppercase tracking-wider">Year</label>
          <select
            value={targetYear ?? data.targetYear}
            onChange={(e) => setTargetYear(parseInt(e.target.value))}
            className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium text-navy-900 focus:outline-none focus:ring-2 focus:ring-gold-400"
          >
            {data.allYears.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Glossary — help panel */}
      <Glossary items={CUSTOMERS_GLOSSARY} />

      {/* Revenue replacement banner */}
      {data.revenueMetrics.lostRevenuePriorYear > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-card p-4 flex flex-wrap gap-6 items-center hover-lift">
          <div>
            <p className="text-[10px] font-semibold text-navy-700 uppercase tracking-wider">Lost Customer Revenue (prior year)</p>
            <p className="text-lg font-bold text-red-600 font-num">{fmtMoney(data.revenueMetrics.lostRevenuePriorYear)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-navy-700 uppercase tracking-wider">New Customer Revenue (this year)</p>
            <p className="text-lg font-bold text-emerald-600 font-num">{fmtMoney(data.revenueMetrics.newRevenueThisYear)}</p>
          </div>
          {data.revenueMetrics.replacementRatio !== null && (
            <div>
              <p className="text-[10px] font-semibold text-navy-700 uppercase tracking-wider">Revenue Replacement Ratio</p>
              <p className={`text-lg font-bold font-num ${data.revenueMetrics.replacementRatio >= 1 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {(data.revenueMetrics.replacementRatio * 100).toFixed(0)}%
                {data.revenueMetrics.replacementRatio >= 1
                  ? ' ✓ Replaced'
                  : ' ↓ Under-replaced'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Status KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusCard label="New" icon={UserPlus} value={data.counts.new} accent="emerald"
          active={activeStatus === 'new'} onClick={() => setActiveStatus('new')} />
        <StatusCard label="Existing" icon={Users} value={data.counts.existing} accent="navy"
          active={activeStatus === 'existing'} onClick={() => setActiveStatus('existing')} />
        <StatusCard label="Returning" icon={Repeat} value={data.counts.returning} accent="gold"
          active={activeStatus === 'returning'} onClick={() => setActiveStatus('returning')}
          subtitle="subset of Existing" />
        <StatusCard label="Lost" icon={UserMinus} value={data.counts.lost} accent="red"
          active={activeStatus === 'lost'} onClick={() => setActiveStatus('lost')} />
      </div>

      {/* Two-column: named list + movement table */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Named customer list with export */}
        <section className="bg-white rounded-3xl border border-slate-200 shadow-card overflow-hidden hover-lift">
          <div className="px-5 py-4 bg-gradient-to-r from-navy-900 to-navy-700 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white capitalize flex items-center gap-2">
                <span className="inline-block w-1 h-4 bg-gold-500 rounded-full" />
                {activeStatus} Customers ({namedList.length})
              </h2>
              <p className="text-xs text-slate-300 mt-0.5 pl-3">
                {activeStatus === 'lost'
                  ? 'Sorted by prior-year revenue'
                  : 'Sorted by this-year revenue'}
              </p>
            </div>
            <button
              onClick={() => exportCustomersCsv(namedList, activeStatus, yr)}
              disabled={namedList.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gold-500 text-navy-900 rounded-lg hover:bg-gold-400 disabled:opacity-40 transition-all"
            >
              <Download size={12} />
              Export CSV
            </button>
          </div>
          <div className="overflow-y-auto max-h-[600px]">
            {namedList.length === 0 ? (
              <p className="p-6 text-sm text-slate-400 text-center">No customers in this category.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-100 text-xs text-navy-700">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">Customer</th>
                    <th className="px-4 py-2 text-right font-semibold">
                      {activeStatus === 'lost' ? 'Prior Rev' : 'Revenue'}
                    </th>
                    <th className="px-4 py-2 text-left font-semibold">Years</th>
                  </tr>
                </thead>
                <tbody>
                  {namedList.map((c) => (
                    <tr key={c.key} className="border-b border-slate-50 hover:bg-navy-50/40 transition-colors">
                      <td className="px-4 py-2 text-xs">
                        <p className="font-medium text-navy-900 truncate max-w-[200px]">{c.displayName}</p>
                        <p className="text-slate-400 text-[10px]">
                          {c.customerNo ?? c.customerCode ?? ''}{c.customerGroupName && ` · ${c.customerGroupName}`}
                        </p>
                      </td>
                      <td className="px-4 py-2 text-right text-xs font-semibold text-navy-900 tabular-nums font-num">
                        {activeStatus === 'lost'
                          ? fmtMoney(c.revenuePriorYear ?? 0)
                          : fmtMoney(c.revenueThisYear ?? 0)}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-500 tabular-nums font-num">
                        {c.yearsActive.join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Movement by branch / salesperson */}
        <section className="bg-white rounded-3xl border border-slate-200 shadow-card overflow-hidden hover-lift">
          <div className="px-5 py-4 bg-gradient-to-r from-navy-900 to-navy-700 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="inline-block w-1 h-4 bg-gold-500 rounded-full" />
              Movement by {groupBy === 'branch' ? 'Branch' : 'Salesperson'}
            </h2>
            <div className="flex gap-1 text-xs bg-navy-950/40 rounded-full p-0.5">
              {(['branch', 'salesperson'] as const).map((g) => (
                <button key={g} onClick={() => setGroupBy(g)}
                  className={`px-2.5 py-1 rounded-full font-medium capitalize transition-all ${
                    groupBy === g ? 'bg-gold-500 text-navy-900' : 'text-slate-300 hover:text-white'
                  }`}>
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-y-auto max-h-[600px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-100 text-xs text-navy-700">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Name</th>
                  <th className="px-3 py-2 text-right font-semibold text-emerald-600">New</th>
                  <th className="px-3 py-2 text-right font-semibold text-navy-700">Exist</th>
                  <th className="px-3 py-2 text-right font-semibold text-gold-700">Ret</th>
                  <th className="px-3 py-2 text-right font-semibold text-red-500">Lost</th>
                  <th className="px-3 py-2 text-right font-semibold text-navy-700">Replace</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.name} className="border-b border-slate-50 hover:bg-navy-50/40 transition-colors">
                    <td className="px-4 py-2 text-xs font-medium text-navy-900 flex items-center gap-2">
                      <Building2 size={12} className="text-navy-400" />
                      {m.name}
                    </td>
                    <td className="px-3 py-2 text-right text-xs font-semibold text-emerald-600 tabular-nums font-num">{m.newCustomers}</td>
                    <td className="px-3 py-2 text-right text-xs text-slate-600 tabular-nums font-num">{m.existingCustomers}</td>
                    <td className="px-3 py-2 text-right text-xs text-gold-700 tabular-nums font-num">{m.returningCustomers}</td>
                    <td className="px-3 py-2 text-right text-xs font-semibold text-red-500 tabular-nums font-num">{m.lostCustomers}</td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums font-num">
                      <span className={m.replacementRatio >= 1 ? 'text-emerald-600' : 'text-amber-600'}>
                        {m.lostCustomers > 0 ? `${(m.replacementRatio * 100).toFixed(0)}%` : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* Bottom tab: Drill-down, Salesperson Performance, RFM, Behaviour */}
      <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
        {([
          { id: 'movement',    label: 'Drill-Down',             icon: ChevronRight },
          { id: 'salesperson', label: 'Salesperson Performance', icon: Users },
          { id: 'rfm',         label: 'RFM Segmentation',        icon: Sparkles },
          { id: 'behaviour',   label: 'Salesperson Behaviour',   icon: Target },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === id
                ? 'border-gold-500 text-navy-900'
                : 'border-transparent text-slate-500 hover:text-navy-900'
            }`}>
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'movement' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {movements.slice(0, 6).map((m) => (
            <div key={m.name} className="bg-white rounded-3xl border border-slate-200 shadow-card p-4 hover-lift">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-navy-900">{m.name}</p>
                <span className="text-xs text-slate-500 font-num">
                  +{m.newCustomers} new · −{m.lostCustomers} lost
                </span>
              </div>
              {(m.newRevenue > 0 || m.lostRevenue > 0) && (
                <div className="mb-3 text-xs text-slate-500 space-y-1 font-num">
                  <div className="flex justify-between">
                    <span className="text-red-500">Lost rev: {fmtMoney(m.lostRevenue)}</span>
                    <span className="text-emerald-600">New rev: {fmtMoney(m.newRevenue)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-red-100 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${Math.min(100, m.replacementRatio * 100)}%` }}
                    />
                  </div>
                </div>
              )}
              {m.newCustomerList.length > 0 && (
                <div className="mb-2">
                  <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-1">Top new</p>
                  <ul className="space-y-0.5">
                    {m.newCustomerList.slice(0, 5).map((c) => (
                      <li key={c.key} className="text-xs text-slate-600 flex items-center gap-1 truncate">
                        <ChevronRight size={10} className="text-emerald-500 shrink-0" />
                        <span className="truncate">{c.displayName}</span>
                        <span className="ml-auto text-slate-400 tabular-nums shrink-0 font-num">
                          {fmtMoney(c.revenueThisYear ?? 0)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {m.lostCustomerList.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wider mb-1">Top lost</p>
                  <ul className="space-y-0.5">
                    {m.lostCustomerList.slice(0, 5).map((c) => (
                      <li key={c.key} className="text-xs text-slate-600 flex items-center gap-1 truncate">
                        <ChevronRight size={10} className="text-red-400 shrink-0" />
                        <span className="truncate">{c.displayName}</span>
                        <span className="ml-auto text-slate-400 tabular-nums shrink-0 font-num">
                          {fmtMoney(c.revenuePriorYear ?? 0)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'salesperson' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-card overflow-hidden hover-lift">
          <div className="px-5 py-4 bg-gradient-to-r from-navy-900 to-navy-700">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="inline-block w-1 h-4 bg-gold-500 rounded-full" />
              Salesperson Revenue Replacement Analysis
            </h2>
            <p className="text-xs text-slate-300 mt-0.5 pl-3">
              Did the salesperson replace lost revenue with new accounts?
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-navy-700">Salesperson</th>
                  <th className="px-3 py-2 text-right font-semibold text-navy-700">Total Rev</th>
                  <th className="px-3 py-2 text-right font-semibold text-navy-700">Retained</th>
                  <th className="px-3 py-2 text-right font-semibold text-red-500">Lost Rev</th>
                  <th className="px-3 py-2 text-right font-semibold text-emerald-600">New Rev</th>
                  <th className="px-3 py-2 text-right font-semibold text-navy-700">Net Δ</th>
                  <th className="px-3 py-2 text-right font-semibold text-navy-700">Replace%</th>
                </tr>
              </thead>
              <tbody>
                {data.salespersonPerformance.map((s) => (
                  <tr key={s.name} className="border-b border-slate-50 hover:bg-navy-50/40 transition-colors">
                    <td className="px-4 py-2 font-medium text-navy-900 max-w-[160px] truncate">{s.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-navy-900 font-num">{fmtMoney(s.totalRevenue)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-navy-700 font-num">{fmtMoney(s.retainedRevenue)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-red-500 font-num">{fmtMoney(s.lostRevenue)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-600 font-num">{fmtMoney(s.newRevenue)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums font-semibold font-num ${s.netRevenueChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {s.netRevenueChange >= 0 ? '+' : ''}{fmtMoney(s.netRevenueChange)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-num">
                      {s.lostRevenue > 0 ? (
                        <span className={`font-semibold ${s.replacementRatio >= 1 ? 'text-emerald-600' : s.replacementRatio >= 0.7 ? 'text-amber-600' : 'text-red-500'}`}>
                          {(s.replacementRatio * 100).toFixed(0)}%
                          {s.replacementRatio >= 1 && ' ✓'}
                        </span>
                      ) : <span className="text-slate-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'rfm' && (
        <RFMMatrix
          customers={data.rfm?.customers ?? []}
          summary={data.rfm?.segmentSummary ?? []}
        />
      )}

      {activeTab === 'behaviour' && (
        <SalespersonBubbleChart data={data.salespersonBubble ?? []} />
      )}
    </main>
  )
}

// ─── Status card ─────────────────────────────────────────────────────────────

function StatusCard({
  label, value, icon: Icon, accent, active, onClick, subtitle,
}: {
  label: string; value: number; icon: React.ElementType
  accent: 'emerald' | 'navy' | 'gold' | 'red'
  active: boolean; onClick: () => void; subtitle?: string
}) {
  const colors: Record<string, { bg: string; text: string; border: string; icon: string; ring: string; strip: string }> = {
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: 'text-emerald-600', ring: 'ring-emerald-300', strip: 'bg-emerald-500' },
    navy:    { bg: 'bg-navy-50',    text: 'text-navy-900',    border: 'border-navy-200',    icon: 'text-navy-900',    ring: 'ring-navy-400',    strip: 'bg-navy-700' },
    gold:    { bg: 'bg-gold-50',    text: 'text-gold-800',    border: 'border-gold-200',    icon: 'text-gold-700',    ring: 'ring-gold-400',    strip: 'bg-gold-500' },
    red:     { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     icon: 'text-red-500',     ring: 'ring-red-300',     strip: 'bg-red-500' },
  }
  const c = colors[accent]
  return (
    <button onClick={onClick}
      className={`relative text-left bg-white rounded-3xl border shadow-card p-4 transition-all hover-lift overflow-hidden ${
        active ? `${c.border} ring-2 ring-offset-1 ${c.ring}` : 'border-slate-200'
      }`}>
      <span className={`absolute left-0 top-3 bottom-3 w-1 rounded-full ${c.strip}`} />
      <div className="flex items-center justify-between mb-2 pl-1">
        <p className="text-[10px] font-semibold text-navy-700 uppercase tracking-wider">{label}</p>
        <span className={`p-1.5 rounded-lg ${c.bg}`}><Icon size={14} className={c.icon} /></span>
      </div>
      <p className={`text-2xl font-bold font-num pl-1 ${c.text}`}>{value.toLocaleString()}</p>
      {subtitle && <p className="text-[10px] text-slate-400 mt-1 pl-1">{subtitle}</p>}
    </button>
  )
}

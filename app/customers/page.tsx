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
  Building2, ChevronRight, Download, TrendingUp, TrendingDown,
} from 'lucide-react'

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
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `฿${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `฿${(n / 1_000).toFixed(1)}K`
  return `฿${n.toLocaleString()}`
}

function exportCustomersCsv(
  profiles: Profile[],
  status: string,
  targetYear: number,
) {
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
  const bom = '\uFEFF'  // UTF-8 BOM for Excel
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
  const [activeTab, setActiveTab] = useState<'movement' | 'salesperson'>('movement')

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
      <main className="flex-1 flex items-center justify-center">
        <RefreshCw className="text-slate-400 animate-spin" size={28} />
      </main>
    )
  }

  if (data.counts.totalCustomers === 0) {
    return (
      <main className="flex-1 flex items-center justify-center p-8">
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
    <main className="flex-1 p-4 lg:p-6 space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Customer Movement</h1>
          <p className="text-sm text-slate-500 mt-1">
            New / Existing / Lost / Returning for {data.targetYear}
            {loading && <RefreshCw className="inline ml-2 animate-spin" size={11} />}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-500">Year</label>
          <select
            value={targetYear ?? data.targetYear}
            onChange={(e) => setTargetYear(parseInt(e.target.value))}
            className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700"
          >
            {data.allYears.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Revenue replacement banner */}
      {data.revenueMetrics.lostRevenuePriorYear > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-wrap gap-6 items-center">
          <div>
            <p className="text-xs text-slate-500 font-medium">Lost Customer Revenue (prior year)</p>
            <p className="text-lg font-bold text-red-600">{fmtMoney(data.revenueMetrics.lostRevenuePriorYear)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">New Customer Revenue (this year)</p>
            <p className="text-lg font-bold text-emerald-600">{fmtMoney(data.revenueMetrics.newRevenueThisYear)}</p>
          </div>
          {data.revenueMetrics.replacementRatio !== null && (
            <div>
              <p className="text-xs text-slate-500 font-medium">Revenue Replacement Ratio</p>
              <p className={`text-lg font-bold ${data.revenueMetrics.replacementRatio >= 1 ? 'text-emerald-600' : 'text-amber-600'}`}>
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
        <StatusCard label="Existing" icon={Users} value={data.counts.existing} accent="blue"
          active={activeStatus === 'existing'} onClick={() => setActiveStatus('existing')} />
        <StatusCard label="Returning" icon={Repeat} value={data.counts.returning} accent="violet"
          active={activeStatus === 'returning'} onClick={() => setActiveStatus('returning')}
          subtitle="subset of Existing" />
        <StatusCard label="Lost" icon={UserMinus} value={data.counts.lost} accent="red"
          active={activeStatus === 'lost'} onClick={() => setActiveStatus('lost')} />
      </div>

      {/* Two-column: named list + movement table */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Named customer list with export */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-800 capitalize">
                {activeStatus} Customers ({namedList.length})
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeStatus === 'lost'
                  ? 'Sorted by prior-year revenue'
                  : 'Sorted by this-year revenue'}
              </p>
            </div>
            <button
              onClick={() => exportCustomersCsv(namedList, activeStatus, yr)}
              disabled={namedList.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg hover:border-blue-400 hover:text-blue-600 disabled:opacity-40 transition-colors"
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
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-100 text-xs text-slate-500">
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
                    <tr key={c.key} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-2 text-xs">
                        <p className="font-medium text-slate-800 truncate max-w-[200px]">{c.displayName}</p>
                        <p className="text-slate-400 text-[10px]">
                          {c.customerNo ?? c.customerCode ?? ''}{c.customerGroupName && ` · ${c.customerGroupName}`}
                        </p>
                      </td>
                      <td className="px-4 py-2 text-right text-xs font-semibold text-slate-800 tabular-nums">
                        {activeStatus === 'lost'
                          ? fmtMoney(c.revenuePriorYear ?? 0)
                          : fmtMoney(c.revenueThisYear ?? 0)}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-500 tabular-nums">
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
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">
              Movement by {groupBy === 'branch' ? 'Branch' : 'Salesperson'}
            </h2>
            <div className="flex gap-1 text-xs">
              {(['branch', 'salesperson'] as const).map((g) => (
                <button key={g} onClick={() => setGroupBy(g)}
                  className={`px-2.5 py-1 rounded-full font-medium capitalize ${groupBy === g ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {g}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-y-auto max-h-[600px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-100 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Name</th>
                  <th className="px-3 py-2 text-right font-semibold text-emerald-600">New</th>
                  <th className="px-3 py-2 text-right font-semibold text-blue-600">Exist</th>
                  <th className="px-3 py-2 text-right font-semibold text-violet-600">Ret</th>
                  <th className="px-3 py-2 text-right font-semibold text-red-500">Lost</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-500">Replace</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.name} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-2 text-xs font-medium text-slate-800 flex items-center gap-2">
                      <Building2 size={12} className="text-slate-300" />
                      {m.name}
                    </td>
                    <td className="px-3 py-2 text-right text-xs font-semibold text-emerald-600 tabular-nums">{m.newCustomers}</td>
                    <td className="px-3 py-2 text-right text-xs text-slate-600 tabular-nums">{m.existingCustomers}</td>
                    <td className="px-3 py-2 text-right text-xs text-violet-600 tabular-nums">{m.returningCustomers}</td>
                    <td className="px-3 py-2 text-right text-xs font-semibold text-red-500 tabular-nums">{m.lostCustomers}</td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums">
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

      {/* Bottom tab: Drill-down or Salesperson Performance */}
      <div className="flex gap-2 border-b border-slate-200">
        {(['movement', 'salesperson'] as const).map((t) => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t === 'movement' ? 'Drill-Down' : 'Salesperson Performance'}
          </button>
        ))}
      </div>

      {activeTab === 'movement' ? (
        /* Per-entity drill-down */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {movements.slice(0, 6).map((m) => (
            <div key={m.name} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-slate-800">{m.name}</p>
                <span className="text-xs text-slate-500">
                  +{m.newCustomers} new · −{m.lostCustomers} lost
                </span>
              </div>
              {/* Revenue replacement mini-bar */}
              {(m.newRevenue > 0 || m.lostRevenue > 0) && (
                <div className="mb-3 text-xs text-slate-500 space-y-1">
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
                  <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide mb-1">Top new</p>
                  <ul className="space-y-0.5">
                    {m.newCustomerList.slice(0, 5).map((c) => (
                      <li key={c.key} className="text-xs text-slate-600 flex items-center gap-1 truncate">
                        <ChevronRight size={10} className="text-slate-300 shrink-0" />
                        <span className="truncate">{c.displayName}</span>
                        <span className="ml-auto text-slate-400 tabular-nums shrink-0">
                          {fmtMoney(c.revenueThisYear ?? 0)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {m.lostCustomerList.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wide mb-1">Top lost</p>
                  <ul className="space-y-0.5">
                    {m.lostCustomerList.slice(0, 5).map((c) => (
                      <li key={c.key} className="text-xs text-slate-600 flex items-center gap-1 truncate">
                        <ChevronRight size={10} className="text-slate-300 shrink-0" />
                        <span className="truncate">{c.displayName}</span>
                        <span className="ml-auto text-slate-400 tabular-nums shrink-0">
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
      ) : (
        /* Salesperson performance table */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-800">Salesperson Revenue Replacement Analysis</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Did the salesperson replace lost revenue with new accounts?
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-slate-500">Salesperson</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-500">Total Rev</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-500">Retained</th>
                  <th className="px-3 py-2 text-right font-semibold text-red-500">Lost Rev</th>
                  <th className="px-3 py-2 text-right font-semibold text-emerald-600">New Rev</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-500">Net Δ</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-500">Replace%</th>
                </tr>
              </thead>
              <tbody>
                {data.salespersonPerformance.map((s) => (
                  <tr key={s.name} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium text-slate-800 max-w-[160px] truncate">{s.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{fmtMoney(s.totalRevenue)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-blue-600">{fmtMoney(s.retainedRevenue)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-red-500">{fmtMoney(s.lostRevenue)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-600">{fmtMoney(s.newRevenue)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums font-semibold ${s.netRevenueChange >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {s.netRevenueChange >= 0 ? '+' : ''}{fmtMoney(s.netRevenueChange)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
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
    </main>
  )
}

// ─── Status card ─────────────────────────────────────────────────────────────

function StatusCard({
  label, value, icon: Icon, accent, active, onClick, subtitle,
}: {
  label: string; value: number; icon: React.ElementType
  accent: 'emerald' | 'blue' | 'violet' | 'red'
  active: boolean; onClick: () => void; subtitle?: string
}) {
  const colors: Record<string, { bg: string; text: string; border: string; icon: string }> = {
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: 'text-emerald-600' },
    blue:    { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    icon: 'text-blue-600' },
    violet:  { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200',  icon: 'text-violet-600' },
    red:     { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     icon: 'text-red-500' },
  }
  const c = colors[accent]
  return (
    <button onClick={onClick}
      className={`text-left bg-white rounded-xl border shadow-sm p-4 transition-all hover:shadow-md ${active ? `${c.border} ring-2 ring-offset-1` : 'border-slate-200'}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</p>
        <span className={`p-1.5 rounded-lg ${c.bg}`}><Icon size={14} className={c.icon} /></span>
      </div>
      <p className={`text-2xl font-bold ${c.text}`}>{value.toLocaleString()}</p>
      {subtitle && <p className="text-[10px] text-slate-400 mt-1">{subtitle}</p>}
    </button>
  )
}

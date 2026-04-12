'use client'

/**
 * /customer-lookup
 *
 * Search for a specific customer by number, code, or name.
 * Shows full profile: revenue by year, branch/salesperson history,
 * and recent transactions.
 */

import { useEffect, useRef, useState } from 'react'
import { Search, RefreshCw, User, TrendingUp, Building2, UserCheck } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

type Transaction = {
  postingDate: string
  year: number
  documentNo?: string
  documentType?: string
  branchCode: string
  salespersonName: string
  description?: string
  quantity?: number
  netAmount: number
  grossAmount?: number
}

type CustomerResult = {
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
  revenueByYear: Record<string, number>
  recentTransactions: Transaction[]
}

function fmtMoney(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `฿${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `฿${(n / 1_000).toFixed(1)}K`
  return `฿${n.toLocaleString()}`
}

export default function CustomerLookupPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CustomerResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [selected, setSelected] = useState<CustomerResult | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const search = (q: string) => {
    if (q.trim().length < 2) {
      setResults([])
      setSearched(false)
      return
    }
    setLoading(true)
    fetch(`/api/customers/lookup?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => {
        setResults(d.results ?? [])
        setSearched(true)
        if ((d.results ?? []).length === 1) setSelected(d.results[0])
        else setSelected(null)
      })
      .finally(() => setLoading(false))
  }

  const handleInput = (val: string) => {
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 350)
  }

  const revenueChartData = selected
    ? Object.entries(selected.revenueByYear)
        .sort(([a], [b]) => parseInt(a) - parseInt(b))
        .map(([year, revenue]) => ({ year, revenue }))
    : []

  return (
    <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Customer Lookup</h1>
        <p className="text-sm text-slate-500 mt-1">
          Search by customer number, code, or name
        </p>
      </div>

      {/* Search box */}
      <div className="relative max-w-lg mb-6">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        {loading && (
          <RefreshCw size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
        )}
        <input
          type="text"
          autoFocus
          placeholder="e.g. CRD39060 · WS001 · บริษัท ไทย..."
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          className="w-full pl-10 pr-10 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 shadow-sm"
        />
      </div>

      {/* Results list (when multiple matches) */}
      {!selected && results.length > 1 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden max-w-2xl mb-6">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-500">{results.length} customers found</p>
          </div>
          <div className="divide-y divide-slate-50">
            {results.map((r) => (
              <button
                key={r.key}
                onClick={() => setSelected(r)}
                className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{r.displayName}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {r.customerNo ?? r.customerCode ?? ''}
                      {r.customerGroupName && ` · ${r.customerGroupName}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-700">{fmtMoney(r.totalRevenue)}</p>
                    <p className="text-xs text-slate-400">Last: {r.lastActiveYear}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No results */}
      {searched && results.length === 0 && !loading && (
        <div className="text-center py-12 text-slate-400">
          <User size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No customers found for "{query}"</p>
        </div>
      )}

      {/* Customer detail panel */}
      {selected && (
        <div className="space-y-6">
          {/* Back button when multiple results exist */}
          {results.length > 1 && (
            <button
              onClick={() => setSelected(null)}
              className="text-xs text-blue-600 hover:underline"
            >
              ← Back to results
            </button>
          )}

          {/* Profile header */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">{selected.displayName}</h2>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {selected.customerNo && (
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-mono">
                      {selected.customerNo}
                    </span>
                  )}
                  {selected.customerCode && (
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">
                      {selected.customerCode}
                    </span>
                  )}
                  {selected.customerGroupName && (
                    <span className="text-xs bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full">
                      {selected.customerGroupName}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-800">{fmtMoney(selected.totalRevenue)}</p>
                <p className="text-xs text-slate-400 mt-0.5">lifetime revenue (Amount)</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-slate-100">
              <Stat icon={TrendingUp} label="Years Active" value={selected.yearsActive.join(', ')} />
              <Stat icon={TrendingUp} label="Last Active" value={String(selected.lastActiveYear)} />
              <Stat icon={Building2} label="Branches" value={selected.branches.join(', ') || '—'} />
              <Stat icon={UserCheck} label="Salespersons" value={selected.salespersons.slice(0, 2).join(', ') + (selected.salespersons.length > 2 ? ` +${selected.salespersons.length - 2}` : '') || '—'} />
            </div>
          </div>

          {/* Revenue by year chart */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Revenue by Year (Amount)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revenueChartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `฿${(v / 1e6).toFixed(1)}M`}
                />
                <Tooltip
                  formatter={(v: number) => [fmtMoney(v), 'Revenue']}
                  labelStyle={{ fontSize: 12 }}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>

            {/* Revenue table */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="py-1.5 text-left font-semibold text-slate-500">Year</th>
                    <th className="py-1.5 text-right font-semibold text-slate-500">Revenue (Amount)</th>
                    <th className="py-1.5 text-right font-semibold text-slate-500">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueChartData.map(({ year, revenue }) => (
                    <tr key={year} className="border-b border-slate-50">
                      <td className="py-1.5 font-medium">{year}</td>
                      <td className="py-1.5 text-right tabular-nums">{fmtMoney(revenue)}</td>
                      <td className="py-1.5 text-right tabular-nums text-slate-400">
                        {selected.totalRevenue ? ((revenue / selected.totalRevenue) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent transactions */}
          {selected.recentTransactions.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-700">
                  Recent Transactions ({selected.recentTransactions.length} shown)
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-slate-500">Date</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-500">Doc No</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-500">Branch</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-500">Salesperson</th>
                      <th className="px-4 py-2 text-left font-semibold text-slate-500">Description</th>
                      <th className="px-4 py-2 text-right font-semibold text-slate-500">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.recentTransactions.map((t, i) => (
                      <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="px-4 py-2 tabular-nums text-slate-500">{t.postingDate}</td>
                        <td className="px-4 py-2 font-mono text-slate-600">{t.documentNo ?? '—'}</td>
                        <td className="px-4 py-2 text-slate-600">{t.branchCode}</td>
                        <td className="px-4 py-2 text-slate-600 max-w-[140px] truncate">{t.salespersonName}</td>
                        <td className="px-4 py-2 text-slate-500 max-w-[200px] truncate">{t.description ?? '—'}</td>
                        <td className="px-4 py-2 text-right font-semibold tabular-nums text-slate-800">
                          {fmtMoney(t.netAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!searched && results.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <Search size={48} className="mx-auto mb-4 opacity-20" />
          <p className="text-sm font-medium">Enter a customer number, code, or name</p>
          <p className="text-xs mt-1 opacity-70">e.g. CRD39060 · WS001 · บริษัท ไทย</p>
        </div>
      )}
    </main>
  )
}

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400 font-medium mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-slate-700 truncate">{value}</p>
    </div>
  )
}

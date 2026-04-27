'use client'

/**
 * /customer-lookup
 *
 * Search for a specific customer by number, code, or name.
 * Shows full profile: revenue by year, branch/salesperson history,
 * and recent transactions.
 */

import { useEffect, useRef, useState } from 'react'
import { Search, RefreshCw, User, TrendingUp, Building2, UserCheck, CalendarDays } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { CLT_COLORS, CLT_AXIS, CLT_TOOLTIP, fmtY, fmtCurrency } from '@/lib/chartTheme'
import { Glossary } from '@/components/charts/Glossary'
import { LOOKUP_GLOSSARY } from '@/lib/glossary-items'

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
    <main className="flex-1 bg-[#F8FAFC] p-4 lg:p-6 overflow-y-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <span className="inline-flex w-10 h-10 rounded-xl bg-gradient-to-br from-navy-900 to-navy-700 text-gold-400 items-center justify-center shadow-card">
          <Search size={18} />
        </span>
        <div>
          <h1 className="text-lg font-bold text-navy-900">Customer Lookup</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Search by customer number, code, or name
          </p>
        </div>
      </div>

      {/* Glossary — help panel */}
      <div className="mb-6">
        <Glossary items={LOOKUP_GLOSSARY} />
      </div>

      {/* Search box */}
      <div className="relative max-w-lg mb-6">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-navy-500" />
        {loading && (
          <RefreshCw size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gold-500 animate-spin" />
        )}
        <input
          type="text"
          autoFocus
          placeholder="e.g. CRD39060 · WS001 · บริษัท ไทย..."
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          className="w-full pl-10 pr-10 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-100 shadow-card"
        />
      </div>

      {/* Results list (when multiple matches) */}
      {!selected && results.length > 1 && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-card overflow-hidden max-w-2xl mb-6 hover-lift">
          <div className="px-4 py-3 bg-gradient-to-r from-navy-900 to-navy-700">
            <p className="text-xs font-semibold text-white flex items-center gap-2">
              <span className="inline-block w-1 h-3.5 bg-gold-500 rounded-full" />
              {results.length} customers found
            </p>
          </div>
          <div className="divide-y divide-slate-50">
            {results.map((r) => (
              <button
                key={r.key}
                onClick={() => setSelected(r)}
                className="w-full text-left px-4 py-3 hover:bg-navy-50/40 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-navy-900">{r.displayName}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {r.customerNo ?? r.customerCode ?? ''}
                      {r.customerGroupName && ` · ${r.customerGroupName}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-navy-900 font-num">{fmtMoney(r.totalRevenue)}</p>
                    <p className="text-xs text-slate-400 font-num">Last: {r.lastActiveYear}</p>
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
          <p className="text-sm">No customers found for &ldquo;{query}&rdquo;</p>
        </div>
      )}

      {/* Customer detail panel */}
      {selected && (
        <div className="space-y-6 animate-slide-up">
          {/* Back button when multiple results exist */}
          {results.length > 1 && (
            <button
              onClick={() => setSelected(null)}
              className="text-xs font-semibold text-navy-900 hover:text-gold-600 transition-colors"
            >
              ← Back to results
            </button>
          )}

          {/* Profile header */}
          <div className="relative bg-white rounded-3xl border border-slate-200 shadow-card p-5 hover-lift overflow-hidden">
            <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-navy-900 via-gold-500 to-navy-900" />
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <h2 className="text-lg font-bold text-navy-900">{selected.displayName}</h2>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {selected.customerNo && (
                    <span className="text-xs bg-navy-50 text-navy-900 px-2 py-0.5 rounded-full font-mono font-semibold">
                      {selected.customerNo}
                    </span>
                  )}
                  {selected.customerCode && (
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">
                      {selected.customerCode}
                    </span>
                  )}
                  {selected.customerGroupName && (
                    <span className="text-xs bg-gold-50 text-gold-800 px-2 py-0.5 rounded-full font-medium">
                      {selected.customerGroupName}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-navy-900 font-num">{fmtMoney(selected.totalRevenue)}</p>
                <p className="text-xs text-slate-400 mt-0.5">lifetime revenue (Amount)</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-slate-100">
              <Stat icon={CalendarDays} label="Years Active" value={selected.yearsActive.join(', ')} />
              <Stat icon={TrendingUp} label="Last Active" value={String(selected.lastActiveYear)} />
              <Stat icon={Building2} label="Branches" value={selected.branches.join(', ') || '—'} />
              <Stat icon={UserCheck} label="Salespersons" value={selected.salespersons.slice(0, 2).join(', ') + (selected.salespersons.length > 2 ? ` +${selected.salespersons.length - 2}` : '') || '—'} />
            </div>
          </div>

          {/* Revenue by year chart */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-card p-5 hover-lift">
            <h3 className="text-sm font-semibold text-navy-900 mb-4 flex items-center gap-2">
              <span className="inline-block w-1 h-4 bg-gold-500 rounded-full" />
              Revenue by Year (Amount)
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revenueChartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CLT_AXIS.grid} />
                <XAxis dataKey="year" tick={CLT_AXIS.tick} tickLine={CLT_AXIS.tickLine} axisLine={CLT_AXIS.axisLine} />
                <YAxis
                  tick={CLT_AXIS.tick}
                  tickLine={CLT_AXIS.tickLine}
                  axisLine={CLT_AXIS.axisLine}
                  tickFormatter={fmtY}
                />
                <Tooltip formatter={(v: number) => [fmtCurrency(v), 'Revenue']} {...CLT_TOOLTIP} />
                <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                  {revenueChartData.map((_, i) => (
                    <Cell key={i} fill={CLT_COLORS[i % CLT_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Revenue table */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="py-1.5 px-2 text-left font-semibold text-navy-700">Year</th>
                    <th className="py-1.5 px-2 text-right font-semibold text-navy-700">Revenue (Amount)</th>
                    <th className="py-1.5 px-2 text-right font-semibold text-navy-700">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueChartData.map(({ year, revenue }) => (
                    <tr key={year} className="border-b border-slate-50 hover:bg-navy-50/40 transition-colors">
                      <td className="py-1.5 px-2 font-semibold text-navy-900 font-num">{year}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums font-num">{fmtMoney(revenue)}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums text-slate-400 font-num">
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
            <div className="bg-white rounded-3xl border border-slate-200 shadow-card overflow-hidden hover-lift">
              <div className="px-5 py-4 bg-gradient-to-r from-navy-900 to-navy-700">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <span className="inline-block w-1 h-4 bg-gold-500 rounded-full" />
                  Recent Transactions ({selected.recentTransactions.length} shown)
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-2 text-left font-semibold text-navy-700">Date</th>
                      <th className="px-4 py-2 text-left font-semibold text-navy-700">Doc No</th>
                      <th className="px-4 py-2 text-left font-semibold text-navy-700">Branch</th>
                      <th className="px-4 py-2 text-left font-semibold text-navy-700">Salesperson</th>
                      <th className="px-4 py-2 text-left font-semibold text-navy-700">Description</th>
                      <th className="px-4 py-2 text-right font-semibold text-navy-700">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selected.recentTransactions.map((t, i) => (
                      <tr key={i} className="border-b border-slate-50 hover:bg-navy-50/40 transition-colors">
                        <td className="px-4 py-2 tabular-nums text-slate-500 font-num">{t.postingDate}</td>
                        <td className="px-4 py-2 font-mono text-slate-600">{t.documentNo ?? '—'}</td>
                        <td className="px-4 py-2 text-slate-600">{t.branchCode}</td>
                        <td className="px-4 py-2 text-slate-600 max-w-[140px] truncate">{t.salespersonName}</td>
                        <td className="px-4 py-2 text-slate-500 max-w-[200px] truncate">{t.description ?? '—'}</td>
                        <td className="px-4 py-2 text-right font-semibold tabular-nums text-navy-900 font-num">
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
          <Search size={48} className="mx-auto mb-4 opacity-20 text-navy-400" />
          <p className="text-sm font-medium text-navy-700">Enter a customer number, code, or name</p>
          <p className="text-xs mt-1 opacity-70">e.g. CRD39060 · WS001 · บริษัท ไทย</p>
        </div>
      )}
    </main>
  )
}

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="inline-flex w-8 h-8 shrink-0 rounded-lg bg-navy-50 text-navy-900 items-center justify-center">
        <Icon size={14} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] text-navy-700 font-semibold uppercase tracking-wider">{label}</p>
        <p className="text-sm font-semibold text-navy-900 truncate">{value}</p>
      </div>
    </div>
  )
}

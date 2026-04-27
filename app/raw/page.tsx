'use client'

/**
 * /raw
 *
 * Drill-through raw data table.  Filter, search, sort, and paginate over
 * every record in the database.  Optional CSV export of current view.
 */

import { useEffect, useState } from 'react'
import { Search, Download, ChevronLeft, ChevronRight, RefreshCw, ArrowUpDown, Database } from 'lucide-react'
import type { DashboardFilters, FilterOptions, SalesRecord } from '@/types'
import { FilterPanel } from '@/components/filters/FilterPanel'

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

type SortKey = keyof SalesRecord

export default function RawPage() {
  const [options, setOptions] = useState<FilterOptions | null>(null)
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('postingDate')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [records, setRecords] = useState<SalesRecord[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [pageCount, setPageCount] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/options').then((r) => r.json()).then(setOptions)
  }, [])

  useEffect(() => {
    setLoading(true)
    const timer = setTimeout(() => {
      fetch('/api/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters, search, sortBy, sortDir, page, pageSize }),
      })
        .then((r) => r.json())
        .then((d) => {
          setRecords(d.records ?? [])
          setTotalCount(d.totalCount ?? 0)
          setPageCount(d.pageCount ?? 1)
        })
        .finally(() => setLoading(false))
    }, 200)
    return () => clearTimeout(timer)
  }, [filters, search, sortBy, sortDir, page, pageSize])

  useEffect(() => {
    setPage(1)
  }, [filters, search])

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key)
      setSortDir('desc')
    }
  }

  const exportCsv = () => {
    if (records.length === 0) return
    const cols: SortKey[] = [
      'postingDate', 'branchCode', 'salespersonName', 'customerName', 'customerNo',
      'documentNo', 'documentType', 'productCode', 'testCode', 'description',
      'quantity', 'unitPrice', 'lineAmount', 'discountAmount', 'netAmount', 'grossAmount',
    ]
    const header = cols.join(',')
    const rows = records.map((r) =>
      cols.map((c) => {
        const v = r[c] as unknown
        if (v == null) return ''
        const s = String(v).replace(/"/g, '""')
        return s.includes(',') ? `"${s}"` : s
      }).join(','),
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `clt-records-page${page}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!options) {
    return (
      <main className="flex-1 flex items-center justify-center bg-[#F8FAFC]">
        <RefreshCw className="text-navy-400 animate-spin" size={28} />
      </main>
    )
  }

  return (
    <div className="flex flex-1 overflow-hidden bg-[#F8FAFC]">
      {/* Sidebar filters */}
      <div className="hidden xl:block p-4 shrink-0">
        <FilterPanel options={options} filters={filters} onChange={setFilters} />
      </div>

      <main className="flex-1 overflow-hidden flex flex-col p-4 lg:p-6 min-w-0 animate-fade-in">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex w-10 h-10 rounded-xl bg-gradient-to-br from-navy-900 to-navy-700 text-gold-400 items-center justify-center shadow-card">
              <Database size={18} />
            </span>
            <div>
              <h1 className="text-lg font-bold text-navy-900">Raw Data</h1>
              <p className="text-xs text-slate-500 mt-0.5 font-num">
                {totalCount.toLocaleString()} records match current filters
                {loading && <RefreshCw className="inline ml-2 animate-spin" size={11} />}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-500" />
              <input
                type="text"
                placeholder="Search customer, product, doc no…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg w-72 focus:outline-none focus:border-gold-400 focus:ring-2 focus:ring-gold-100 shadow-sm"
              />
            </div>
            <button
              onClick={exportCsv}
              disabled={records.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gold-50 border border-gold-300 rounded-lg text-xs font-semibold text-gold-900 hover:bg-gold-100 disabled:opacity-40 transition-all"
            >
              <Download size={12} />
              Export page
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden flex flex-col min-h-0">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-gradient-to-r from-navy-900 to-navy-700 text-white">
                <tr>
                  <Th onClick={() => toggleSort('postingDate')} active={sortBy === 'postingDate'}>Date</Th>
                  <Th onClick={() => toggleSort('branchCode')} active={sortBy === 'branchCode'}>Branch</Th>
                  <Th onClick={() => toggleSort('salespersonName')} active={sortBy === 'salespersonName'}>Salesperson</Th>
                  <Th onClick={() => toggleSort('customerName')} active={sortBy === 'customerName'}>Customer</Th>
                  <Th onClick={() => toggleSort('documentNo')} active={sortBy === 'documentNo'}>Doc No</Th>
                  <Th>Product / Test</Th>
                  <Th onClick={() => toggleSort('quantity')} active={sortBy === 'quantity'} align="right">Qty</Th>
                  <Th onClick={() => toggleSort('unitPrice')} active={sortBy === 'unitPrice'} align="right">Unit Price</Th>
                  <Th onClick={() => toggleSort('netAmount')} active={sortBy === 'netAmount'} align="right">Amount</Th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 && !loading && (
                  <tr>
                    <td colSpan={9} className="text-center text-sm text-slate-400 py-12">
                      No records match your filters.
                    </td>
                  </tr>
                )}
                {records.map((r, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-navy-50/40 transition-colors">
                    <td className="px-3 py-2 text-slate-600 tabular-nums whitespace-nowrap font-num">{r.postingDate}</td>
                    <td className="px-3 py-2 text-navy-900 font-semibold">{r.branchCode}</td>
                    <td className="px-3 py-2 text-slate-600 max-w-[140px] truncate">{r.salespersonName}</td>
                    <td className="px-3 py-2 text-navy-900 font-medium max-w-[200px] truncate">
                      {r.customerName}
                      {r.customerNo && <span className="text-slate-400 ml-1 font-mono text-[11px]">· {r.customerNo}</span>}
                    </td>
                    <td className="px-3 py-2 text-slate-500 font-mono">{r.documentNo}</td>
                    <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate">
                      {r.productCode || r.testCode}
                      {r.description && <span className="text-slate-400"> · {r.description}</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600 font-num">
                      {r.quantity ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600 font-num">
                      {r.unitPrice != null ? r.unitPrice.toLocaleString() : '—'}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums font-semibold font-num ${r.netAmount < 0 ? 'text-red-500' : 'text-navy-900'}`}>
                      {r.netAmount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 flex items-center justify-between text-xs text-slate-500">
            <span className="font-num">
              Page <span className="font-semibold text-navy-900">{page}</span> of {pageCount} · <span className="font-semibold text-navy-900">{totalCount.toLocaleString()}</span> records
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg hover:bg-navy-900 hover:text-gold-400 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500 transition-all"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page >= pageCount}
                className="p-1.5 rounded-lg hover:bg-navy-900 hover:text-gold-400 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-500 transition-all"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function Th({
  children,
  onClick,
  active,
  align = 'left',
}: {
  children: React.ReactNode
  onClick?: () => void
  active?: boolean
  align?: 'left' | 'right'
}) {
  return (
    <th
      onClick={onClick}
      className={`px-3 py-2.5 text-${align} font-semibold whitespace-nowrap select-none ${
        onClick ? 'cursor-pointer hover:text-gold-400' : ''
      } ${active ? 'text-gold-400' : 'text-white'}`}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {onClick && <ArrowUpDown size={10} className={active ? 'text-gold-400' : 'text-slate-300'} />}
      </span>
    </th>
  )
}

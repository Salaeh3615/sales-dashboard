'use client'

/**
 * /raw
 *
 * Drill-through raw data table.  Filter, search, sort, and paginate over
 * every record in the database.  Optional CSV export of current view.
 */

import { useEffect, useMemo, useState } from 'react'
import { Search, Download, ChevronLeft, ChevronRight, RefreshCw, ArrowUpDown } from 'lucide-react'
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
    }, 200) // small debounce for search
    return () => clearTimeout(timer)
  }, [filters, search, sortBy, sortDir, page, pageSize])

  // Reset to page 1 when filters/search change
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
      'postingDate',
      'branchCode',
      'salespersonName',
      'customerName',
      'customerNo',
      'documentNo',
      'documentType',
      'productCode',
      'testCode',
      'description',
      'quantity',
      'unitPrice',
      'lineAmount',
      'discountAmount',
      'netAmount',
      'grossAmount',
    ]
    const header = cols.join(',')
    const rows = records.map((r) =>
      cols
        .map((c) => {
          const v = r[c] as unknown
          if (v == null) return ''
          const s = String(v).replace(/"/g, '""')
          return s.includes(',') ? `"${s}"` : s
        })
        .join(','),
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
      <main className="flex-1 flex items-center justify-center">
        <RefreshCw className="text-slate-400 animate-spin" size={28} />
      </main>
    )
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar filters */}
      <div className="hidden xl:block p-4 shrink-0">
        <FilterPanel options={options} filters={filters} onChange={setFilters} />
      </div>

      <main className="flex-1 overflow-hidden flex flex-col p-4 lg:p-6 min-w-0">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Raw Data</h1>
            <p className="text-sm text-slate-500 mt-1">
              {totalCount.toLocaleString()} records match current filters
              {loading && <RefreshCw className="inline ml-2 animate-spin" size={11} />}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search customer, product, doc no…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg w-72 focus:outline-none focus:border-blue-400"
              />
            </div>
            <button
              onClick={exportCsv}
              disabled={records.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:border-blue-400 hover:text-blue-600 disabled:opacity-40"
            >
              <Download size={12} />
              Export page
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
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
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-600 tabular-nums whitespace-nowrap">{r.postingDate}</td>
                    <td className="px-3 py-2 text-slate-700 font-medium">{r.branchCode}</td>
                    <td className="px-3 py-2 text-slate-600 max-w-[140px] truncate">{r.salespersonName}</td>
                    <td className="px-3 py-2 text-slate-800 font-medium max-w-[200px] truncate">
                      {r.customerName}
                      {r.customerNo && <span className="text-slate-400 ml-1">· {r.customerNo}</span>}
                    </td>
                    <td className="px-3 py-2 text-slate-500 font-mono">{r.documentNo}</td>
                    <td className="px-3 py-2 text-slate-600 max-w-[200px] truncate">
                      {r.productCode || r.testCode}
                      {r.description && <span className="text-slate-400"> · {r.description}</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                      {r.quantity ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                      {r.unitPrice != null ? r.unitPrice.toLocaleString() : '—'}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums font-semibold ${r.netAmount < 0 ? 'text-red-500' : 'text-slate-800'}`}>
                      {r.netAmount.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 flex items-center justify-between text-xs text-slate-500">
            <span>
              Page {page} of {pageCount} · {totalCount.toLocaleString()} records
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page >= pageCount}
                className="p-1.5 rounded hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent"
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
      className={`px-3 py-2 text-${align} font-semibold text-slate-500 whitespace-nowrap select-none ${
        onClick ? 'cursor-pointer hover:text-slate-700' : ''
      } ${active ? 'text-blue-600' : ''}`}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {onClick && <ArrowUpDown size={10} className={active ? 'text-blue-400' : 'text-slate-300'} />}
      </span>
    </th>
  )
}

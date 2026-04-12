'use client'

import { useState, useEffect, useCallback } from 'react'
import { TopNav } from '@/components/dashboard/TopNav'
import {
  TrendingUp, TrendingDown, Minus,
  ChevronDown, ChevronRight,
  Users, DollarSign, ArrowLeftRight,
  Download,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type GroupBy = 'salesperson' | 'branch' | 'product' | 'customer'

interface LostCustomer {
  key: string
  name: string
  salesperson: string
  revenueA: number
}

interface CompRow {
  key: string
  label: string
  revenueA: number
  revenueB: number
  customersA: number
  customersB: number
  change: number
  changePct: number | null
  retained: number
  lost: number
  gained: number
  trend: number[]
  lostCustomers: LostCustomer[]
}

interface Summary {
  totalA: number
  totalB: number
  change: number
  changePct: number | null
}

interface ApiResult {
  availablePeriods: string[]
  trendPeriods: string[]
  rows: CompRow[]
  summary: Summary | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtB(n: number, digits = 2) {
  const abs = Math.abs(n)
  if (abs >= 1e6)  return `฿${(n / 1e6).toFixed(digits)}M`
  if (abs >= 1e3)  return `฿${(n / 1e3).toFixed(1)}K`
  return `฿${n.toFixed(0)}`
}

function fmtPct(n: number | null) {
  if (n === null) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

function periodLabel(p: string) {
  // "2025-Q1" → "Q1'25"
  if (p.includes('-Q')) {
    const [y, q] = p.split('-Q')
    return `${q}'${y.slice(2)}`
  }
  return p
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ values, periods, width = 128, height = 36 }: {
  values: number[]
  periods: string[]
  width?: number
  height?: number
}) {
  if (values.length < 2) return null
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const pad = 3

  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2)
    const y = pad + ((max - v) / range) * (height - pad * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  const last = values[values.length - 1]
  const prev = values[values.length - 2]
  const color = last > prev ? '#22c55e' : last < prev ? '#ef4444' : '#94a3b8'

  return (
    <svg
      width={width}
      height={height}
      className="inline-block"
      aria-label={values.map((v, i) => `${periods[i]}: ${fmtB(v)}`).join(', ')}
    >
      {/* Zero baseline faint line */}
      {min < 0 && max > 0 && (
        <line
          x1={pad} y1={pad + (max / range) * (height - pad * 2)}
          x2={width - pad} y2={pad + (max / range) * (height - pad * 2)}
          stroke="#e2e8f0" strokeWidth="1"
        />
      )}
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      {/* Last dot */}
      <circle
        cx={+(pts.split(' ').pop()!.split(',')[0])}
        cy={+(pts.split(' ').pop()!.split(',')[1])}
        r="2.5" fill={color}
      />
    </svg>
  )
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCSV(rows: CompRow[], periodA: string, periodB: string, groupBy: string, trendPeriods: string[]) {
  const headers = [
    'Key', 'Label',
    `Revenue ${periodA}`, `Revenue ${periodB}`, 'Change', 'Change %',
    `Customers ${periodA}`, `Customers ${periodB}`, 'Retained', 'Lost', 'Gained',
    ...trendPeriods.map(p => `Trend ${p}`),
  ]
  const bom = '\uFEFF'
  const lines = [headers.join(','), ...rows.map(r => [
    `"${r.key}"`, `"${r.label}"`,
    r.revenueA.toFixed(2), r.revenueB.toFixed(2),
    r.change.toFixed(2), r.changePct?.toFixed(2) ?? '',
    r.customersA, r.customersB, r.retained, r.lost, r.gained,
    ...r.trend.map(v => v.toFixed(2)),
  ].join(','))]
  const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `comparison_${groupBy}_${periodA}_vs_${periodB}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Sub-component: Row ───────────────────────────────────────────────────────

function ComparisonRow({ row, trendPeriods, periodA, periodB }: {
  row: CompRow
  trendPeriods: string[]
  periodA: string
  periodB: string
}) {
  const [open, setOpen] = useState(false)

  const changeColor = row.change > 0
    ? 'text-green-600'
    : row.change < 0
    ? 'text-red-600'
    : 'text-slate-500'

  const changeBg = row.change > 0
    ? 'bg-green-50'
    : row.change < 0
    ? 'bg-red-50'
    : 'bg-slate-50'

  return (
    <>
      <tr
        className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors ${open ? 'bg-slate-50' : ''}`}
        onClick={() => row.lost > 0 && setOpen(o => !o)}
      >
        {/* Expand toggle */}
        <td className="py-2.5 pl-3 pr-1 w-6">
          {row.lost > 0 ? (
            open
              ? <ChevronDown size={14} className="text-slate-400" />
              : <ChevronRight size={14} className="text-slate-400" />
          ) : null}
        </td>

        {/* Label */}
        <td className="py-2.5 pr-3 text-sm font-medium text-slate-800 max-w-[160px]">
          <div className="truncate">{row.label}</div>
        </td>

        {/* Period A revenue */}
        <td className="py-2.5 px-3 text-right text-sm text-slate-600 tabular-nums">
          {fmtB(row.revenueA)}
        </td>

        {/* Period B revenue */}
        <td className="py-2.5 px-3 text-right text-sm font-semibold text-slate-800 tabular-nums">
          {fmtB(row.revenueB)}
        </td>

        {/* Change */}
        <td className={`py-2.5 px-3 text-right text-sm font-semibold tabular-nums ${changeColor}`}>
          <span className={`inline-block px-2 py-0.5 rounded text-xs ${changeBg}`}>
            {row.change >= 0 ? '+' : ''}{fmtB(row.change, 1)}
          </span>
        </td>

        {/* Change % */}
        <td className={`py-2.5 px-3 text-right text-xs tabular-nums ${changeColor}`}>
          {fmtPct(row.changePct)}
        </td>

        {/* Customers A */}
        <td className="py-2.5 px-3 text-right text-xs text-slate-500 tabular-nums">
          {row.customersA}
        </td>

        {/* Customer movement */}
        <td className="py-2.5 px-3">
          <div className="flex items-center gap-1.5 text-xs justify-center">
            <span className="text-green-600 font-medium">+{row.gained}</span>
            <span className="text-slate-300">|</span>
            <span className="text-blue-600">{row.retained}</span>
            <span className="text-slate-300">|</span>
            <span className={row.lost > 0 ? 'text-red-600 font-semibold' : 'text-slate-400'}>
              -{row.lost}
            </span>
          </div>
        </td>

        {/* Customers B */}
        <td className="py-2.5 px-3 text-right text-xs text-slate-700 font-medium tabular-nums">
          {row.customersB}
        </td>

        {/* Sparkline */}
        <td className="py-2.5 px-3">
          <Sparkline values={row.trend} periods={trendPeriods} />
        </td>
      </tr>

      {/* Lost customers expansion */}
      {open && row.lostCustomers.length > 0 && (
        <tr className="bg-red-50/40">
          <td colSpan={10} className="pl-10 pr-4 py-3">
            <div className="text-xs font-semibold text-red-700 mb-2">
              ลูกค้าที่หายไป ({row.lostCustomers.length} ราย) — มีใน {periodA} แต่ไม่มีใน {periodB}
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500">
                  <th className="text-left pb-1 pr-4 font-medium">ชื่อลูกค้า</th>
                  <th className="text-left pb-1 pr-4 font-medium">รหัส</th>
                  <th className="text-left pb-1 pr-4 font-medium">Salesperson</th>
                  <th className="text-right pb-1 font-medium">Revenue ใน {periodA}</th>
                </tr>
              </thead>
              <tbody>
                {row.lostCustomers.slice(0, 30).map(c => (
                  <tr key={c.key} className="border-t border-red-100">
                    <td className="py-1 pr-4 text-slate-700 max-w-[200px] truncate">{c.name}</td>
                    <td className="py-1 pr-4 text-slate-500 font-mono">{c.key}</td>
                    <td className="py-1 pr-4 text-slate-600">{c.salesperson}</td>
                    <td className="py-1 text-right text-red-600 font-medium tabular-nums">{fmtB(c.revenueA)}</td>
                  </tr>
                ))}
                {row.lostCustomers.length > 30 && (
                  <tr>
                    <td colSpan={4} className="pt-1 text-slate-400 italic">
                      … และอีก {row.lostCustomers.length - 30} ราย
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
  { value: 'salesperson', label: 'Salesperson' },
  { value: 'branch',      label: 'Branch' },
  { value: 'product',     label: 'Test / Product' },
  { value: 'customer',    label: 'Customer' },
]

export default function ComparisonPage() {
  const [availPeriods, setAvailPeriods] = useState<string[]>([])
  const [periodA, setPeriodA] = useState('')
  const [periodB, setPeriodB] = useState('')
  const [groupBy, setGroupBy] = useState<GroupBy>('salesperson')
  const [result, setResult] = useState<ApiResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  // ── Load available periods on mount ──────────────────────────────────────

  useEffect(() => {
    fetch('/api/comparison')
      .then(r => r.json())
      .then((d: ApiResult) => {
        setAvailPeriods(d.availablePeriods)
        // Default: latest Q as B, one year prior as A
        if (d.availablePeriods.length >= 2) {
          const last = d.availablePeriods[d.availablePeriods.length - 1]
          // Find same quarter one year ago
          if (last.includes('-Q')) {
            const [y, q] = last.split('-Q')
            const prior = `${+y - 1}-Q${q}`
            const fallback = d.availablePeriods[0]
            setPeriodA(d.availablePeriods.includes(prior) ? prior : fallback)
            setPeriodB(last)
          } else {
            setPeriodA(d.availablePeriods[d.availablePeriods.length - 2])
            setPeriodB(last)
          }
        }
      })
      .catch(() => {})
  }, [])

  // ── Fetch comparison data ─────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!periodA || !periodB) return
    setLoading(true)
    setError('')
    try {
      const url = `/api/comparison?groupBy=${groupBy}&periodA=${periodA}&periodB=${periodB}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: ApiResult = await res.json()
      setResult(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [periodA, periodB, groupBy])

  // Auto-load when params change
  useEffect(() => { load() }, [load])

  // ── Swap periods ─────────────────────────────────────────────────────────

  const swap = () => { setPeriodA(periodB); setPeriodB(periodA) }

  // ── Computed values ───────────────────────────────────────────────────────

  const rows = result?.rows ?? []
  const s    = result?.summary
  const tp   = result?.trendPeriods ?? []

  const totalLostCustomers = rows.reduce((sum, r) => sum + r.lost, 0)
  const totalGained        = rows.reduce((sum, r) => sum + r.gained, 0)

  return (
    <div className="min-h-screen bg-slate-50">
      <TopNav />

      <div className="max-w-screen-xl mx-auto px-4 py-6 space-y-5">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-xl font-bold text-slate-800">Comparison Analysis</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            เปรียบเทียบ Revenue & ลูกค้า ระหว่าง 2 ช่วงเวลา พร้อม Trend 8 ไตรมาส
          </p>
        </div>

        {/* ── Controls ───────────────────────────────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap gap-4 items-end">

          {/* Period A */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Period A (เปรียบเทียบกับ)</label>
            <select
              value={periodA}
              onChange={e => setPeriodA(e.target.value)}
              className="border border-slate-300 rounded-lg text-sm px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              {availPeriods.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Swap button */}
          <button
            onClick={swap}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-500 transition-colors"
            title="Swap periods"
          >
            <ArrowLeftRight size={16} />
          </button>

          {/* Period B */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Period B (ปัจจุบัน)</label>
            <select
              value={periodB}
              onChange={e => setPeriodB(e.target.value)}
              className="border border-slate-300 rounded-lg text-sm px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              {availPeriods.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Group by */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">แบ่งตาม</label>
            <div className="flex gap-1">
              {GROUP_OPTIONS.map(o => (
                <button
                  key={o.value}
                  onClick={() => setGroupBy(o.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    groupBy === o.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Export */}
          {rows.length > 0 && (
            <button
              onClick={() => exportCSV(rows, periodA, periodB, groupBy, tp)}
              className="ml-auto flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <Download size={14} /> Export CSV
            </button>
          )}
        </div>

        {/* ── Error ──────────────────────────────────────────────────── */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* ── Summary cards ──────────────────────────────────────────── */}
        {s && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Period A total */}
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500 mb-1">Revenue {periodA}</div>
              <div className="text-xl font-bold text-slate-700 tabular-nums">{fmtB(s.totalA)}</div>
            </div>

            {/* Period B total */}
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500 mb-1">Revenue {periodB}</div>
              <div className="text-xl font-bold text-slate-800 tabular-nums">{fmtB(s.totalB)}</div>
            </div>

            {/* Change */}
            <div className={`bg-white border rounded-xl p-4 ${
              s.change >= 0 ? 'border-green-200' : 'border-red-200'
            }`}>
              <div className="text-xs text-slate-500 mb-1">เปลี่ยนแปลง</div>
              <div className={`text-xl font-bold tabular-nums ${s.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {s.change >= 0 ? '+' : ''}{fmtB(s.change)}
              </div>
              <div className={`text-xs mt-0.5 ${s.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {s.change >= 0 ? <TrendingUp size={12} className="inline mr-1" /> : <TrendingDown size={12} className="inline mr-1" />}
                {fmtPct(s.changePct)}
              </div>
            </div>

            {/* Customer movement */}
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500 mb-1">Customer Movement</div>
              <div className="flex items-center gap-2 text-sm font-semibold mt-1">
                <span className="text-green-600">+{totalGained} ใหม่</span>
                <span className="text-slate-300">|</span>
                <span className="text-red-600">-{totalLostCustomers} หาย</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Loading ─────────────────────────────────────────────────── */}
        {loading && (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
            <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-sm text-slate-500">กำลังโหลด…</p>
          </div>
        )}

        {/* ── Comparison table ────────────────────────────────────────── */}
        {!loading && rows.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">

            {/* Trend period labels */}
            {tp.length > 0 && (
              <div className="border-b border-slate-100 px-4 py-2.5 flex items-center gap-2 bg-slate-50 text-xs text-slate-400">
                <span className="font-medium text-slate-500">Trend:</span>
                {tp.map(p => (
                  <span
                    key={p}
                    className={`px-1.5 py-0.5 rounded ${
                      p === periodA ? 'bg-blue-100 text-blue-700 font-semibold' :
                      p === periodB ? 'bg-green-100 text-green-700 font-semibold' :
                      'text-slate-400'
                    }`}
                  >
                    {periodLabel(p)}
                  </span>
                ))}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 font-medium">
                    <th className="py-2.5 pl-3 pr-1 w-6" />
                    <th className="py-2.5 pr-3 text-left">
                      {GROUP_OPTIONS.find(o => o.value === groupBy)?.label}
                    </th>
                    <th className="py-2.5 px-3 text-right">Revenue {periodA}</th>
                    <th className="py-2.5 px-3 text-right">Revenue {periodB}</th>
                    <th className="py-2.5 px-3 text-right">เปลี่ยน</th>
                    <th className="py-2.5 px-3 text-right">%</th>
                    <th className="py-2.5 px-3 text-right">Cust {periodA}</th>
                    <th className="py-2.5 px-3 text-center">
                      <span className="text-green-600">+ใหม่</span>
                      {' / '}
                      <span className="text-blue-600">คงอยู่</span>
                      {' / '}
                      <span className="text-red-600">-หาย</span>
                    </th>
                    <th className="py-2.5 px-3 text-right">Cust {periodB}</th>
                    <th className="py-2.5 px-3 text-left">8Q Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <ComparisonRow
                      key={row.key}
                      row={row}
                      trendPeriods={tp}
                      periodA={periodA}
                      periodB={periodB}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 text-xs text-slate-400 flex items-center gap-4">
              <span>{rows.length} รายการ</span>
              <span className="text-slate-300">|</span>
              <span>คลิกที่แถวที่มีลูกค้าหาย (สีแดง) เพื่อดูรายชื่อ</span>
            </div>
          </div>
        )}

        {/* ── Empty state ─────────────────────────────────────────────── */}
        {!loading && !error && rows.length === 0 && periodA && periodB && result && (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-400">
            <Minus size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">ไม่พบข้อมูลสำหรับช่วงเวลาที่เลือก</p>
          </div>
        )}

      </div>
    </div>
  )
}

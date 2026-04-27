'use client'

/**
 * /health — Customer Health Watchlist.
 *
 * คะแนน 0–100 ต่อลูกค้า แบ่งเป็น Healthy / Watch / At-Risk / Critical
 * พร้อมเหตุผลอัตโนมัติว่าทำไมคะแนนถึงเท่านี้
 */

import { useEffect, useMemo, useState } from 'react'
import {
  RefreshCw, HeartPulse, Filter, Calendar, Search, AlertTriangle,
  TrendingDown, Activity,
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
} from 'recharts'
import type { DashboardFilters, FilterOptions } from '@/types'
import { FilterPanel } from '@/components/filters/FilterPanel'
import { CLT_AXIS, CLT_TOOLTIP } from '@/lib/chartTheme'
import { BentoCard } from '@/components/charts/BentoCard'
import { Glossary } from '@/components/charts/Glossary'
import { HEALTH_GLOSSARY } from '@/lib/glossary-items'

// ─── Types ───────────────────────────────────────────────────────────────────

type HealthBucket = 'healthy' | 'watch' | 'at_risk' | 'critical'

type CustomerHealth = {
  customerKey: string
  customerName: string
  customerNo: string
  salespersonCode: string
  branchCode: string
  groupName: string
  daysSinceLastOrder: number
  totalLifetimeRevenue: number
  ordersLast90: number
  ordersPrior90: number
  revenueLast90: number
  revenuePrior90: number
  avgOrderLast90: number
  avgOrderPrior90: number
  recencyScore: number
  frequencyScore: number
  revenueScore: number
  orderSizeScore: number
  healthScore: number
  bucket: HealthBucket
  reasons: string[]
  sparkline: { label: string; revenue: number }[]
}

type HealthResponse = {
  asOfDate: string
  totalCustomers: number
  totalLifetimeRevenue: number
  buckets: Record<HealthBucket, { count: number; revenue: number }>
  topCriticalByRevenue: CustomerHealth[]
  topAtRiskByRevenue: CustomerHealth[]
  recentlyDecliningTopRevenue: CustomerHealth[]
  customers: CustomerHealth[]
  recordCount: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: DashboardFilters = {
  years: [], quarters: [], months: [], branches: [],
  salespersons: [], documentTypes: [], customerGroups: [],
  revenueMetric: 'netAmount',
}

function fmt(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '−' : ''
  if (abs >= 1_000_000_000) return `${sign}฿${(abs / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `${sign}฿${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}฿${(abs / 1_000).toFixed(1)}K`
  return `${sign}฿${abs.toFixed(0)}`
}

const BUCKET_META: Record<HealthBucket, {
  label: string; range: string
  bg: string; text: string; ring: string; chip: string
  status: 'ahead' | 'on_track' | 'behind' | 'at_risk'
}> = {
  healthy:  { label: 'Healthy',  range: '80–100', bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-200', chip: 'bg-emerald-500',  status: 'ahead'    },
  watch:    { label: 'Watch',    range: '60–79',  bg: 'bg-navy-50',    text: 'text-navy-900',    ring: 'ring-navy-200',    chip: 'bg-navy-700',     status: 'on_track' },
  at_risk:  { label: 'At-Risk',  range: '40–59',  bg: 'bg-gold-50',    text: 'text-gold-800',    ring: 'ring-gold-200',    chip: 'bg-gold-500',     status: 'behind'   },
  critical: { label: 'Critical', range: '<40',    bg: 'bg-red-50',     text: 'text-red-700',     ring: 'ring-red-200',     chip: 'bg-red-500',      status: 'at_risk'  },
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function HealthPage() {
  const [options, setOptions] = useState<FilterOptions | null>(null)
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS)
  const [data, setData] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [bucketFilter, setBucketFilter] = useState<HealthBucket | 'all'>('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<CustomerHealth | null>(null)

  useEffect(() => {
    fetch('/api/options').then((r) => r.json()).then(setOptions).catch(() => setOptions(null))
  }, [])

  useEffect(() => {
    if (!options) return
    setLoading(true)
    fetch('/api/health', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filters }),
    })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [options, filters])

  const filteredCustomers = useMemo(() => {
    if (!data) return []
    let rows = data.customers
    if (bucketFilter !== 'all') rows = rows.filter((c) => c.bucket === bucketFilter)
    if (search.trim()) {
      const s = search.toLowerCase()
      rows = rows.filter((c) =>
        c.customerName.toLowerCase().includes(s) ||
        c.customerNo.toLowerCase().includes(s) ||
        c.salespersonCode.toLowerCase().includes(s),
      )
    }
    return rows.slice(0, 100)
  }, [data, bucketFilter, search])

  if (!options) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <RefreshCw className="text-navy-400 animate-spin" size={28} />
      </main>
    )
  }

  return (
    <div className="flex flex-1 overflow-hidden bg-[#F8FAFC]">
      <div className="hidden lg:block p-4 shrink-0">
        <FilterPanel options={options} filters={filters} onChange={setFilters} />
      </div>

      <main className="flex-1 overflow-y-auto p-4 lg:p-5 space-y-5 min-w-0 animate-fade-in">
        <Header asOfDate={data?.asOfDate} recordCount={data?.recordCount ?? 0} loading={loading} />

        <Glossary items={HEALTH_GLOSSARY} title="How to read · Customer Health" />

        {!data ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="text-navy-400 animate-spin" size={28} />
          </div>
        ) : (
          <>
            {/* Bucket summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {(['healthy', 'watch', 'at_risk', 'critical'] as HealthBucket[]).map((bk) => {
                const meta = BUCKET_META[bk]
                const stat = data.buckets[bk]
                const pctRev = data.totalLifetimeRevenue > 0
                  ? (stat.revenue / data.totalLifetimeRevenue) * 100 : 0
                const active = bucketFilter === bk
                return (
                  <button
                    key={bk}
                    onClick={() => setBucketFilter(active ? 'all' : bk)}
                    className={`text-left rounded-3xl border bg-white p-4 hover-lift transition-all ${
                      active ? `ring-2 ${meta.ring} border-transparent` : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${meta.chip}`} />
                      <span className={`text-xs font-bold uppercase ${meta.text}`}>{meta.label}</span>
                      <span className="text-[10px] text-slate-400 ml-auto">score {meta.range}</span>
                    </div>
                    <p className="text-2xl font-bold font-num text-navy-900">{stat.count.toLocaleString()}</p>
                    <p className="text-[11px] text-slate-500">ลูกค้า · {fmt(stat.revenue)} ({pctRev.toFixed(1)}%)</p>
                  </button>
                )
              })}
            </div>

            {/* Watchlist priorities */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <BentoCard
                title="Critical — รายได้สูงสุดในกลุ่ม Score < 40"
                subtitle="รายชื่อที่เสี่ยงสูงสุดเมื่อชั่งน้ำหนักด้วย lifetime revenue"
                colSpan={6}
                status="at_risk"
                right={<AlertTriangle size={14} className="text-red-500" />}
              >
                <CustomerList rows={data.topCriticalByRevenue} onSelect={setSelected} />
              </BentoCard>

              <BentoCard
                title="At-Risk — รายได้สูงสุดในกลุ่ม Score 40–59"
                subtitle="ก่อนตกชั้นไป Critical"
                colSpan={6}
                status="behind"
                right={<TrendingDown size={14} className="text-gold-700" />}
              >
                <CustomerList rows={data.topAtRiskByRevenue} onSelect={setSelected} />
              </BentoCard>

              <BentoCard
                title="Recently Declining — รายใหญ่ที่รายได้ 90 วันล่าสุดลด >30%"
                subtitle="ลูกค้าที่ยังจัดเป็น Healthy/Watch แต่เริ่มมีสัญญาณลด"
                colSpan={12}
                status="behind"
                right={<Activity size={14} className="text-navy-700" />}
              >
                <CustomerList rows={data.recentlyDecliningTopRevenue} onSelect={setSelected} showDeltaCol />
              </BentoCard>
            </div>

            {/* Full table */}
            <BentoCard
              title="All Customers"
              subtitle={`เรียงตาม lifetime revenue — แสดง ${filteredCustomers.length} จาก ${data.customers.length}`}
              status="neutral"
              right={
                <div className="flex items-center gap-2">
                  <span className="relative">
                    <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="ค้นหา..."
                      className="text-xs pl-7 pr-2 py-1 border border-slate-200 rounded-lg w-40 focus:outline-none focus:ring-1 focus:ring-navy-300"
                    />
                  </span>
                  <select
                    value={bucketFilter}
                    onChange={(e) => setBucketFilter(e.target.value as HealthBucket | 'all')}
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none"
                  >
                    <option value="all">ทุก bucket</option>
                    <option value="healthy">Healthy</option>
                    <option value="watch">Watch</option>
                    <option value="at_risk">At-Risk</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              }
            >
              <CustomerTable rows={filteredCustomers} onSelect={setSelected} />
            </BentoCard>
          </>
        )}
      </main>

      {selected && <DetailPanel customer={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

// ─── Header ──────────────────────────────────────────────────────────────────

function Header({ asOfDate, recordCount, loading }: { asOfDate?: string; recordCount: number; loading: boolean }) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-3">
        <span className="inline-flex w-10 h-10 rounded-xl bg-gradient-to-br from-navy-900 to-navy-700 text-gold-400 items-center justify-center shadow-card">
          <HeartPulse size={18} />
        </span>
        <div>
          <h1 className="text-lg font-bold text-navy-900">Customer Health Watchlist</h1>
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <Calendar size={11} />
            ข้อมูลล่าสุด {asOfDate ?? '—'} · {recordCount.toLocaleString()} records
            {loading && <RefreshCw className="ml-2 animate-spin" size={10} />}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Reusable customer list (compact rows) ───────────────────────────────────

function CustomerList({
  rows, onSelect, showDeltaCol = false,
}: {
  rows: CustomerHealth[]; onSelect: (c: CustomerHealth) => void; showDeltaCol?: boolean
}) {
  if (rows.length === 0) {
    return <p className="text-xs text-slate-400 italic py-6 text-center">— ไม่มีลูกค้าในกลุ่มนี้ —</p>
  }
  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((c) => {
        const meta = BUCKET_META[c.bucket]
        const delta = c.revenuePrior90 > 0
          ? ((c.revenueLast90 - c.revenuePrior90) / c.revenuePrior90) * 100
          : null
        return (
          <li key={c.customerKey}>
            <button
              onClick={() => onSelect(c)}
              className="w-full text-left py-2 px-1 hover:bg-slate-50 rounded-lg transition-colors"
            >
              <div className="flex items-center gap-3">
                <ScoreBadge score={c.healthScore} bucket={c.bucket} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-navy-900 truncate">{c.customerName}</p>
                  <p className="text-[10px] text-slate-500 truncate">
                    {c.salespersonCode || '—'} · {c.branchCode || '—'} · ห่าง {c.daysSinceLastOrder}d
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-xs font-bold font-num ${meta.text}`}>{fmt(c.totalLifetimeRevenue)}</p>
                  {showDeltaCol && delta !== null && (
                    <p className="text-[10px] font-num text-red-600">{delta.toFixed(0)}% (90d)</p>
                  )}
                </div>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// ─── Score badge (circular w/ bucket color) ──────────────────────────────────

function ScoreBadge({ score, bucket }: { score: number; bucket: HealthBucket }) {
  const meta = BUCKET_META[bucket]
  return (
    <span className={`inline-flex items-center justify-center w-9 h-9 rounded-xl ${meta.bg} ${meta.text} font-bold text-xs shrink-0`}>
      {Math.round(score)}
    </span>
  )
}

// ─── Full table ──────────────────────────────────────────────────────────────

function CustomerTable({
  rows, onSelect,
}: { rows: CustomerHealth[]; onSelect: (c: CustomerHealth) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[10px] font-semibold text-slate-500 uppercase border-b border-slate-200">
            <th className="py-2 px-1">Score</th>
            <th className="py-2 px-1">ลูกค้า</th>
            <th className="py-2 px-1 text-right">Lifetime</th>
            <th className="py-2 px-1 text-right">90d Rev</th>
            <th className="py-2 px-1 text-right">Δ vs prior 90d</th>
            <th className="py-2 px-1 text-right">Last order</th>
            <th className="py-2 px-1">Salesperson</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const delta = c.revenuePrior90 > 0
              ? ((c.revenueLast90 - c.revenuePrior90) / c.revenuePrior90) * 100
              : null
            const deltaColor = delta === null ? 'text-slate-400'
              : delta < -30 ? 'text-red-600'
              : delta < 0 ? 'text-gold-700'
              : 'text-emerald-700'
            return (
              <tr
                key={c.customerKey}
                onClick={() => onSelect(c)}
                className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
              >
                <td className="py-2 px-1"><ScoreBadge score={c.healthScore} bucket={c.bucket} /></td>
                <td className="py-2 px-1">
                  <p className="font-semibold text-navy-900 truncate max-w-xs">{c.customerName}</p>
                  <p className="text-[10px] text-slate-500">{c.groupName || '—'}</p>
                </td>
                <td className="py-2 px-1 text-right font-num">{fmt(c.totalLifetimeRevenue)}</td>
                <td className="py-2 px-1 text-right font-num">{fmt(c.revenueLast90)}</td>
                <td className={`py-2 px-1 text-right font-num ${deltaColor}`}>
                  {delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(0)}%`}
                </td>
                <td className="py-2 px-1 text-right font-num">{c.daysSinceLastOrder}d</td>
                <td className="py-2 px-1 text-slate-500">{c.salespersonCode || '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Detail panel (slide-over) ───────────────────────────────────────────────

function DetailPanel({ customer, onClose }: { customer: CustomerHealth; onClose: () => void }) {
  const meta = BUCKET_META[customer.bucket]
  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-navy-950/40 animate-fade-in" />
      <aside
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md h-full bg-white shadow-2xl overflow-y-auto p-6 animate-slide-in-right"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-navy-900 text-lg">×</button>

        <div className="flex items-center gap-3 mb-1">
          <ScoreBadge score={customer.healthScore} bucket={customer.bucket} />
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${meta.bg} ${meta.text}`}>{meta.label}</span>
        </div>
        <h2 className="text-base font-bold text-navy-900 mt-2">{customer.customerName}</h2>
        <p className="text-[11px] text-slate-500">
          {customer.customerNo || '—'} · {customer.groupName || '—'} · {customer.salespersonCode || '—'} · {customer.branchCode || '—'}
        </p>

        {/* Score breakdown */}
        <div className="mt-5">
          <p className="text-[10px] font-semibold text-slate-500 uppercase mb-2">Score breakdown</p>
          <div className="space-y-1.5">
            <ScoreBar label="Recency" value={customer.recencyScore} weight="35%" />
            <ScoreBar label="Revenue trend" value={customer.revenueScore} weight="30%" />
            <ScoreBar label="Frequency trend" value={customer.frequencyScore} weight="20%" />
            <ScoreBar label="Order size trend" value={customer.orderSizeScore} weight="15%" />
          </div>
        </div>

        {/* Reasons */}
        <div className="mt-5">
          <p className="text-[10px] font-semibold text-slate-500 uppercase mb-2">สัญญาณที่พบ</p>
          <ul className="space-y-1.5">
            {customer.reasons.map((r, i) => (
              <li key={i} className="text-xs text-slate-700 flex gap-2">
                <span className="text-gold-600">•</span><span>{r}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Sparkline */}
        <div className="mt-5">
          <p className="text-[10px] font-semibold text-slate-500 uppercase mb-1">รายได้ 6 เดือนล่าสุด</p>
          <div style={{ width: '100%', height: 120 }}>
            <ResponsiveContainer>
              <AreaChart data={customer.sparkline} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="hh" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0a3d2a" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#0a3d2a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" {...CLT_AXIS} />
                <YAxis {...CLT_AXIS} tickFormatter={(v) => fmt(v)} width={50} />
                <Tooltip {...CLT_TOOLTIP} formatter={(v: number) => [fmt(v), 'Revenue']} />
                <Area type="monotone" dataKey="revenue" stroke="#0a3d2a" strokeWidth={2} fill="url(#hh)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Numbers */}
        <div className="grid grid-cols-2 gap-3 mt-5 text-[11px]">
          <Stat label="Lifetime revenue" value={fmt(customer.totalLifetimeRevenue)} />
          <Stat label="Last order" value={`${customer.daysSinceLastOrder}d ago`} />
          <Stat label="Revenue 90d" value={fmt(customer.revenueLast90)} />
          <Stat label="Revenue prior 90d" value={fmt(customer.revenuePrior90)} />
          <Stat label="Orders 90d" value={String(customer.ordersLast90)} />
          <Stat label="Orders prior 90d" value={String(customer.ordersPrior90)} />
        </div>
      </aside>
    </div>
  )
}

function ScoreBar({ label, value, weight }: { label: string; value: number; weight: string }) {
  const color = value >= 80 ? 'bg-emerald-500'
    : value >= 60 ? 'bg-navy-700'
    : value >= 40 ? 'bg-gold-500'
    : 'bg-red-500'
  return (
    <div>
      <div className="flex items-center text-[10px] mb-0.5">
        <span className="flex-1 text-slate-700">{label}</span>
        <span className="text-slate-400 mr-2">w {weight}</span>
        <span className="font-bold font-num text-navy-900">{Math.round(value)}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <span className={`block h-full ${color} rounded-full transition-all`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-slate-500 uppercase">{label}</p>
      <p className="text-xs font-bold font-num text-navy-900">{value}</p>
    </div>
  )
}

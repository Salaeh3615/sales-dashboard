'use client'

/**
 * RunRateCard — Month-to-date projection card.
 * Shows MTD actual, pace-based EOM projection, and MoM / YoY delta,
 * with a mini cumulative line chart for the current month.
 */

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine,
} from 'recharts'
import type { RunRateResult } from '@/lib/calculations/insights'

function fmtMoney(n: number) {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `฿${(n / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `฿${(n / 1_000).toFixed(1)}K`
  return `฿${n.toFixed(0)}`
}

function fmtPct(n: number | null) {
  if (n === null || isNaN(n)) return '—'
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
}

function monthLabel(key: string) {
  const [y, m] = key.split('-')
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${MONTHS[parseInt(m) - 1]} ${y}`
}

export function RunRateCard({ data }: { data: RunRateResult }) {
  const progressPct = Math.round((data.currentDayOfMonth / data.daysInMonth) * 100)
  const mom = data.momDeltaPct
  const yoy = data.yoyDeltaPct

  const momPositive = mom === null ? null : mom >= 0
  const yoyPositive = yoy === null ? null : yoy >= 0

  // Project line for the remaining days
  const projectedSeries = [
    ...data.dailySeries,
    ...Array.from({ length: data.daysInMonth - data.currentDayOfMonth }, (_, i) => ({
      day: data.currentDayOfMonth + i + 1,
      revenue: data.avgDailyRate,
      cumulative: data.currentMTD + data.avgDailyRate * (i + 1),
    })),
  ]

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 hover-lift">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-1 h-4 bg-gold-500 rounded-full" />
            <h3 className="text-sm font-bold text-navy-900">
              Run-Rate · {monthLabel(data.currentMonth)}
            </h3>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Day {data.currentDayOfMonth}/{data.daysInMonth} ({progressPct}% elapsed)
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <DeltaPill label="vs prev month" pct={mom} positive={momPositive} />
          <DeltaPill label="vs same month last yr" pct={yoy} positive={yoyPositive} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <StatCell label="MTD actual" value={fmtMoney(data.currentMTD)} tone="navy" />
        <StatCell label="Projected EOM" value={fmtMoney(data.projectedEOM)} tone="gold" sub={`@ ฿${(data.avgDailyRate / 1000).toFixed(0)}K/day`} />
        <StatCell label="Prev month total" value={fmtMoney(data.previousMonthTotal)} tone="slate" sub={monthLabel(data.previousMonthLabel)} />
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-navy-700 to-gold-500 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Mini cumulative chart */}
      <div className="w-full h-[110px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={projectedSeries} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
            <XAxis
              dataKey="day"
              tick={{ fontSize: 9, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis hide />
            <Tooltip
              formatter={(v: number | string) => {
                const n = Number(v)
                return [fmtMoney(n), 'Cumulative']
              }}
              labelFormatter={(l) => `Day ${l}`}
              contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid #e2e8f0' }}
            />
            {/* Prev-month reference */}
            {data.previousMonthTotal > 0 && (
              <ReferenceLine
                y={data.previousMonthTotal}
                stroke="#94a3b8"
                strokeDasharray="3 3"
                label={{ value: 'Prev mo', position: 'right', fontSize: 9, fill: '#94a3b8' }}
              />
            )}
            {/* Actual — solid line up to today */}
            <Line
              type="monotone"
              dataKey="cumulative"
              stroke="#0a3d2a"
              strokeWidth={2}
              dot={false}
              data={projectedSeries.slice(0, data.currentDayOfMonth)}
            />
            {/* Projected — dashed */}
            <Line
              type="monotone"
              dataKey="cumulative"
              stroke="#FFCC00"
              strokeWidth={2}
              strokeDasharray="4 3"
              dot={false}
              data={projectedSeries.slice(data.currentDayOfMonth - 1)}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function DeltaPill({ label, pct, positive }: { label: string; pct: number | null; positive: boolean | null }) {
  const Icon = positive === null ? Minus : positive ? TrendingUp : TrendingDown
  const color = positive === null
    ? 'bg-slate-100 text-slate-500'
    : positive
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : 'bg-red-50 text-red-700 border-red-200'
  return (
    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${color}`}>
      <Icon size={10} />
      <span className="font-num">{fmtPct(pct)}</span>
      <span className="text-[9px] opacity-70 font-normal ml-1">{label}</span>
    </div>
  )
}

function StatCell({ label, value, tone, sub }: {
  label: string; value: string; tone: 'navy' | 'gold' | 'slate'; sub?: string
}) {
  const tones = {
    navy:  { bg: 'bg-navy-50',  text: 'text-navy-900',  strip: 'bg-navy-700' },
    gold:  { bg: 'bg-gold-50',  text: 'text-gold-800',  strip: 'bg-gold-500' },
    slate: { bg: 'bg-slate-50', text: 'text-slate-800', strip: 'bg-slate-400' },
  }
  const t = tones[tone]
  return (
    <div className={`relative rounded-xl p-3 overflow-hidden ${t.bg}`}>
      <span className={`absolute left-0 top-2 bottom-2 w-1 rounded-full ${t.strip}`} />
      <p className="text-[10px] text-navy-700 font-semibold uppercase tracking-wider pl-1">{label}</p>
      <p className={`text-base font-bold mt-0.5 pl-1 font-num ${t.text}`}>{value}</p>
      {sub && <p className="text-[9px] text-slate-400 mt-0.5 pl-1">{sub}</p>}
    </div>
  )
}

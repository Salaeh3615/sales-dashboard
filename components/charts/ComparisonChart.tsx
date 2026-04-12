'use client'

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'

const YEAR_COLORS = [
  '#3b82f6', '#7c3aed', '#0d9488', '#f59e0b',
  '#ef4444', '#8b5cf6', '#06b6d4',
]

function fmtY(v: number) {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}

function fmtTooltip(v: number | string) {
  const n = Number(v)
  return isNaN(n)
    ? String(v)
    : `฿${n.toLocaleString(undefined, { minimumFractionDigits: 0 })}`
}

/** Quarter comparison across years */
export function QuarterComparisonChart({
  data,
  years,
}: {
  data: { quarter: string; [year: string]: number | string }[]
  years: number[]
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <p className="text-sm font-semibold text-slate-700 mb-4">Quarterly Comparison by Year</p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="quarter"
            tick={{ fontSize: 12, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={fmtY}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            width={55}
          />
          <Tooltip
            formatter={(v, name) => [fmtTooltip(v as number), name]}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(v) => <span style={{ fontSize: 11, color: '#475569' }}>{v}</span>}
          />
          {years.map((y, i) => (
            <Bar
              key={y}
              dataKey={String(y)}
              fill={YEAR_COLORS[i % YEAR_COLORS.length]}
              radius={[3, 3, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Month comparison across years */
export function MonthComparisonChart({
  data,
  years,
}: {
  data: { month: string; [year: string]: number | string }[]
  years: number[]
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <p className="text-sm font-semibold text-slate-700 mb-4">Monthly Comparison by Year</p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={fmtY}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            width={55}
          />
          <Tooltip
            formatter={(v, name) => [fmtTooltip(v as number), name]}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(v) => <span style={{ fontSize: 11, color: '#475569' }}>{v}</span>}
          />
          {years.map((y, i) => (
            <Bar
              key={y}
              dataKey={String(y)}
              fill={YEAR_COLORS[i % YEAR_COLORS.length]}
              radius={[3, 3, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Simple year-over-year bar */
export function YearComparisonChart({
  data,
}: {
  data: { year: number; revenue: number }[]
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <p className="text-sm font-semibold text-slate-700 mb-4">Annual Revenue Comparison</p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart
          data={data}
          margin={{ top: 5, right: 10, bottom: 5, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 12, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={fmtY}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            width={60}
          />
          <Tooltip
            formatter={(v) => [fmtTooltip(v as number), 'Revenue']}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
          />
          <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={YEAR_COLORS[i % YEAR_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

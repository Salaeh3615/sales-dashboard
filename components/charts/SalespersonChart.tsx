'use client'

import type { EntityRevenue } from '@/types'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'

const COLORS = [
  '#3b82f6', '#7c3aed', '#0d9488', '#f59e0b',
  '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16',
  '#f97316', '#ec4899', '#14b8a6', '#a855f7',
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

/** Top-N bar chart, horizontal layout for readability */
export function SalespersonBarChart({
  data,
  topN = 10,
}: {
  data: EntityRevenue[]
  topN?: number
}) {
  const slice = data.slice(0, topN)
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <p className="text-sm font-semibold text-slate-700 mb-4">
        Top {topN} Salesperson Revenue
      </p>
      <ResponsiveContainer width="100%" height={Math.max(220, slice.length * 34)}>
        <BarChart
          data={slice}
          layout="vertical"
          margin={{ top: 5, right: 10, bottom: 5, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
          <XAxis
            type="number"
            tickFormatter={fmtY}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fill: '#475569' }}
            tickLine={false}
            axisLine={false}
            width={120}
          />
          <Tooltip
            formatter={(v) => [fmtTooltip(v as number), 'Revenue']}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
          />
          <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
            {slice.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Pie chart for top-N share */
export function SalespersonPieChart({
  data,
  topN = 8,
}: {
  data: EntityRevenue[]
  topN?: number
}) {
  const positive = data.filter((d) => d.revenue > 0)
  const top = positive.slice(0, topN)
  const rest = positive.slice(topN)
  const chartData =
    rest.length > 0
      ? [
          ...top,
          {
            name: `Others (${rest.length})`,
            revenue: rest.reduce((s, r) => s + r.revenue, 0),
            share: rest.reduce((s, r) => s + r.share, 0),
            count: rest.reduce((s, r) => s + r.count, 0),
          },
        ]
      : top

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <p className="text-sm font-semibold text-slate-700 mb-4">
        Salesperson Revenue Share (Top {topN})
      </p>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="revenue"
            nameKey="name"
            cx="50%"
            cy="45%"
            outerRadius={95}
            innerRadius={50}
            paddingAngle={2}
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v) => [fmtTooltip(v as number), 'Revenue']}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(v) => (
              <span style={{ fontSize: 10, color: '#475569' }}>
                {String(v).length > 18 ? String(v).slice(0, 18) + '…' : v}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

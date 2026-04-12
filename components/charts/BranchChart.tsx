'use client'

import type { EntityRevenue, TimePoint } from '@/types'
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
  LineChart,
  Line,
} from 'recharts'

const COLORS = [
  '#3b82f6', '#7c3aed', '#0d9488', '#f59e0b',
  '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16',
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

export function BranchBarChart({ data }: { data: EntityRevenue[] }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <p className="text-sm font-semibold text-slate-700 mb-4">Branch Revenue Comparison</p>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart
          data={data}
          margin={{ top: 5, right: 10, bottom: 5, left: 0 }}
          layout="vertical"
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
            tick={{ fontSize: 12, fill: '#475569' }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip
            formatter={(v) => [fmtTooltip(v as number), 'Revenue']}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
          />
          <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function BranchPieChart({ data }: { data: EntityRevenue[] }) {
  const positive = data.filter((d) => d.revenue > 0)
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <p className="text-sm font-semibold text-slate-700 mb-4">Branch Revenue Share</p>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={positive}
            dataKey="revenue"
            nameKey="name"
            cx="50%"
            cy="45%"
            outerRadius={90}
            innerRadius={50}
            paddingAngle={2}
            label={({ name, share }) => `${name} ${share.toFixed(0)}%`}
            labelLine={false}
          >
            {positive.map((_, i) => (
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
            formatter={(v) => <span style={{ fontSize: 11, color: '#475569' }}>{v}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export function BranchTrendChart({
  data,
  branches,
}: {
  data: { label: string; [branch: string]: number | string }[]
  branches: string[]
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <p className="text-sm font-semibold text-slate-700 mb-4">Branch Revenue Over Time</p>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
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
          {branches.map((b, i) => (
            <Line
              key={b}
              type="monotone"
              dataKey={b}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

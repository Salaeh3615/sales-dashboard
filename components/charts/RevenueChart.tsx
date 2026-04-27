'use client'

import type { TimePoint } from '@/types'
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { CLT_AXIS, CLT_TOOLTIP, fmtY, fmtCurrency } from '@/lib/chartTheme'

interface RevenueChartProps {
  monthly: TimePoint[]
  quarterly: TimePoint[]
  yearly: TimePoint[]
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 hover-lift">
      <p className="text-sm font-semibold text-navy-900 mb-4">{title}</p>
      {children}
    </div>
  )
}

export function RevenueChart({ monthly, quarterly, yearly }: RevenueChartProps) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <ChartCard title="Monthly Revenue Trend">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={monthly} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <defs>
              <linearGradient id="gradNavy" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#0a3d2a" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#0a3d2a" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CLT_AXIS.grid} />
            <XAxis dataKey="label" tick={CLT_AXIS.tick} tickLine={CLT_AXIS.tickLine} axisLine={CLT_AXIS.axisLine} interval="preserveStartEnd" />
            <YAxis tickFormatter={fmtY} tick={CLT_AXIS.tick} tickLine={CLT_AXIS.tickLine} axisLine={CLT_AXIS.axisLine} width={55} />
            <Tooltip formatter={(v) => [fmtCurrency(v as number), 'Revenue']} {...CLT_TOOLTIP} />
            <Area type="monotone" dataKey="revenue" stroke="#0a3d2a" strokeWidth={2.5} fill="url(#gradNavy)" dot={false} activeDot={{ r: 4, fill: '#0a3d2a' }} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Quarterly Revenue Trend">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={quarterly} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <defs>
              <linearGradient id="gradGold" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#FFCC00" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#FFCC00" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CLT_AXIS.grid} />
            <XAxis dataKey="label" tick={CLT_AXIS.tick} tickLine={CLT_AXIS.tickLine} axisLine={CLT_AXIS.axisLine} />
            <YAxis tickFormatter={fmtY} tick={CLT_AXIS.tick} tickLine={CLT_AXIS.tickLine} axisLine={CLT_AXIS.axisLine} width={55} />
            <Tooltip formatter={(v) => [fmtCurrency(v as number), 'Revenue']} {...CLT_TOOLTIP} />
            <Area type="monotone" dataKey="revenue" stroke="#d9a900" strokeWidth={2.5} fill="url(#gradGold)" dot={false} activeDot={{ r: 4, fill: '#FFCC00' }} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Annual Revenue">
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={yearly} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <defs>
              <linearGradient id="gradAnnual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#0a3d2a" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#FFCC00" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CLT_AXIS.grid} />
            <XAxis dataKey="label" tick={{ ...CLT_AXIS.tick, fontSize: 12 }} tickLine={CLT_AXIS.tickLine} axisLine={CLT_AXIS.axisLine} />
            <YAxis tickFormatter={fmtY} tick={CLT_AXIS.tick} tickLine={CLT_AXIS.tickLine} axisLine={CLT_AXIS.axisLine} width={55} />
            <Tooltip formatter={(v) => [fmtCurrency(v as number), 'Revenue']} {...CLT_TOOLTIP} />
            <Area type="monotone" dataKey="revenue" stroke="#0a3d2a" strokeWidth={2.5} fill="url(#gradAnnual)" dot={{ r: 5, fill: '#FFCC00', stroke: '#0a3d2a', strokeWidth: 2 }} activeDot={{ r: 6 }} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}

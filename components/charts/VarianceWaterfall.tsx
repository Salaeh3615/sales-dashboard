'use client'

/**
 * VarianceWaterfall — Month-by-month variance (actual − target) with a
 * cumulative line overlay.  Positive months rise; negative months drop;
 * the line shows running YTD gap.
 */

import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Cell,
} from 'recharts'
import { CLT_AXIS, CLT_TOOLTIP, fmtY, fmtCurrency } from '@/lib/chartTheme'

type Point = { month: number; label: string; variance: number; cumulative: number }

export function VarianceWaterfall({ data }: { data: Point[] }) {
  if (data.length === 0) {
    return <p className="text-xs text-slate-400 py-10 text-center">No variance data yet.</p>
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
        <XAxis dataKey="label" {...CLT_AXIS} />
        <YAxis
          yAxisId="left"
          tickFormatter={fmtY}
          {...CLT_AXIS}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tickFormatter={fmtY}
          {...CLT_AXIS}
        />
        <Tooltip
          {...CLT_TOOLTIP}
          formatter={(v: number, name: string) => [fmtCurrency(v), name]}
        />
        <ReferenceLine yAxisId="left" y={0} stroke="#94A3B8" strokeWidth={1.5} />
        <Bar yAxisId="left" dataKey="variance" name="Monthly variance" radius={[6, 6, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.variance >= 0 ? '#10B981' : '#EF4444'} />
          ))}
        </Bar>
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="cumulative"
          name="Cumulative gap"
          stroke="#0a3d2a"
          strokeWidth={2.5}
          dot={{ r: 4, fill: '#FFCC00', stroke: '#0a3d2a', strokeWidth: 2 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}

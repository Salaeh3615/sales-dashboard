'use client'

import type { EntityRevenue } from '@/types'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface RankingTableProps {
  title: string
  data: EntityRevenue[]
  topN?: number
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `฿${(n / 1_000_000).toFixed(2)}M`
  if (Math.abs(n) >= 1_000) return `฿${(n / 1_000).toFixed(1)}K`
  return `฿${n.toLocaleString()}`
}

export function RankingTable({ title, data, topN = 20 }: RankingTableProps) {
  const rows = data.slice(0, topN)
  const max = rows[0]?.revenue ?? 1

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 w-8">#</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Name</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">Revenue</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 w-16">Share</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 w-20">Txns</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 w-32"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const pct = max !== 0 ? (row.revenue / Math.abs(max)) * 100 : 0
              const isNeg = row.revenue < 0
              return (
                <tr
                  key={i}
                  className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                >
                  <td className="px-4 py-2.5 text-slate-400 text-xs font-medium">{i + 1}</td>
                  <td className="px-4 py-2.5 text-slate-800 font-medium text-xs max-w-[180px] truncate">
                    {row.name}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right text-xs font-semibold tabular-nums ${
                      isNeg ? 'text-red-500' : 'text-slate-800'
                    }`}
                  >
                    {fmt(row.revenue)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs text-slate-500 tabular-nums">
                    {row.share.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs text-slate-500 tabular-nums">
                    {row.count.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${isNeg ? 'bg-red-400' : 'bg-blue-500'}`}
                        style={{ width: `${Math.min(Math.abs(pct), 100)}%` }}
                      />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

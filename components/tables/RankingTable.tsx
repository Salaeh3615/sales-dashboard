'use client'

import type { EntityRevenue } from '@/types'

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
    <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden hover-lift">
      <div className="px-5 py-4 bg-gradient-to-r from-navy-900 to-navy-700">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <span className="inline-block w-1 h-4 bg-gold-500 rounded-full" />
          {title}
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-navy-700 w-8">#</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-navy-700">Name</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-navy-700">Revenue</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-navy-700 w-16">Share</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-navy-700 w-20">Txns</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-navy-700 w-32"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const pct = max !== 0 ? (row.revenue / Math.abs(max)) * 100 : 0
              const isNeg = row.revenue < 0
              const isTop3 = i < 3
              return (
                <tr
                  key={i}
                  className="border-b border-slate-50 hover:bg-navy-50/40 transition-colors"
                >
                  <td className="px-4 py-2.5 text-xs font-semibold tabular-nums">
                    {isTop3 ? (
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 text-navy-900 text-[10px] font-bold shadow-sm">
                        {i + 1}
                      </span>
                    ) : (
                      <span className="text-slate-400">{i + 1}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-navy-900 font-medium text-xs max-w-[180px] truncate">
                    {row.name}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right text-xs font-semibold tabular-nums font-num ${
                      isNeg ? 'text-red-500' : 'text-navy-900'
                    }`}
                  >
                    {fmt(row.revenue)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs text-slate-500 tabular-nums font-num">
                    {row.share.toFixed(1)}%
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs text-slate-500 tabular-nums font-num">
                    {row.count.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          isNeg
                            ? 'bg-red-400'
                            : isTop3
                              ? 'bg-gradient-to-r from-navy-900 to-gold-500'
                              : 'bg-navy-600'
                        }`}
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

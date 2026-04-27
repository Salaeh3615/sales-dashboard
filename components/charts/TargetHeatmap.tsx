'use client'

/**
 * TargetHeatmap — Branch × Month attainment grid.
 *
 * Cells are colored by attainment percentage:
 *   ≥100% → emerald
 *   95-99 → navy
 *   85-94 → gold
 *   <85   → red
 * Future/empty months are rendered in slate.
 */

type Cell = { month: number; attainmentPct: number; actual: number; target: number }

type Props = {
  rows: { branch: string; cells: Cell[] }[]
  anchorMonth: number
}

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

function colorClasses(pct: number, isFuture: boolean, hasTarget: boolean): string {
  if (isFuture || !hasTarget) return 'bg-slate-50 text-slate-300'
  if (pct >= 100) return 'bg-emerald-500 text-white'
  if (pct >= 95)  return 'bg-navy-700 text-white'
  if (pct >= 85)  return 'bg-gold-400 text-navy-900'
  if (pct > 0)    return 'bg-red-400 text-white'
  return 'bg-slate-100 text-slate-400'
}

function fmtMoney(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `฿${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `฿${(n / 1_000).toFixed(0)}K`
  return `฿${n.toFixed(0)}`
}

export function TargetHeatmap({ rows, anchorMonth }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="text-[11px] border-separate" style={{ borderSpacing: '2px' }}>
        <thead>
          <tr>
            <th className="sticky left-0 bg-white text-left text-navy-700 font-semibold px-2 py-1 z-10 whitespace-nowrap">
              Branch
            </th>
            {MONTHS.map((m, i) => {
              const monthNum = i + 1
              return (
                <th
                  key={i}
                  className={`font-semibold px-1 py-1 text-center ${monthNum === anchorMonth ? 'text-gold-600' : 'text-navy-700'}`}
                >
                  {m}
                </th>
              )
            })}
            <th className="px-2 py-1 text-navy-700 font-semibold">YTD</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const ytdActual = row.cells.slice(0, anchorMonth).reduce((s, c) => s + c.actual, 0)
            const ytdTarget = row.cells.slice(0, anchorMonth).reduce((s, c) => s + c.target, 0)
            const ytdPct = ytdTarget > 0 ? (ytdActual / ytdTarget) * 100 : 0
            return (
              <tr key={row.branch}>
                <td className="sticky left-0 bg-white px-2 py-1 font-semibold text-navy-900 z-10 whitespace-nowrap">
                  {row.branch}
                </td>
                {row.cells.map((c) => {
                  const isFuture = c.month > anchorMonth
                  const hasTarget = c.target > 0
                  return (
                    <td key={c.month} className="p-0">
                      <div
                        className={`w-10 h-10 rounded-md flex items-center justify-center font-semibold font-num transition-all hover:scale-110 hover:shadow-md cursor-default ${colorClasses(c.attainmentPct, isFuture, hasTarget)}`}
                        title={`${row.branch} · Month ${c.month}\nTarget: ${fmtMoney(c.target)}\nActual: ${fmtMoney(c.actual)}\nAttainment: ${c.attainmentPct.toFixed(1)}%`}
                      >
                        {isFuture || !hasTarget ? '–' : `${Math.round(c.attainmentPct)}`}
                      </div>
                    </td>
                  )
                })}
                <td className={`px-2 py-1 text-center font-bold font-num rounded-md ${colorClasses(ytdPct, false, ytdTarget > 0)}`}>
                  {ytdPct.toFixed(0)}%
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 text-[10px] text-slate-500">
        <LegendDot className="bg-emerald-500" label="≥100%" />
        <LegendDot className="bg-navy-700" label="95-99%" />
        <LegendDot className="bg-gold-400" label="85-94%" />
        <LegendDot className="bg-red-400" label="<85%" />
        <LegendDot className="bg-slate-100 border border-slate-200" label="Future / No target" />
      </div>
    </div>
  )
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`inline-block w-3 h-3 rounded-sm ${className}`} />
      {label}
    </span>
  )
}

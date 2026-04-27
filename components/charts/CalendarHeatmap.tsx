'use client'

/**
 * CalendarHeatmap — GitHub-style daily revenue grid.
 * Renders one cell per day, coloured by revenue intensity (navy scale),
 * grouped into weeks (Mon → Sun) with month labels along the top.
 */

import { useMemo, useState } from 'react'
import type { DailyPoint } from '@/lib/calculations/insights'

interface Props {
  data: DailyPoint[]
  metricLabel?: string
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const DAY_NAMES = ['Mon', '', 'Wed', '', 'Fri', '', '']

function fmtMoney(n: number) {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `฿${(n / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `฿${(n / 1_000).toFixed(1)}K`
  return `฿${n.toFixed(0)}`
}

function parseISO(d: string): Date {
  // Treat as local date (avoid timezone shifts)
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day)
}

export function CalendarHeatmap({ data, metricLabel = 'Revenue' }: Props) {
  const [hover, setHover] = useState<DailyPoint | null>(null)

  const { weeks, maxRev, totalRev, activeDays, monthLabels } = useMemo(() => {
    if (data.length === 0) {
      return { weeks: [], maxRev: 0, totalRev: 0, activeDays: 0, monthLabels: [] }
    }

    const byDate = new Map(data.map((d) => [d.date, d]))
    const sortedDates = data.map((d) => d.date).sort()
    const start = parseISO(sortedDates[0])
    const end = parseISO(sortedDates[sortedDates.length - 1])

    // Snap start to Monday
    const startCol = new Date(start)
    const dow = (startCol.getDay() + 6) % 7  // Mon=0
    startCol.setDate(startCol.getDate() - dow)

    // Snap end to Sunday
    const endCol = new Date(end)
    const dowEnd = (endCol.getDay() + 6) % 7
    endCol.setDate(endCol.getDate() + (6 - dowEnd))

    const weeks: (DailyPoint | null)[][] = []
    const monthSet = new Map<number, string>()  // week index → month name
    let cur = new Date(startCol)
    let weekIdx = 0
    while (cur <= endCol) {
      const week: (DailyPoint | null)[] = []
      for (let i = 0; i < 7; i++) {
        const iso = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
        const inRange = cur >= start && cur <= end
        const point = inRange ? (byDate.get(iso) ?? { date: iso, revenue: 0, count: 0 }) : null
        week.push(point)
        if (inRange && cur.getDate() === 1) {
          monthSet.set(weekIdx, MONTH_NAMES[cur.getMonth()])
        }
        cur.setDate(cur.getDate() + 1)
      }
      weeks.push(week)
      weekIdx += 1
    }

    const revs = data.map((d) => d.revenue).filter((v) => v > 0)
    const maxRev = revs.length > 0 ? Math.max(...revs) : 0
    const totalRev = data.reduce((s, d) => s + d.revenue, 0)
    const activeDays = data.filter((d) => d.revenue > 0).length

    const monthLabels = [...monthSet.entries()].map(([idx, name]) => ({ idx, name }))

    return { weeks, maxRev, totalRev, activeDays, monthLabels }
  }, [data])

  const intensity = (rev: number): string => {
    if (rev <= 0) return 'bg-slate-100'
    const ratio = Math.min(1, rev / (maxRev || 1))
    // 5-step navy scale
    if (ratio < 0.2) return 'bg-navy-100'
    if (ratio < 0.4) return 'bg-navy-300'
    if (ratio < 0.6) return 'bg-navy-500'
    if (ratio < 0.8) return 'bg-navy-700'
    return 'bg-navy-900'
  }

  if (weeks.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 text-xs text-slate-400 text-center">
        No daily data to display.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-5 hover-lift">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="inline-block w-1 h-4 bg-gold-500 rounded-full" />
          <h3 className="text-sm font-bold text-navy-900">Daily Activity Heatmap</h3>
        </div>
        <div className="text-xs text-slate-500 font-num">
          <span className="font-semibold text-navy-900">{activeDays}</span> active days
          · total <span className="font-semibold text-navy-900">{fmtMoney(totalRev)}</span>
        </div>
      </div>

      <div className="relative overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Month labels */}
          <div className="flex gap-[3px] pl-8 mb-1">
            {weeks.map((_, i) => {
              const label = monthLabels.find((m) => m.idx === i)
              return (
                <div key={i} className="w-[11px] text-[9px] text-slate-400 font-semibold">
                  {label?.name ?? ''}
                </div>
              )
            })}
          </div>

          <div className="flex gap-[3px]">
            {/* Day-of-week labels */}
            <div className="flex flex-col gap-[3px] pr-1 pt-0">
              {DAY_NAMES.map((d, i) => (
                <div key={i} className="h-[11px] text-[9px] text-slate-400 w-6 leading-[11px]">
                  {d}
                </div>
              ))}
            </div>

            {/* Grid */}
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map((d, di) => {
                  if (!d) {
                    return <div key={di} className="w-[11px] h-[11px]" />
                  }
                  return (
                    <div
                      key={di}
                      onMouseEnter={() => setHover(d)}
                      onMouseLeave={() => setHover(null)}
                      className={`w-[11px] h-[11px] rounded-[2px] ${intensity(d.revenue)}
                        hover:ring-2 hover:ring-gold-400 transition-all cursor-pointer`}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between mt-4 text-[10px] text-slate-500">
        <div className="h-4 text-xs">
          {hover ? (
            <span className="font-num">
              <strong className="text-navy-900">{hover.date}</strong>
              {' · '}
              {fmtMoney(hover.revenue)}
              {' · '}
              {hover.count.toLocaleString()} txn
            </span>
          ) : (
            <span className="text-slate-400">Hover to inspect a day</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span>Less</span>
          <div className="w-[11px] h-[11px] rounded-[2px] bg-slate-100" />
          <div className="w-[11px] h-[11px] rounded-[2px] bg-navy-100" />
          <div className="w-[11px] h-[11px] rounded-[2px] bg-navy-300" />
          <div className="w-[11px] h-[11px] rounded-[2px] bg-navy-500" />
          <div className="w-[11px] h-[11px] rounded-[2px] bg-navy-700" />
          <div className="w-[11px] h-[11px] rounded-[2px] bg-navy-900" />
          <span>More · {metricLabel}</span>
        </div>
      </div>
    </div>
  )
}

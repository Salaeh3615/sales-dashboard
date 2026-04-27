/**
 * chartTheme.ts — Shared Recharts styling for CLT brand
 *
 * Deep emerald (#0a3d2a) + Gold (#FFCC00) — luxury brand palette.
 * Use CLT_COLORS for categorical data, CLT_SINGLE for single-series accents.
 */

export const CLT_COLORS = [
  '#0a3d2a', // emerald 900 (primary)
  '#FFCC00', // gold 500 (accent)
  '#1c6c4c', // emerald 600
  '#d9a900', // gold 600
  '#4ba078', // emerald 400
  '#ffd11a', // gold 400
  '#2d8660', // emerald 500
  '#13543c', // emerald 700
] as const

export const CLT_SINGLE = {
  primary: '#0a3d2a',    // emerald
  accent:  '#FFCC00',    // gold
  support: '#13543c',    // emerald light
  success: '#10b981',    // emerald 500
  danger:  '#ef4444',    // red 500
  warning: '#f59e0b',    // amber 500
} as const

export const CLT_AXIS = {
  tick:      { fontSize: 11, fill: '#64748b' },
  tickLine:  false as const,
  axisLine:  false as const,
  grid:      '#f1f5f9',
}

export const CLT_TOOLTIP = {
  contentStyle: {
    fontSize:     12,
    borderRadius: 10,
    border:       '1px solid #e2e8f0',
    boxShadow:    '0 4px 12px rgba(10, 61, 42, 0.08)',
    background:   '#ffffff',
    padding:      '8px 12px',
  },
  labelStyle:  { color: '#0a3d2a', fontWeight: 600 },
  itemStyle:   { color: '#475569' },
}

export const CLT_LEGEND = {
  iconType: 'circle' as const,
  iconSize: 8,
  formatter: (value: string) => `<span style="font-size:11px;color:#475569">${value}</span>`,
}

// Helper — formatters used across charts
export function fmtY(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `${(v / 1_000).toFixed(0)}K`
  return String(v)
}

export function fmtCurrency(v: number | string): string {
  const n = Number(v)
  return isNaN(n)
    ? String(v)
    : `฿${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

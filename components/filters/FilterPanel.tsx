'use client'

import { DashboardFilters, FilterOptions, RevenueMetric } from '@/types'
import { ChevronDown, ChevronUp, X, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'

interface FilterPanelProps {
  options: FilterOptions
  filters: DashboardFilters
  onChange: (filters: DashboardFilters) => void
}

type Section = 'period' | 'scope' | 'advanced'

// ─── Small helpers ────────────────────────────────────────────────────────────

function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: { value: string | number; label: string }[]
  selected: (string | number)[]
  onChange: (vals: (string | number)[]) => void
}) {
  const toggle = (val: string | number) => {
    onChange(
      selected.includes(val) ? selected.filter((v) => v !== val) : [...selected, val],
    )
  }
  const isAll = selected.length === 0

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold text-navy-700 uppercase tracking-wider">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => onChange([])}
          className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
            isAll
              ? 'bg-navy-900 text-gold-400 border-navy-900 shadow-sm'
              : 'bg-white text-slate-600 border-slate-200 hover:border-navy-400 hover:text-navy-900'
          }`}
        >
          All
        </button>
        {options.map((opt) => {
          const active = selected.includes(opt.value)
          return (
            <button
              key={opt.value}
              onClick={() => toggle(opt.value)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                active
                  ? 'bg-navy-900 text-gold-400 border-navy-900 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-navy-400 hover:text-navy-900'
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FilterPanel({ options, filters, onChange }: FilterPanelProps) {
  const [open, setOpen] = useState<Section[]>(['period', 'scope'])

  const toggle = (s: Section) =>
    setOpen((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))

  const isOpen = (s: Section) => open.includes(s)

  const setField = <K extends keyof DashboardFilters>(key: K, val: DashboardFilters[K]) =>
    onChange({ ...filters, [key]: val })

  const hasActiveFilters =
    filters.years.length ||
    filters.quarters.length ||
    filters.months.length ||
    filters.branches.length ||
    filters.salespersons.length ||
    filters.documentTypes.length ||
    filters.customerGroups.length

  const clearAll = () =>
    onChange({
      years: [],
      quarters: [],
      months: [],
      branches: [],
      salespersons: [],
      documentTypes: [],
      customerGroups: [],
      revenueMetric: filters.revenueMetric,
    })

  const MONTH_NAMES = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ]

  return (
    <aside className="w-72 shrink-0 bg-white border border-slate-200 rounded-2xl shadow-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-navy-900 to-navy-700">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <SlidersHorizontal size={14} className="text-gold-400" />
          Filters
        </h2>
        {hasActiveFilters ? (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 text-xs text-gold-300 hover:text-gold-400 transition-colors"
          >
            <X size={12} /> Clear all
          </button>
        ) : null}
      </div>

      {/* Revenue metric selector */}
      <div className="px-4 py-3 border-b border-slate-100 space-y-1.5 bg-slate-50/60">
        <p className="text-[10px] font-semibold text-navy-700 uppercase tracking-wider">Revenue metric</p>
        <div className="flex gap-1.5">
          {(['netAmount', 'grossAmount', 'lineAmount'] as RevenueMetric[]).map((m) => (
            <button
              key={m}
              onClick={() => setField('revenueMetric', m)}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium border transition-all ${
                filters.revenueMetric === m
                  ? 'bg-navy-900 text-gold-400 border-navy-900 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-navy-400 hover:text-navy-900'
              }`}
            >
              {m === 'netAmount' ? 'Net' : m === 'grossAmount' ? 'Gross' : 'Line'}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-y-auto max-h-[calc(100vh-220px)]">
        {/* Period section */}
        <Section
          title="Period"
          id="period"
          open={isOpen('period')}
          onToggle={() => toggle('period')}
        >
          <MultiSelect
            label="Year"
            options={options.years.map((y) => ({ value: y, label: String(y) }))}
            selected={filters.years}
            onChange={(v) => setField('years', v as number[])}
          />
          <MultiSelect
            label="Quarter"
            options={['Q1', 'Q2', 'Q3', 'Q4'].map((q) => ({ value: q, label: q }))}
            selected={filters.quarters}
            onChange={(v) => setField('quarters', v as string[])}
          />
          <MultiSelect
            label="Month"
            options={options.months.map((m) => ({ value: m.number, label: MONTH_NAMES[m.number - 1] }))}
            selected={filters.months}
            onChange={(v) => setField('months', v as number[])}
          />
        </Section>

        {/* Scope section */}
        <Section
          title="Scope"
          id="scope"
          open={isOpen('scope')}
          onToggle={() => toggle('scope')}
        >
          <MultiSelect
            label="Branch"
            options={options.branches.map((b) => ({ value: b, label: b }))}
            selected={filters.branches}
            onChange={(v) => setField('branches', v as string[])}
          />
          <MultiSelect
            label="Salesperson"
            options={options.salespersons.map((s) => ({ value: s, label: s }))}
            selected={filters.salespersons}
            onChange={(v) => setField('salespersons', v as string[])}
          />
        </Section>

        {/* Advanced section */}
        {(options.documentTypes.length > 0 || options.customerGroups.length > 0) && (
          <Section
            title="Advanced"
            id="advanced"
            open={isOpen('advanced')}
            onToggle={() => toggle('advanced')}
          >
            {options.documentTypes.length > 0 && (
              <MultiSelect
                label="Document Type"
                options={options.documentTypes.map((d) => ({ value: d, label: d }))}
                selected={filters.documentTypes}
                onChange={(v) => setField('documentTypes', v as string[])}
              />
            )}
            {options.customerGroups.length > 0 && (
              <MultiSelect
                label="Customer Group"
                options={options.customerGroups.map((g) => ({ value: g, label: g }))}
                selected={filters.customerGroups}
                onChange={(v) => setField('customerGroups', v as string[])}
              />
            )}
          </Section>
        )}
      </div>
    </aside>
  )
}

function Section({
  title,
  id,
  open,
  onToggle,
  children,
}: {
  title: string
  id: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-navy-50/50 transition-colors"
      >
        <span className="text-sm font-semibold text-navy-900">{title}</span>
        {open
          ? <ChevronUp size={14} className="text-navy-600" />
          : <ChevronDown size={14} className="text-slate-400" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-4">{children}</div>}
    </div>
  )
}

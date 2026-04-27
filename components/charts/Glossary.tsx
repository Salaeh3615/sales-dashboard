'use client'

/**
 * Glossary — A lightweight collapsible help panel that explains the
 * iconography and calculation rules used across the dashboard.  Drop this
 * into any page where the symbols or color-coded cells may be ambiguous.
 */

import { useState } from 'react'
import { Info, ChevronDown, ChevronUp } from 'lucide-react'

type Item = {
  symbol: React.ReactNode
  title: string
  body: string
}

const DEFAULT_ITEMS: Item[] = [
  {
    symbol: <span className="text-red-500 font-bold">!</span>,
    title: 'Attention marker (major outlier)',
    body: 'ค่ามากกว่า 2× ของค่าเฉลี่ย (major outlier ตาม Tukey rule) เช่น อัตราส่วนลดของเซลส์คนนี้สูงกว่าค่าเฉลี่ยทั้งทีม 2 เท่า ควรติดตามสาเหตุ (ราคา contract / ส่วนลดพิเศษ / ลูกค้าต่อรอง)',
  },
  {
    symbol: <span className="text-emerald-600 font-bold">✓</span>,
    title: 'Replacement check',
    body: 'เซลส์ชดเชยรายได้ที่เสียไปจากลูกค้าเก่าได้ ≥ 100% ด้วยลูกค้าใหม่/เติบโตของลูกค้าเดิม',
  },
  {
    symbol: <span className="inline-block w-3 h-3 rounded-sm bg-emerald-500" />,
    title: 'Attainment ≥ 100%',
    body: 'ทำได้ถึงหรือเกินเป้าของเดือน/YTD',
  },
  {
    symbol: <span className="inline-block w-3 h-3 rounded-sm bg-navy-700" />,
    title: 'Attainment 95–99%',
    body: 'ใกล้ถึงเป้า (On Track)',
  },
  {
    symbol: <span className="inline-block w-3 h-3 rounded-sm bg-gold-400" />,
    title: 'Attainment 85–94%',
    body: 'ต่ำกว่าเป้า เล็กน้อย (Behind) ควรเร่งในเดือนถัดไป',
  },
  {
    symbol: <span className="inline-block w-3 h-3 rounded-sm bg-red-400" />,
    title: 'Attainment < 85%',
    body: 'ต่ำกว่าเป้ามาก (At Risk) ต้องมี action plan',
  },
  {
    symbol: <span className="text-gold-600 font-mono text-xs">EOY proj.</span>,
    title: 'End-of-Year projection',
    body: 'ประมาณการรายได้สิ้นปี: รายได้เดือนที่ผ่านมา (จริง) + ประมาณการเดือนปัจจุบัน (actual × จำนวนวันทั้งเดือน ÷ วันที่ข้อมูลล่าสุด) + เป้าของเดือนที่เหลือ',
  },
  {
    symbol: <span className="text-navy-700 font-mono text-xs">Run-rate</span>,
    title: 'Required daily run-rate',
    body: 'รายได้เฉลี่ยต่อวันที่ต้องทำให้ได้ในวันที่เหลือของเดือน เพื่อให้ครบเป้าของเดือนนั้น (เป้า − รายได้ MTD) ÷ วันที่เหลือ',
  },
  {
    symbol: <span className="text-emerald-600 font-mono text-xs">Pace 1.0×</span>,
    title: 'Pace multiplier',
    body: 'เปรียบเทียบ avg daily rate ปัจจุบัน กับ required daily rate: 1.0 = ทันเป้า, >1.0 = เร็วกว่าเป้า, <1.0 = ช้ากว่าเป้า',
  },
]

export function Glossary({
  items = DEFAULT_ITEMS,
  defaultOpen = false,
  title = 'How to read this dashboard',
}: {
  items?: Item[]
  defaultOpen?: boolean
  title?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-gradient-to-br from-navy-50 to-white rounded-2xl border border-navy-100 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-navy-50/60 transition-colors"
      >
        <span className="p-1.5 rounded-lg bg-navy-900 text-gold-400">
          <Info size={14} />
        </span>
        <p className="flex-1 text-sm font-semibold text-navy-900">{title}</p>
        <span className="text-xs text-slate-500">
          {open ? 'Collapse' : 'Click to view'}
        </span>
        {open ? <ChevronUp size={16} className="text-navy-700" /> : <ChevronDown size={16} className="text-navy-700" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-navy-100">
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 mt-3">
            {items.map((it, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-slate-200 shrink-0">
                  {it.symbol}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-navy-900">{it.title}</p>
                  <p className="text-[11px] text-slate-600 leading-relaxed mt-0.5">{it.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// Export the defaults so callers can augment with page-specific items
export { DEFAULT_ITEMS as DEFAULT_GLOSSARY_ITEMS }

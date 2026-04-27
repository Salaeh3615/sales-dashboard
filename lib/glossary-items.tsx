/**
 * glossary-items.tsx — Page-specific Glossary entries used across the
 * dashboard.  Each export is an array of {symbol, title, body} items that
 * can be passed to <Glossary items={…}/> so the collapsible help panel
 * explains domain-specific symbols / color codes on the page where it lives.
 */

import React from 'react'

export type GlossaryItem = {
  symbol: React.ReactNode
  title: string
  body: string
}

// Small colored swatch helper
const Swatch = ({ className }: { className: string }) =>
  <span className={`inline-block w-3 h-3 rounded-sm ${className}`} />

// ─── Overview (/) ─────────────────────────────────────────────────────────────
export const OVERVIEW_GLOSSARY: GlossaryItem[] = [
  {
    symbol: <span className="text-navy-900 font-mono text-xs">NET</span>,
    title: 'Net Revenue',
    body: 'รายได้สุทธิ (Gross − Credit Memo − Discount) ตัวเลขที่ใช้ทุก KPI หลัก ใช้ค่าดีฟอลต์ในหน้าแดชบอร์ด สามารถเปลี่ยนเป็น Gross ได้จากฟิลเตอร์',
  },
  {
    symbol: <span className="text-gold-600 font-mono text-xs">Run-rate</span>,
    title: 'Required daily run-rate',
    body: 'รายได้เฉลี่ยต่อวันที่ต้องทำให้ได้ในวันที่เหลือของเดือน เพื่อให้ครบเป้าของเดือน (เป้า − รายได้ MTD) ÷ วันที่เหลือ',
  },
  {
    symbol: <Swatch className="bg-emerald-500" />,
    title: 'New customer',
    body: 'ลูกค้าที่ซื้อครั้งแรกในปีที่เลือก — ไม่เคยปรากฏในปีก่อนหน้า',
  },
  {
    symbol: <Swatch className="bg-navy-700" />,
    title: 'Existing / Returning',
    body: 'Existing = ซื้อต่อเนื่องจากปีก่อน · Returning = เคยหายไปอย่างน้อย 1 ปีแล้วกลับมา',
  },
  {
    symbol: <Swatch className="bg-red-500" />,
    title: 'Lost customer',
    body: 'ลูกค้าปีก่อนที่ไม่ซื้อต่อในปีนี้ (นับเป็น revenue at risk)',
  },
  {
    symbol: <span className="text-gold-700 font-bold">CM</span>,
    title: 'Credit Memo banner',
    body: 'แสดงเมื่ออัตรา Credit Memo ÷ Invoice > 10% แปลว่ายอดถูกลดจริงเยอะ ควรตรวจสาเหตุ (คืนของ / ส่วนลดหลังบิล / error)',
  },
  {
    symbol: <span className="text-emerald-600 font-bold">↑</span>,
    title: 'Waterfall bridge',
    body: 'กราฟ Revenue Bridge เทียบปี YoY: แท่งเขียว = สาเหตุที่ทำให้โตขึ้น, แท่งแดง = สาเหตุที่หดตัว, แท่งน้ำเงิน = ยอดรวม',
  },
  {
    symbol: <Swatch className="bg-gradient-to-br from-gold-100 to-gold-500" />,
    title: 'Calendar heatmap',
    body: 'ความเข้มของสีเทียบเป็น % ของเพดาน: ยิ่งเข้มยิ่งรายได้สูง ช่องเทา = ไม่มียอดในวันนั้น',
  },
]

// ─── Customers (/customers) ───────────────────────────────────────────────────
export const CUSTOMERS_GLOSSARY: GlossaryItem[] = [
  {
    symbol: <span className="text-emerald-600 font-bold">✓</span>,
    title: 'Replacement ratio ≥ 100%',
    body: 'รายได้จากลูกค้าใหม่ ≥ รายได้ที่เสียไปจากลูกค้าเก่าที่หายไป — ถือว่าเซลส์ชดเชยได้เต็ม',
  },
  {
    symbol: <span className="text-amber-600 font-bold">↓</span>,
    title: 'Under-replaced',
    body: 'Replacement ratio < 100% — เซลส์หารายได้ใหม่ไม่ทดแทนที่เสียไป ต้องเร่งหาลูกค้าใหม่',
  },
  {
    symbol: <Swatch className="bg-emerald-500" />,
    title: 'New customer',
    body: 'ลูกค้าที่ซื้อเป็นครั้งแรกในปี (ไม่เคยปรากฏในข้อมูลก่อนหน้า)',
  },
  {
    symbol: <Swatch className="bg-navy-700" />,
    title: 'Existing',
    body: 'ซื้อปีที่เลือก + ปีก่อนหน้าติดกัน — ฐานลูกค้าหลัก',
  },
  {
    symbol: <Swatch className="bg-gold-500" />,
    title: 'Returning',
    body: 'เคยหายไปอย่างน้อย 1 ปีแล้วกลับมาซื้อใหม่ (subset ของ Existing)',
  },
  {
    symbol: <Swatch className="bg-red-500" />,
    title: 'Lost',
    body: 'เคยซื้อปีก่อน แต่ไม่ซื้อในปีที่เลือก — risk bucket สำหรับ churn analysis',
  },
  {
    symbol: <span className="text-navy-900 font-mono text-[10px]">RFM</span>,
    title: 'RFM Matrix',
    body: 'แกน Recency (ซื้อล่าสุดเมื่อไหร่) × Frequency (ซื้อบ่อยแค่ไหน) × Monetary (ซื้อจำนวนเงินเท่าไหร่) แบ่งลูกค้าเป็น 10+ segment',
  },
  {
    symbol: <span className="text-gold-600 font-mono text-[10px]">bubble</span>,
    title: 'Salesperson bubble',
    body: 'ขนาดฟอง = รายได้รวม, ตำแหน่ง = retention vs new customer ratio ใช้ระบุสไตล์เซลส์ (ฟาร์มเมอร์ vs ฮันเตอร์)',
  },
]

// ─── Customer Lookup (/customer-lookup) ───────────────────────────────────────
export const LOOKUP_GLOSSARY: GlossaryItem[] = [
  {
    symbol: <span className="text-navy-900 font-mono text-[10px]">MoM</span>,
    title: 'Month-over-Month',
    body: 'เทียบยอดเดือนล่าสุดกับเดือนก่อนหน้า — ใช้ดูโมเมนตัมของลูกค้ารายนี้',
  },
  {
    symbol: <span className="text-navy-900 font-mono text-[10px]">YoY</span>,
    title: 'Year-over-Year',
    body: 'เทียบยอดปีนี้ (สะสมจนถึงเดือนล่าสุด) กับช่วงเดือนเดียวกันปีก่อน',
  },
  {
    symbol: <span className="text-emerald-600 font-bold">↑</span>,
    title: 'Positive trend',
    body: 'ลูกค้าเติบโตเมื่อเทียบกับช่วงก่อน — ควรรักษาและพยายามขยายซื้อต่อ',
  },
  {
    symbol: <span className="text-red-500 font-bold">↓</span>,
    title: 'Declining trend',
    body: 'ลูกค้าซื้อน้อยลง — จุดที่เซลส์ควรติดตาม หาสาเหตุ (ราคา คู่แข่ง การใช้งาน)',
  },
  {
    symbol: <span className="text-gold-600 font-mono text-[10px]">avg/mo</span>,
    title: 'Monthly average',
    body: 'ค่าเฉลี่ยรายได้ต่อเดือนของลูกค้ารายนี้ตลอดช่วงที่ซื้อ',
  },
  {
    symbol: <Swatch className="bg-navy-700" />,
    title: 'Revenue bar',
    body: 'แท่งรายได้ในกราฟ timeline ลูกค้า — ความสูงแปรตามยอดเงิน',
  },
]

// ─── Tests (/test-analytics) ──────────────────────────────────────────────────
export const TESTS_GLOSSARY: GlossaryItem[] = [
  {
    symbol: <span className="text-navy-900 font-mono text-[10px]">SKU</span>,
    title: 'Test SKU',
    body: 'รหัสบริการทดสอบแต่ละตัว (test code) ใช้ระบุประเภทการทดสอบที่ลูกค้าสั่ง',
  },
  {
    symbol: <span className="text-emerald-600 font-bold">★</span>,
    title: 'Top performer',
    body: 'Test ที่รายได้รวมสูงสุดในช่วงที่เลือก — โฟกัสที่จะรักษาคุณภาพและกำลังการผลิต',
  },
  {
    symbol: <span className="text-gold-600 font-mono text-[10px]">avg ฿</span>,
    title: 'Average unit price',
    body: 'ราคาเฉลี่ยต่อครั้งของบริการนั้น (revenue ÷ quantity) บอกตำแหน่งราคา',
  },
  {
    symbol: <Swatch className="bg-gold-500" />,
    title: 'Volume leader',
    body: 'Test ที่จำนวนครั้งสูงสุด — อาจราคาต่อหน่วยไม่สูง แต่หมุนเวียนบ่อย',
  },
  {
    symbol: <span className="text-red-500 font-bold">!</span>,
    title: 'Price variance alert',
    body: 'เมื่อราคาต่อหน่วยของ test นี้แกว่งมากกว่า 30% ระหว่าง min–max ควรตรวจสอบ (ส่วนลด contract / pricing error)',
  },
  {
    symbol: <span className="text-navy-900 font-mono text-[10px]">top 5</span>,
    title: 'Top 5 customers',
    body: 'ลูกค้า 5 อันดับแรกที่ใช้บริการ test นี้ — ประเมินความเสี่ยง concentration',
  },
]

// ─── Comparison (/comparison) ─────────────────────────────────────────────────
export const COMPARISON_GLOSSARY: GlossaryItem[] = [
  {
    symbol: <span className="text-navy-900 font-mono text-[10px]">Δ%</span>,
    title: 'Percentage delta',
    body: 'อัตราการเปลี่ยนแปลง = (ค่าใหม่ − ค่าเก่า) ÷ ค่าเก่า × 100',
  },
  {
    symbol: <span className="text-emerald-600 font-bold">▲</span>,
    title: 'Growth',
    body: 'Δ% เป็นบวก — ช่วงเทียบใหม่รายได้สูงขึ้น',
  },
  {
    symbol: <span className="text-red-500 font-bold">▼</span>,
    title: 'Decline',
    body: 'Δ% เป็นลบ — ช่วงเทียบใหม่รายได้ลดลง',
  },
  {
    symbol: <Swatch className="bg-emerald-500" />,
    title: 'Positive contribution (Waterfall)',
    body: 'ปัจจัยที่ทำให้รายได้ปีใหม่ดีขึ้นเทียบปีเก่า (เพิ่มลูกค้า / ราคาขึ้น / ขายเพิ่ม)',
  },
  {
    symbol: <Swatch className="bg-red-500" />,
    title: 'Negative contribution',
    body: 'ปัจจัยที่ทำให้รายได้หดตัว (ลูกค้าหาย / ลดราคา / ขายน้อยลง)',
  },
  {
    symbol: <Swatch className="bg-navy-700" />,
    title: 'Total bar',
    body: 'แท่งยอดรวมทั้งสองข้าง (ปีเก่า / ปีใหม่) ใช้เป็น anchor ของ waterfall',
  },
  {
    symbol: <span className="text-gold-600 font-mono text-[10px]">same-store</span>,
    title: 'Same-store baseline',
    body: 'เปรียบเทียบเฉพาะลูกค้าที่มีทั้งสองปี (ตัดลูกค้าใหม่/หายออก) เพื่อดู organic growth',
  },
]

// ─── Decomposition (/decomposition) ───────────────────────────────────────────
export const DECOMPOSITION_GLOSSARY: GlossaryItem[] = [
  {
    symbol: <span className="text-navy-900 font-mono text-[10px]">PVM</span>,
    title: 'Price-Volume-Mix decomposition',
    body: 'แตกการเปลี่ยนแปลงรายได้ออกเป็น 3 ส่วน: (1) Price = ราคาต่อหน่วยเปลี่ยน × ปริมาณใหม่, (2) Volume = ปริมาณที่เปลี่ยน × ราคาเดิม, (3) Mix = ส่วนที่เหลือจาก mix สินค้า/test ใหม่/หาย',
  },
  {
    symbol: <Swatch className="bg-emerald-500" />,
    title: 'Positive driver',
    body: 'ปัจจัยที่ทำให้รายได้เพิ่มขึ้น (ราคาขึ้น / ขายเยอะขึ้น / mix ดีขึ้น / ลูกค้าใหม่)',
  },
  {
    symbol: <Swatch className="bg-red-500" />,
    title: 'Negative driver',
    body: 'ปัจจัยที่ทำให้รายได้ลดลง (ราคาลง / ขายน้อยลง / ลูกค้าหาย / สินค้าหายจาก portfolio)',
  },
  {
    symbol: <span className="text-gold-700 font-mono text-[10px]">same-store</span>,
    title: 'Same-store growth',
    body: 'การเติบโตจากลูกค้ากลุ่มเดียวกันที่ซื้อทั้งสองช่วง — ตัด noise จากลูกค้าใหม่/หายออก ใช้ดู organic growth จริง',
  },
  {
    symbol: <span className="text-emerald-700 font-bold">+top</span>,
    title: 'Top contributors',
    body: '5 อันดับแรกที่ส่งผลให้รายได้ "เพิ่ม" มากที่สุด (delta บวก) — ลูกค้า/test/สาขา/เซลส์ที่ควรขยายโมเดลความสำเร็จ',
  },
  {
    symbol: <span className="text-red-700 font-bold">−top</span>,
    title: 'Top detractors',
    body: '5 อันดับแรกที่ส่งผลให้รายได้ "ลด" มากที่สุด (delta ลบ) — ปัญหาหลักที่ต้องวิเคราะห์สาเหตุและกลับมาคุย',
  },
  {
    symbol: <span className="text-navy-700 font-mono text-[10px]">bridge</span>,
    title: 'Bridge chart',
    body: 'แสดงรายได้ A → B โดยแต่ละแท่งบอกว่าใคร/อะไรที่ดันขึ้นหรือฉุดลง อ่านจากซ้าย (รายได้ A) ไปขวา (รายได้ B)',
  },
  {
    symbol: <span className="text-gold-600 font-bold">★</span>,
    title: 'Auto narrative',
    body: 'สรุปอัตโนมัติจาก PVM + bridges — เรียงจากภาพรวม → สาเหตุหลัก → ลูกค้า → บริการ → สาขา',
  },
]

// ─── Health (/health) ─────────────────────────────────────────────────────────
export const HEALTH_GLOSSARY: GlossaryItem[] = [
  {
    symbol: <span className="text-navy-900 font-mono text-[10px]">0–100</span>,
    title: 'Health Score',
    body: 'คะแนนสุขภาพลูกค้า 0–100 = Recency 35% + Revenue trend 30% + Frequency 20% + Order size 15%',
  },
  {
    symbol: <Swatch className="bg-emerald-500" />,
    title: 'Healthy (≥80)',
    body: 'ซื้อสม่ำเสมอ รายได้ทรง/โต ขนาดออเดอร์คงที่',
  },
  {
    symbol: <Swatch className="bg-navy-700" />,
    title: 'Watch (60–79)',
    body: 'มีสัญญาณบางอย่างเริ่มอ่อน เช่น recency เพิ่ม หรือ revenue trend แผ่ว',
  },
  {
    symbol: <Swatch className="bg-gold-500" />,
    title: 'At-Risk (40–59)',
    body: 'หลายมิติเริ่มลด รายได้ 90 วันล่าสุดต่ำกว่าช่วงก่อนหน้าอย่างมีนัยสำคัญ',
  },
  {
    symbol: <Swatch className="bg-red-500" />,
    title: 'Critical (<40)',
    body: 'หลุดทั้งความถี่ + รายได้ + ระยะเวลา — ใกล้สูญเสียลูกค้า',
  },
  {
    symbol: <span className="text-navy-700 font-mono text-[10px]">90d</span>,
    title: 'Window 90 days',
    body: 'การคำนวณ trend ใช้ช่วง 90 วันล่าสุด vs 90 วันก่อนหน้านั้น (รวม 180 วัน)',
  },
  {
    symbol: <span className="text-gold-700 font-bold">Δ</span>,
    title: 'Δ vs prior 90d',
    body: 'อัตราการเปลี่ยนของรายได้ระหว่างสองหน้าต่าง 90 วัน — ใช้ดู momentum ระยะสั้น',
  },
  {
    symbol: <span className="text-emerald-700 font-bold">w</span>,
    title: 'Weighting',
    body: 'แต่ละมิติมี weight ต่างกัน: recency มีน้ำหนักสูงสุดเพราะเป็นสัญญาณ leading ที่ชัดสุด',
  },
]

// ─── Variance (/variance) ─────────────────────────────────────────────────────
export const VARIANCE_GLOSSARY: GlossaryItem[] = [
  {
    symbol: <span className="text-navy-900 font-mono text-[10px]">z</span>,
    title: 'z-score',
    body: 'จำนวน standard deviation ที่ actual ห่างจาก baseline · z = (actual − baseline) ÷ stddev',
  },
  {
    symbol: <Swatch className="bg-red-500" />,
    title: 'Negative anomaly',
    body: 'รายได้ในช่วงนั้นต่ำกว่า baseline เกินค่า threshold (เช่น z ≤ −2)',
  },
  {
    symbol: <Swatch className="bg-emerald-500" />,
    title: 'Positive anomaly',
    body: 'รายได้สูงกว่า baseline เกิน threshold — ดูว่าทำซ้ำได้หรือเป็น one-off',
  },
  {
    symbol: <span className="text-slate-500 font-mono text-[10px]">━ ━</span>,
    title: 'Baseline line',
    body: 'rolling average ของ N period ก่อนหน้า (12 เดือน หรือ 8 สัปดาห์) ใช้เป็นเส้นเทียบ',
  },
  {
    symbol: <Swatch className="bg-slate-200" />,
    title: 'Normal band',
    body: 'แถบเทาคือช่วง baseline ± 2σ — ค่าที่อยู่ในแถบนี้ถือว่าอยู่ในเกณฑ์ปกติ',
  },
  {
    symbol: <span className="text-gold-700 font-mono text-[10px]">5W</span>,
    title: '5-Whys narrative',
    body: 'คำอธิบายอัตโนมัติ 4–6 ระดับ: ภาพรวม → ลูกค้า → บริการ → สาขา → ลูกค้าใหม่/หาย → ปริมาณออเดอร์',
  },
  {
    symbol: <span className="text-emerald-700 font-bold">+top</span>,
    title: 'Top contributors',
    body: 'รายการที่อธิบาย variance ได้มากที่สุด แต่ละแกน (customer/test/branch/sales)',
  },
  {
    symbol: <span className="text-navy-700 font-mono text-[10px]">share%</span>,
    title: 'Variance share',
    body: 'สัดส่วนของแต่ละ contributor ต่อ variance รวม — รวม top ๆ ให้เห็นว่ากี่ % มาจากใคร',
  },
]

// ─── Discounts (/discounts) ───────────────────────────────────────────────────
export const DISCOUNTS_GLOSSARY: GlossaryItem[] = [
  {
    symbol: <span className="text-red-500 font-bold">!</span>,
    title: 'Attention marker (major outlier)',
    body: 'ค่ามากกว่า 2× ของค่าเฉลี่ย (major outlier) — เช่น อัตราส่วนลดของเซลส์คนนี้สูงกว่าค่าเฉลี่ยทั้งทีม 2 เท่า ควรสอบถามสาเหตุ (ราคา contract / ส่วนลดพิเศษ / ลูกค้าต่อรอง)',
  },
  {
    symbol: <span className="text-navy-900 font-mono text-[10px]">disc%</span>,
    title: 'Discount rate',
    body: 'เปอร์เซ็นต์ส่วนลด = Discount ÷ Gross Revenue × 100 — ใช้เปรียบเทียบระหว่างเซลส์ / สาขา / ลูกค้า',
  },
  {
    symbol: <Swatch className="bg-red-400" />,
    title: 'High discount band',
    body: 'ส่วนลดสูงกว่าค่าเฉลี่ยทีมอย่างมีนัยสำคัญ — ควรตรวจ contract / deal size / approval',
  },
  {
    symbol: <Swatch className="bg-gold-400" />,
    title: 'Moderate discount band',
    body: 'ส่วนลดอยู่ในช่วงปกติ (ใกล้เคียงค่าเฉลี่ย)',
  },
  {
    symbol: <Swatch className="bg-emerald-500" />,
    title: 'Low / no discount',
    body: 'ไม่ได้ให้ส่วนลดหรือน้อยมาก — รักษา margin ได้ดี',
  },
  {
    symbol: <span className="text-gold-600 font-mono text-[10px]">contract</span>,
    title: 'Contract customer',
    body: 'ลูกค้าที่มีราคาสัญญา (ส่วนลดคงที่) — ยอดส่วนลดอาจดูสูงแต่เป็นตามตกลง ไม่ใช่ anomaly',
  },
  {
    symbol: <span className="text-navy-700 font-mono text-[10px]">avg</span>,
    title: 'Team / branch average',
    body: 'ค่าเฉลี่ยของทีมหรือสาขา ใช้เป็น baseline ในการเทียบเซลส์รายคน',
  },
]

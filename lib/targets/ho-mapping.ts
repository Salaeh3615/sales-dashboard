/**
 * ho-mapping.ts — Map HO locationCode → subdivision bucket.
 *
 * Business rules supplied by the CLT finance team:
 *   • ส่วนบริการสอบเทียบเครื่องมือ       → P1205
 *   • ส่วนตรวจประเมินและรับรองระบบ       → P1320, P1315, P1310, P1301, P1305, P1615
 *   • ส่วนฝึกอบรมและทดสอบความชำนาญฯ     → P1510, P1525, P1515
 *   • ส่วนประสานงานขายและพัฒนาธุรกิจ     → P1616, P1405
 *
 * Any other HO locationCode is treated as "งานโครงการและอื่น ๆ"
 * (project revenue / ad-hoc sources outside the four core divisions).
 * Where we can recognise a specific project pattern from the transaction
 * contents, we tag the row with a human-readable project name.
 */

export const SUB_CALIBRATION = 'ส่วนบริการสอบเทียบเครื่องมือ'
export const SUB_ASSESSMENT  = 'ส่วนตรวจประเมินและรับรองระบบ'
export const SUB_TRAINING    = 'ส่วนฝึกอบรมและทดสอบความชำนาญฯ'
export const SUB_SALES       = 'ส่วนประสานงานขายและพัฒนาธุรกิจ'
export const SUB_PROJECTS    = 'งานโครงการและอื่น ๆ'

/** Primary mapping used by the target-attainment calculator. */
export const HO_LOCATION_TO_SUBDIVISION: Record<string, string> = {
  // สอบเทียบ
  P1205: SUB_CALIBRATION,
  // ตรวจประเมิน
  P1320: SUB_ASSESSMENT,
  P1315: SUB_ASSESSMENT,
  P1310: SUB_ASSESSMENT,
  P1301: SUB_ASSESSMENT,
  P1305: SUB_ASSESSMENT,
  P1615: SUB_ASSESSMENT,
  // อบรม / PT
  P1510: SUB_TRAINING,
  P1525: SUB_TRAINING,
  P1515: SUB_TRAINING,
  // ประสานงานขายและพัฒนาธุรกิจ
  P1616: SUB_SALES,
  P1405: SUB_SALES,
  // Everything else falls into "projects" automatically — see helper below.
}

/**
 * Known HO project codes with a friendly label.  Used to decompose the
 * "projects & other" bucket into recognisable revenue sources so the
 * dashboard can credit them individually.
 */
export const HO_PROJECT_NAMES: Record<string, string> = {
  P5931: 'โครงการ มกอช. (เสริม)',
  L0205: 'บริการเร่งด่วน / Walk-in ต่างประเทศ',
  P4105: 'กองทุนและส่งเสริมคุณภาพชีวิตคนพิการ',
  P1636: 'โครงการยกระดับสินค้ามาตรฐาน SME',
}

/** Resolve a locationCode into { subdivision, projectName? }. */
export function classifyHoLocation(locationCode: string | null | undefined): {
  subdivision: string
  projectName?: string
} {
  const loc = (locationCode ?? '').trim()
  const sub = HO_LOCATION_TO_SUBDIVISION[loc]
  if (sub) return { subdivision: sub }
  return {
    subdivision: SUB_PROJECTS,
    projectName: HO_PROJECT_NAMES[loc] ?? (loc ? `โครงการ (${loc})` : 'ไม่ระบุ'),
  }
}

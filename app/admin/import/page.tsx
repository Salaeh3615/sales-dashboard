'use client'

/**
 * /admin/import
 *
 * Admin data-import page.
 *
 * Features:
 *  - Upload CSV/XLSX → parsed, normalised, stored in NDJSON
 *  - Append (default) or Replace all existing data
 *  - Database stats: record count + raw Amount sum (verifiable against source)
 *  - Revenue validation: shows whether the DB total matches calculated totals
 *  - Import history with per-batch record counts
 *  - Shareable viewer / admin URLs
 *
 * ⚠ Deduplication note
 * ---------------------
 * Each record is fingerprinted by:
 *   postingDate | documentNo | documentType | customerNo | salespersonCode |
 *   productCode | testCode | description | netAmount
 *
 * Re-importing the same file → all records skipped (inserted = 0).
 * Importing a new file      → all new records inserted.
 *
 * If you previously imported files before April 2026 (old hash used only
 * documentNo + productCode + testCode + postingDate + netAmount), some
 * line-items with the same price may have been lost.  To fix: click
 * "Clear database" then re-import all source files.
 */

import { useEffect, useRef, useState } from 'react'
import {
  Upload, RefreshCw, FileText, Trash2,
  CheckCircle2, AlertTriangle, Database, BarChart3,
} from 'lucide-react'
import * as PapaModule from 'papaparse'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Papa: typeof import('papaparse') = (PapaModule as any).default ?? PapaModule

// ─── Types ────────────────────────────────────────────────────────────────────

type Batch = {
  id: string
  filename: string
  importedAt: string
  recordCount: number
}

type ImportResult = {
  ok: boolean
  inserted: number
  skipped: number
  batches: { filename: string; inserted: number; skipped: number }[]
}

type DbStats = {
  recordCount: number
  rawAmountSum: number
  batches: Batch[]
}

type ValidationResult = {
  ok: boolean
  label: string
  detail?: string
}

type ValidationGroup = {
  section: string
  results: ValidationResult[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(n: number) {
  if (Math.abs(n) >= 1_000_000) return `฿${(n / 1_000_000).toFixed(4)}M`
  return `฿${n.toLocaleString('en', { minimumFractionDigits: 2 })}`
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminImportPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging]     = useState(false)
  const [loading, setLoading]       = useState(false)
  const [replace, setReplace]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [result, setResult]         = useState<ImportResult | null>(null)
  const [stats, setStats]           = useState<DbStats | null>(null)
  const [validating, setValidating] = useState(false)
  const [validation, setValidation] = useState<ValidationGroup[] | null>(null)
  const [valSummary, setValSummary] = useState<{ passed: number; failed: number } | null>(null)
  const [origin, setOrigin]   = useState('https://your-app.vercel.app')
  const [blobMode, setBlobMode] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')

  // ── Load DB stats on mount ──────────────────────────────────────────────────
  const refreshStats = async () => {
    try {
      const res = await fetch('/api/import')
      const data = await res.json()
      setStats({
        batches:      data.batches      ?? [],
        recordCount:  data.recordCount  ?? 0,
        rawAmountSum: data.rawAmountSum ?? 0,
      })
      setBlobMode(data.blobMode ?? false)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    refreshStats()
    setOrigin(window.location.origin)
  }, [])

  // ── Upload ─────────────────────────────────────────────────────────────────
  const upload = async (files: FileList | File[] | null) => {
    if (!files || (files as FileList).length === 0) return
    setLoading(true)
    setError(null)
    setResult(null)
    setValidation(null)
    setUploadProgress('')

    try {
      const fileArr = Array.from(files)

      // ── Blob mode (Vercel production): parse CSV in browser, send chunks ────
      if (blobMode) {
        const CHUNK_ROWS = 2000   // ~1-2 MB per request — safely under 4.5 MB limit

        let totalInserted = 0
        let totalSkipped  = 0
        const batchSummaries: { filename: string; inserted: number; skipped: number }[] = []

        for (let fi = 0; fi < fileArr.length; fi++) {
          const file = fileArr[fi]

          // 1. Parse CSV entirely in browser (runs locally, no upload needed)
          setUploadProgress(`กำลัง parse ไฟล์ ${fi + 1}/${fileArr.length}: ${file.name}…`)

          const parsed = await new Promise<{ headers: string[]; rows: string[][] }>((resolve, reject) => {
            Papa.parse(file, {
              header:         false,
              skipEmptyLines: true,
              complete: (res) => {
                const all = res.data as string[][]
                if (!all || all.length < 2) {
                  reject(new Error(
                    `ไม่พบข้อมูลในไฟล์ "${file.name}" (พบ ${all?.length ?? 0} บรรทัด) — ตรวจสอบว่าเป็น CSV และมีข้อมูล`
                  ))
                  return
                }
                resolve({ headers: all[0] ?? [], rows: all.slice(1) })
              },
              error: (err) => reject(new Error(`PapaParse error: ${err.message ?? String(err)}`)),
            })
          })

          const { headers, rows } = parsed
          setUploadProgress(`parse สำเร็จ: ${rows.length.toLocaleString()} rows — กำลังส่งข้อมูล…`)
          const totalChunks = Math.ceil(rows.length / CHUNK_ROWS)

          // 2. Send in small chunks — each chunk is just a few hundred KB
          for (let ci = 0; ci < totalChunks; ci++) {
            const chunkRows = rows.slice(ci * CHUNK_ROWS, (ci + 1) * CHUNK_ROWS)
            const pct       = Math.round(((ci + 1) / totalChunks) * 100)
            const rowsDone  = Math.min((ci + 1) * CHUNK_ROWS, rows.length)

            setUploadProgress(
              `ไฟล์ ${fi + 1}/${fileArr.length} · chunk ${ci + 1}/${totalChunks} (${rowsDone.toLocaleString()} / ${rows.length.toLocaleString()} rows · ${pct}%)`
            )

            const res = await fetch('/api/import', {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify({
                headers,
                rows:     chunkRows,
                filename: file.name,
                // clear DB only before the very first chunk of the first file
                replace: fi === 0 && ci === 0 && replace,
              }),
            })
            if (!res.ok) {
              const data = await res.json().catch(() => ({}))
              throw new Error((data as { error?: string }).error ?? `Chunk ${ci + 1} failed`)
            }
            const data: ImportResult = await res.json()
            totalInserted += data.inserted
            totalSkipped  += data.skipped
            if (ci === totalChunks - 1) batchSummaries.push(...data.batches)
          }
        }

        setResult({ ok: true, inserted: totalInserted, skipped: totalSkipped, batches: batchSummaries })
        await refreshStats()
        return
      }

      // ── Local mode: send via FormData ────────────────────────────────────────
      const fd = new FormData()
      fileArr.forEach((f) => fd.append('files', f))
      if (replace) fd.append('replace', 'true')
      setUploadProgress('กำลัง upload…')
      const res = await fetch('/api/import', { method: 'POST', body: fd })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? 'Upload failed')
      }
      const data: ImportResult = await res.json()
      setResult(data)
      await refreshStats()

    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setLoading(false)
      setUploadProgress('')
    }
  }

  // ── Clear ──────────────────────────────────────────────────────────────────
  const handleClear = async () => {
    if (!confirm(
      'Delete ALL records from the database?\n\n' +
      'This cannot be undone. Re-import all source files afterwards.',
    )) return
    setLoading(true)
    setValidation(null)
    setError(null)
    try {
      const res = await fetch('/api/import', { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? `Clear failed (${res.status})`)
      }
      setResult(null)
      await refreshStats()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Clear failed')
    } finally {
      setLoading(false)
    }
  }

  // ── Run validation ─────────────────────────────────────────────────────────
  const runValidation = async () => {
    setValidating(true)
    setValidation(null)
    try {
      const res = await fetch('/api/validate')
      const data = await res.json()
      setValidation(data.groups ?? [])
      setValSummary(data.summary ?? null)
    } catch {
      setValidation([])
    } finally {
      setValidating(false)
    }
  }

  const batches = stats?.batches ?? []

  return (
    <main className="flex-1 p-4 lg:p-6 max-w-4xl mx-auto w-full space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Admin · Data Import</h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload CSV or Excel files. Records are parsed, normalised, and stored.
          Viewers see updated data immediately on refresh.
        </p>
      </div>

      {/* ── Database Stats ───────────────────────────────────────────────── */}
      {stats && (
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Database size={16} className="text-blue-600" />
            <h2 className="text-sm font-bold text-slate-800">Database Stats</h2>
            <span className="ml-auto text-xs text-slate-400">
              Verify these totals against your source files
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Stat label="Total Records" value={stats.recordCount.toLocaleString()} />
            <Stat label="Raw Amount Sum" value={fmtMoney(stats.rawAmountSum)}
              sub="sum of all Amount fields" />
            <Stat label="Import Batches" value={String(batches.length)} />
          </div>

          {/* Dedup warning if data already exists */}
          {stats.recordCount > 0 && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <strong>⚠ Deduplication note:</strong> If you imported data before April 2026,
              some line-items with the same price in the same invoice may have been lost
              (old hash bug). To get accurate totals: click <em>Clear database</em> then
              re-import all your source files. After re-import, the Raw Amount Sum should
              exactly match the sum of the <code>Amount</code> column in your Excel files.
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button
              onClick={runValidation}
              disabled={validating || stats.recordCount === 0}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {validating
                ? <><RefreshCw size={12} className="animate-spin" />Running…</>
                : <><BarChart3 size={12} />Run Revenue Validation</>}
            </button>
          </div>

          {/* Validation results */}
          {validation !== null && valSummary && (
            <div className="mt-4 space-y-3">
              <div className={`flex items-center gap-2 p-3 rounded-lg text-sm font-semibold ${
                valSummary.failed === 0
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {valSummary.failed === 0
                  ? <CheckCircle2 size={16} />
                  : <AlertTriangle size={16} />}
                {valSummary.passed}/{valSummary.passed + valSummary.failed} checks passed
                {valSummary.failed > 0 && ` — ${valSummary.failed} FAILED`}
              </div>

              {validation.map((g) => (
                <div key={g.section} className="border border-slate-100 rounded-lg overflow-hidden">
                  <p className="px-4 py-2 bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-100">
                    {g.section}
                  </p>
                  <ul className="divide-y divide-slate-50">
                    {g.results.map((r, i) => (
                      <li key={i} className="px-4 py-2 flex items-start gap-2 text-xs">
                        <span className={r.ok ? 'text-emerald-500 mt-0.5' : 'text-red-500 mt-0.5'}>
                          {r.ok ? '✓' : '✗'}
                        </span>
                        <div>
                          <p className={r.ok ? 'text-slate-700' : 'text-red-700 font-medium'}>{r.label}</p>
                          {r.detail && <p className="text-slate-400 mt-0.5">{r.detail}</p>}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Upload zone ──────────────────────────────────────────────────── */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl py-14 px-8 transition-colors ${
          dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          multiple
          className="hidden"
          onChange={(e) => upload(e.target.files)}
        />
        {loading
          ? <RefreshCw size={36} className="text-blue-500 animate-spin" />
          : <Upload size={36} className="text-slate-400" />}
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-700">
            {uploadProgress || (loading ? 'Importing…' : 'Drop CSV / Excel files here')}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Multiple files allowed · duplicates detected automatically
          </p>
        </div>
      </div>

      {/* Replace toggle */}
      <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
        <input
          type="checkbox"
          checked={replace}
          onChange={(e) => setReplace(e.target.checked)}
          className="rounded border-slate-300"
        />
        <span>
          <strong>Replace all existing data</strong> with this upload
          <span className="text-slate-400 ml-1">(otherwise append + deduplicate)</span>
        </span>
      </label>

      {/* ── Import result ────────────────────────────────────────────────── */}
      {result && (
        <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <CheckCircle2 size={20} className="text-emerald-600 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-emerald-800">Import successful</p>
            <p className="text-emerald-700 mt-1">
              Inserted <strong>{result.inserted.toLocaleString()}</strong> new records ·{' '}
              {result.skipped.toLocaleString()} duplicates skipped
            </p>
            {result.batches.map((b, i) => (
              <p key={i} className="text-emerald-600 text-xs mt-0.5">
                {b.filename}: +{b.inserted.toLocaleString()} ({b.skipped.toLocaleString()} skipped)
              </p>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle size={20} className="text-red-500 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-red-800">Import failed</p>
            <p className="text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* ── Shareable URLs ───────────────────────────────────────────────── */}
      <section className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-bold text-blue-800">Shareable URLs</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-white rounded-lg border border-blue-100 p-3">
            <p className="text-xs font-semibold text-emerald-700 mb-1">👁 Viewer (share freely)</p>
            <code className="text-xs text-slate-700 font-mono break-all">
              {origin}/
            </code>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Main dashboard — read-only, no login required. Share this URL with anyone who needs to view the data.
            </p>
          </div>
          <div className="bg-white rounded-lg border border-blue-100 p-3">
            <p className="text-xs font-semibold text-amber-700 mb-1">🔒 Admin (keep private)</p>
            <code className="text-xs text-slate-700 font-mono break-all">
              {origin}/admin/import
            </code>
            <p className="text-[11px] text-slate-500 mt-1.5">
              This page — upload and manage data files. Do not share with viewers.
            </p>
          </div>
        </div>
        <p className="text-[11px] text-blue-700">
          <strong>Deploy on Vercel:</strong> push to{' '}
          <a href="https://vercel.com" target="_blank" rel="noreferrer" className="underline">vercel.com</a>{' '}
          (free tier). Viewer URL = <code>https://&lt;project&gt;.vercel.app/</code> · Admin URL ={' '}
          <code>https://&lt;project&gt;.vercel.app/admin/import</code>.
          Data lives in <code>data/records.ndjson</code> — for production use a persistent volume or Postgres.
        </p>
      </section>

      {/* ── Import history ───────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Import history</h2>
          {batches.length > 0 && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
            >
              <Trash2 size={12} />
              Clear database
            </button>
          )}
        </div>
        {batches.length === 0 ? (
          <p className="p-6 text-sm text-slate-400 text-center">No imports yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-xs text-slate-500">
                <th className="px-4 py-2 text-left font-semibold">File</th>
                <th className="px-4 py-2 text-right font-semibold">Records</th>
                <th className="px-4 py-2 text-right font-semibold">Imported at</th>
              </tr>
            </thead>
            <tbody>
              {[...batches].reverse().map((b) => (
                <tr key={b.id} className="border-b border-slate-50">
                  <td className="px-4 py-2 text-slate-800 text-xs flex items-center gap-2">
                    <FileText size={12} className="text-slate-400" />
                    {b.filename}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-xs text-slate-600">
                    {b.recordCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-xs text-slate-500">
                    {new Date(b.importedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ── Deploy to Vercel ─────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">🚀</span>
          <h2 className="text-sm font-bold text-slate-800">Share with Others — Deploy to Vercel</h2>
        </div>
        <p className="text-xs text-slate-500">
          ทำตาม 5 ขั้นตอนนี้ คนอื่นจะเข้าดู dashboard นี้ได้จาก URL ของคุณโดยไม่ต้อง import ข้อมูลเอง
        </p>

        <ol className="space-y-3 text-sm">
          {/* Step 1 */}
          <li className="flex gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">1</span>
            <div>
              <p className="font-medium text-slate-700">Push โค้ดขึ้น GitHub</p>
              <code className="block mt-1 bg-slate-100 rounded px-3 py-2 text-xs text-slate-600 font-mono whitespace-pre">
{`cd sales-dashboard
git init
git add -A
git commit -m "initial"
git remote add origin https://github.com/<your-user>/<repo>.git
git push -u origin main`}
              </code>
              <p className="text-xs text-slate-400 mt-1">ไฟล์ใน <code>data/</code> จะถูก .gitignore ไว้อยู่แล้ว ปลอดภัย</p>
            </div>
          </li>

          {/* Step 2 */}
          <li className="flex gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">2</span>
            <div>
              <p className="font-medium text-slate-700">Import project บน Vercel</p>
              <p className="text-xs text-slate-500 mt-1">
                ไปที่{' '}
                <a href="https://vercel.com/new" target="_blank" rel="noopener noreferrer"
                   className="text-blue-600 underline">vercel.com/new</a>
                {' '}→ เลือก GitHub repo → คลิก <strong>Deploy</strong> (ไม่ต้องแก้ settings อะไร)
              </p>
            </div>
          </li>

          {/* Step 3 */}
          <li className="flex gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">3</span>
            <div>
              <p className="font-medium text-slate-700">สร้าง Blob Store แล้วเชื่อมกับ project</p>
              <p className="text-xs text-slate-500 mt-1">
                Vercel Dashboard → project → <strong>Storage</strong> tab → <strong>Create Database</strong> → เลือก <strong>Blob</strong> → Connect to project
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Vercel จะ inject <code>BLOB_READ_WRITE_TOKEN</code> ให้อัตโนมัติ — ไม่ต้องก็อปวาง
              </p>
            </div>
          </li>

          {/* Step 4 */}
          <li className="flex gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">4</span>
            <div>
              <p className="font-medium text-slate-700">Redeploy แล้ว Import ข้อมูลผ่านหน้านี้</p>
              <p className="text-xs text-slate-500 mt-1">
                หลัง Connect Blob → คลิก <strong>Redeploy</strong> → เปิด <code>/admin/import</code> บน URL ของ Vercel → Upload ไฟล์ CSV ตามปกติ ข้อมูลจะบันทึกใน Blob (cloud) แทน local
              </p>
            </div>
          </li>

          {/* Step 5 */}
          <li className="flex gap-3">
            <span className="shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center">5</span>
            <div>
              <p className="font-medium text-slate-700">แชร์ URL ให้คนอื่น</p>
              <p className="text-xs text-slate-500 mt-1">
                URL หน้าหลัก <code>https://xxx.vercel.app/</code> → ดูได้เลย ไม่ต้อง login<br />
                หน้า Admin <code>/admin/import</code> → สำหรับคนที่ต้อง upload ข้อมูล (แนะนำให้เพิ่ม password ถ้าต้องการ)
              </p>
            </div>
          </li>
        </ol>

        <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-800">
          <strong>✅ Free tier ใช้ได้:</strong> Vercel Hobby (ฟรี) รองรับ Blob storage สูงสุด 500 MB
          ซึ่งรองรับข้อมูลหลาย million records ได้สบาย
        </div>
      </section>

    </main>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <p className="text-xs text-slate-500 font-medium">{label}</p>
      <p className="text-lg font-bold text-slate-800 mt-0.5">{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

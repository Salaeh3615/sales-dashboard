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
 */

import { useEffect, useRef, useState } from 'react'
import {
  Upload, RefreshCw, FileText, Trash2,
  CheckCircle2, AlertTriangle, Database, BarChart3,
} from 'lucide-react'
import * as PapaModule from 'papaparse'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Papa: typeof import('papaparse') = (PapaModule as any).default ?? PapaModule

const HEADER_KEYWORDS = [
  'shortcut dimension 1 code', 'posting date', 'salesperson code',
  'bill-to name', 'sale person name', 'amount',
]
function findHeaderRowIndex(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const rowText = rows[i].map(c => String(c ?? '').toLowerCase().trim()).join(' ')
    const matches = HEADER_KEYWORDS.filter(kw => rowText.includes(kw))
    if (matches.length >= 2) return i
  }
  return 0
}

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
  const [deletingId, setDeletingId] = useState<string | null>(null)

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

  const upload = async (files: FileList | File[] | null) => {
    if (!files || (files as FileList).length === 0) return
    setLoading(true)
    setError(null)
    setResult(null)
    setValidation(null)
    setUploadProgress('')

    try {
      const fileArr = Array.from(files)

      if (blobMode) {
        const CHUNK_ROWS = window.location.hostname === 'localhost' ? 5000 : 100

        let totalInserted = 0
        let totalSkipped  = 0
        const batchSummaries: { filename: string; inserted: number; skipped: number }[] = []

        for (let fi = 0; fi < fileArr.length; fi++) {
          const file = fileArr[fi]

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
                const headerIdx = findHeaderRowIndex(all)
                resolve({ headers: all[headerIdx] ?? [], rows: all.slice(headerIdx + 1) })
              },
              error: (err) => reject(new Error(`PapaParse error: ${err.message ?? String(err)}`)),
            })
          })

          const { headers, rows } = parsed
          setUploadProgress(`parse สำเร็จ: ${rows.length.toLocaleString()} rows — กำลังส่งข้อมูล…`)
          const totalChunks = Math.ceil(rows.length / CHUNK_ROWS)

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

  const handleDeleteBatch = async (b: Batch) => {
    if (!confirm(
      `ลบไฟล์นี้ออกจากฐานข้อมูล?\n\n` +
      `ไฟล์: ${b.filename}\n` +
      `จำนวน: ${b.recordCount.toLocaleString()} records\n\n` +
      `การลบนี้ย้อนกลับไม่ได้`,
    )) return
    setDeletingId(b.id)
    setError(null)
    try {
      const res = await fetch(`/api/import?batchId=${encodeURIComponent(b.id)}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? `Delete failed (${res.status})`)
      }
      await refreshStats()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

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
    <main className="flex-1 bg-[#F8FAFC] p-4 lg:p-5 max-w-5xl mx-auto w-full space-y-5 animate-fade-in">

      {/* Header */}
      <div className="hero-card p-5">
        <div className="relative flex items-center gap-3">
          <span className="inline-flex w-10 h-10 rounded-xl bg-gradient-to-br from-gold-400/30 to-gold-500/10 backdrop-blur text-gold-300 items-center justify-center border border-gold-400/30 shadow-inner shrink-0">
            <Upload size={18} strokeWidth={2.2} />
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold tracking-tight leading-tight">Admin · Data Import</h1>
            <p className="text-xs text-navy-100/70 mt-0.5 tracking-wide">
              Upload CSV or Excel files · records are parsed, normalised, and stored
            </p>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-semibold text-gold-300 tracking-wider uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </span>
        </div>
      </div>

      {/* ── Database Stats ───────────────────────────────────────────────── */}
      {stats && (
        <section className="bg-white rounded-3xl border border-slate-200 shadow-luxe p-5 hover-lift">
          <div className="flex items-center gap-2 mb-4">
            <span className="inline-flex w-8 h-8 rounded-lg bg-navy-50 text-navy-900 items-center justify-center">
              <Database size={14} />
            </span>
            <h2 className="text-sm font-bold text-navy-900">Database Stats</h2>
            <span className="ml-auto text-xs text-slate-400">
              Verify these totals against your source files
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Stat label="Total Records" value={stats.recordCount.toLocaleString()} tone="navy" />
            <Stat label="Raw Amount Sum" value={fmtMoney(stats.rawAmountSum)} tone="gold"
              sub="sum of all Amount fields" />
            <Stat label="Import Batches" value={String(batches.length)} tone="slate" />
          </div>

          {stats.recordCount > 0 && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
              <strong>⚠ Deduplication note:</strong> If you imported data before April 2026,
              some line-items with the same price may have been lost. To get accurate totals:
              click <em>Clear database</em> then re-import all your source files.
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button
              onClick={runValidation}
              disabled={validating || stats.recordCount === 0}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-navy-900 text-gold-400 rounded-lg hover:bg-navy-800 disabled:opacity-40 transition-all shadow-sm"
            >
              {validating
                ? <><RefreshCw size={12} className="animate-spin" />Running…</>
                : <><BarChart3 size={12} />Run Revenue Validation</>}
            </button>
          </div>

          {validation !== null && valSummary && (
            <div className="mt-4 space-y-3">
              <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-semibold ${
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
                <div key={g.section} className="border border-slate-100 rounded-xl overflow-hidden">
                  <p className="px-4 py-2 bg-navy-50 text-xs font-semibold text-navy-900 border-b border-slate-100">
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
        className={`cursor-pointer flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-3xl py-14 px-8 transition-all ${
          dragging
            ? 'border-gold-500 bg-gold-50 shadow-gold-glow scale-[1.01]'
            : 'border-slate-300 bg-white hover:border-gold-400 hover:bg-gold-50/40'
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
          ? <RefreshCw size={36} className="text-gold-500 animate-spin" />
          : <Upload size={36} className="text-navy-700" />}
        <div className="text-center">
          <p className="text-sm font-semibold text-navy-900">
            {uploadProgress || (loading ? 'Importing…' : 'Drop CSV / Excel files here')}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Multiple files allowed · duplicates detected automatically
          </p>
        </div>
      </div>

      {/* Replace toggle */}
      <label className="flex items-center gap-2 text-sm text-navy-900 cursor-pointer">
        <input
          type="checkbox"
          checked={replace}
          onChange={(e) => setReplace(e.target.checked)}
          className="rounded border-slate-300 text-navy-900 focus:ring-gold-400"
        />
        <span>
          <strong>Replace all existing data</strong> with this upload
          <span className="text-slate-400 ml-1">(otherwise append + deduplicate)</span>
        </span>
      </label>

      {/* ── Import result ────────────────────────────────────────────────── */}
      {result && (
        <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-3xl shadow-card">
          <CheckCircle2 size={20} className="text-emerald-600 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-emerald-800">Import successful</p>
            <p className="text-emerald-700 mt-1 font-num">
              Inserted <strong>{result.inserted.toLocaleString()}</strong> new records ·{' '}
              {result.skipped.toLocaleString()} duplicates skipped
            </p>
            {result.batches.map((b, i) => (
              <p key={i} className="text-emerald-600 text-xs mt-0.5 font-num">
                {b.filename}: +{b.inserted.toLocaleString()} ({b.skipped.toLocaleString()} skipped)
              </p>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-3xl shadow-card">
          <AlertTriangle size={20} className="text-red-500 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-red-800">Import failed</p>
            <p className="text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* ── Shareable URLs ───────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-navy-50 via-white to-gold-50/30 border border-navy-100 rounded-3xl p-5 space-y-3 shadow-card">
        <h2 className="text-sm font-bold text-navy-900 flex items-center gap-2">
          <span className="inline-block w-1 h-4 bg-gold-500 rounded-full" />
          Shareable URLs
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-navy-100 p-3 hover-lift">
            <p className="text-xs font-semibold text-emerald-700 mb-1">👁 Viewer (share freely)</p>
            <code className="text-xs text-navy-900 font-mono break-all bg-slate-50 block px-2 py-1 rounded">
              {origin}/
            </code>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Main dashboard — read-only, no login required.
            </p>
          </div>
          <div className="bg-white rounded-xl border border-navy-100 p-3 hover-lift">
            <p className="text-xs font-semibold text-gold-700 mb-1">🔒 Admin (keep private)</p>
            <code className="text-xs text-navy-900 font-mono break-all bg-slate-50 block px-2 py-1 rounded">
              {origin}/admin/import
            </code>
            <p className="text-[11px] text-slate-500 mt-1.5">
              This page — upload and manage data files.
            </p>
          </div>
        </div>
      </section>

      {/* ── Import history ───────────────────────────────────────────────── */}
      <section className="bg-white rounded-3xl border border-slate-200 shadow-card overflow-hidden hover-lift">
        <div className="px-5 py-4 bg-gradient-to-r from-navy-900 via-navy-800 to-navy-700 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <span className="inline-block w-1 h-4 bg-gold-500 rounded-full" />
            Import history
            {batches.length > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-navy-800/60 text-[10px] font-num text-gold-300 border border-navy-600">
                {batches.length}
              </span>
            )}
          </h2>
          {batches.length > 0 && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1 text-xs font-semibold text-red-300 hover:text-red-200 hover:bg-red-500/10 px-2 py-1 rounded-lg transition-colors"
            >
              <Trash2 size={12} />
              Clear all
            </button>
          )}
        </div>
        {batches.length === 0 ? (
          <p className="p-6 text-sm text-slate-400 text-center">No imports yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {[...batches].reverse().map((b) => {
              const isDeleting = deletingId === b.id
              return (
                <li
                  key={b.id}
                  className={`group flex items-center gap-3 px-5 py-3 hover:bg-navy-50/40 transition-colors ${
                    isDeleting ? 'opacity-50 pointer-events-none' : ''
                  }`}
                >
                  <span className="inline-flex w-9 h-9 rounded-xl bg-gradient-to-br from-gold-100 to-gold-50 border border-gold-200/60 items-center justify-center shrink-0">
                    <FileText size={14} className="text-gold-700" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-navy-900 truncate">{b.filename}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 font-num">
                      {new Date(b.importedAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-navy-900 tabular-nums font-num">
                      {b.recordCount.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">records</p>
                  </div>

                  <button
                    onClick={() => handleDeleteBatch(b)}
                    disabled={isDeleting}
                    className="ml-2 inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title="ลบไฟล์นี้ออกจากฐานข้อมูล"
                    aria-label={`Delete batch ${b.filename}`}
                  >
                    {isDeleting
                      ? <RefreshCw size={14} className="animate-spin" />
                      : <Trash2 size={14} />}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

    </main>
  )
}

function Stat({ label, value, sub, tone = 'navy' }: {
  label: string; value: string; sub?: string
  tone?: 'navy' | 'gold' | 'slate'
}) {
  const tones = {
    navy:  { bg: 'bg-gradient-to-br from-navy-50 to-white',  text: 'text-navy-900',  strip: 'bg-gradient-to-b from-navy-600 to-navy-900' },
    gold:  { bg: 'bg-gradient-to-br from-gold-50 to-white',  text: 'text-gold-800',  strip: 'bg-gradient-to-b from-gold-400 to-gold-600' },
    slate: { bg: 'bg-gradient-to-br from-slate-50 to-white', text: 'text-slate-800', strip: 'bg-gradient-to-b from-slate-300 to-slate-500' },
  }
  const t = tones[tone]
  return (
    <div className={`group relative rounded-2xl p-3.5 overflow-hidden border border-slate-200/60 transition-all hover:border-slate-300 hover:shadow-md ${t.bg}`}>
      <span className={`absolute left-0 top-2 bottom-2 w-1 rounded-full ${t.strip}`} />
      <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-[0.12em] pl-2">{label}</p>
      <p className={`text-xl font-bold mt-1 pl-2 font-num tracking-tight ${t.text}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-1 pl-2">{sub}</p>}
    </div>
  )
}

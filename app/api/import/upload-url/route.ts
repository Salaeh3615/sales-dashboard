/**
 * POST /api/import/upload-url
 *
 * Issues a Vercel Blob client-upload token so the browser can upload
 * CSV/XLSX files directly to Blob storage (bypassing the 4.5 MB API body limit).
 *
 * Flow:
 *   browser → @vercel/blob/client upload() → Blob CDN  (no size limit)
 *   browser → POST /api/import  { blobUrl, filename, replace }
 *   server  → fetch(blobUrl) → parse CSV → appendRecords()
 */

import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as HandleUploadBody

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          'text/csv',
          'text/plain',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'application/octet-stream',
        ],
        maximumSizeInBytes: 200 * 1024 * 1024, // 200 MB
      }),
      onUploadCompleted: async ({ blob }) => {
        // Processing is triggered by the client after upload
        console.log('[upload-url] blob ready:', blob.url)
      },
    })

    return NextResponse.json(jsonResponse)
  } catch (err) {
    console.error('[upload-url] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Token error' },
      { status: 400 },
    )
  }
}

import { withAuth, createSupabaseClient, ok, error } from '@cbt/shared'
import { getSellingAccountCredentials } from '../../../lib/account-client'
import { getAccessToken } from '../../../lib/lwa'

const SP_API_BASE = process.env.SP_API_BASE || 'https://sellingpartnerapi-na.amazon.com'
const DEFAULT_MARKETPLACE = 'ATVPDKIKX0DER'
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

// GET  ?selling_account_id=xxx
//   → trả về cached templates hoặc check tiến độ report đang chạy
//   → { status: 'ready'|'syncing'|'empty', templates: string[], synced_at, error? }
//
// POST { selling_account_id, force? }
//   → kick off SP-API report, lưu reportId vào amz_shipping_templates_sync
//   → { status: 'syncing' }
//
// Client tự poll GET mỗi 5s cho đến khi status === 'ready'.
export default withAuth(async (req, res, auth) => {
  const supabase = createSupabaseClient()
  const sellingAccountId =
    req.method === 'GET'
      ? (req.query.selling_account_id as string)
      : (req.body?.selling_account_id as string)

  if (!sellingAccountId) return error(res, 400, 'selling_account_id là bắt buộc')

  // ── GET: trả về cache hoặc tiến độ ─────────────────────────────────────
  if (req.method === 'GET') {
    // 1. Kiểm tra cache còn tươi không
    const { data: cached } = await supabase
      .from('amz_shipping_templates_cache')
      .select('template_name, synced_at')
      .eq('account_id', auth.account_id)
      .eq('selling_account_id', sellingAccountId)
      .order('template_name')

    if (cached && cached.length > 0) {
      const cacheAge = Date.now() - new Date(cached[0].synced_at).getTime()
      if (cacheAge < CACHE_TTL_MS) {
        return ok(res, {
          status: 'ready',
          templates: cached.map((r) => r.template_name),
          synced_at: cached[0].synced_at,
        })
      }
    }

    // 2. Xem có job đang chạy không
    const { data: job } = await supabase
      .from('amz_shipping_templates_sync')
      .select('report_id, status, error_message')
      .eq('account_id', auth.account_id)
      .eq('selling_account_id', sellingAccountId)
      .maybeSingle()

    if (!job || job.status === 'idle') {
      return ok(res, { status: 'empty', templates: [] })
    }

    if (job.status === 'failed') {
      return ok(res, {
        status: 'error',
        templates: cached?.map((r) => r.template_name) ?? [],
        error: job.error_message ?? 'Sync thất bại',
      })
    }

    // status === 'pending' — check SP-API report tiến độ
    try {
      const credentials = await getSellingAccountCredentials(sellingAccountId)
      const accessToken = await getAccessToken(credentials, sellingAccountId)
      const headers = spHeaders(accessToken)

      const pollRes = await fetch(
        `${SP_API_BASE}/reports/2021-06-30/reports/${job.report_id}`,
        { headers }
      )
      if (!pollRes.ok) throw new Error(`Poll failed (${pollRes.status})`)
      const report = (await pollRes.json()) as {
        processingStatus: string
        reportDocumentId?: string
      }

      if (report.processingStatus === 'FATAL' || report.processingStatus === 'CANCELLED') {
        await supabase
          .from('amz_shipping_templates_sync')
          .update({ status: 'failed', error_message: `Report ${report.processingStatus}`, updated_at: new Date().toISOString() })
          .eq('account_id', auth.account_id)
          .eq('selling_account_id', sellingAccountId)
        return ok(res, { status: 'error', templates: [], error: `Report ${report.processingStatus}` })
      }

      if (report.processingStatus !== 'DONE') {
        // IN_QUEUE hoặc IN_PROGRESS
        return ok(res, { status: 'syncing', templates: [] })
      }

      // DONE — download + parse + cache
      const { data: config } = await supabase
        .from('amz_product_configs')
        .select('marketplace_id')
        .eq('selling_account_id', sellingAccountId)
        .maybeSingle()
      const marketplaceId = config?.marketplace_id || DEFAULT_MARKETPLACE
      void marketplaceId // used implicitly via report content

      const templates = await downloadAndParseReport(
        report.reportDocumentId!,
        accessToken
      )

      const now = new Date().toISOString()
      if (templates.length > 0) {
        await supabase
          .from('amz_shipping_templates_cache')
          .delete()
          .eq('account_id', auth.account_id)
          .eq('selling_account_id', sellingAccountId)

        await supabase.from('amz_shipping_templates_cache').insert(
          templates.map((name) => ({
            account_id: auth.account_id,
            selling_account_id: sellingAccountId,
            template_name: name,
            synced_at: now,
          }))
        )
      }

      await supabase
        .from('amz_shipping_templates_sync')
        .update({ status: 'idle', updated_at: now })
        .eq('account_id', auth.account_id)
        .eq('selling_account_id', sellingAccountId)

      return ok(res, { status: 'ready', templates, synced_at: now })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi không xác định'
      return ok(res, {
        status: 'error',
        templates: cached?.map((r) => r.template_name) ?? [],
        error: msg,
      })
    }
  }

  // ── POST: kick off report ────────────────────────────────────────────────
  if (req.method === 'POST') {
    // Kiểm tra cache còn tươi — skip nếu không force
    if (!req.body?.force) {
      const { data: cached } = await supabase
        .from('amz_shipping_templates_cache')
        .select('template_name, synced_at')
        .eq('account_id', auth.account_id)
        .eq('selling_account_id', sellingAccountId)
        .limit(1)
      if (cached?.[0]?.synced_at) {
        const age = Date.now() - new Date(cached[0].synced_at).getTime()
        if (age < CACHE_TTL_MS) {
          const { data: all } = await supabase
            .from('amz_shipping_templates_cache')
            .select('template_name')
            .eq('account_id', auth.account_id)
            .eq('selling_account_id', sellingAccountId)
            .order('template_name')
          return ok(res, {
            status: 'ready',
            templates: (all ?? []).map((r) => r.template_name),
            synced_at: cached[0].synced_at,
          })
        }
      }
    }

    try {
      const credentials = await getSellingAccountCredentials(sellingAccountId)
      const accessToken = await getAccessToken(credentials, sellingAccountId)

      const { data: config } = await supabase
        .from('amz_product_configs')
        .select('marketplace_id')
        .eq('selling_account_id', sellingAccountId)
        .maybeSingle()
      const marketplaceId = config?.marketplace_id || DEFAULT_MARKETPLACE

      const createRes = await fetch(`${SP_API_BASE}/reports/2021-06-30/reports`, {
        method: 'POST',
        headers: spHeaders(accessToken),
        body: JSON.stringify({
          reportType: 'GET_MERCHANT_LISTINGS_ALL_DATA',
          marketplaceIds: [marketplaceId],
        }),
      })
      if (!createRes.ok) {
        throw new Error(`Create report failed (${createRes.status}): ${await createRes.text()}`)
      }
      const { reportId } = (await createRes.json()) as { reportId: string }
      if (!reportId) throw new Error('SP-API không trả về reportId')

      // Lưu reportId vào sync job table
      await supabase.from('amz_shipping_templates_sync').upsert(
        {
          account_id: auth.account_id,
          selling_account_id: sellingAccountId,
          report_id: reportId,
          status: 'pending',
          error_message: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'account_id,selling_account_id' }
      )

      return ok(res, { status: 'syncing' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể tạo report'
      return error(res, 500, msg)
    }
  }

  return error(res, 405, 'Method not allowed')
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function spHeaders(accessToken: string): Record<string, string> {
  return {
    'x-amz-access-token': accessToken,
    'Content-Type': 'application/json',
    'User-Agent': 'CBT-Listing-Studio/1.0 (Language=TypeScript)',
  }
}

async function downloadAndParseReport(
  reportDocumentId: string,
  accessToken: string
): Promise<string[]> {
  const docRes = await fetch(
    `${SP_API_BASE}/reports/2021-06-30/documents/${reportDocumentId}`,
    { headers: spHeaders(accessToken) }
  )
  if (!docRes.ok) throw new Error(`Get document failed (${docRes.status})`)
  const { url, compressionAlgorithm } = (await docRes.json()) as {
    url: string
    compressionAlgorithm?: string
  }

  const csvRes = await fetch(url)
  if (!csvRes.ok) throw new Error(`Download CSV failed (${csvRes.status})`)

  let csvText: string
  if (compressionAlgorithm === 'GZIP') {
    const { gunzipSync } = await import('zlib')
    csvText = gunzipSync(Buffer.from(await csvRes.arrayBuffer())).toString('utf-8')
  } else {
    csvText = await csvRes.text()
  }

  const lines = csvText.split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split('\t').map((h) => h.trim().toLowerCase())
  const col = headers.indexOf('merchant-shipping-group-name')
  if (col === -1) return []

  const names = new Set<string>()
  for (let i = 1; i < lines.length; i++) {
    const name = lines[i].split('\t')[col]?.trim()
    if (name) names.add(name)
  }
  return [...names].sort()
}

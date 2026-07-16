import { withAuth, createSupabaseClient, ok, error } from '@cbt/shared'
import { getSellingAccountCredentials } from '../../../lib/account-client'
import { getAccessToken } from '../../../lib/lwa'

const SP_API_BASE = process.env.SP_API_BASE || 'https://sellingpartnerapi-na.amazon.com'
const DEFAULT_MARKETPLACE = 'ATVPDKIKX0DER'
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

// GET  ?selling_account_id=xxx  → cached templates (từ amz_shipping_templates_cache)
// POST { selling_account_id, force? } → sync từ SP-API Reports, cache, trả về list
export default withAuth(async (req, res, auth) => {
  const supabase = createSupabaseClient()
  const sellingAccountId =
    req.method === 'GET'
      ? (req.query.selling_account_id as string)
      : (req.body?.selling_account_id as string)

  if (!sellingAccountId) return error(res, 400, 'selling_account_id là bắt buộc')

  // ── GET: trả về cache ─────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { data } = await supabase
      .from('amz_shipping_templates_cache')
      .select('template_name, synced_at')
      .eq('account_id', auth.account_id)
      .eq('selling_account_id', sellingAccountId)
      .order('template_name')
    return ok(res, {
      templates: (data ?? []).map((r) => r.template_name),
      synced_at: data?.[0]?.synced_at ?? null,
    })
  }

  // ── POST: sync từ SP-API Reports ──────────────────────────────────────────
  if (req.method === 'POST') {
    // Kiểm tra cache còn tươi không (< 1h) trừ khi force=true
    const { data: cached } = await supabase
      .from('amz_shipping_templates_cache')
      .select('template_name, synced_at')
      .eq('account_id', auth.account_id)
      .eq('selling_account_id', sellingAccountId)
      .order('template_name')

    const cacheAge = cached?.[0]?.synced_at
      ? Date.now() - new Date(cached[0].synced_at).getTime()
      : Infinity

    if (cacheAge < CACHE_TTL_MS && !req.body?.force) {
      return ok(res, {
        templates: (cached ?? []).map((r) => r.template_name),
        synced_at: cached?.[0]?.synced_at ?? null,
        from_cache: true,
      })
    }

    try {
      const credentials = await getSellingAccountCredentials(sellingAccountId)
      const accessToken = await getAccessToken(credentials, sellingAccountId)

      // Lấy marketplace cho selling account này
      const { data: config } = await supabase
        .from('amz_product_configs')
        .select('marketplace_id')
        .eq('selling_account_id', sellingAccountId)
        .maybeSingle()
      const marketplaceId = config?.marketplace_id || DEFAULT_MARKETPLACE

      const templates = await syncShippingTemplatesFromReports(accessToken, marketplaceId)

      if (templates.length > 0) {
        const now = new Date().toISOString()
        // Xóa cache cũ rồi insert mới
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

      return ok(res, { templates, synced_at: new Date().toISOString(), from_cache: false })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync thất bại'
      // Trả stale cache khi lỗi
      if (cached && cached.length > 0) {
        return ok(res, {
          templates: cached.map((r) => r.template_name),
          synced_at: cached[0].synced_at,
          from_cache: true,
          error: msg,
        })
      }
      return error(res, 500, msg)
    }
  }

  return error(res, 405, 'Method not allowed')
})

// ── SP-API Reports helper ─────────────────────────────────────────────────────

async function syncShippingTemplatesFromReports(
  accessToken: string,
  marketplaceId: string
): Promise<string[]> {
  const headers: Record<string, string> = {
    'x-amz-access-token': accessToken,
    'Content-Type': 'application/json',
    'User-Agent': 'CBT-Listing-Studio/1.0 (Language=TypeScript)',
  }

  // 1. Tạo report
  const createRes = await fetch(`${SP_API_BASE}/reports/2021-06-30/reports`, {
    method: 'POST',
    headers,
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

  // 2. Poll đến khi DONE (tối đa ~55s — 11 lần × 5s)
  let reportDocumentId: string | null = null
  for (let i = 0; i < 11; i++) {
    await sleep(5000)
    const pollRes = await fetch(`${SP_API_BASE}/reports/2021-06-30/reports/${reportId}`, { headers })
    if (!pollRes.ok) throw new Error(`Poll report failed (${pollRes.status})`)
    const report = (await pollRes.json()) as {
      processingStatus: string
      reportDocumentId?: string
    }
    if (report.processingStatus === 'DONE') {
      reportDocumentId = report.reportDocumentId ?? null
      break
    }
    if (report.processingStatus === 'FATAL' || report.processingStatus === 'CANCELLED') {
      throw new Error(`Report kết thúc với trạng thái: ${report.processingStatus}`)
    }
    // IN_QUEUE / IN_PROGRESS → tiếp tục poll
  }
  if (!reportDocumentId) throw new Error('Report không hoàn thành trong thời gian cho phép')

  // 3. Lấy URL download
  const docRes = await fetch(
    `${SP_API_BASE}/reports/2021-06-30/documents/${reportDocumentId}`,
    { headers }
  )
  if (!docRes.ok) throw new Error(`Get document failed (${docRes.status})`)
  const { url, compressionAlgorithm } = (await docRes.json()) as {
    url: string
    compressionAlgorithm?: string
  }

  // 4. Download CSV (có thể là GZIP)
  const csvRes = await fetch(url)
  if (!csvRes.ok) throw new Error(`Download CSV failed (${csvRes.status})`)

  let csvText: string
  if (compressionAlgorithm === 'GZIP') {
    const { gunzipSync } = await import('zlib')
    const buf = Buffer.from(await csvRes.arrayBuffer())
    csvText = gunzipSync(buf).toString('utf-8')
  } else {
    csvText = await csvRes.text()
  }

  // 5. Parse TSV — tìm cột merchant-shipping-group-name
  const lines = csvText.split('\n')
  if (lines.length < 2) return []
  const headerCols = lines[0].split('\t').map((h) => h.trim().toLowerCase())
  const col = headerCols.indexOf('merchant-shipping-group-name')
  if (col === -1) return []

  const names = new Set<string>()
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t')
    const name = cols[col]?.trim()
    if (name) names.add(name)
  }
  return [...names].sort()
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

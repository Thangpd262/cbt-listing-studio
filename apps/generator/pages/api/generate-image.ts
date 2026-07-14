import { withAuth, createSupabaseClient, created, error } from '@cbt/shared'
import { generateImage, type ImageProvider } from '../../lib/image'
import { uploadToStorage } from '../../lib/storage'

// POST — generate ONE ad-hoc image from a prompt template (or raw prompt) and
// return its URL. Lighter than the full pipeline; used by the crawl job panel's
// "Gen ảnh AI" button. Persists a gen_assets row so the 30-day cleanup applies.
// Body: { listing_id, prompt_id?, prompt?, platform?, provider? }
export default withAuth(async (req, res, auth) => {
  if (req.method !== 'POST') return error(res, 405, 'Method not allowed')

  const { listing_id, prompt_id, prompt, platform, provider, model } = req.body ?? {}
  if (!listing_id) return error(res, 400, 'listing_id là bắt buộc')

  const supabase = createSupabaseClient()

  // Map a prompt's model to an image provider (fallback: dalle).
  const modelToProvider = (m: string | null): ImageProvider =>
    m === 'gemini-2.5-flash-image' ? 'imagen' : 'dalle'

  // Resolve the prompt text (raw prompt wins; else load the template).
  // The template's model decides the provider unless a raw prompt is used.
  let promptText = typeof prompt === 'string' ? prompt.trim() : ''
  let templateModel: string | null = null
  if (!promptText && prompt_id) {
    const { data: tpl } = await supabase
      .from('prompt_templates')
      .select('content, model')
      .eq('id', prompt_id)
      .eq('account_id', auth.account_id)
      .single()
    if (!tpl) return error(res, 404, 'Prompt template không tồn tại')
    promptText = tpl.content
    templateModel = tpl.model ?? null
  }
  if (!promptText) return error(res, 400, 'Cần prompt_id hoặc prompt')

  const plt = platform === 'walmart' ? 'walmart' : 'amazon'
  // Precedence: explicit body model → template model → provider param → dalle.
  const imgProvider: ImageProvider = model
    ? modelToProvider(model)
    : templateModel
      ? modelToProvider(templateModel)
      : provider === 'imagen'
        ? 'imagen'
        : 'dalle'

  try {
    const gen = await generateImage(promptText, imgProvider)
    const path = `${auth.account_id}/adhoc/${crypto.randomUUID()}.png`
    const url = await uploadToStorage(gen.buffer, path)

    // Best-effort persistence for retention cleanup.
    const { data: job } = await supabase
      .from('gen_jobs')
      .insert({ account_id: auth.account_id, listing_id, platform: plt, status: 'completed', result: { images: [url] } })
      .select('id')
      .single()

    let assetId: string | null = null
    let expiresAt: string | null = null
    if (job) {
      const { data: asset } = await supabase
        .from('gen_assets')
        .insert({
          account_id: auth.account_id,
          job_id: job.id,
          listing_id,
          platform: plt,
          asset_type: 'image',
          storage_path: url,
        })
        .select('id, expires_at')
        .single()
      assetId = asset?.id ?? null
      expiresAt = asset?.expires_at ?? null
    }

    return created(res, { id: assetId, url, expires_at: expiresAt })
  } catch (err) {
    return error(res, 500, err instanceof Error ? err.message : 'Gen ảnh thất bại')
  }
})

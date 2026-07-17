import { createSupabaseClient } from '@cbt/shared'
import { getListing, getSceneAnalysis, type SceneAnalysis } from './crawl-client'
import { generateTitle, generateDescription, generateImagePrompt, GEMINI_TEXT_MODEL } from './gemini'
import { generateImage, type ImageProvider } from './image'
import { uploadToStorage } from './storage'
import { textCost, imageCost, providerForModel } from './spend'
import { logAiCall } from './logAiCall'

type Supabase = ReturnType<typeof createSupabaseClient>

export type GenJob = {
  id: string
  account_id: string
  user_id?: string | null
  listing_id: string
  platform: 'amazon' | 'walmart'
}

// Map the image provider enum to a spend provider string.
const imageProviderName = (p: ImageProvider): string => (p === 'imagen' ? 'google' : 'openai')

const DEFAULT_WALMART_COLORS = [
  'Black', 'White', 'Navy Blue', 'Red', 'Forest Green',
  'Charcoal Gray', 'Burgundy', 'Sand', 'Sky Blue', 'Mustard',
]

// Use scene palette first, then fill up to 10 from defaults.
function getWalmartVariants(scene: SceneAnalysis): string[] {
  const fromPalette = scene.palette.slice(0, 10)
  const merged = [...fromPalette]
  for (const c of DEFAULT_WALMART_COLORS) {
    if (merged.length >= 10) break
    if (!merged.includes(c)) merged.push(c)
  }
  return merged.slice(0, 10)
}

// Generate one image (prompt → image → upload) and record its spend.
async function makeImage(
  supabase: Supabase,
  job: GenJob,
  scene: SceneAnalysis,
  platform: string,
  path: string,
  provider: ImageProvider,
  variant?: { color: string }
): Promise<string> {
  const prompt = await generateImagePrompt(scene, platform, variant)
  // The prompt-building text call is part of producing the image (step image_gen).
  await logAiCall(supabase, {
    account_id: job.account_id,
    user_id: job.user_id,
    listing_id: job.listing_id,
    model: GEMINI_TEXT_MODEL,
    provider: providerForModel(GEMINI_TEXT_MODEL),
    step: 'image_gen',
    images_requested: 0,
    images_received: 0,
    input_tokens: prompt.inputTokens,
    output_tokens: prompt.outputTokens,
    cost_usd: textCost(GEMINI_TEXT_MODEL, prompt.inputTokens, prompt.outputTokens),
  })

  const img = await generateImage(prompt.text, provider)
  const url = await uploadToStorage(img.buffer, path)
  await logAiCall(supabase, {
    account_id: job.account_id,
    user_id: job.user_id,
    listing_id: job.listing_id,
    model: img.model,
    provider: imageProviderName(img.provider),
    step: 'image_gen',
    images_requested: 1,
    images_received: 1,
    cost_usd: imageCost(img.model),
  })
  return url
}

// Shared title + description generation with spend tracking.
async function makeCopy(supabase: Supabase, job: GenJob, scene: SceneAnalysis) {
  const [title, description] = await Promise.all([
    generateTitle(scene, job.platform),
    generateDescription(scene, job.platform),
  ])
  for (const [step, r] of [['title_gen', title], ['desc_gen', description]] as const) {
    await logAiCall(supabase, {
      account_id: job.account_id,
      user_id: job.user_id,
      listing_id: job.listing_id,
      model: GEMINI_TEXT_MODEL,
      provider: providerForModel(GEMINI_TEXT_MODEL),
      step,
      images_requested: 0,
      images_received: 0,
      input_tokens: r.inputTokens,
      output_tokens: r.outputTokens,
      cost_usd: textCost(GEMINI_TEXT_MODEL, r.inputTokens, r.outputTokens),
    })
  }
  return { title: title.text, description: description.text }
}

async function runAmazon(supabase: Supabase, job: GenJob, scene: SceneAnalysis, provider: ImageProvider) {
  const { title, description } = await makeCopy(supabase, job, scene)
  const imageUrl = await makeImage(supabase, job, scene, 'amazon', `${job.account_id}/${job.id}/main.png`, provider)

  await supabase.from('gen_assets').insert([
    { account_id: job.account_id, job_id: job.id, listing_id: job.listing_id, platform: 'amazon', asset_type: 'image', storage_path: imageUrl },
    { account_id: job.account_id, job_id: job.id, listing_id: job.listing_id, platform: 'amazon', asset_type: 'title', content: title },
    { account_id: job.account_id, job_id: job.id, listing_id: job.listing_id, platform: 'amazon', asset_type: 'description', content: description },
  ])

  return { images: [imageUrl], title, description }
}

async function runWalmart(supabase: Supabase, job: GenJob, scene: SceneAnalysis, provider: ImageProvider) {
  const colors = getWalmartVariants(scene)
  const { title, description } = await makeCopy(supabase, job, scene)

  const variants = await Promise.all(
    colors.map(async (color, i) => {
      const url = await makeImage(
        supabase, job, scene, 'walmart', `${job.account_id}/${job.id}/variant-${i}.png`, provider, { color }
      )
      return { variant_id: `v${i + 1}`, color, images: [url] }
    })
  )

  const assetRows = [
    { account_id: job.account_id, job_id: job.id, listing_id: job.listing_id, platform: 'walmart', asset_type: 'title', content: title },
    { account_id: job.account_id, job_id: job.id, listing_id: job.listing_id, platform: 'walmart', asset_type: 'description', content: description },
    ...variants.map((v) => ({
      account_id: job.account_id, job_id: job.id, listing_id: job.listing_id,
      platform: 'walmart', asset_type: 'image', storage_path: v.images[0], variant_id: v.variant_id,
    })),
  ]
  await supabase.from('gen_assets').insert(assetRows)

  return { variants, title, description }
}

// Entry point: run the full generation pipeline for a job. Throws on failure
// (the caller flips gen_jobs.status to 'failed').
export async function runGenerationPipeline(job: GenJob, apiKey: string, provider: ImageProvider = 'dalle') {
  const supabase = createSupabaseClient()

  // Fetch listing (ownership/existence check) + scene analysis in parallel.
  const [, scene] = await Promise.all([
    getListing(job.listing_id, apiKey),
    getSceneAnalysis(job.listing_id, apiKey),
  ])

  return job.platform === 'amazon'
    ? runAmazon(supabase, job, scene, provider)
    : runWalmart(supabase, job, scene, provider)
}

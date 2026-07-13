import { createSupabaseClient } from '@cbt/shared'

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'generated-assets'

// Upload an image buffer to Supabase Storage and return its public URL.
export async function uploadToStorage(buffer: Buffer, path: string): Promise<string> {
  const supabase = createSupabaseClient()
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: 'image/png',
    upsert: true,
  })
  if (error) throw new Error(`Storage upload failed: ${error.message}`)

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return publicUrl
}

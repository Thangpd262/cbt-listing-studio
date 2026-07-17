import { createSupabaseClient } from '@cbt/shared'

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'generated-assets'

// Detect image MIME type from buffer magic bytes.
// Imagen (Gemini) returns JPEG bytes despite being called for PNG — detect so
// we declare the correct content-type and use the right file extension.
function detectMimeType(buf: Buffer): { mime: string; ext: string } {
  if (buf[0] === 0xff && buf[1] === 0xd8) return { mime: 'image/jpeg', ext: 'jpg' }
  if (buf[0] === 0x89 && buf[1] === 0x50) return { mime: 'image/png',  ext: 'png' }
  if (buf[0] === 0x52 && buf[1] === 0x49) return { mime: 'image/webp', ext: 'webp' }
  return { mime: 'image/png', ext: 'png' } // safe default
}

// Upload an image buffer to Supabase Storage and return its public URL.
// The file extension in `path` is replaced with the detected format so the URL
// and content-type always match the actual bytes.
export async function uploadToStorage(buffer: Buffer, path: string): Promise<string> {
  const supabase = createSupabaseClient()
  const { mime, ext } = detectMimeType(buffer)
  // Replace or append the correct extension.
  const finalPath = path.replace(/\.(png|jpg|jpeg|webp)$/i, '') + '.' + ext
  const { error } = await supabase.storage.from(BUCKET).upload(finalPath, buffer, {
    contentType: mime,
    upsert: true,
  })
  if (error) throw new Error(`Storage upload failed: ${error.message}`)

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(finalPath)
  return publicUrl
}

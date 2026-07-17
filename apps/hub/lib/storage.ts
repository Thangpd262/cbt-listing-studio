import { createSupabaseClient } from '@cbt/shared'

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'generated-assets'

// Detect image MIME type from the first bytes of a Buffer.
function detectMimeType(buf: Buffer): { mime: string; ext: string } {
  if (buf[0] === 0xff && buf[1] === 0xd8) return { mime: 'image/jpeg', ext: 'jpg' }
  if (buf[0] === 0x89 && buf[1] === 0x50) return { mime: 'image/png',  ext: 'png' }
  if (buf[0] === 0x52 && buf[1] === 0x49) return { mime: 'image/webp', ext: 'webp' }
  return { mime: 'image/jpeg', ext: 'jpg' }
}

// Upload a Buffer to Supabase Storage and return its public URL.
export async function uploadToStorage(buffer: Buffer, path: string): Promise<string> {
  const supabase = createSupabaseClient()
  const { mime, ext } = detectMimeType(buffer)
  const finalPath = path.replace(/\.(png|jpg|jpeg|webp)$/i, '') + '.' + ext
  const { error } = await supabase.storage.from(BUCKET).upload(finalPath, buffer, {
    contentType: mime,
    upsert: true,
  })
  if (error) throw new Error(`Storage upload failed: ${error.message}`)
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(finalPath)
  return publicUrl
}

// Extract the storage object path from a public URL (for deletion).
export function objectPath(publicUrl: string): string | null {
  const marker = `/object/public/${BUCKET}/`
  const i = publicUrl.indexOf(marker)
  if (i === -1) return null
  return decodeURIComponent(publicUrl.slice(i + marker.length))
}

export { BUCKET }

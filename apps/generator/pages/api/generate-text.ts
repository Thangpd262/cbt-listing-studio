import { withAuth, ok, error } from '@cbt/shared'
import { generateDescriptionFromTitle } from '../../lib/gemini'

// POST — generate marketing text from a title. Currently supports
// kind='description'. Called server-to-server by list-amz for the
// "AI viết mô tả" flag. Body: { kind, title, platform? }
export default withAuth(async (req, res) => {
  if (req.method !== 'POST') return error(res, 405, 'Method not allowed')

  const { kind, title, platform } = req.body ?? {}
  if (kind !== 'description') return error(res, 400, "kind='description' required")
  if (!title || typeof title !== 'string') return error(res, 400, 'title là bắt buộc')

  try {
    const { text } = await generateDescriptionFromTitle(title, platform === 'walmart' ? 'walmart' : 'amazon')
    return ok(res, { text })
  } catch (err) {
    return error(res, 500, err instanceof Error ? err.message : 'Gen mô tả thất bại')
  }
})

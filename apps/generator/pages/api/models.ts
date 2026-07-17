import { withAuth, ok, error, IMAGE_MODELS } from '@cbt/shared'

// GET — list available image models from the shared constant. Any valid API key
// may read this (drives the Hub model dropdown + cost display).
export default withAuth(async (req, res) => {
  if (req.method !== 'GET') return error(res, 405, 'Method not allowed')
  return ok(res, IMAGE_MODELS)
})

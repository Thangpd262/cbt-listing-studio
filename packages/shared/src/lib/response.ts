import type { NextApiResponse } from 'next'

export function ok(res: NextApiResponse, data: unknown) {
  return res.status(200).json({ success: true, data })
}

export function created(res: NextApiResponse, data: unknown) {
  return res.status(201).json({ success: true, data })
}

export function error(res: NextApiResponse, status: number, message: string) {
  return res.status(status).json({ success: false, error: message })
}

export function paginated(
  res: NextApiResponse,
  data: unknown,
  total: number,
  page: number,
  limit: number
) {
  return res.status(200).json({
    success: true,
    data,
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  })
}

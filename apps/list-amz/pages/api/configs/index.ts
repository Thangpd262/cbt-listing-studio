import { withAuth, createSupabaseClient, ok, error } from '@cbt/shared'

// GET — config for a selling account (?selling_account_id=)
// PUT — upsert config (marketplace, default shipping template / product type, extra config)
export default withAuth(async (req, res, auth) => {
  const supabase = createSupabaseClient()
  const sellingAccountId = (req.query.selling_account_id as string) ?? req.body?.selling_account_id
  if (!sellingAccountId) return error(res, 400, 'selling_account_id là bắt buộc')

  if (req.method === 'GET') {
    const { data, error: dbError } = await supabase
      .from('amz_product_configs')
      .select('*')
      .eq('account_id', auth.account_id)
      .eq('selling_account_id', sellingAccountId)
      .maybeSingle()
    if (dbError) return error(res, 500, dbError.message)
    return ok(res, data)
  }

  if (req.method === 'PUT') {
    const { default_shipping_template, default_product_type, marketplace_id, config } = req.body ?? {}
    const { data, error: dbError } = await supabase
      .from('amz_product_configs')
      .upsert(
        {
          account_id: auth.account_id,
          selling_account_id: sellingAccountId,
          ...(default_shipping_template !== undefined ? { default_shipping_template } : {}),
          ...(default_product_type !== undefined ? { default_product_type } : {}),
          ...(marketplace_id !== undefined ? { marketplace_id } : {}),
          ...(config !== undefined ? { config } : {}),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'selling_account_id' }
      )
      .select('*')
      .single()
    if (dbError || !data) return error(res, 500, dbError?.message ?? 'Upsert config thất bại')
    return ok(res, data)
  }

  return error(res, 405, 'Method not allowed')
})

// Builds SP-API attribute objects from a product_configs row (wrap/kind schema).
// Matches the field schema used in amz-spapi-asin project.

export type FieldWrap = 'mkt' | 'lang' | 'raw' | ''
export type FieldKind =
  | 'attr'
  | 'keywords'
  | 'bullets'
  | 'price'
  | 'qty'
  | 'handling_time'
  | 'image'
  | 'images'
  | 'parent'
  | 'gtin'

export type FieldDef = {
  k: string
  label: string
  type: string
  def: string
  attr: string
  wrap: FieldWrap
  kind: FieldKind
  options?: string
}

export type ProductConfig = {
  key: string
  product_type: string
  variation_theme: string | null
  fields: FieldDef[]
}

const LANG = 'en_US'
const NON_ATTR_KINDS: FieldKind[] = ['price', 'qty', 'handling_time', 'parent', 'gtin']

// Wrap a single scalar value with marketplace context.
const mkt = (v: unknown, mktId: string) => [{ value: v, marketplace_id: mktId }]
const lang = (v: unknown, mktId: string) => [{ value: v, language_tag: LANG, marketplace_id: mktId }]

/**
 * Build the SP-API `attributes` object from config fields + user-supplied values.
 * Does NOT include offer (price/qty) or variation attributes — those are separate.
 */
export function buildAttributesFromConfig(
  fields: FieldDef[],
  values: Record<string, string>,
  marketplaceId: string
): Record<string, unknown> {
  const attrs: Record<string, unknown> = {}

  for (const field of fields) {
    // User-entered value wins, but an empty string (field left blank) must fall
    // back to the config default — `??` would keep the empty string.
    const rawValue = (values[field.k]?.trim() || field.def || '').trim()

    // Image kinds (no attr name, handled as locator keys)
    if (field.kind === 'image') {
      if (rawValue) {
        attrs['main_product_image_locator'] = [{ media_location: rawValue, marketplace_id: marketplaceId }]
      }
      continue
    }
    if (field.kind === 'images') {
      // Config images are the default set → placed last. Crawl images (carried
      // from the source listing under the synthetic `__crawl_images__` key) lead.
      // Only the 8 "other" slots are filled here — the main image is a separate
      // `image` field, so the effective total is 1 main + 8 = 9.
      const configUrls = rawValue.split('\n').map((u) => u.trim()).filter(Boolean)
      const crawlUrls = (values['__crawl_images__'] ?? '').split('\n').map((u) => u.trim()).filter(Boolean)
      const MAX_OTHER = 8
      const crawlSlots = Math.max(0, MAX_OTHER - configUrls.length)
      const merged = [...crawlUrls.slice(0, crawlSlots), ...configUrls].slice(0, MAX_OTHER)
      merged.forEach((url, i) => {
        attrs[`other_product_image_locator_${i + 1}`] = [{ media_location: url, marketplace_id: marketplaceId }]
      })
      continue
    }

    // Non-attribute kinds (price, qty, handling_time, parent, gtin)
    if (NON_ATTR_KINDS.includes(field.kind)) continue
    if (!field.attr || field.wrap === '') continue
    if (!rawValue) continue

    // Keywords → array of lang-wrapped terms
    if (field.kind === 'keywords') {
      const terms = rawValue.split('\n').map((s) => s.trim()).filter(Boolean)
      if (terms.length) {
        attrs[field.attr] = terms.map((t) => ({ value: t, language_tag: LANG, marketplace_id: marketplaceId }))
      }
      continue
    }

    // Bullets → array of lang-wrapped strings
    if (field.kind === 'bullets') {
      const bullets = rawValue.split('\n').map((s) => s.trim()).filter(Boolean)
      if (bullets.length) {
        attrs[field.attr] = bullets.map((b) => ({ value: b, language_tag: LANG, marketplace_id: marketplaceId }))
      }
      continue
    }

    // Regular attribute
    switch (field.wrap) {
      case 'mkt':
        attrs[field.attr] = mkt(rawValue, marketplaceId)
        break
      case 'lang':
        attrs[field.attr] = lang(rawValue, marketplaceId)
        break
      case 'raw':
        try {
          attrs[field.attr] = JSON.parse(rawValue)
        } catch {
          // skip malformed JSON — don't crash the whole build
        }
        break
    }
  }

  return attrs
}

/**
 * Build offer attributes: purchasable_offer + fulfillment_availability.
 * Extracted from price/qty/handling_time fields.
 */
export function buildOfferAttributes(
  fields: FieldDef[],
  values: Record<string, string>,
  marketplaceId: string
): Record<string, unknown> {
  const get = (kind: FieldKind) => {
    const field = fields.find((f) => f.kind === kind)
    return (values[field?.k ?? '']?.trim() || field?.def || '').trim()
  }

  const price = parseFloat(get('price'))
  const qty = parseInt(get('qty'), 10)
  const handling = parseInt(get('handling_time'), 10)

  const attrs: Record<string, unknown> = {}

  if (!isNaN(price) && price > 0) {
    attrs['purchasable_offer'] = [
      {
        marketplace_id: marketplaceId,
        currency: 'USD',
        our_price: [{ schedule: [{ value_with_tax: price }] }],
      },
    ]
  }

  // fulfillment_availability takes no marketplace_id, and the handling-time key
  // is `handling_time` (not lead_time_to_ship_max_days).
  attrs['fulfillment_availability'] = [
    {
      fulfillment_channel_code: 'DEFAULT',
      quantity: isNaN(qty) ? 0 : qty,
      ...(handling > 0 ? { handling_time: handling } : {}),
    },
  ]

  return attrs
}

/**
 * Build variation attributes (parentage_level, variation_theme, child relationship).
 * parentSku present → child listing; absent → parent listing (or standalone if no variationTheme).
 */
export function buildVariationAttributes(
  fields: FieldDef[],
  values: Record<string, string>,
  variationTheme: string | null,
  marketplaceId: string
): Record<string, unknown> {
  if (!variationTheme) return {}

  const parentField = fields.find((f) => f.kind === 'parent')
  const parentSku = (values[parentField?.k ?? 'parent']?.trim() || parentField?.def || '').trim()

  const attrs: Record<string, unknown> = {
    variation_theme: [{ name: variationTheme, marketplace_id: marketplaceId }],
  }

  if (parentSku) {
    attrs['parentage_level'] = mkt('child', marketplaceId)
    attrs['child_parent_sku_relationship'] = [
      {
        child_relationship_type: 'variation',
        parent_sku: parentSku,
        marketplace_id: marketplaceId,
      },
    ]
  } else {
    attrs['parentage_level'] = mkt('parent', marketplaceId)
  }

  return attrs
}

/**
 * Assemble the full SP-API PUT body from a ProductConfig + field values.
 */
export function buildListingBodyFromConfig(
  config: ProductConfig,
  values: Record<string, string>,
  marketplaceId: string
): object {
  const attributes = {
    ...buildAttributesFromConfig(config.fields, values, marketplaceId),
    ...buildOfferAttributes(config.fields, values, marketplaceId),
    ...buildVariationAttributes(config.fields, values, config.variation_theme, marketplaceId),
  }

  return {
    productType: config.product_type,
    requirements: 'LISTING',
    attributes,
  }
}

-- 026: remove supplier_declared_dg_hz_regulation field from all product configs.
-- This attribute is inapplicable for apparel, mugs, candles, hats — Amazon
-- returns a 90000900 warning when it is submitted for these product types.
-- The field definition (k: supplier_dg) is stripped from the fields JSONB array.

UPDATE product_configs
SET
  fields = (
    SELECT jsonb_agg(f)
    FROM jsonb_array_elements(fields) AS f
    WHERE f->>'k' <> 'supplier_dg'
  ),
  updated_at = now()
WHERE platform = 'amazon';

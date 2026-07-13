-- Product type configs (field definitions + wrap/kind schema).
-- One row per product type per platform (amazon | walmart).
-- fields JSONB: array of { k, label, type, def, attr, wrap, kind, options? }
--   wrap: "mkt" | "lang" | "raw" | ""
--   kind: "attr" | "keywords" | "bullets" | "price" | "qty" | "handling_time" |
--         "image" | "images" | "parent" | "gtin" | "wm_sizes"

CREATE TABLE IF NOT EXISTS product_configs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key             TEXT NOT NULL UNIQUE,           -- e.g. AMZ_TSHIRT, WALMART_MUG
  label           TEXT NOT NULL,
  platform        TEXT NOT NULL DEFAULT 'amazon' CHECK (platform IN ('amazon', 'walmart')),
  product_type    TEXT NOT NULL,                  -- Amazon: SHIRT / Walmart: T-Shirts
  variation_theme TEXT,                           -- Amazon: SIZE/COLOR, COLOR_NAME... / null = no variation
  fields          JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_configs_platform ON product_configs(platform);

-- ─── Seed: Amazon T-Shirt ───────────────────────────────────────────────────

INSERT INTO product_configs (key, label, platform, product_type, variation_theme, fields) VALUES
('AMZ_TSHIRT', 'Áo thun Amazon (SHIRT / SIZE+COLOR)', 'amazon', 'SHIRT', 'SIZE/COLOR', '[
  {"k":"condition_type","label":"Condition","type":"text","def":"new_new","attr":"condition_type","wrap":"mkt","kind":"attr"},
  {"k":"brand","label":"Brand","type":"text","def":"ACIVTO","attr":"brand","wrap":"mkt","kind":"attr"},
  {"k":"gtin_exempt","label":"Miễn GTIN","type":"text","def":"true","attr":"supplier_declared_has_product_identifier_exemption","wrap":"mkt","kind":"attr"},
  {"k":"item_type_keyword","label":"Category","type":"text","def":"novelty-fashion-t-shirts","attr":"item_type_keyword","wrap":"mkt","kind":"attr"},
  {"k":"model_name","label":"Model name","type":"text","def":"Graphic T-Shirt","attr":"model_name","wrap":"mkt","kind":"attr"},
  {"k":"style","label":"Style","type":"text","def":"Graphic Tee","attr":"style","wrap":"lang","kind":"attr"},
  {"k":"item_name","label":"Tên sản phẩm","type":"text","def":"","attr":"item_name","wrap":"lang","kind":"attr"},
  {"k":"search_terms","label":"Search Terms","type":"textarea","def":"","attr":"generic_keyword","wrap":"","kind":"keywords"},
  {"k":"product_description","label":"Mô tả","type":"textarea","def":"Premium quality graphic t-shirt with vibrant, fade-resistant print. Made from soft 100% cotton for all-day comfort.","attr":"product_description","wrap":"lang","kind":"attr"},
  {"k":"bullets","label":"Bullet points","type":"textarea","def":"PREMIUM COTTON — Soft, breathable 100% ring-spun cotton\nVIBRANT PRINT — Fade-resistant graphic that lasts wash after wash\nCLASSIC FIT — Relaxed, comfortable fit for everyday wear\nMACHINE WASHABLE — Machine wash cold, tumble dry low\nPERFECT GIFT — Great for birthdays, holidays, and any occasion","attr":"bullet_point","wrap":"lang","kind":"bullets"},
  {"k":"material","label":"Chất liệu","type":"text","def":"Cotton","attr":"material","wrap":"mkt","kind":"attr"},
  {"k":"fabric_type","label":"Fabric type","type":"text","def":"100% Cotton","attr":"fabric_type","wrap":"mkt","kind":"attr"},
  {"k":"target_gender","label":"Gender","type":"select","options":"unisex,male,female","def":"unisex","attr":"target_gender","wrap":"mkt","kind":"attr"},
  {"k":"department","label":"Department","type":"select","options":"unisex-adult,mens,womens,boys,girls","def":"unisex-adult","attr":"department","wrap":"mkt","kind":"attr"},
  {"k":"age_range_description","label":"Age Range","type":"text","def":"Adult","attr":"age_range_description","wrap":"lang","kind":"attr"},
  {"k":"care_instructions","label":"Care instructions","type":"text","def":"Machine Wash Cold, Tumble Dry Low","attr":"care_instructions","wrap":"lang","kind":"attr"},
  {"k":"color","label":"Màu (child listing)","type":"text","def":"","attr":"color","wrap":"lang","kind":"attr"},
  {"k":"color_map","label":"Color Map","type":"text","def":"","attr":"color_map","wrap":"mkt","kind":"attr"},
  {"k":"size","label":"Size hiển thị","type":"text","def":"","attr":"size","wrap":"lang","kind":"attr"},
  {"k":"shirt_size","label":"Shirt Size","type":"select","options":"s,m,l,x_l,2x_l,3x_l,4x_l,5x_l","def":"l","attr":"shirt_size","wrap":"mkt","kind":"attr"},
  {"k":"size_map","label":"Size Map","type":"select","options":"xx_small,x_small,small,medium,large,x_large,xx_large,3x_large,4x_large,5x_large","def":"large","attr":"size_map","wrap":"mkt","kind":"attr"},
  {"k":"number_of_items","label":"Số lượng trong gói","type":"number","def":"1","attr":"number_of_items","wrap":"mkt","kind":"attr"},
  {"k":"special_feature","label":"Special features (JSON)","type":"text","def":"[{\"value\":\"Graphic Print\",\"language_tag\":\"en_US\",\"marketplace_id\":\"ATVPDKIKX0DER\"},{\"value\":\"Machine Washable\",\"language_tag\":\"en_US\",\"marketplace_id\":\"ATVPDKIKX0DER\"}]","attr":"special_feature","wrap":"raw","kind":"attr"},
  {"k":"manufacturer","label":"Manufacturer","type":"text","def":"ACIVTO","attr":"manufacturer","wrap":"mkt","kind":"attr"},
  {"k":"model_number","label":"Model number","type":"text","def":"ACIVTO-TSH-01","attr":"model_number","wrap":"mkt","kind":"attr"},
  {"k":"included_components","label":"Included components","type":"text","def":"T-Shirt","attr":"included_components","wrap":"lang","kind":"attr"},
  {"k":"unit_count","label":"Unit count (JSON)","type":"text","def":"[{\"value\":1,\"type\":{\"value\":\"Count\",\"language_tag\":\"en_US\"},\"marketplace_id\":\"ATVPDKIKX0DER\"}]","attr":"unit_count","wrap":"raw","kind":"attr"},
  {"k":"supplier_dg","label":"Dangerous Goods","type":"text","def":"not_applicable","attr":"supplier_declared_dg_hz_regulation","wrap":"mkt","kind":"attr"},
  {"k":"list_price","label":"List price (JSON)","type":"text","def":"[{\"marketplace_id\":\"ATVPDKIKX0DER\",\"currency\":\"USD\",\"value\":24.99}]","attr":"list_price","wrap":"raw","kind":"attr"},
  {"k":"country_of_origin","label":"Xuất xứ","type":"text","def":"US","attr":"country_of_origin","wrap":"mkt","kind":"attr"},
  {"k":"price","label":"Giá (USD)","type":"number","def":"24.99","attr":"","wrap":"","kind":"price"},
  {"k":"qty","label":"Tồn kho","type":"number","def":"50","attr":"","wrap":"","kind":"qty"},
  {"k":"handling_time","label":"Handling time (ngày)","type":"number","def":"3","attr":"","wrap":"","kind":"handling_time"},
  {"k":"img","label":"Ảnh chính (URL)","type":"text","def":"","attr":"","wrap":"","kind":"image"},
  {"k":"parent","label":"SKU cha","type":"text","def":"","attr":"","wrap":"","kind":"parent"},
  {"k":"gtin","label":"GTIN/UPC","type":"text","def":"","attr":"","wrap":"","kind":"gtin"},
  {"k":"images","label":"Ảnh phụ","type":"textarea","def":"","attr":"","wrap":"","kind":"images"}
]'::jsonb)
ON CONFLICT (key) DO UPDATE SET label=EXCLUDED.label, product_type=EXCLUDED.product_type,
  variation_theme=EXCLUDED.variation_theme, fields=EXCLUDED.fields, updated_at=NOW();

-- ─── Seed: Amazon Sweatshirt/Hoodie ────────────────────────────────────────

INSERT INTO product_configs (key, label, platform, product_type, variation_theme, fields) VALUES
('AMZ_SWEATSHIRT', 'Áo Sweatshirt/Hoodie Amazon (SWEATSHIRT / SIZE+COLOR)', 'amazon', 'SWEATSHIRT', 'SIZE/COLOR', '[
  {"k":"condition_type","label":"Condition","type":"text","def":"new_new","attr":"condition_type","wrap":"mkt","kind":"attr"},
  {"k":"brand","label":"Brand","type":"text","def":"ACIVTO","attr":"brand","wrap":"mkt","kind":"attr"},
  {"k":"gtin_exempt","label":"Miễn GTIN","type":"text","def":"true","attr":"supplier_declared_has_product_identifier_exemption","wrap":"mkt","kind":"attr"},
  {"k":"item_type_keyword","label":"Category","type":"text","def":"fashion-hoodies-sweatshirts","attr":"item_type_keyword","wrap":"mkt","kind":"attr"},
  {"k":"model_name","label":"Model name","type":"text","def":"Graphic Sweatshirt","attr":"model_name","wrap":"mkt","kind":"attr"},
  {"k":"style","label":"Style","type":"text","def":"Graphic Sweatshirt","attr":"style","wrap":"lang","kind":"attr"},
  {"k":"item_name","label":"Tên sản phẩm","type":"text","def":"","attr":"item_name","wrap":"lang","kind":"attr"},
  {"k":"search_terms","label":"Search Terms","type":"textarea","def":"","attr":"generic_keyword","wrap":"","kind":"keywords"},
  {"k":"product_description","label":"Mô tả","type":"textarea","def":"Premium quality graphic sweatshirt with vibrant, fade-resistant print. Soft fleece interior for warmth and comfort.","attr":"product_description","wrap":"lang","kind":"attr"},
  {"k":"bullets","label":"Bullet points","type":"textarea","def":"PREMIUM FLEECE — Soft, warm 50% Cotton / 50% Polyester blend\nVIBRANT PRINT — Fade-resistant graphic that lasts wash after wash\nCOMFY FIT — Classic relaxed fit, ribbed cuffs and waistband\nMACHINE WASHABLE — Machine wash cold, tumble dry low\nPERFECT GIFT — Great for birthdays, holidays, and any occasion","attr":"bullet_point","wrap":"lang","kind":"bullets"},
  {"k":"material","label":"Chất liệu","type":"text","def":"Cotton, Polyester","attr":"material","wrap":"mkt","kind":"attr"},
  {"k":"fabric_type","label":"Fabric type","type":"text","def":"50% Cotton, 50% Polyester","attr":"fabric_type","wrap":"mkt","kind":"attr"},
  {"k":"closure_type","label":"Closure Type","type":"select","options":"pullover,full_zip,half_zip","def":"pullover","attr":"closure_type","wrap":"mkt","kind":"attr"},
  {"k":"hood_type","label":"Hood Type","type":"select","options":"hooded,no_hood","def":"hooded","attr":"hood_type","wrap":"mkt","kind":"attr"},
  {"k":"target_gender","label":"Gender","type":"select","options":"unisex,male,female","def":"unisex","attr":"target_gender","wrap":"mkt","kind":"attr"},
  {"k":"department","label":"Department","type":"select","options":"unisex-adult,mens,womens,boys,girls","def":"unisex-adult","attr":"department","wrap":"mkt","kind":"attr"},
  {"k":"age_range_description","label":"Age Range","type":"text","def":"Adult","attr":"age_range_description","wrap":"lang","kind":"attr"},
  {"k":"care_instructions","label":"Care instructions","type":"text","def":"Machine Wash Cold, Tumble Dry Low","attr":"care_instructions","wrap":"lang","kind":"attr"},
  {"k":"color","label":"Màu (child listing)","type":"text","def":"","attr":"color","wrap":"lang","kind":"attr"},
  {"k":"color_map","label":"Color Map","type":"text","def":"","attr":"color_map","wrap":"mkt","kind":"attr"},
  {"k":"size","label":"Size hiển thị","type":"text","def":"","attr":"size","wrap":"lang","kind":"attr"},
  {"k":"sweatshirt_size","label":"Sweatshirt Size","type":"select","options":"s,m,l,x_l,2x_l,3x_l,4x_l,5x_l","def":"l","attr":"sweatshirt_size","wrap":"mkt","kind":"attr"},
  {"k":"size_map","label":"Size Map","type":"select","options":"xx_small,x_small,small,medium,large,x_large,xx_large,3x_large,4x_large,5x_large","def":"large","attr":"size_map","wrap":"mkt","kind":"attr"},
  {"k":"number_of_items","label":"Số lượng trong gói","type":"number","def":"1","attr":"number_of_items","wrap":"mkt","kind":"attr"},
  {"k":"special_feature","label":"Special features (JSON)","type":"text","def":"[{\"value\":\"Graphic Print\",\"language_tag\":\"en_US\",\"marketplace_id\":\"ATVPDKIKX0DER\"},{\"value\":\"Fleece Lined\",\"language_tag\":\"en_US\",\"marketplace_id\":\"ATVPDKIKX0DER\"}]","attr":"special_feature","wrap":"raw","kind":"attr"},
  {"k":"manufacturer","label":"Manufacturer","type":"text","def":"ACIVTO","attr":"manufacturer","wrap":"mkt","kind":"attr"},
  {"k":"model_number","label":"Model number","type":"text","def":"ACIVTO-SWT-01","attr":"model_number","wrap":"mkt","kind":"attr"},
  {"k":"included_components","label":"Included components","type":"text","def":"Sweatshirt","attr":"included_components","wrap":"lang","kind":"attr"},
  {"k":"unit_count","label":"Unit count (JSON)","type":"text","def":"[{\"value\":1,\"type\":{\"value\":\"Count\",\"language_tag\":\"en_US\"},\"marketplace_id\":\"ATVPDKIKX0DER\"}]","attr":"unit_count","wrap":"raw","kind":"attr"},
  {"k":"supplier_dg","label":"Dangerous Goods","type":"text","def":"not_applicable","attr":"supplier_declared_dg_hz_regulation","wrap":"mkt","kind":"attr"},
  {"k":"list_price","label":"List price (JSON)","type":"text","def":"[{\"marketplace_id\":\"ATVPDKIKX0DER\",\"currency\":\"USD\",\"value\":34.99}]","attr":"list_price","wrap":"raw","kind":"attr"},
  {"k":"country_of_origin","label":"Xuất xứ","type":"text","def":"US","attr":"country_of_origin","wrap":"mkt","kind":"attr"},
  {"k":"price","label":"Giá (USD)","type":"number","def":"34.99","attr":"","wrap":"","kind":"price"},
  {"k":"qty","label":"Tồn kho","type":"number","def":"50","attr":"","wrap":"","kind":"qty"},
  {"k":"handling_time","label":"Handling time","type":"number","def":"3","attr":"","wrap":"","kind":"handling_time"},
  {"k":"img","label":"Ảnh chính","type":"text","def":"","attr":"","wrap":"","kind":"image"},
  {"k":"parent","label":"SKU cha","type":"text","def":"","attr":"","wrap":"","kind":"parent"},
  {"k":"gtin","label":"GTIN/UPC","type":"text","def":"","attr":"","wrap":"","kind":"gtin"},
  {"k":"images","label":"Ảnh phụ","type":"textarea","def":"","attr":"","wrap":"","kind":"images"}
]'::jsonb)
ON CONFLICT (key) DO UPDATE SET label=EXCLUDED.label, product_type=EXCLUDED.product_type,
  variation_theme=EXCLUDED.variation_theme, fields=EXCLUDED.fields, updated_at=NOW();

-- ─── Seed: Amazon Hat ───────────────────────────────────────────────────────

INSERT INTO product_configs (key, label, platform, product_type, variation_theme, fields) VALUES
('AMZ_HAT', 'Mũ lưỡi trai Amazon (HAT / COLOR)', 'amazon', 'HAT', 'COLOR_NAME', '[
  {"k":"condition_type","label":"Condition","type":"text","def":"new_new","attr":"condition_type","wrap":"mkt","kind":"attr"},
  {"k":"brand","label":"Brand","type":"text","def":"ACIVTO","attr":"brand","wrap":"mkt","kind":"attr"},
  {"k":"gtin_exempt","label":"Miễn GTIN","type":"text","def":"true","attr":"supplier_declared_has_product_identifier_exemption","wrap":"mkt","kind":"attr"},
  {"k":"item_type_keyword","label":"Category","type":"text","def":"baseball-caps","attr":"item_type_keyword","wrap":"mkt","kind":"attr"},
  {"k":"model_name","label":"Model name","type":"text","def":"Graphic Baseball Cap","attr":"model_name","wrap":"mkt","kind":"attr"},
  {"k":"style","label":"Style","type":"text","def":"Baseball Cap","attr":"style","wrap":"lang","kind":"attr"},
  {"k":"item_name","label":"Tên sản phẩm","type":"text","def":"","attr":"item_name","wrap":"lang","kind":"attr"},
  {"k":"search_terms","label":"Search Terms","type":"textarea","def":"","attr":"generic_keyword","wrap":"","kind":"keywords"},
  {"k":"product_description","label":"Mô tả","type":"textarea","def":"Classic adjustable baseball cap with unique design. Made from durable 65% polyester / 35% cotton blend. One size fits most with adjustable snapback closure.","attr":"product_description","wrap":"lang","kind":"attr"},
  {"k":"bullets","label":"Bullet points","type":"textarea","def":"ADJUSTABLE FIT — One size fits most with snapback closure\nDURABLE MATERIAL — 65% Polyester / 35% Cotton blend\nSTRUCTURED DESIGN — Pre-curved brim, 6-panel construction\nUNIQUE GRAPHIC — Vibrant printed or embroidered design\nPERFECT GIFT — Great for fans, sports lovers, and casual wear","attr":"bullet_point","wrap":"lang","kind":"bullets"},
  {"k":"material","label":"Chất liệu","type":"text","def":"Polyester, Cotton","attr":"material","wrap":"mkt","kind":"attr"},
  {"k":"fabric_type","label":"Fabric type","type":"text","def":"65% Polyester, 35% Cotton","attr":"fabric_type","wrap":"mkt","kind":"attr"},
  {"k":"closure_type","label":"Closure Type","type":"select","options":"snapback,flexfit,fitted,velcro,buckle","def":"snapback","attr":"closure_type","wrap":"mkt","kind":"attr"},
  {"k":"hat_size","label":"Hat Size","type":"select","options":"one_size,s_m,l_xl,s,m,l,x_l","def":"one_size","attr":"hat_size","wrap":"mkt","kind":"attr"},
  {"k":"target_gender","label":"Gender","type":"select","options":"unisex,male,female","def":"unisex","attr":"target_gender","wrap":"mkt","kind":"attr"},
  {"k":"department","label":"Department","type":"select","options":"unisex-adult,mens,womens,boys,girls","def":"unisex-adult","attr":"department","wrap":"mkt","kind":"attr"},
  {"k":"age_range_description","label":"Age Range","type":"text","def":"Adult","attr":"age_range_description","wrap":"lang","kind":"attr"},
  {"k":"care_instructions","label":"Care instructions","type":"text","def":"Spot Clean Only","attr":"care_instructions","wrap":"lang","kind":"attr"},
  {"k":"color","label":"Màu (child listing)","type":"text","def":"","attr":"color","wrap":"lang","kind":"attr"},
  {"k":"color_map","label":"Color Map","type":"text","def":"","attr":"color_map","wrap":"mkt","kind":"attr"},
  {"k":"number_of_items","label":"Số lượng trong gói","type":"number","def":"1","attr":"number_of_items","wrap":"mkt","kind":"attr"},
  {"k":"special_feature","label":"Special features (JSON)","type":"text","def":"[{\"value\":\"Adjustable\",\"language_tag\":\"en_US\",\"marketplace_id\":\"ATVPDKIKX0DER\"},{\"value\":\"Structured\",\"language_tag\":\"en_US\",\"marketplace_id\":\"ATVPDKIKX0DER\"}]","attr":"special_feature","wrap":"raw","kind":"attr"},
  {"k":"supplier_dg","label":"Dangerous Goods","type":"text","def":"not_applicable","attr":"supplier_declared_dg_hz_regulation","wrap":"mkt","kind":"attr"},
  {"k":"manufacturer","label":"Manufacturer","type":"text","def":"ACIVTO","attr":"manufacturer","wrap":"mkt","kind":"attr"},
  {"k":"model_number","label":"Model number","type":"text","def":"ACIVTO-HAT-01","attr":"model_number","wrap":"mkt","kind":"attr"},
  {"k":"included_components","label":"Included components","type":"text","def":"Baseball Cap","attr":"included_components","wrap":"lang","kind":"attr"},
  {"k":"unit_count","label":"Unit count (JSON)","type":"text","def":"[{\"value\":1,\"type\":{\"value\":\"Count\",\"language_tag\":\"en_US\"},\"marketplace_id\":\"ATVPDKIKX0DER\"}]","attr":"unit_count","wrap":"raw","kind":"attr"},
  {"k":"list_price","label":"List price (JSON)","type":"text","def":"[{\"marketplace_id\":\"ATVPDKIKX0DER\",\"currency\":\"USD\",\"value\":19.99}]","attr":"list_price","wrap":"raw","kind":"attr"},
  {"k":"country_of_origin","label":"Xuất xứ","type":"text","def":"US","attr":"country_of_origin","wrap":"mkt","kind":"attr"},
  {"k":"price","label":"Giá (USD)","type":"number","def":"19.99","attr":"","wrap":"","kind":"price"},
  {"k":"qty","label":"Tồn kho","type":"number","def":"50","attr":"","wrap":"","kind":"qty"},
  {"k":"handling_time","label":"Handling time","type":"number","def":"3","attr":"","wrap":"","kind":"handling_time"},
  {"k":"img","label":"Ảnh chính","type":"text","def":"","attr":"","wrap":"","kind":"image"},
  {"k":"parent","label":"SKU cha","type":"text","def":"","attr":"","wrap":"","kind":"parent"},
  {"k":"gtin","label":"GTIN/UPC","type":"text","def":"","attr":"","wrap":"","kind":"gtin"},
  {"k":"images","label":"Ảnh phụ","type":"textarea","def":"","attr":"","wrap":"","kind":"images"}
]'::jsonb)
ON CONFLICT (key) DO UPDATE SET label=EXCLUDED.label, product_type=EXCLUDED.product_type,
  variation_theme=EXCLUDED.variation_theme, fields=EXCLUDED.fields, updated_at=NOW();

-- ─── Seed: Amazon Mug ───────────────────────────────────────────────────────

INSERT INTO product_configs (key, label, platform, product_type, variation_theme, fields) VALUES
('AMZ_MUG', 'Cốc sứ Amazon (DRINKING_CUP / SIZE)', 'amazon', 'DRINKING_CUP', 'SIZE_NAME', '[
  {"k":"condition_type","label":"Condition","type":"text","def":"new_new","attr":"condition_type","wrap":"mkt","kind":"attr"},
  {"k":"brand","label":"Brand","type":"text","def":"ACIVTO","attr":"brand","wrap":"mkt","kind":"attr"},
  {"k":"gtin_exempt","label":"Miễn GTIN","type":"text","def":"true","attr":"supplier_declared_has_product_identifier_exemption","wrap":"mkt","kind":"attr"},
  {"k":"item_type_keyword","label":"Category","type":"text","def":"coffee-cups-mugs","attr":"item_type_keyword","wrap":"mkt","kind":"attr"},
  {"k":"model_name","label":"Model name","type":"text","def":"Coffee Mug","attr":"model_name","wrap":"mkt","kind":"attr"},
  {"k":"style","label":"Style","type":"text","def":"Coffee Mug","attr":"style","wrap":"lang","kind":"attr"},
  {"k":"item_name","label":"Tên sản phẩm","type":"text","def":"","attr":"item_name","wrap":"lang","kind":"attr"},
  {"k":"search_terms","label":"Search Terms","type":"textarea","def":"","attr":"generic_keyword","wrap":"","kind":"keywords"},
  {"k":"product_description","label":"Mô tả","type":"textarea","def":"Premium ceramic coffee mug with a unique printed design. Vibrant, fade-resistant print. Microwave and dishwasher safe. The perfect gift for any occasion.","attr":"product_description","wrap":"lang","kind":"attr"},
  {"k":"bullets","label":"Bullet points","type":"textarea","def":"Premium ceramic, sturdy & durable\nVibrant double-sided print that lasts\nMicrowave & dishwasher safe\n11 oz capacity, comfortable C-handle\nPerfect gift idea for birthdays & holidays","attr":"bullet_point","wrap":"lang","kind":"bullets"},
  {"k":"material","label":"Chất liệu","type":"text","def":"Ceramic","attr":"material","wrap":"mkt","kind":"attr"},
  {"k":"color","label":"Màu","type":"text","def":"White","attr":"color","wrap":"lang","kind":"attr"},
  {"k":"size","label":"Size (vd 11 fl oz)","type":"text","def":"11 fl oz","attr":"size","wrap":"lang","kind":"attr"},
  {"k":"capacity","label":"Dung tích (JSON)","type":"text","def":"[{\"unit\":\"fluid_ounces\",\"value\":11,\"marketplace_id\":\"ATVPDKIKX0DER\"}]","attr":"capacity","wrap":"raw","kind":"attr"},
  {"k":"number_of_items","label":"Số lượng trong gói","type":"number","def":"1","attr":"number_of_items","wrap":"mkt","kind":"attr"},
  {"k":"is_microwave_safe","label":"Microwave safe","type":"select","options":"true,false","def":"true","attr":"is_microwaveable","wrap":"mkt","kind":"attr"},
  {"k":"is_dishwasher_safe","label":"Dishwasher safe","type":"select","options":"true,false","def":"true","attr":"is_dishwasher_safe","wrap":"mkt","kind":"attr"},
  {"k":"special_feature","label":"Special features (JSON)","type":"text","def":"[{\"value\":\"Microwave Safe\",\"language_tag\":\"en_US\",\"marketplace_id\":\"ATVPDKIKX0DER\"},{\"value\":\"Dishwasher Safe\",\"language_tag\":\"en_US\",\"marketplace_id\":\"ATVPDKIKX0DER\"}]","attr":"special_feature","wrap":"raw","kind":"attr"},
  {"k":"care_instructions","label":"Care instructions","type":"text","def":"Dishwasher Safe","attr":"care_instructions","wrap":"lang","kind":"attr"},
  {"k":"manufacturer","label":"Manufacturer","type":"text","def":"ACIVTO","attr":"manufacturer","wrap":"mkt","kind":"attr"},
  {"k":"model_number","label":"Model number","type":"text","def":"ACIVTO-MUG-11","attr":"model_number","wrap":"mkt","kind":"attr"},
  {"k":"included_components","label":"Included components","type":"text","def":"Coffee Mug","attr":"included_components","wrap":"lang","kind":"attr"},
  {"k":"unit_count","label":"Unit count (JSON)","type":"text","def":"[{\"value\":1,\"type\":{\"value\":\"Count\",\"language_tag\":\"en_US\"},\"marketplace_id\":\"ATVPDKIKX0DER\"}]","attr":"unit_count","wrap":"raw","kind":"attr"},
  {"k":"item_width_height","label":"Kích thước W×H (JSON)","type":"text","def":"[{\"width\":{\"value\":3.2,\"unit\":\"inches\"},\"height\":{\"value\":3.8,\"unit\":\"inches\"},\"marketplace_id\":\"ATVPDKIKX0DER\"}]","attr":"item_width_height","wrap":"raw","kind":"attr"},
  {"k":"supplier_dg","label":"Dangerous Goods","type":"text","def":"not_applicable","attr":"supplier_declared_dg_hz_regulation","wrap":"mkt","kind":"attr"},
  {"k":"list_price","label":"List price (JSON)","type":"text","def":"[{\"marketplace_id\":\"ATVPDKIKX0DER\",\"currency\":\"USD\",\"value\":21.99}]","attr":"list_price","wrap":"raw","kind":"attr"},
  {"k":"country_of_origin","label":"Xuất xứ","type":"text","def":"US","attr":"country_of_origin","wrap":"mkt","kind":"attr"},
  {"k":"price","label":"Giá (USD)","type":"number","def":"21.99","attr":"","wrap":"","kind":"price"},
  {"k":"qty","label":"Tồn kho","type":"number","def":"50","attr":"","wrap":"","kind":"qty"},
  {"k":"handling_time","label":"Handling time","type":"number","def":"3","attr":"","wrap":"","kind":"handling_time"},
  {"k":"img","label":"Ảnh chính","type":"text","def":"","attr":"","wrap":"","kind":"image"},
  {"k":"parent","label":"SKU cha","type":"text","def":"","attr":"","wrap":"","kind":"parent"},
  {"k":"gtin","label":"GTIN/UPC","type":"text","def":"","attr":"","wrap":"","kind":"gtin"},
  {"k":"images","label":"Ảnh phụ","type":"textarea","def":"","attr":"","wrap":"","kind":"images"}
]'::jsonb)
ON CONFLICT (key) DO UPDATE SET label=EXCLUDED.label, product_type=EXCLUDED.product_type,
  variation_theme=EXCLUDED.variation_theme, fields=EXCLUDED.fields, updated_at=NOW();

-- ─── Seed: Amazon Candle ────────────────────────────────────────────────────

INSERT INTO product_configs (key, label, platform, product_type, variation_theme, fields) VALUES
('AMZ_CANDLE', 'Nến Jar Amazon (CANDLE)', 'amazon', 'CANDLE', '', '[
  {"k":"condition_type","label":"Condition","type":"text","def":"new_new","attr":"condition_type","wrap":"mkt","kind":"attr"},
  {"k":"brand","label":"Brand","type":"text","def":"ACIVTO","attr":"brand","wrap":"mkt","kind":"attr"},
  {"k":"gtin_exempt","label":"Miễn GTIN","type":"text","def":"true","attr":"supplier_declared_has_product_identifier_exemption","wrap":"mkt","kind":"attr"},
  {"k":"item_type_keyword","label":"Category","type":"text","def":"pillar-candles","attr":"item_type_keyword","wrap":"mkt","kind":"attr"},
  {"k":"model_name","label":"Model name","type":"text","def":"Scented Soy Candle","attr":"model_name","wrap":"mkt","kind":"attr"},
  {"k":"style","label":"Style","type":"text","def":"Jar Candle","attr":"style","wrap":"lang","kind":"attr"},
  {"k":"item_name","label":"Tên sản phẩm","type":"text","def":"","attr":"item_name","wrap":"lang","kind":"attr"},
  {"k":"search_terms","label":"Search Terms","type":"textarea","def":"","attr":"generic_keyword","wrap":"","kind":"keywords"},
  {"k":"product_description","label":"Mô tả","type":"textarea","def":"Hand-poured soy wax candle in a reusable glass jar. Made with premium fragrance oils for a clean, long-lasting burn. Perfect for home décor, relaxation, and gifting.","attr":"product_description","wrap":"lang","kind":"attr"},
  {"k":"bullets","label":"Bullet points","type":"textarea","def":"NATURAL SOY WAX — Clean-burning, eco-friendly soy wax blend\nLONG BURN TIME — Up to 45 hours of fragrance\nPREMIUM FRAGRANCE — Crafted with high-quality fragrance oils\nREUSABLE GLASS JAR — Repurpose the jar after the candle burns down\nPERFECT GIFT — Ideal for birthdays, holidays, and home décor","attr":"bullet_point","wrap":"lang","kind":"bullets"},
  {"k":"material","label":"Wax Material","type":"select","options":"Soy Wax,Paraffin Wax,Beeswax,Coconut Wax","def":"Soy Wax","attr":"material","wrap":"mkt","kind":"attr"},
  {"k":"scent","label":"Scent","type":"text","def":"Lavender","attr":"scent","wrap":"lang","kind":"attr"},
  {"k":"fragrance_notes","label":"Fragrance Notes","type":"text","def":"Fresh lavender, hints of vanilla and musk","attr":"fragrance_notes","wrap":"lang","kind":"attr"},
  {"k":"burn_time","label":"Burn Time (JSON)","type":"text","def":"[{\"value\":45,\"unit\":\"hours\",\"marketplace_id\":\"ATVPDKIKX0DER\"}]","attr":"burn_time","wrap":"raw","kind":"attr"},
  {"k":"container_type","label":"Container Type","type":"select","options":"Glass Jar,Tin,Ceramic Jar","def":"Glass Jar","attr":"container_type","wrap":"lang","kind":"attr"},
  {"k":"color","label":"Màu","type":"text","def":"Clear","attr":"color","wrap":"lang","kind":"attr"},
  {"k":"item_weight","label":"Item Weight (JSON)","type":"text","def":"[{\"value\":8,\"unit\":\"ounces\",\"marketplace_id\":\"ATVPDKIKX0DER\"}]","attr":"item_weight","wrap":"raw","kind":"attr"},
  {"k":"item_dimensions","label":"Kích thước (JSON)","type":"text","def":"[{\"width\":{\"value\":3.5,\"unit\":\"inches\"},\"height\":{\"value\":4,\"unit\":\"inches\"},\"marketplace_id\":\"ATVPDKIKX0DER\"}]","attr":"item_dimensions","wrap":"raw","kind":"attr"},
  {"k":"number_of_items","label":"Số lượng trong gói","type":"number","def":"1","attr":"number_of_items","wrap":"mkt","kind":"attr"},
  {"k":"special_feature","label":"Special features (JSON)","type":"text","def":"[{\"value\":\"Soy Wax\",\"language_tag\":\"en_US\",\"marketplace_id\":\"ATVPDKIKX0DER\"},{\"value\":\"Hand Poured\",\"language_tag\":\"en_US\",\"marketplace_id\":\"ATVPDKIKX0DER\"},{\"value\":\"Cotton Wick\",\"language_tag\":\"en_US\",\"marketplace_id\":\"ATVPDKIKX0DER\"}]","attr":"special_feature","wrap":"raw","kind":"attr"},
  {"k":"california_prop65","label":"California Prop 65","type":"select","options":"Not Applicable,WARNING: This product can expose you to chemicals including toluene which is known to the State of California to cause birth defects or other reproductive harm. For more information go to www.P65Warnings.ca.gov.","def":"Not Applicable","attr":"california_proposition_65","wrap":"mkt","kind":"attr"},
  {"k":"supplier_dg","label":"Dangerous Goods","type":"text","def":"not_applicable","attr":"supplier_declared_dg_hz_regulation","wrap":"mkt","kind":"attr"},
  {"k":"manufacturer","label":"Manufacturer","type":"text","def":"ACIVTO","attr":"manufacturer","wrap":"mkt","kind":"attr"},
  {"k":"model_number","label":"Model number","type":"text","def":"ACIVTO-CND-01","attr":"model_number","wrap":"mkt","kind":"attr"},
  {"k":"included_components","label":"Included components","type":"text","def":"Scented Candle","attr":"included_components","wrap":"lang","kind":"attr"},
  {"k":"unit_count","label":"Unit count (JSON)","type":"text","def":"[{\"value\":1,\"type\":{\"value\":\"Count\",\"language_tag\":\"en_US\"},\"marketplace_id\":\"ATVPDKIKX0DER\"}]","attr":"unit_count","wrap":"raw","kind":"attr"},
  {"k":"list_price","label":"List price (JSON)","type":"text","def":"[{\"marketplace_id\":\"ATVPDKIKX0DER\",\"currency\":\"USD\",\"value\":24.99}]","attr":"list_price","wrap":"raw","kind":"attr"},
  {"k":"country_of_origin","label":"Xuất xứ","type":"text","def":"US","attr":"country_of_origin","wrap":"mkt","kind":"attr"},
  {"k":"price","label":"Giá (USD)","type":"number","def":"24.99","attr":"","wrap":"","kind":"price"},
  {"k":"qty","label":"Tồn kho","type":"number","def":"50","attr":"","wrap":"","kind":"qty"},
  {"k":"handling_time","label":"Handling time","type":"number","def":"3","attr":"","wrap":"","kind":"handling_time"},
  {"k":"img","label":"Ảnh chính","type":"text","def":"","attr":"","wrap":"","kind":"image"},
  {"k":"gtin","label":"GTIN/UPC","type":"text","def":"","attr":"","wrap":"","kind":"gtin"},
  {"k":"images","label":"Ảnh phụ","type":"textarea","def":"","attr":"","wrap":"","kind":"images"}
]'::jsonb)
ON CONFLICT (key) DO UPDATE SET label=EXCLUDED.label, product_type=EXCLUDED.product_type,
  variation_theme=EXCLUDED.variation_theme, fields=EXCLUDED.fields, updated_at=NOW();

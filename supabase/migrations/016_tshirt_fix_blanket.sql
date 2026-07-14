-- 016: fix AMZ_TSHIRT size/variation attributes + add AMZ_BLANKET config.
-- Both use INSERT ... ON CONFLICT (key) DO UPDATE so they re-seed idempotently.

-- ─── Fix: Amazon T-Shirt ────────────────────────────────────────────────────
-- Changes vs 008: shirt_size -> raw JSON block; add neck/sleeve/fit_type/
-- special_size_type/import_designation; item_type_keyword=graphic-t-shirts;
-- care_instructions=Machine Wash; material=100% Cotton.

INSERT INTO product_configs (key, label, platform, product_type, variation_theme, fields) VALUES
('AMZ_TSHIRT', 'Áo thun Amazon (SHIRT / SIZE+COLOR)', 'amazon', 'SHIRT', 'SIZE/COLOR', '[
  {"k":"condition_type","label":"Condition","type":"text","def":"new_new","attr":"condition_type","wrap":"mkt","kind":"attr"},
  {"k":"brand","label":"Brand","type":"text","def":"ACIVTO","attr":"brand","wrap":"mkt","kind":"attr"},
  {"k":"gtin_exempt","label":"Miễn GTIN","type":"text","def":"true","attr":"supplier_declared_has_product_identifier_exemption","wrap":"mkt","kind":"attr"},
  {"k":"item_type_keyword","label":"Category","type":"text","def":"graphic-t-shirts","attr":"item_type_keyword","wrap":"mkt","kind":"attr"},
  {"k":"model_name","label":"Model name","type":"text","def":"Graphic T-Shirt","attr":"model_name","wrap":"mkt","kind":"attr"},
  {"k":"style","label":"Style","type":"text","def":"Graphic Tee","attr":"style","wrap":"lang","kind":"attr"},
  {"k":"item_name","label":"Tên sản phẩm","type":"text","def":"","attr":"item_name","wrap":"lang","kind":"attr"},
  {"k":"search_terms","label":"Search Terms","type":"textarea","def":"","attr":"generic_keyword","wrap":"","kind":"keywords"},
  {"k":"product_description","label":"Mô tả","type":"textarea","def":"Premium quality graphic t-shirt with vibrant, fade-resistant print. Made from soft 100% cotton for all-day comfort.","attr":"product_description","wrap":"lang","kind":"attr"},
  {"k":"bullets","label":"Bullet points","type":"textarea","def":"PREMIUM COTTON — Soft, breathable 100% ring-spun cotton\nVIBRANT PRINT — Fade-resistant graphic that lasts wash after wash\nCLASSIC FIT — Relaxed, comfortable fit for everyday wear\nMACHINE WASHABLE — Machine wash cold, tumble dry low\nPERFECT GIFT — Great for birthdays, holidays, and any occasion","attr":"bullet_point","wrap":"lang","kind":"bullets"},
  {"k":"material","label":"Chất liệu","type":"text","def":"100% Cotton","attr":"material","wrap":"mkt","kind":"attr"},
  {"k":"fabric_type","label":"Fabric type","type":"text","def":"100% Cotton","attr":"fabric_type","wrap":"mkt","kind":"attr"},
  {"k":"target_gender","label":"Gender","type":"select","options":"unisex,male,female","def":"unisex","attr":"target_gender","wrap":"mkt","kind":"attr"},
  {"k":"department","label":"Department","type":"select","options":"unisex-adult,mens,womens,boys,girls","def":"unisex-adult","attr":"department","wrap":"mkt","kind":"attr"},
  {"k":"age_range_description","label":"Age Range","type":"text","def":"Adult","attr":"age_range_description","wrap":"lang","kind":"attr"},
  {"k":"care_instructions","label":"Care instructions","type":"text","def":"Machine Wash","attr":"care_instructions","wrap":"lang","kind":"attr"},
  {"k":"color","label":"Màu (child listing)","type":"text","def":"","attr":"color","wrap":"lang","kind":"attr"},
  {"k":"color_map","label":"Color Map","type":"text","def":"","attr":"color_map","wrap":"mkt","kind":"attr"},
  {"k":"size","label":"Size hiển thị","type":"text","def":"","attr":"size","wrap":"lang","kind":"attr"},
  {"k":"shirt_size","label":"Shirt Size (JSON)","type":"text","def":"[{\"size\":\"m\",\"body_type\":\"regular\",\"size_class\":\"alpha\",\"height_type\":\"regular\",\"size_system\":\"as1\",\"marketplace_id\":\"ATVPDKIKX0DER\"}]","attr":"shirt_size","wrap":"raw","kind":"attr"},
  {"k":"size_map","label":"Size Map","type":"select","options":"xx_small,x_small,small,medium,large,x_large,xx_large,3x_large,4x_large,5x_large","def":"large","attr":"size_map","wrap":"mkt","kind":"attr"},
  {"k":"neck","label":"Neck (JSON)","type":"text","def":"[{\"neck_style\":[{\"value\":\"Crew Neck\"}],\"marketplace_id\":\"ATVPDKIKX0DER\"}]","attr":"neck","wrap":"raw","kind":"attr"},
  {"k":"sleeve","label":"Sleeve (JSON)","type":"text","def":"[{\"type\":[{\"value\":\"Short Sleeve\"}],\"marketplace_id\":\"ATVPDKIKX0DER\"}]","attr":"sleeve","wrap":"raw","kind":"attr"},
  {"k":"fit_type","label":"Fit Type","type":"text","def":"Regular","attr":"fit_type","wrap":"lang","kind":"attr"},
  {"k":"special_size_type","label":"Special Size Type","type":"text","def":"Standard","attr":"special_size_type","wrap":"lang","kind":"attr"},
  {"k":"import_designation","label":"Import Designation","type":"text","def":"Imported","attr":"import_designation","wrap":"lang","kind":"attr"},
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

-- ─── Seed: Amazon Woven Throw Blanket ───────────────────────────────────────
-- Standalone (variation_theme = ''). merchant_shipping_group def is blank — the
-- user fills their shipping-template UUID per selling account.

INSERT INTO product_configs (key, label, platform, product_type, variation_theme, fields) VALUES
('AMZ_BLANKET', 'Chăn dệt Amazon (BLANKET)', 'amazon', 'BLANKET', '', '[
  {"k":"condition_type","label":"Condition","type":"text","def":"new_new","attr":"condition_type","wrap":"mkt","kind":"attr"},
  {"k":"brand","label":"Brand","type":"text","def":"ACIVTO","attr":"brand","wrap":"mkt","kind":"attr"},
  {"k":"gtin_exempt","label":"Miễn GTIN","type":"text","def":"true","attr":"supplier_declared_has_product_identifier_exemption","wrap":"mkt","kind":"attr"},
  {"k":"item_type_keyword","label":"Category","type":"text","def":"throw-blankets","attr":"item_type_keyword","wrap":"mkt","kind":"attr"},
  {"k":"model_name","label":"Model name","type":"text","def":"Personalized Woven Throw Blanket","attr":"model_name","wrap":"mkt","kind":"attr"},
  {"k":"style","label":"Style","type":"text","def":"Woven Throw","attr":"style","wrap":"lang","kind":"attr"},
  {"k":"theme","label":"Theme","type":"text","def":"Floral","attr":"theme","wrap":"lang","kind":"attr"},
  {"k":"item_name","label":"Tên sản phẩm","type":"text","def":"","attr":"item_name","wrap":"lang","kind":"attr"},
  {"k":"search_terms","label":"Search Terms","type":"textarea","def":"","attr":"generic_keyword","wrap":"","kind":"keywords"},
  {"k":"product_description","label":"Mô tả","type":"textarea","def":"Cozy personalized woven throw blanket with a vibrant, long-lasting design. Soft 100% cotton weave — perfect for the couch, bed, or as a thoughtful gift.","attr":"product_description","wrap":"lang","kind":"attr"},
  {"k":"bullets","label":"Bullet points","type":"textarea","def":"PREMIUM WOVEN COTTON — Soft, breathable 100% cotton, jacquard-woven for durability\nVIBRANT LASTING DESIGN — Woven-in pattern that will not fade or peel\nVERSATILE SIZE — 50x60 inch throw, ideal for couch, bed, or travel\nEASY CARE — Machine wash cold, gentle cycle, tumble dry low\nPERFECT GIFT — Great for birthdays, weddings, housewarmings, and holidays","attr":"bullet_point","wrap":"lang","kind":"bullets"},
  {"k":"material","label":"Chất liệu","type":"text","def":"Cotton","attr":"material","wrap":"mkt","kind":"attr"},
  {"k":"fabric_type","label":"Fabric type","type":"text","def":"100% Cotton","attr":"fabric_type","wrap":"mkt","kind":"attr"},
  {"k":"blanket_form","label":"Blanket Form (JSON)","type":"text","def":"[{\"value\":\"throw_blanket\",\"language_tag\":\"en_US\",\"marketplace_id\":\"ATVPDKIKX0DER\"}]","attr":"blanket_form","wrap":"raw","kind":"attr"},
  {"k":"color","label":"Màu","type":"text","def":"Cream","attr":"color","wrap":"lang","kind":"attr"},
  {"k":"size","label":"Size hiển thị","type":"text","def":"50x60 Inches","attr":"size","wrap":"lang","kind":"attr"},
  {"k":"item_dimensions","label":"Item Dimensions (JSON)","type":"text","def":"[{\"width\":{\"unit\":\"inches\",\"value\":50},\"height\":{\"unit\":\"inches\",\"value\":1},\"length\":{\"unit\":\"inches\",\"value\":60},\"marketplace_id\":\"ATVPDKIKX0DER\"}]","attr":"item_dimensions","wrap":"raw","kind":"attr"},
  {"k":"item_length_width","label":"Item Length/Width (JSON)","type":"text","def":"[{\"width\":{\"unit\":\"inches\",\"value\":50},\"length\":{\"unit\":\"inches\",\"value\":60},\"marketplace_id\":\"ATVPDKIKX0DER\"}]","attr":"item_length_width","wrap":"raw","kind":"attr"},
  {"k":"age_range_description","label":"Age Range","type":"text","def":"Adult","attr":"age_range_description","wrap":"lang","kind":"attr"},
  {"k":"merchant_shipping_group","label":"Shipping template UUID","type":"text","def":"","attr":"merchant_shipping_group","wrap":"mkt","kind":"attr"},
  {"k":"required_product_compliance_certificate","label":"Compliance Certificate","type":"text","def":"Not Applicable","attr":"required_product_compliance_certificate","wrap":"mkt","kind":"attr"},
  {"k":"number_of_items","label":"Số lượng trong gói","type":"number","def":"1","attr":"number_of_items","wrap":"mkt","kind":"attr"},
  {"k":"special_feature","label":"Special features (JSON)","type":"text","def":"[{\"value\":\"Personalized\",\"language_tag\":\"en_US\",\"marketplace_id\":\"ATVPDKIKX0DER\"},{\"value\":\"Woven\",\"language_tag\":\"en_US\",\"marketplace_id\":\"ATVPDKIKX0DER\"},{\"value\":\"Machine Washable\",\"language_tag\":\"en_US\",\"marketplace_id\":\"ATVPDKIKX0DER\"}]","attr":"special_feature","wrap":"raw","kind":"attr"},
  {"k":"care_instructions","label":"Care instructions","type":"text","def":"Machine Wash Cold, Gentle Cycle, Tumble Dry Low, No Bleach","attr":"care_instructions","wrap":"lang","kind":"attr"},
  {"k":"manufacturer","label":"Manufacturer","type":"text","def":"ACIVTO","attr":"manufacturer","wrap":"mkt","kind":"attr"},
  {"k":"model_number","label":"Model number","type":"text","def":"ACIVTO-WVN-BLK-S01","attr":"model_number","wrap":"mkt","kind":"attr"},
  {"k":"included_components","label":"Included components","type":"text","def":"Woven Throw Blanket","attr":"included_components","wrap":"lang","kind":"attr"},
  {"k":"unit_count","label":"Unit count (JSON)","type":"text","def":"[{\"value\":1,\"type\":{\"value\":\"Count\",\"language_tag\":\"en_US\"},\"marketplace_id\":\"ATVPDKIKX0DER\"}]","attr":"unit_count","wrap":"raw","kind":"attr"},
  {"k":"supplier_dg","label":"Dangerous Goods","type":"text","def":"not_applicable","attr":"supplier_declared_dg_hz_regulation","wrap":"mkt","kind":"attr"},
  {"k":"list_price","label":"List price (JSON)","type":"text","def":"[{\"marketplace_id\":\"ATVPDKIKX0DER\",\"currency\":\"USD\",\"value\":97.99}]","attr":"list_price","wrap":"raw","kind":"attr"},
  {"k":"country_of_origin","label":"Xuất xứ","type":"text","def":"US","attr":"country_of_origin","wrap":"mkt","kind":"attr"},
  {"k":"price","label":"Giá (USD)","type":"number","def":"59.95","attr":"","wrap":"","kind":"price"},
  {"k":"qty","label":"Tồn kho","type":"number","def":"50","attr":"","wrap":"","kind":"qty"},
  {"k":"handling_time","label":"Handling time","type":"number","def":"3","attr":"","wrap":"","kind":"handling_time"},
  {"k":"img","label":"Ảnh chính","type":"text","def":"","attr":"","wrap":"","kind":"image"},
  {"k":"images","label":"Ảnh phụ","type":"textarea","def":"","attr":"","wrap":"","kind":"images"}
]'::jsonb)
ON CONFLICT (key) DO UPDATE SET label=EXCLUDED.label, product_type=EXCLUDED.product_type,
  variation_theme=EXCLUDED.variation_theme, fields=EXCLUDED.fields, updated_at=NOW();

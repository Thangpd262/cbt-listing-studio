// Sample data used until the backend services ship. Kept in one place so the
// Crawl / Config / Jobs / Listing screens stay consistent and easy to swap for
// real API calls later.

export type ProductGroup = { id: string; name: string }

export const GROUPS: ProductGroup[] = [
  { id: 'phone-cases', name: 'Phone Cases' },
  { id: 'tshirt', name: 'Áo thun' },
  { id: 'mugs', name: 'Mugs' },
]

// System default configs = seeded product_configs (migration 008). Read-only.
export type SystemConfig = {
  key: string
  label: string
  product_type: string
  variation_theme: string
}

export const SYSTEM_CONFIGS: SystemConfig[] = [
  { key: 'AMZ_TSHIRT', label: 'Áo thun Amazon', product_type: 'SHIRT', variation_theme: 'SIZE/COLOR' },
  { key: 'AMZ_SWEATSHIRT', label: 'Sweatshirt/Hoodie', product_type: 'SWEATSHIRT', variation_theme: 'SIZE/COLOR' },
  { key: 'AMZ_HAT', label: 'Mũ lưỡi trai', product_type: 'HAT', variation_theme: 'COLOR_NAME' },
  { key: 'AMZ_MUG', label: 'Cốc sứ', product_type: 'DRINKING_CUP', variation_theme: 'SIZE_NAME' },
  { key: 'AMZ_CANDLE', label: 'Nến Jar', product_type: 'CANDLE', variation_theme: '' },
]

// User configs cloned from a system default, with edited values.
export type MyConfig = {
  id: string
  name: string
  from: string // system config key
  note: string
}

export const MY_CONFIGS: MyConfig[] = [
  { id: 'my1', name: 'Áo thun HOT 2026', from: 'AMZ_TSHIRT', note: 'đã sửa giá mặc định, bullet points' },
  { id: 'my2', name: 'Mug Basic No-variant', from: 'AMZ_MUG', note: 'bỏ trường size, chỉ 1 variant' },
]

// Sample crawled listings (fallback when the crawl API returns nothing).
export type SampleListing = {
  id: string
  title: string
  shop: string
  group: string
  price: number
  hasJob: boolean
  images: string[]
  // AI-generated images persisted on the listing (empty until any are generated).
  aiImages: string[]
  // Left-column metadata (optional — absent for real rows that lack it).
  username?: string
  email?: string
  etsyId?: string
  sourceUrl?: string
  createdAt?: string
}

const img = (seed: string) => `https://picsum.photos/seed/${seed}/240/240`

export const SAMPLE_LISTINGS: SampleListing[] = [
  {
    id: 's1',
    title: 'Elegant Flowers Tough Case, Luxury Rose Phone Case, Boho Floral',
    shop: 'LauderCases',
    group: 'Phone Cases',
    price: 22.99,
    hasJob: false,
    images: [img('case1'), img('case2'), img('case3'), img('case4'), img('case5'), img('case6')],
    aiImages: [],
    username: 'vnam0142004',
    email: 'nam@iart.group',
    etsyId: '1792611842',
    sourceUrl: 'https://www.etsy.com/listing/1792611842/elegant-flowers-tough-case',
    createdAt: '2026-07-14',
  },
  {
    id: 's2',
    title: 'Boho Wildflower Phone Case iPhone 16 15 14 Samsung Pixel Aesthetic',
    shop: 'WildDesigns',
    group: 'Phone Cases',
    price: 19.99,
    hasJob: true,
    images: [img('wild1'), img('wild2'), img('wild3')],
    aiImages: [img('ai-wild1')],
    username: 'vnam0142004',
    etsyId: '1805168638',
    sourceUrl: 'https://www.etsy.com/listing/1805168638/boho-wildflower-phone-case',
    createdAt: '2026-07-14',
  },
  {
    id: 's3',
    title: 'Vintage Floral Graphic Tee Women Boho T-Shirt Cotton Soft Unisex',
    shop: 'FloralThreads',
    group: 'Áo thun',
    price: 24.99,
    hasJob: false,
    images: [],
    aiImages: [],
    username: 'vthang0091',
    email: 'thang@iart.group',
    etsyId: '1843647245',
    sourceUrl: 'https://www.etsy.com/listing/1843647245/vintage-floral-graphic-tee',
    createdAt: '2026-07-13',
  },
]

// Representative subset of a base config's fields[] for offline/sample mode,
// so the override editor is demonstrable without the product-configs API.
import type { ConfigField } from './api'

export const SAMPLE_BASE_FIELDS: ConfigField[] = [
  { k: 'item_name', label: 'Tên sản phẩm (title)', type: 'text', def: '' },
  { k: 'brand', label: 'Brand', type: 'text', def: 'ACIVTO' },
  {
    k: 'product_description',
    label: 'Mô tả',
    type: 'textarea',
    def: 'Premium quality graphic t-shirt with vibrant, fade-resistant print.',
  },
  {
    k: 'bullets',
    label: 'Bullet points (mỗi dòng 1 ý)',
    type: 'textarea',
    def: 'PREMIUM COTTON — Soft, breathable 100% ring-spun cotton\nVIBRANT PRINT — Fade-resistant graphic',
  },
  { k: 'target_gender', label: 'Gender', type: 'select', def: 'unisex', options: 'unisex,male,female' },
  { k: 'price', label: 'Giá (USD)', type: 'number', def: '24.99' },
  { k: 'qty', label: 'Tồn kho', type: 'number', def: '50' },
  { k: 'handling_time', label: 'Handling time (ngày)', type: 'number', def: '3' },
]

export type JobRow = {
  id: string
  sku: string
  action: string
  user: string
  status: 'pending' | 'processing' | 'success' | 'failed'
  time: string
}

export const SAMPLE_JOBS: JobRow[] = [
  { id: '293c89f4', sku: 'FLORAL-001', action: 'create', user: 'Thang', status: 'success', time: '2 phút trước' },
  { id: 'a4f12c01', sku: 'SHIRT-042', action: 'price_qty', user: 'Linh', status: 'success', time: '8 phút trước' },
  { id: '7bc90041', sku: 'MUG-007', action: 'create', user: 'Nam', status: 'failed', time: '15 phút trước' },
  { id: 'e2310abc', sku: 'HAT-019', action: 'update', user: 'Thang', status: 'processing', time: '22 phút trước' },
]

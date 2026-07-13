# Phase 2 — apps/hub

**Service:** `cbt-hub` | Port 3000  
**Vercel project:** `cbt-hub`  
**Role:** UI shell — dashboard, điều hướng giữa các service

## Context

Hub là app duy nhất có UI (React/Next.js pages). Các service còn lại chỉ có API routes. Hub gọi trực tiếp các service khác từ browser (qua `NEXT_PUBLIC_*` URLs) hoặc từ Next.js API routes.

## Dependencies

```env
NEXT_PUBLIC_ACCOUNT_URL=https://cbt-account.vercel.app
NEXT_PUBLIC_CRAWL_URL=https://cbt-crawl.vercel.app
NEXT_PUBLIC_GENERATOR_URL=https://cbt-listing-studio-generator.vercel.app
NEXT_PUBLIC_LIST_AMZ_URL=https://cbt-list-amz.vercel.app
NEXT_PUBLIC_LIST_WMT_URL=https://cbt-list-wmt.vercel.app
```

Cần deploy Account trước, lấy URL rồi mới set.

## Files to create

```
apps/hub/
├── pages/
│   ├── _app.tsx             # AuthProvider wrap toàn bộ app
│   ├── index.tsx            # redirect → /dashboard
│   ├── login.tsx            # Login form
│   ├── dashboard.tsx        # Stats overview
│   ├── crawl.tsx            # Crawl UI (embed hoặc native)
│   ├── generator.tsx        # Generator UI
│   ├── list/
│   │   ├── amz.tsx          # Amazon listing UI
│   │   └── wmt.tsx          # Walmart listing UI
│   └── settings/
│       ├── index.tsx        # General settings
│       ├── team.tsx         # Team management
│       ├── selling-accounts.tsx
│       └── api-keys.tsx
├── pages/api/
│   ├── health.ts            # đã có
│   └── auth/
│       └── [...nextauth].ts # optional: proxy login/logout
├── lib/
│   ├── api.ts               # fetch helpers cho từng service
│   └── auth-context.tsx     # React context lưu token + user
├── components/
│   ├── Layout.tsx           # Sidebar + header
│   ├── Sidebar.tsx
│   └── StatsCard.tsx
└── styles/
    └── globals.css
```

## Implementation Steps

### 1. Cài dependencies

```bash
cd apps/hub
pnpm add tailwindcss postcss autoprefixer
pnpm add @headlessui/react lucide-react
npx tailwindcss init -p
```

### 2. `lib/auth-context.tsx`

```typescript
// Context lưu: token (localStorage), user (account_id, role, email)
// login(token) → decode JWT → set state
// logout() → clear localStorage → redirect /login
// useAuth() hook — dùng ở mọi component/page

const AuthContext = createContext<{
  token: string | null
  user: { account_id: string; user_id: string; role: string } | null
  login: (token: string) => void
  logout: () => void
}>()
```

### 3. `lib/api.ts`

```typescript
// Fetch helpers gọi từng service với token tự động
export const accountApi = {
  register: (data) => fetch(`${ACCOUNT_URL}/api/auth/register`, { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => fetch(`${ACCOUNT_URL}/api/auth/login`, ...),
  me: (token) => fetch(`${ACCOUNT_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } }),
  getApiKeys: (token) => ...,
  createApiKey: (token) => ...,
  getSellingAccounts: (token) => ...,
  // ...
}

export const crawlApi = {
  ingest: (apiKey, data) => fetch(`${CRAWL_URL}/api/listings/ingest`, { headers: { 'X-API-Key': apiKey }, ... }),
  getListings: (apiKey, params) => ...,
  analyze: (apiKey, id) => ...,
}

export const generatorApi = { ... }
export const listAmzApi = { ... }
export const listWmtApi = { ... }
```

### 4. `pages/_app.tsx`

```typescript
// Wrap với AuthProvider
// Check localStorage token on mount → restore session
// Protected routes redirect → /login nếu chưa auth
```

### 5. `pages/login.tsx`

```typescript
// Form: email + password
// Submit → accountApi.login() → lưu token → redirect /dashboard
```

### 6. `pages/dashboard.tsx`

```typescript
// Fetch stats từ nhiều service song song:
// - crawlApi.getListings (count)
// - generatorApi.getJobs (count)
// - generatorApi.getSpend (total)
// Hiển thị StatsCard: listings crawled, jobs completed, AI spend
```

### 7. Pages còn lại

Mỗi page là một CRUD UI đơn giản dùng `lib/api.ts`:

- `crawl.tsx` — table listings, nút Analyze, hiển thị scene analysis
- `generator.tsx` — form tạo gen job, polling status, hiển thị kết quả
- `list/amz.tsx` — table sản phẩm AMZ, form tạo listing
- `list/wmt.tsx` — table sản phẩm WMT, form tạo listing + stage/publish
- `settings/selling-accounts.tsx` — CRUD selling accounts + credentials form
- `settings/api-keys.tsx` — list keys, tạo mới (hiện key 1 lần), revoke

## Routing & Auth Guard

```typescript
// pages/_app.tsx hoặc middleware.ts
// Tất cả /dashboard/*, /crawl, /generator, /list/*, /settings/* đều protected
// Redirect → /login nếu không có token
```

## Verification

```
1. Mở https://cbt-hub-tau.vercel.app
2. Login với account đã tạo ở Phase 1
3. Dashboard hiển thị stats (0s)
4. Tạo API key ở Settings → API Keys
5. Xem Crawl page load được
```

## Notes

- Hub dùng token (Bearer JWT) để call Account API từ browser
- Hub dùng API Key (X-API-Key) khi call Crawl/Generator/List từ browser
- Nên lưu API key vào localStorage cùng token sau khi user tạo
- UI tối giản, không cần fancy — focus vào functional

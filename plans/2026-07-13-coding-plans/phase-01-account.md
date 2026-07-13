# Phase 1 — apps/account

**Service:** `cbt-account` | Port 3001  
**Vercel project:** `cbt-account`  
**Tables:** accounts, app_users, api_keys, selling_accounts, account_credentials, user_selling_permissions, subscriptions

## Context

Account là auth foundation của toàn hệ thống. Tất cả service còn lại gọi `POST /api/auth/validate` để xác thực X-API-Key. Account KHÔNG dùng `withAuth` — nó tự xác thực.

## Dependencies

```env
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
JWT_SECRET=                  # ký session JWT
```

Không cần `ACCOUNT_SERVICE_URL` — đây chính là Account service.

## Files to create

```
apps/account/
├── pages/api/
│   ├── health.ts            # đã có
│   ├── auth/
│   │   ├── register.ts      # POST — tạo account + user
│   │   ├── login.ts         # POST — trả JWT session
│   │   ├── logout.ts        # POST — invalidate session (stateless: client xoá)
│   │   ├── me.ts            # GET — profile từ JWT header
│   │   └── validate.ts      # POST — internal: validate X-API-Key → trả AuthContext
│   ├── selling-accounts/
│   │   ├── index.ts         # GET list / POST create
│   │   ├── [id].ts          # GET / PUT / DELETE
│   │   └── [id]/
│   │       └── credentials.ts  # GET — internal only, trả credentials decrypted
│   ├── api-keys/
│   │   ├── index.ts         # GET list / POST create
│   │   └── [id].ts          # DELETE — revoke
│   ├── team/
│   │   ├── index.ts         # GET list members / POST invite
│   │   └── [userId].ts      # DELETE member
│   └── permissions/
│       ├── index.ts         # GET list / POST grant
│       └── [id].ts          # PUT update role / DELETE revoke
├── lib/
│   ├── supabase.ts          # createSupabaseClient() từ shared
│   ├── auth.ts              # signJWT, verifyJWT, hashApiKey, hashPassword
│   └── encryption.ts        # encryptCredentials, decryptCredentials (AES-256)
└── middleware/
    └── withSession.ts       # verify JWT Bearer → trả AccountContext (dùng cho auth/* routes)
```

## Implementation Steps

### 1. Cài thêm dependencies

```bash
cd apps/account
pnpm add bcryptjs jsonwebtoken crypto-js
pnpm add -D @types/bcryptjs @types/jsonwebtoken
```

### 2. `lib/auth.ts`

```typescript
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const JWT_SECRET = process.env.JWT_SECRET!

// Session JWT (cho login/me)
export function signJWT(payload: { account_id: string; user_id: string; role: string }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyJWT(token: string) {
  return jwt.verify(token, JWT_SECRET) as { account_id: string; user_id: string; role: string }
}

// API key: random 32 bytes → hex string, stored as SHA-256 hash
export function generateApiKey(): { key: string; hash: string } {
  const key = 'cbt_' + crypto.randomBytes(32).toString('hex')
  const hash = crypto.createHash('sha256').update(key).digest('hex')
  return { key, hash }
}

export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
```

### 3. `lib/encryption.ts` — mã hoá credentials bán hàng

```typescript
import crypto from 'crypto'

const ENCRYPTION_KEY = process.env.CREDENTIALS_ENCRYPTION_KEY! // 32 chars

export function encryptCredentials(data: object): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(data)), cipher.final()])
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

export function decryptCredentials(encrypted: string): object {
  const [ivHex, dataHex] = encrypted.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv)
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()])
  return JSON.parse(decrypted.toString())
}
```

### 4. `middleware/withSession.ts`

```typescript
// Dùng cho các route yêu cầu login (me, selling-accounts, team, ...)
// Verify Bearer JWT → inject AccountContext
export type AccountContext = {
  account_id: string
  user_id: string
  role: string
}

export function withSession(handler: (req, res, ctx: AccountContext) => Promise<void>) {
  return async (req, res) => {
    const auth = req.headers.authorization
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ success: false, error: 'Missing token' })
    try {
      const ctx = verifyJWT(auth.slice(7))
      return handler(req, res, ctx)
    } catch {
      return res.status(401).json({ success: false, error: 'Invalid token' })
    }
  }
}
```

### 5. `pages/api/auth/register.ts`

```typescript
// POST { email, password, name }
// → INSERT accounts → INSERT app_users (auth_user_id = supabase auth or uuid) → INSERT subscriptions
// → trả { account_id, token }
```

### 6. `pages/api/auth/login.ts`

```typescript
// POST { email, password }
// → SELECT accounts by email → verifyPassword → signJWT
// → trả { token, account_id, user_id, role }
```

### 7. `pages/api/auth/validate.ts` ← QUAN TRỌNG NHẤT

```typescript
// POST — header: X-API-Key
// Đây là endpoint mà withAuth của tất cả service khác gọi
// → SELECT api_keys WHERE key_hash = hashApiKey(X-API-Key) AND revoked_at IS NULL
// → JOIN accounts, app_users
// → UPDATE api_keys SET last_used_at = now()
// → trả AuthContext: { account_id, user_id, role, tier, permissions[] }
```

### 8. `pages/api/selling-accounts/index.ts`

```typescript
// GET (withSession) → SELECT selling_accounts WHERE account_id = ctx.account_id
// POST (withSession) → INSERT selling_accounts + encryptCredentials → INSERT account_credentials
```

### 9. `pages/api/selling-accounts/[id]/credentials.ts`

```typescript
// GET — INTERNAL ONLY (không qua withSession, check internal secret header)
// Dùng bởi list-amz và list-wmt để lấy SP-API / Walmart credentials
// Header: X-Internal-Secret: process.env.INTERNAL_SECRET
// → SELECT account_credentials → decryptCredentials
```

### 10. `pages/api/api-keys/index.ts`

```typescript
// GET (withSession) → list api_keys WHERE account_id, revoked_at IS NULL
// POST (withSession) → generateApiKey() → INSERT api_keys → trả key ONCE (không lưu raw key)
```

## Env vars cần thêm

```env
CREDENTIALS_ENCRYPTION_KEY=  # 32 chars random string
INTERNAL_SECRET=             # random string để authenticate internal calls
```

Set thêm 2 vars này trên Vercel (production + preview + development).

## Verification

```bash
# Health check
curl https://cbt-account.vercel.app/api/health

# Register
curl -X POST https://cbt-account.vercel.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123","name":"Test"}'

# Login → lấy token
curl -X POST https://cbt-account.vercel.app/api/auth/login \
  -d '{"email":"test@test.com","password":"test123"}'

# Tạo API key → lấy key
curl -X POST https://cbt-account.vercel.app/api/api-keys \
  -H "Authorization: Bearer <token>"

# Validate API key (dùng bởi service khác)
curl -X POST https://cbt-account.vercel.app/api/auth/validate \
  -H "X-API-Key: <api_key>"
```

## Risks

- `CREDENTIALS_ENCRYPTION_KEY` phải giữ bí mật — nếu mất, credentials bán hàng không decrypt được
- `INTERNAL_SECRET` phải match giữa account và list-amz/list-wmt
- Login dùng stateless JWT — logout chỉ xoá client-side

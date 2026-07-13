# CBT Listing Studio — Coding Plan

**Created:** 2026-07-13  
**Status:** IN PROGRESS  
**Repo:** `Thangpd262/cbt-listing-studio`

## Tổng quan

Foundation đã xong: monorepo, shared package, migrations, vercel.json, env vars (prod + dev).  
Mỗi app có `pages/api/health.ts` làm placeholder.  
Việc còn lại: viết business logic cho 6 services theo thứ tự sau.

## Build Order (phải theo thứ tự)

| Phase | Service | Port | Phụ thuộc | File |
|-------|---------|------|-----------|------|
| 1 | account | 3001 | — (auth foundation) | [phase-01-account.md](./phase-01-account.md) |
| 2 | hub | 3000 | account deployed | [phase-02-hub.md](./phase-02-hub.md) |
| 3 | crawl | 3002 | account deployed | [phase-03-crawl.md](./phase-03-crawl.md) |
| 4 | generator | 3003 | account + crawl | [phase-04-generator.md](./phase-04-generator.md) |
| 5 | list-amz | 3004 | account deployed | [phase-05-list-amz.md](./phase-05-list-amz.md) |
| 6 | list-wmt | 3005 | account deployed | [phase-06-list-wmt.md](./phase-06-list-wmt.md) |

## Acceptance Criteria tổng

- [ ] `pnpm turbo build` pass không lỗi
- [ ] `pnpm turbo typecheck` pass
- [ ] `/api/health` trả 200 trên tất cả 6 service
- [ ] `/api/auth/validate` hoạt động với X-API-Key hợp lệ
- [ ] `withAuth` middleware hoạt động trên tất cả service còn lại
- [ ] End-to-end: ingest listing → analyze → generate → list lên AMZ/WMT

## Env vars cần thêm sau khi deploy Account

Sau khi `cbt-account` deploy xong, lấy URL rồi set `ACCOUNT_SERVICE_URL` trên 4 service còn lại (crawl, generator, list-amz, list-wmt) trong Vercel.

```
ACCOUNT_SERVICE_URL=https://cbt-account.vercel.app
```

Hub cần set thêm `NEXT_PUBLIC_*` URLs cho tất cả services.

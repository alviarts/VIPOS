# VIPOS - Aplikasi POS/Kasir Modern

[![CI](https://github.com/alviarts/VIPOS/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/alviarts/VIPOS/actions/workflows/ci.yml)
[![Deploy](https://github.com/alviarts/VIPOS/actions/workflows/deploy-vps.yml/badge.svg?branch=main)](https://github.com/alviarts/VIPOS/actions/workflows/deploy-vps.yml)

Aplikasi Point of Sale (POS) / Kasir modern yang mobile-friendly, dirancang untuk kemudahan penggunaan di tablet dan smartphone.

## Fitur

- **Dashboard** — Ringkasan penjualan harian/bulanan, grafik, produk terlaris
- **Kasir (POS)** — Interface kasir dengan keranjang belanja, pencarian produk, filter kategori
- **Manajemen Produk** — CRUD produk dengan kategori, SKU, stok
- **Transaksi** — Riwayat transaksi lengkap, detail, void/pembatalan
- **Laporan** — Laporan penjualan harian/bulanan, metode pembayaran, produk terlaris
- **Multi Pembayaran** — Cash, Kartu, QRIS
- **Multi User** — Role admin & kasir
- **Mobile-First** — Responsive design untuk tablet & smartphone

## Tech Stack

- **Frontend (Web):** React 18 + Vite + Tailwind CSS
- **Backend:** Node.js + Express
- **Database:**
  - Phase 1: SQLite (via better-sqlite3) — masih dipakai untuk dev/test
  - Phase 2 P2-01a: Postgres infrastructure ready (Prisma + Supabase). Schema mirror SQLite, migration tool `apps/backend/scripts/migrate-sqlite-to-postgres.mjs` siap untuk cutover. Routes belum migrate ke Prisma — itu scope P2-01b
- **ORM (Phase 2):** Prisma (Postgres provider). Schema di `apps/backend/prisma/schema.prisma`, 97 model
- **Auth:** JWT
- **Mobile (planned, Phase 3+):** Kotlin + Jetpack Compose
- **Shared schemas:** Zod + OpenAPI 3.1 (di `packages/shared`, dipakai backend untuk runtime validation; web dapat type lewat `@vipos/shared`)

## Repo structure (monorepo)

```
VIPOS/
├── apps/
│   ├── web/         # React + Vite frontend (was: frontend/)
│   ├── backend/     # Express + better-sqlite3 API (was: backend/)
│   └── android/     # Placeholder, di-bootstrap di P3-01
├── packages/
│   └── shared/      # Shared TypeScript types + Zod schemas + OpenAPI registry
├── tools/
│   └── scripts/
│       └── deploy.sh   # Production deploy ke VPS (nginx + pm2)
├── docs/
│   ├── v2/          # Frozen analysis Majoo (jangan diubah)
│   └── v3/workflow/ # Phase docs + templates (sumber of truth task)
├── package.json     # npm workspaces root
├── tsconfig.base.json
└── tsconfig.json    # references ke per-package tsconfig
```

Workspaces dikonfigurasi via npm workspaces (lihat root `package.json` `workspaces` field).

## Quick Start

### 1. Install dependencies

```bash
npm install
```

`npm install` di root sekaligus install semua workspaces (`apps/web`, `apps/backend`, `packages/shared`).

### 2. Setup environment

```bash
cp .env.example apps/backend/.env
```

Edit `apps/backend/.env` lalu set `JWT_SECRET` ke string acak.

### 3. Seed sample data

```bash
npm run seed
```

(Atau langsung: `npm run seed --workspace=apps/backend`.)

### 4. Run development

```bash
npm run dev
```

Frontend: http://localhost:5173
Backend API: http://localhost:3001

Untuk start individual:

```bash
npm run dev:web         # frontend only
npm run dev:backend     # backend only
```

### 5. Default Login

- **Admin:** `admin` / `admin123`

## Database (P2-01a)

VIPOS sedang transisi dari SQLite ke Postgres. Phase 1 jalan murni di SQLite. Phase 2 P2-01a sudah landing infrastruktur Prisma + Postgres; cutover route logic ke Prisma masuk scope P2-01b.

### Quick start (Postgres lokal via Docker)

```bash
# Spin up Postgres 17 untuk dev (port 5433)
docker run --rm -d --name vipos-pg \
  -e POSTGRES_PASSWORD=devsecret -e POSTGRES_DB=vipos \
  -p 5433:5432 postgres:17-alpine

export DATABASE_URL="postgresql://postgres:devsecret@localhost:5433/vipos"
export DIRECT_URL="postgresql://postgres:devsecret@localhost:5433/vipos"

# Apply schema (97 tables) ke Postgres lokal
cd apps/backend && npx prisma migrate deploy

# Sync data dari SQLite snapshot ke Postgres
node scripts/migrate-sqlite-to-postgres.mjs --dry-run   # preview
node scripts/migrate-sqlite-to-postgres.mjs             # eksekusi
```

### Production (Supabase)

Production pakai Supabase Postgres dengan dua URL:

| Var            | Port | Mode        | Pakai untuk                 |
| -------------- | ---- | ----------- | --------------------------- |
| `DATABASE_URL` | 6543 | Transaction | Runtime app (Prisma client) |
| `DIRECT_URL`   | 5432 | Session     | `prisma migrate` saja       |

```
DATABASE_URL=postgresql://postgres.<projectRef>:<PASS>@aws-X-region.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
DIRECT_URL=postgresql://postgres.<projectRef>:<PASS>@aws-X-region.pooler.supabase.com:5432/postgres
```

⚠️ Untuk DIRECT_URL **JANGAN** pakai `db.<projectRef>.supabase.co:5432` — host itu IPv6-only di Supabase free tier dan banyak environment (CI runner, Devin, GitHub Actions) yang IPv4-only. Pakai pooler hostname dengan port 5432 (session mode) instead.

### Migration tool

`apps/backend/scripts/migrate-sqlite-to-postgres.mjs` — sync seluruh data SQLite ke Postgres dengan zero data loss verifier. Jalan idempoten (TRUNCATE + RESTART IDENTITY CASCADE per table) supaya boleh re-run berkali-kali.

```bash
# Dry-run (count saja, no writes)
node scripts/migrate-sqlite-to-postgres.mjs --dry-run

# Real (truncate Postgres → bulk insert)
DATABASE_URL=$DATABASE_URL node scripts/migrate-sqlite-to-postgres.mjs
```

Exit code 0 = success + row count parity. Exit code 1 = mismatch (zero data loss criteria fail). Exit code 2 = env error.

### Backup (P2-01a baseline; expand di P2-08)

`apps/backend/scripts/backup-postgres.sh` — daily `pg_dump` + gzip → local dir + opsional S3 offload.

```bash
# Manual
./apps/backend/scripts/backup-postgres.sh

# Cron (production VPS)
0 2 * * * cd /var/www/vipos && ./apps/backend/scripts/backup-postgres.sh \
  >> /var/log/vipos-backup.log 2>&1
```

Restore: `gunzip < vipos-YYYY-MM-DD_HHMMSS.sql.gz | psql "$DATABASE_URL"`.

## Production Build

```bash
npm run build       # build semua workspaces (saat ini hanya apps/web)
npm start           # start backend (Express, serve API only)
```

Frontend di-serve via nginx static dari `apps/web/dist/`. Lihat [DEPLOYMENT.md](./DEPLOYMENT.md) untuk konfigurasi VPS lengkap, atau jalankan `tools/scripts/deploy.sh` di VPS.

## Workspace scripts

| Script                 | Apa yang dilakukan                                             |
| ---------------------- | -------------------------------------------------------------- |
| `npm run dev`          | Concurrently jalankan backend + web (dev mode)                 |
| `npm run dev:web`      | Vite dev server di apps/web (port 5173)                        |
| `npm run dev:backend`  | Nodemon backend di apps/backend (port 3001)                    |
| `npm run build`        | Build semua workspaces (`--if-present`)                        |
| `npm run build:web`    | Build apps/web saja                                            |
| `npm start`            | Start production backend                                       |
| `npm run seed`         | Seed data sample ke SQLite                                     |
| `npm test`             | Jalankan tests semua workspaces (placeholder, P0-05)           |
| `npm run lint`         | ESLint flat config — seluruh repo (errors=fail, warnings=info) |
| `npm run lint:fix`     | ESLint dengan auto-fix                                         |
| `npm run format`       | Prettier --write . (format semua file)                         |
| `npm run format:check` | Prettier --check . (verify formatted)                          |

## API

### Versioning (P2-07)

VIPOS API pakai **URI versioning** dengan canonical prefix `/api/v{N}/`. Versi aktif: **v1**.

| Method | Canonical endpoint      | Legacy alias         | Description            |
| ------ | ----------------------- | -------------------- | ---------------------- |
| POST   | /api/v1/auth/login      | /api/auth/login      | Login                  |
| GET    | /api/v1/auth/me         | /api/auth/me         | Current user           |
| POST   | /api/v1/auth/register   | /api/auth/register   | Register (admin)       |
| GET    | /api/v1/products        | /api/products        | List products          |
| POST   | /api/v1/products        | /api/products        | Create product (admin) |
| PUT    | /api/v1/products/:id    | /api/products/:id    | Update product (admin) |
| DELETE | /api/v1/products/:id    | /api/products/:id    | Delete product (admin) |
| GET    | /api/v1/categories      | /api/categories      | List categories        |
| GET    | /api/v1/transactions    | /api/transactions    | List transactions      |
| POST   | /api/v1/transactions    | /api/transactions    | Create transaction     |
| GET    | /api/v1/dashboard/stats | /api/dashboard/stats | Dashboard stats        |

Daftar lengkap semua endpoint ada di Swagger UI (lihat di bawah).

**Legacy alias** `/api/*` (tanpa `v1`) masih bekerja untuk backward compatibility, tapi setiap response dari alias tersebut otomatis menambahkan header:

- `Deprecation: true`
- `Sunset: Wed, 04 Nov 2026 23:59:59 GMT`
- `Link: </api/v1/...>; rel="successor-version"`

Sunset window 6 bulan; alias akan dihapus pada commit terpisah setelah 2026-11-04. Konsumen API (web client, Android di Phase 3, integrasi pihak ketiga) dipersilakan migrasi ke `/api/v1/...` sebelum tanggal tersebut.

Policy versioning lengkap di [`CHANGELOG.md`](./CHANGELOG.md#api-versioning-policy).

Production: prefix `/vipos` di-strip oleh nginx (lihat [DEPLOYMENT.md](./DEPLOYMENT.md)). Endpoint internal tetap `/api/v1/*`.

### API Documentation (Swagger / OpenAPI)

OpenAPI 3.1 spec di-generate otomatis dari Zod schemas di `packages/shared/src/schemas/*.ts`. Backend mount Swagger UI di:

- Dev: http://localhost:3001/api/docs
- Raw spec: http://localhost:3001/api/docs.json

Semua path di spec sudah pakai prefix `/api/v1/...` (legacy alias tidak di-document). Mau test endpoint langsung di browser dengan auth? Login sekali via `POST /api/v1/auth/login`, copy `token`, klik **Authorize** di Swagger UI, paste sebagai `Bearer <token>`.

Untuk disable Swagger UI di production, set env `DISABLE_API_DOCS=1`.

## Development workflow

VIPOS dikerjakan via task-based workflow di `docs/v3/workflow/` (86 tasks across 7 phases). Setiap task punya branch + PR sendiri. Lihat [docs/v3/workflow/00_OVERVIEW.md](./docs/v3/workflow/00_OVERVIEW.md) untuk peta phases dan [docs/v3/workflow/01_HOW_TO_USE.md](./docs/v3/workflow/01_HOW_TO_USE.md) untuk konvensi branch/commit/PR.

### Code quality (ESLint + Prettier + Husky)

Setelah `npm install` (atau `npm run prepare` sekali), Husky meng-install git hook otomatis:

- `pre-commit` → jalankan lint-staged: `eslint --fix` + `prettier --write` hanya pada file yang ter-stage. File-file di luar staging tidak ke-touched.
- `commit-msg` → commitlint enforce format **Conventional Commits dengan task-ID scope**:
  - Valid: `feat(P1-04): tambah Products page`
  - Valid: `wip(P0-02): scaffold workflow CI`
  - Invalid: `update stuff` → ditolak
  - Type yang diterima: `feat | fix | docs | chore | style | refactor | perf | test | build | ci | revert | wip | release`

VS Code: install ekstensi ESLint + Prettier + EditorConfig (rekomendasi sudah di `.vscode/extensions.json`). Setting auto-format on save sudah di `.vscode/settings.json`.

Lint checks juga dipanggil di CI (lihat `.github/workflows/ci.yml`).

## License

MIT

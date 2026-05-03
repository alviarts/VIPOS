# VIPOS - Aplikasi POS/Kasir Modern

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
- **Database:** SQLite (via better-sqlite3)
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

## Production Build

```bash
npm run build       # build semua workspaces (saat ini hanya apps/web)
npm start           # start backend (Express, serve API only)
```

Frontend di-serve via nginx static dari `apps/web/dist/`. Lihat [DEPLOYMENT.md](./DEPLOYMENT.md) untuk konfigurasi VPS lengkap, atau jalankan `tools/scripts/deploy.sh` di VPS.

## Workspace scripts

| Script | Apa yang dilakukan |
|---|---|
| `npm run dev` | Concurrently jalankan backend + web (dev mode) |
| `npm run dev:web` | Vite dev server di apps/web (port 5173) |
| `npm run dev:backend` | Nodemon backend di apps/backend (port 3001) |
| `npm run build` | Build semua workspaces (`--if-present`) |
| `npm run build:web` | Build apps/web saja |
| `npm start` | Start production backend |
| `npm run seed` | Seed data sample ke SQLite |
| `npm test` | Jalankan tests semua workspaces (placeholder, P0-05) |
| `npm run lint` | Jalankan linter semua workspaces (placeholder, P0-03) |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Current user |
| POST | /api/auth/register | Register (admin) |
| GET | /api/products | List products |
| POST | /api/products | Create product (admin) |
| PUT | /api/products/:id | Update product (admin) |
| DELETE | /api/products/:id | Delete product (admin) |
| GET | /api/categories | List categories |
| POST | /api/categories | Create category (admin) |
| GET | /api/transactions | List transactions |
| POST | /api/transactions | Create transaction |
| POST | /api/transactions/:id/void | Void transaction |
| GET | /api/dashboard/stats | Dashboard stats |
| GET | /api/dashboard/chart | Sales chart data |
| GET | /api/dashboard/top-products | Top selling products |

Production: prefix `/vipos` di-strip oleh nginx (lihat [DEPLOYMENT.md](./DEPLOYMENT.md)). Endpoint internal tetap `/api/*`.

### API Documentation (Swagger / OpenAPI)

OpenAPI 3.1 spec di-generate otomatis dari Zod schemas di `packages/shared/src/schemas/*.ts`. Backend mount Swagger UI di:

- Dev: http://localhost:3001/api/docs
- Raw spec: http://localhost:3001/api/docs.json

Mau test endpoint langsung di browser dengan auth? Login sekali via `POST /api/auth/login`, copy `token`, klik **Authorize** di Swagger UI, paste sebagai `Bearer <token>`. Spec berisi semua resource (`auth`, `products`, `categories`, `customers`, `finance`, `inventory`).

Untuk disable Swagger UI di production, set env `DISABLE_API_DOCS=1`.

## Development workflow

VIPOS dikerjakan via task-based workflow di `docs/v3/workflow/` (86 tasks across 7 phases). Setiap task punya branch + PR sendiri. Lihat [docs/v3/workflow/00_OVERVIEW.md](./docs/v3/workflow/00_OVERVIEW.md) untuk peta phases dan [docs/v3/workflow/01_HOW_TO_USE.md](./docs/v3/workflow/01_HOW_TO_USE.md) untuk konvensi branch/commit/PR.

## License

MIT

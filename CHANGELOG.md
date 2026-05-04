# Changelog

Semua perubahan API VIPOS yang berdampak ke client (web, Android di Phase 3,
integrasi pihak ketiga) dicatat di sini. Format mengikuti
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) dan project memakai
[Semantic Versioning](https://semver.org/lang/id/) untuk pricing API.

## API versioning policy

- **Canonical prefix**: `/api/v{N}/...`. Versi aktif: `v1`.
- **Bump major (`v2`, `v3`, ...)** saat ada **breaking change** di:
  - bentuk request body / query string yang sudah lama dipakai
  - bentuk response body (key removed/renamed, type changed)
  - kontrak auth / RBAC (mis. scope token berubah)
  - URL path resource yang sudah pernah dirilis
- **Tetap di v1** untuk perubahan additive: tambah field opsional, tambah
  endpoint baru, tambah enum value baru di response (kalau client diperingatkan
  via OpenAPI spec).
- **Deprecation flow**: ketika v2 dirilis, v1 endpoint balas dengan header
  - `Deprecation: true` (atau IMF-fixdate kapan deprecate)
  - `Sunset: <IMF-fixdate>` (tanggal endpoint akan dimatikan, minimal 6 bulan
    setelah deprecation)
  - `Link: </api/v2/...>; rel="successor-version"`
- **Sunset minimum**: 6 bulan dari tanggal deprecation untuk memberi window
  migrasi ke konsumen pihak ketiga + APK Android lama.

Source of truth contract: [Swagger UI](http://localhost:3001/api/docs) +
`/api/docs.json` (auto-generated dari Zod schemas di `packages/shared`).

---

## [Unreleased]

### Added

- **P2-07**: API versioning. Semua endpoint sekarang canonically tersedia di
  `/api/v1/*` (sebelumnya unversioned `/api/*`). Web client + tests sudah
  pakai `/api/v1`.
- **P2-07**: Backward-compat alias di `/api/*` (kecuali `/api/health`,
  `/api/docs`, `/api/docs.json`) yang otomatis menambahkan header
  `Deprecation: true`, `Sunset: Wed, 04 Nov 2026 23:59:59 GMT`, dan
  `Link: </api/v1/...>; rel="successor-version"` per RFC 8594. Sunset window
  6 bulan; alias akan dihapus pada commit terpisah setelah 2026-11-04 dan
  semua client confirm migrasi.
- **P2-07**: Swagger UI di `/api/docs` + raw OpenAPI 3.1 spec di
  `/api/docs.json`. Auto-generated dari Zod schemas di `packages/shared`,
  jadi single source of truth contract untuk web (sekarang) dan Android (P3).
  Path di spec konsisten dengan canonical `/api/v1/...`.

### Deprecated

- Unversioned `/api/*` paths. Migrate ke `/api/v1/*` sebelum sunset
  **2026-11-04**. Pemanggilan ke alias akan terus bekerja sampai sunset, tapi
  client harus pantau `Deprecation` / `Sunset` response header.

---

## [1.0.0] — 2026-05-03 (pre-launch baseline)

Phase 1 selesai (P1-01..P1-18, semua merged ke `main`). Tracker:
[`docs/v3/workflow/phase_1_web_dashboard.md`](docs/v3/workflow/phase_1_web_dashboard.md).

Highlights:

- Web dashboard React + Vite + Tailwind covering 11 menu group Majoo:
  Penjualan (POS, Promo, Voucher, Loyalty, Komisi), B2B (Quotation, Sales
  Order, DO, Invoice, Receipt, Aging), Pelanggan, Keuangan (CoA, Journal,
  Cash, Income, Expense, Recurring Bill, Vendor, Fixed Asset, Financial
  Report), Karyawan + Payroll + Absensi + Schedule + Approval, Order Online +
  Marketplace + Storefront + Consumer App, Marketing (WA Blast / SMS / Email
  / IG Feed), Appointment, Reports (28+ laporan dengan filter standar +
  export CSV/Excel/PDF), Pengaturan (11 sub-pages), LAINNYA (Bantuan,
  LAYANAN, INSPIRASI, Capital, SUPPLIES).
- Backend Node.js + Express + better-sqlite3 dengan ~70 routes.
- Auth JWT 15 menit + refresh token + 2FA TOTP.
- 425 vitest cases ijo di CI (`npm test`).
- Live di http://103.74.5.44/vipos/ via VPS deploy script.

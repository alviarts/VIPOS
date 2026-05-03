# VIPOS — Launch Readiness Strategic Roadmap

> **Status saat ditulis:** Phase 1 (P1-01..18) sudah `[done]` di [`phase_1_web_dashboard.md`](./phase_1_web_dashboard.md). Phase 2 (P2-01..08) di [`phase_2_backend.md`](./phase_2_backend.md) masih `[pending]`. Dokumen ini disusun sebagai referensi strategis dari hasil gap analysis VIPOS vs Majoo (lihat lampiran sesi Devin: `https://app.devin.ai/sessions/0c79ce7d39ee421bb1280ded1c581f1c`).

> **Tujuan dokumen ini:** Memberi panduan apa yang perlu dilakukan **selain** yang sudah ada di phase doc, supaya saat VIPOS launch (web + APK Android) di v0.0.1 / GA, aplikasinya benar-benar siap pakai oleh merchant nyata di Indonesia.

> **Bukan:** roadmap eksekusi yang menggantikan phase doc. Phase doc tetap source-of-truth untuk task tracking.

---

## 0. Plan flow agreed

```
[Phase 1 done] (now)
       │
       ▼
[Strategic Roadmap PR] ◀── kamu di sini
       │
       ▼
[Phase 2 execution] (P2-01..08, backend hardening)
       │
       ▼
[E2E workflow testing] (Devin-driven, full golden-path)
       │
       ▼
[Bug fix from E2E findings]
       │
       ▼
[VIPOS v0.0.1 release] ──► Web + APK Android
       │
       ▼
[Pra-beta test] ──► 1-2 merchant alpha (free, owner kenalan)
       │
       ▼
[Beta] ──► 5-10 merchant
       │
       ▼
[GA launch] (testimonial-backed)
```

---

## 1. Six Pillars of Launch Readiness

### Pillar 1 — Foundation Stability

Phase 2 (P2-01..08 di phase doc) sudah cover dasar foundation: Postgres, multi-tenant, audit, jobs, observability, rate limit, versioning, backup. Berikut **tambahan** yang patut diadopsi di luar yang sudah di-spec:

#### 1.1 Database migration discipline

- Pakai **Prisma migrate** (P2-01). Tambahkan **shadow database** di CI supaya migration di-test sebelum dijalankan ke prod.
- Tiap migration harus reversible (`down` script di-maintain manual untuk migration kompleks).
- **Backup before every migration** otomatis di CI/CD pre-deploy hook.

#### 1.2 Multi-tenant strategy: pilih dari awal

3 model umum:

- **Schema-per-tenant** (`CREATE SCHEMA tenant_xyz`) — paling isolated, mahal scaling >100 tenant.
- **Row-level security (RLS)** + `tenant_id` column + Postgres policy — scalable, butuh disiplin di setiap query.
- **Database-per-tenant** — paling aman, paling mahal.

**Saran:** RLS + `tenant_id`. Setup `app.current_tenant` session variable + `CREATE POLICY` per table. Setup sekali, ongoing cost rendah, security audit gampang.

#### 1.3 Background jobs: gunakan dengan bijak (P2-04)

- **Webhook delivery idempotent** — Marketplace webhook (GoFood/GrabFood) bisa duplicate. Set `idempotency_key` per webhook + dedupe table.
- **Scheduled reports** — jangan hit DB primary, pakai read replica atau materialized view yang refresh per jam.
- **Reminder appointment** — hitung target time **server-side** (bukan client TZ) untuk hindari TZ-bug.

#### 1.4 Yang bukan di Phase 2 doc tapi patut ditambahkan:

| Item                                         | Kenapa                                             | Effort                        |
| -------------------------------------------- | -------------------------------------------------- | ----------------------------- |
| Connection pooling (PgBouncer / Prisma pool) | Hindari Postgres exhausted di traffic spike        | 0.5 hari                      |
| Database read replica                        | Report query heavy, jangan di primary              | 1 hari (free di Supabase Pro) |
| Soft delete + archive policy                 | `deleted_at` + nightly archive >2 tahun ke S3 cold | 2 hari                        |
| Feature flags (Unleash / LaunchDarkly)       | Roll out fitur ke 1 merchant dulu sebelum semua    | 1 hari                        |
| Database seed for QA env                     | Reproducible test data                             | 1 hari                        |

---

### Pillar 2 — Testing & QA Discipline

Phase 1 punya 425 unit/integration test yang pass — perlu dilengkapi dengan layer di atasnya sebelum launch.

#### 2.1 Testing pyramid

| Level                                 | Coverage VIPOS sekarang | Target sebelum launch                     |
| ------------------------------------- | ----------------------- | ----------------------------------------- |
| Unit test                             | 425 (route + schema)    | tetap, target ≥80% line coverage          |
| Integration (DB roundtrip)            | partial (real SQLite)   | naikkan ke ephemeral Postgres di CI       |
| Contract test (FE↔BE)                 | none                    | Pact / OpenAPI-driven                     |
| E2E (Playwright)                      | none                    | minimal 10 golden-path otomatis di CI     |
| Load test (k6 / Artillery)            | none                    | Kasir endpoint @ 100 req/s untuk 10 menit |
| Visual regression (Percy / Chromatic) | none                    | nice-to-have post-launch                  |

#### 2.2 E2E scenarios wajib (10 baseline)

1. Login → 2FA setup → 2FA login.
2. Kasir buka shift → ring up → bayar tunai → struk → tutup shift dengan recon.
3. Kasir bayar QRIS (mock) → settlement masuk hari berikutnya.
4. Order online webhook → accept → complete → settlement match.
5. Appointment book → confirm → check-in → convert ke kasir → settle.
6. Marketing campaign create → schedule → send mock → status updated.
7. Payroll period generate → approve → mark paid → reconcile.
8. Invoice B2B 5-stage flow (Quote → SO → DO → Invoice → Receipt).
9. Inventory stock opname → stok terupdate → reflect di laporan.
10. Multi-outlet: user outlet A tidak bisa lihat data outlet B (RLS proof).

Run setiap night di CI. Block deploy kalau ada yang fail.

#### 2.3 Production smoke test (synthetic monitoring)

Pakai Checkly / Pingdom:

- `/api/health` setiap 1 menit — alert kalau down.
- E2E "login + dashboard" setiap 5 menit di prod — alert kalau response time >2s.
- Public-facing pages availability dari multi-region (US, SG, EU).

---

### Pillar 3 — Performance & Scalability

POS punya pattern unik: **bursty write** (jam makan siang/malam) + **heavy read** (report end-of-month).

#### 3.1 Backend

- **Index strategy**: every `WHERE`/`ORDER BY` column. `EXPLAIN ANALYZE` di slow query. Target p95 <100ms untuk hot path (kasir, products list).
- **Cursor-based pagination** untuk list panjang (transactions, customers). Offset lambat di >10k row.
- **Batch endpoint** untuk Android Kasir (Phase 3): `POST /api/sync/batch` — 50 transaksi pending sekali round-trip.
- **REST stay** (jangan GraphQL — klien sudah well-defined).
- **CDN + edge caching** asset publik (logo merchant, foto produk) via Cloudflare / Bunny.net.

#### 3.2 Frontend

- **Code splitting by route** — target initial bundle <300KB gzipped.
- **Service worker (PWA)** — kasir tetap bisa input transaksi saat internet putus, sync saat online lagi. **CRITICAL untuk Indonesia** (banyak outlet sinyal kurang stabil).
- **Optimistic UI** — klik "Tambah ke Cart" → langsung update state, jangan tunggu API. Rollback kalau gagal.
- **Prefetch** common navigation (Dashboard → Kasir adalah path #1, prefetch saat hover sidebar).

#### 3.3 Database

- **Partitioning** `transactions` by month setelah >1 juta baris (Postgres native).
- **Materialized view** untuk dashboard KPI (refresh tiap 5 menit).
- **Vacuum + analyze** schedule weekly via pg_cron.

---

### Pillar 4 — Operational Readiness

#### 4.1 Deployment infra

- **Staging 1:1 dengan prod** (sama Postgres/Redis/S3, sama 2 instance behind LB).
- **Blue/green** atau **canary** (5% traffic ke versi baru). Vercel/Render/Railway support built-in.
- **Migration workflow**: PR → review terpisah → apply staging → 24h wait → apply prod.
- **Rollback plan**: setiap deploy bisa di-rollback dalam 5 menit. Immutable image tag, jangan `latest`.

#### 4.2 Monitoring & alerting (selain P2-05)

- **Sentry** — alert ke Slack/Discord kalau error rate >0.1%.
- **Grafana / Prometheus** — dashboard: req/s per endpoint, p50/p95/p99 latency, DB pool usage, Redis queue depth.
- **Uptime monitoring** (Better Stack / Healthchecks.io) — SMS/call alert kalau /api/health down >2 menit.
- **Business metric dashboard** (selain infra): GMV harian, jumlah merchant aktif, transaksi/jam.

#### 4.3 Logging discipline

- **Structured JSON logging** (Pino, sudah di P2-05).
- **Correlation ID** (`x-request-id`) trace 1 request FE → BE → DB.
- **PII scrubbing** di logger — JANGAN log nomor kartu, password, JWT token, email user (mask jika perlu).
- **Log retention**: 30 hari di Loki/Datadog, archive ke S3 Glacier untuk audit.

#### 4.4 Backup & DR (P2-08)

- **Restore drill setiap bulan**. Backup yang gak pernah di-test = backup yang pasti gagal saat dibutuhkan.
- Test scenario: drop staging DB → restore dari backup terakhir → run E2E → harus pass 100%. Document RTO actual: target <30 menit dari "DB hilang" sampai "service back online".

---

### Pillar 5 — Security

POS = data uang + pelanggan + karyawan. **Salah dikit = lawsuit.**

#### 5.1 OWASP Top 10 baseline (sebelum launch)

- ✅ Authentication: JWT + 2FA (sudah)
- ❌ **Authorization audit**: setiap endpoint cek `role` + `outlet_id` ownership. Audit otomatis pakai test "user A tidak bisa access resource user B".
- ❌ **Input validation**: Zod schema sudah ada — pastikan **setiap** endpoint pakai. Cek dengan grep `router.(post|put|patch)` yang tidak diikuti `validate({ body: ...})`.
- ❌ **SQL injection**: Prisma aman by default, raw SQL pakai `$queryRaw` parameterized.
- ❌ **XSS**: cek `dangerouslySetInnerHTML` (kalau ada).
- ❌ **CSRF**: SameSite cookie atau CSRF token kalau ada session-based auth.
- ❌ **Rate limiting** (P2-06) per IP + per user — login endpoint paling kritis.
- ❌ **Secrets management**: jangan commit `.env`, pakai Vercel/Railway secret store atau Doppler.
- ❌ **Dependency audit**: `npm audit` weekly + Snyk/Dependabot.
- ❌ **Content Security Policy** header.

#### 5.2 Compliance

- **PCI DSS** kalau handle kartu kredit — **JANGAN** simpan card data di VIPOS, delegate ke payment gateway (Midtrans, Xendit, Doku). VIPOS hanya simpan `transaction_id` reference.
- **UU PDP (Indonesia Personal Data Protection)** — efektif Oktober 2024. Wajib: privacy policy, data retention policy, right-to-delete endpoint untuk customer data.
- **e-Faktur PPN** kalau merchant PKP — integrasi DJP Coretax atau OSS e-Faktur. Out-of-scope Phase 1-2 tapi catat di roadmap Phase 4+.

#### 5.3 Audit logging — bukan cuma untuk debug

P2-03 audit log harus track:

- Login/logout per user.
- Permission change (siapa ubah role siapa).
- Transaction void/refund (kasir vs manager approval).
- Pengaturan keuangan changed (rekening bank, tax rate).
- Bulk delete operations.

Audit log **immutable** — tidak boleh edit/delete oleh user, hanya admin super dengan password kedua.

---

### Pillar 6 — Business Readiness

Aplikasi sempurna teknis tapi gagal bisnis = waste.

#### 6.1 Onboarding merchant

- **Wizard onboarding** (5-step max): Akun → Bisnis info → Outlet pertama → Import produk (Excel) → Tutorial 5-menit.
- **Sample data preset** — saat akun baru, opsi "Mulai dengan template F&B / Retail / Salon" (bibit kategori, produk, sample transaksi).
- **Video tutorial** Bahasa Indonesia, max 2 menit per topik (YouTube atau Loom).
- **In-app tooltip** (`react-joyride` atau `intro.js`) — guided tour pertama kali login.

#### 6.2 Support infrastructure

- **WhatsApp bisnis** untuk first-line support (Indonesia merchant lebih nyaman WA daripada email).
- **Knowledge base** (Notion public atau GitBook) — search-able FAQ + troubleshooting.
- **In-app feedback widget** (`feedback.fish` atau custom).
- **Status page** (Upptime / Statuspage.io) — public.

#### 6.3 Pilot strategy (KRITIS — jangan launch ke 100 merchant sekaligus)

1. **Alpha (1-2 merchant, free)** — owner kenalan, akses langsung, bug fix harian. Min 4 minggu running.
2. **Beta (5-10 merchant, free atau diskon 50%)** — variasi industri (F&B, retail, salon). 2-3 bulan.
3. **GA launch** dengan testimonial dari beta merchant.

**Metric per fase:**

- Daily Active Outlets (DAO) — % outlet yang ada minimal 1 transaksi tiap hari.
- Time-to-first-transaction setelah signup — target <30 menit.
- Support ticket per merchant per minggu — target <2 untuk beta, <0.5 untuk GA.
- Churn rate — target <5% bulanan setelah GA.

#### 6.4 Pricing strategy (benchmark Indonesia)

Benchmark: Majoo Rp 99k/bulan, Pawoon Rp 199k, Kasir Pintar gratis.

- **Free tier** (1 outlet, 100 produk, no marketing) — acquisition magnet.
- **Pro tier** (Rp 149k/bulan, unlimited produk, marketing module, multi-outlet sampai 3) — main revenue.
- **Enterprise** (custom, multi-outlet >3, dedicated support, SLA 99.9%) — high-margin.

VIPOS Phase 1 sudah cover semua fitur Pro — billing/subscription module yang masih perlu dibangun (region P2-08).

#### 6.5 Localization

- **Bahasa Indonesia 100%** (sudah, tapi cek konsistensi: "Pelanggan" vs "Customer" vs "Klien" — pilih satu).
- **Bahasa Inggris** opsional (untuk merchant ekspat di Bali/Jakarta).
- **Format mata uang/tanggal** — `Rp 1.000.000` (titik thousand sep), `03/05/2026` (DD/MM/YYYY).
- **Time zone** — store UTC di DB, render WIB/WITA/WIT per outlet.

---

## 2. Saran Timeline (kalau executed end-to-end ke GA)

```
Week 1-2:    E2E test Phase 1 + bug fix
Week 3-5:    P2-01 Postgres + P2-02 Multi-tenant + Connection pooling
Week 6-7:    P2-03 Audit + P2-04 Background jobs (paralel)
Week 8-9:    P2-05 Observability + P2-06 Rate limit (paralel)
Week 10:     P2-07 API versioning + P2-08 Backup + DR drill
Week 11-12:  Inventory PO/Retur (Phase 1.5 high priority) + Tutup Kasir/Toko
Week 13-14:  Onboarding wizard + Sample data preset + In-app tour
Week 15:     Security audit (external pentest opsional, ~Rp 30-50jt)
Week 16:     Alpha launch (1 merchant kenalan)
Week 17-20:  Iterate from alpha feedback, fix bugs, polish
Week 21-24:  Beta launch (5-10 merchant)
Week 25+:    GA launch
```

**Total: ~6 bulan dari Phase 1 close ke GA launch yang "perfect".**

---

## 3. Top 5 Priorities (paling impactful)

Kalau cuma boleh execute 5 hal:

1. **PWA + offline mode** — non-negotiable untuk POS Indonesia. Internet outage adalah norm, bukan exception.
2. **RLS + audit log dari hari 1 Phase 2** — retrofit security itu painful.
3. **Pilot merchant 1-2 bulan sebelum GA** — bug yang pasti ada hanya muncul saat real merchant pakai.
4. **Restore drill bulanan** — backup yang gak ditest = berbohong ke diri sendiri.
5. **Onboarding wizard + sample data** — bukan teknis, tapi yang menentukan apakah merchant bertahan setelah signup atau churn di hari ke-3.

---

## 4. Cross-Reference

- [`phase_1_web_dashboard.md`](./phase_1_web_dashboard.md) — Phase 1 task tracking (P1-01..18, all done)
- [`phase_2_backend.md`](./phase_2_backend.md) — Phase 2 task tracking (P2-01..08, pending)
- Gap analysis VIPOS vs Majoo: terlampir di sesi Devin `https://app.devin.ai/sessions/0c79ce7d39ee421bb1280ded1c581f1c` (file `VIPOS_vs_Majoo_gap_analysis.md`)

---

## 5. Ownership

Dokumen ini bersifat **strategis advisory**, bukan task tracking. Update dokumen ini hanya kalau ada keputusan strategis baru (mis. ganti pricing model, ganti DB choice, dsb.). Untuk eksekusi harian, tetap pakai phase doc yang sesuai.

# Devin Task Prompt — Template

> Copy block bawah, ganti placeholder `{{...}}`, paste ke session Devin baru.

---

## Template umum (semua task)

```markdown
Lanjutkan development VIPOS di https://github.com/alviarts/VIPOS.

**Task**: {{P{phase}-{nn}: judul task}}
**Phase**: {{Phase X — nama}}
**Branch**: `devin/{{P{phase}-{nn}-{slug}}}`

**Reference dokumen**:

- `docs/v3/workflow/phase_{{X}}_*.md` — cari section "{{P{phase}-{nn}}}"
- `docs/v3/workflow/00_OVERVIEW.md` — visi & arsitektur
- `docs/v3/workflow/01_HOW_TO_USE.md` — konvensi
- `docs/v2/{{file-spesifik.md}}` — spec menu/feature relevant
- `docs/v2/02_DATA_MODELS.md` — entity schemas
- `docs/v2/03_API_CONTRACT.md` — API conventions

**Goal**:
{{1-2 kalimat goal task}}

**Acceptance criteria** (copy dari phase doc):
{{daftar checklist [ ]}}

**Workflow**:

1. Pull main: `cd /home/ubuntu/repos/VIPOS && git fetch && git checkout main && git pull`
2. Buat branch: `git checkout -b devin/{{P{phase}-{nn}-{slug}}}`
3. Implementasi sesuai spec; ikuti konvensi di `01_HOW_TO_USE.md`
4. Test lokal (jalankan acceptance checks)
5. Commit + push: `git push origin devin/{{P{phase}-{nn}-{slug}}}`
6. Buat PR ke `main` pakai template `docs/v3/workflow/templates/pr_template.md`
7. Pass CI checks (lint, typecheck, test, build)
8. Update `docs/v3/workflow/phase_{{X}}_*.md` → mark `{{P{phase}-{nn}}}` jadi `[done]` (commit langsung di main pakai PR untuk update marker, atau di PR yang sama)
9. Notify user dengan link PR

**Catatan penting**:

- VIPOS standalone — tidak proxy ke Majoo, hanya pinjam pola UI/struktur API
- Push pakai proxy bawaan Devin (sudah authenticated). Kalau 403, fallback ke direct PAT URL `https://x-access-token:${GITHUB_PAT}@github.com/alviarts/VIPOS.git`
- Jangan push langsung ke `main` — selalu lewat PR
- Tailwind primary color = teal `#04C99E`
- Backend port 3001, JWT_SECRET dari env, default admin/admin123
- Production deploy: VPS 103.74.5.44 (auto-deploy dari main via GitHub Actions setelah P0-02)
- Estimasi durasi: {{X-Y hari}} — kalau ternyata > 2× estimate, message user untuk bahas pemecahan task

**Verifikasi sebelum buka PR**:

- [ ] `npm run lint` (web + backend) atau `./gradlew lint` (Android) pass
- [ ] `npm test` atau `./gradlew test` pass
- [ ] Build pass: `npm run build` atau `./gradlew assembleDebug`
- [ ] Manual smoke test sesuai task
- [ ] Tidak ada breaking change di endpoint existing (kecuali task explicit)
```

---

## Template khusus: Web task

```markdown
Lanjutkan VIPOS — Task {{P1-XX}}: {{judul web task}}.

[Pakai template umum di atas]

**Tech-specific**:

- Web stack: React 18 + Vite + Tailwind 3 + React Router 6
- API client: `apps/web/src/api/{resource}.js`
- Form: React Hook Form + zod schema dari `packages/shared/src/schemas/`
- State: React Context untuk shared state, useState untuk local
- Style: Tailwind utility classes; primary `teal-500` `#04C99E`
- Test: Vitest + React Testing Library

**Common pitfalls untuk web task**:

- Jangan hardcode API URL — pakai `import.meta.env.VITE_API_URL`
- Form validation pakai zod schema (shared dengan backend)
- Loading state + empty state + error state semua harus ditangani
- Mobile-responsive (Tailwind breakpoints sm/md/lg)
- Role-aware: cek user permission lewat `usePermission()` hook
```

---

## Template khusus: Backend task

```markdown
Lanjutkan VIPOS — Task {{P2-XX}}: {{judul backend task}}.

[Pakai template umum di atas]

**Tech-specific**:

- Stack: Node 18+ + Express 4 + Prisma (after P2-01) atau better-sqlite3 (sebelum)
- Auth: JWT + middleware
- Validation: zod schema dari `packages/shared/`
- Error handling: middleware central dengan error catalog (`docs/v2/07_ERROR_CATALOG.md`)
- Logging: Pino (after P2-05) atau console (sebelum)
- Test: Vitest + Supertest

**Common pitfalls untuk backend task**:

- Jangan return data tanpa filter `tenant_id` (after P2-02)
- Audit log untuk mutation (after P2-03)
- Idempotency key untuk webhook + mobile sync
- Rate limit per user/IP (after P2-06)
- Migration: pakai Prisma Migrate, jangan ALTER TABLE manual
```

---

## Template khusus: Android task

```markdown
Lanjutkan VIPOS — Task {{P3-XX or P4-XX or P5-XX}}: {{judul Android task}}.

[Pakai template umum di atas]

**Tech-specific**:

- Stack: Kotlin 1.9+, Compose, Material 3, Hilt, Room, Retrofit, WorkManager
- Min SDK 21, target SDK 34
- Modul Gradle: `:app`, `:core:designsystem`, `:core:network`, `:core:database`, `:feature-{X}`
- DI: Hilt (`@HiltViewModel`, `@AndroidEntryPoint`)
- Navigation: compose-navigation (typed nav arguments)
- Adaptive: WindowSizeClass utility dari `core:designsystem`
- Test: JUnit + MockK (unit), Compose UI test (UI)

**Common pitfalls untuk Android task**:

- Compose recomposition: hindari unstable lambda di parameter
- Don't block UI thread — semua I/O lewat coroutine + Dispatchers.IO
- Hilt scoping: ViewModel `@ViewModelScoped`, repository `@Singleton`
- Persisten state pakai `rememberSaveable` atau ViewModel
- Localization: extract semua string ke `strings.xml`, jangan hardcode
- Permission: BT/Camera/Storage runtime permission flow

**Adaptive layout checklist**:

- [ ] Compose Preview untuk Compact/Medium/Expanded (3 size class)
- [ ] Test di emulator: Pixel 4 (phone), Pixel Tablet, Pixel C
- [ ] Orientation change preserved state

**Hardware task tambahan checklist**:

- [ ] Test di device fisik (kalau task involve hardware printer/scanner/EDC)
- [ ] Reconnect logic kalau hardware drop
- [ ] Permission flow runtime
- [ ] Settings screen untuk pair/config
- [ ] Auto-recovery (retry queue kalau fail)
```

---

## Template khusus: GTM/marketing task

```markdown
Lanjutkan VIPOS — Task {{P6-XX}}: {{judul GTM task}}.

[Pakai template umum di atas]

**Tech-specific** (kalau ada engineering):

- Marketing site: Next.js + Tailwind (separate project di `apps/web-marketing/`)
- Help center: Docusaurus atau Mintlify

**Common pitfalls GTM task**:

- Konten Bahasa Indonesia native (bukan terjemahan kaku)
- SEO-friendly: meta tags, structured data, sitemap
- Page speed: image optimization, lazy load, cdn
- Analytics: GA4 + Hotjar setup
- Privacy: cookie banner kalau perlu (GDPR-style)
```

---

## Tips assignment ke Devin

1. **Specific > generic**: berikan task ID tepat (bukan "kerjakan Phase 1"), Devin lebih fokus.
2. **Context lengkap**: link semua reference doc. Devin tidak boleh asumsi.
3. **Acceptance criteria explicit**: list checklist clear.
4. **Estimasi realistis**: kalau task estimasi 5 hari Devin dan ternyata stuck, message user untuk bahas pemecahan.
5. **Dependency check**: sebelum start task, confirm dependency `[done]`.
6. **Branch naming strict**: `devin/P{X}-{nn}-{slug}` — konsisten untuk tracking.
7. **PR template**: pakai `templates/pr_template.md` untuk konsisten.
8. **Update marker**: setelah PR merged, update phase doc → task `[done]` (ini juga via PR atau langsung commit di main, terserah konvensi tim).

## Contoh konkret: assigning P1-04

```markdown
Lanjutkan development VIPOS di https://github.com/alviarts/VIPOS.

Task: P1-04 — Produk Master + 5-tab wizard.
Phase: Phase 1 — Web Dashboard.
Branch: `devin/P1-04-products-page`.

Reference:

- docs/v3/workflow/phase_1_web_dashboard.md (section P1-04)
- docs/v3/workflow/00_OVERVIEW.md
- docs/v3/workflow/01_HOW_TO_USE.md
- docs/v2/menus/penjualan/produk_master.md (UI/UX blueprint)
- docs/v2/02_DATA_MODELS.md (entity Product, Variant, Recipe)
- docs/v2/03_API_CONTRACT.md (REST conventions)

Goal: Refresh halaman Products di web `/vipos/`, lengkapi tab Varian, Resep, dan majoo Order yang saat ini locked. Tambah backend endpoint untuk product variant + recipe.

Acceptance criteria:

- [ ] List produk dengan filter (kategori, status, search), pagination
- [ ] Tambah produk wizard 5 tab semua working
- [ ] Tab Varian: tambah opsi (Ukuran/Warna/dll) + price modifier per opsi
- [ ] Tab Resep: pilih bahan baku + qty per produksi 1 unit
- [ ] Tab majoo Order: harga online (markup), aktif/non-aktif di e-menu
- [ ] Edit + Delete produk
- [ ] Bulk import CSV (placeholder, full di P1-15)
- [ ] Image upload (max 4 foto, drag-reorder)
- [ ] Validation per field (Zod schema)

Workflow standard (per template).

Catatan tech-specific (web task):

- Tailwind primary teal #04C99E
- Form: React Hook Form + zod
- Loading/empty/error state semua handle
- Mobile-responsive

Estimasi: 4-5 hari Devin work.
```

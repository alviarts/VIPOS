# Phase 0: Foundation

> Setup monorepo struktur, CI/CD, code quality tooling, type-safe API contract.
> Goal: setiap Devin session berikutnya punya foundation yang seragam dan automated.

**Estimasi total**: 2 minggu (5 tasks, mostly sequential)

## Tasks

---

### P0-01: Monorepo struktur + workspaces  `[done]`

> PR: [#6](https://github.com/alviarts/VIPOS/pull/6) (merged 2026-05-03), session: https://app.devin.ai/sessions/25c7eea136d1457c8c4dda8d16819659

**Goal**: Reorganize repo jadi monorepo dengan workspaces (web, backend, android, docs, scripts).

**Dependencies**: none

**Outputs**:
- `package.json` di root dengan npm/pnpm workspaces config
- `apps/web/` (move dari `frontend/`)
- `apps/backend/` (move dari `backend/`)
- `apps/android/` (placeholder, kosong)
- `packages/shared/` (untuk shared types antara web + backend)
- `tools/scripts/` (deployment, seed, dll)
- `docs/` (already exists, no change)
- Root `tsconfig.json` base + per-package overrides
- Root `README.md` updated dengan structure baru

**Acceptance criteria**:
- [ ] `npm install` di root install semua workspaces sekali
- [ ] `npm run dev:web` jalan di apps/web
- [ ] `npm run dev:backend` jalan di apps/backend
- [ ] `npm run build` build semua packages
- [ ] Existing `/vipos/api/*` endpoints masih working setelah migration
- [ ] Production deploy script di-update (tools/scripts/deploy.sh)
- [ ] No regression di existing fitur (smoke test pakai checklist PR #1)

**Verifikasi**:
```bash
cd /home/ubuntu/repos/VIPOS
npm install
npm run build
cd apps/backend && npm run seed && PORT=3001 JWT_SECRET=devtest npm start &
cd apps/web && npm run dev
# Login admin/admin123, verify Products page works
```

**Branch**: `devin/P0-01-monorepo-setup`
**Estimasi**: 1 hari

**Devin prompt**:
````
Lanjutkan development VIPOS di https://github.com/alviarts/VIPOS.

Task: P0-01 — Monorepo struktur + workspaces.

Goal: Reorganize repo dari `frontend/` + `backend/` flat → monorepo dengan workspaces (apps/web, apps/backend, apps/android, packages/shared, tools/scripts).

Reference:
- docs/v3/workflow/phase_0_foundation.md (section P0-01)
- docs/v3/workflow/01_HOW_TO_USE.md (konvensi)

Acceptance criteria:
[copy-paste dari phase_0 P0-01 acceptance section]

Workflow:
1. Pull main: `cd /home/ubuntu/repos/VIPOS && git fetch && git checkout main && git pull`
2. Branch: `git checkout -b devin/P0-01-monorepo-setup`
3. Implement migration. Be careful: existing PR #1 sudah deployed, jangan break.
4. Test lokal: jalankan acceptance checks
5. Commit + push, buat PR ke main pakai template `docs/v3/workflow/templates/pr_template.md`
6. Update phase_0 doc → mark P0-01 [done]
7. Notify user dengan link PR

Catatan:
- Pakai npm workspaces (atau pnpm kalau lebih reliable)
- Jangan ubah API endpoint paths (/vipos/api/* harus tetap)
- Update production deploy script supaya path baru ke-handle
- Tailwind primary color teal #04C99E tetap dipertahankan
````

---

### P0-02: CI/CD via GitHub Actions  `[done]`

> PR: [#7](https://github.com/alviarts/VIPOS/pull/7) (merged 2026-05-03), session: https://app.devin.ai/sessions/25c7eea136d1457c8c4dda8d16819659

**Goal**: Auto-run lint + typecheck + test + build di setiap PR.

**Dependencies**: P0-01

**Outputs**:
- `.github/workflows/ci.yml` — pipeline untuk PR + push to main
- `.github/workflows/deploy-vps.yml` — auto-deploy on merge to main (web + backend)
- (Phase 3+ akan tambahkan android workflow)

**Acceptance criteria**:
- [ ] PR baru otomatis trigger CI
- [ ] CI checks: lint, typecheck, test, build (untuk web + backend)
- [ ] Deploy workflow di-trigger saat merge ke main; SSH ke VPS, pull, build, restart pm2
- [ ] Branch protection main: require PR + CI pass
- [ ] Secrets di GitHub: VPS_HOST, VPS_USER, SSH_KEY tersimpan
- [ ] CI badge di README.md

**Verifikasi**:
- Buka PR test (no-op change), confirm CI jalan dan pass.
- Merge PR test, confirm deploy auto-trigger dan VPS terupdate.

**Branch**: `devin/P0-02-ci-cd`
**Estimasi**: 1-2 hari

**Devin prompt**:
````
Lanjutkan VIPOS — Task P0-02: CI/CD via GitHub Actions.

Goal: Setup GitHub Actions untuk auto-run lint + typecheck + test + build pada PR, dan auto-deploy ke VPS pada merge ke main.

Dependency: P0-01 (monorepo) sudah merged.

Reference: docs/v3/workflow/phase_0_foundation.md (P0-02), docs/v3/workflow/01_HOW_TO_USE.md.

Acceptance criteria + workflow [seperti template P0-01].

Catatan:
- VPS info: host 103.74.5.44, user root, deploy path /var/www/vipos
- SSH key user simpan sebagai GitHub Secret VPS_SSH_KEY
- Backend pm2 service: `vipos-backend`
- Branch protection: enable di Settings > Branches
````

---

### P0-03: Code style + linting + git hooks  `[pending]`

**Goal**: ESLint + Prettier + Husky + lint-staged untuk web/backend; konsistensi style otomatis.

**Dependencies**: P0-01

**Outputs**:
- `.eslintrc.json` di root + per-package override
- `.prettierrc.json`
- `.editorconfig`
- `lint-staged.config.js`
- `.husky/pre-commit` jalankan lint-staged
- `.husky/commit-msg` enforce conventional commits (commitlint)

**Acceptance criteria**:
- [ ] `npm run lint` pass tanpa error di kondisi awal
- [ ] Pre-commit hook reject commit kalau lint fail
- [ ] Commit message non-conventional di-reject
- [ ] Prettier auto-format on save (VS Code config terdokumentasi)

**Branch**: `devin/P0-03-lint-style-hooks`
**Estimasi**: 1 hari

---

### P0-04: Type-safe API contract (OpenAPI + Zod)  `[pending]`

**Goal**: Define schema API menggunakan Zod (runtime validation) + generate OpenAPI spec untuk dokumentasi. Web client + backend pakai schema yang sama.

**Dependencies**: P0-01

**Outputs**:
- `packages/shared/src/schemas/{resource}.ts` — Zod schemas per resource (auth, products, customers, dst)
- `packages/shared/src/types/index.ts` — TypeScript types derived
- Backend route handlers: validate request/response pakai schemas
- Web API client: generate dari schemas (atau pakai `tRPC` style)
- `docs/api/openapi.json` — generated OpenAPI spec
- Swagger UI accessible di `/api/docs` (dev mode)

**Acceptance criteria**:
- [ ] 5 existing resources (auth, products, categories, customers, finance, inventory) punya Zod schema
- [ ] Backend reject invalid request body dengan 400 + error detail
- [ ] Web client type-safe call ke backend (TypeScript autocomplete)
- [ ] OpenAPI spec generated otomatis dari Zod schemas
- [ ] Swagger UI berfungsi di dev

**Branch**: `devin/P0-04-api-contract`
**Estimasi**: 2-3 hari

---

### P0-05: Testing framework  `[pending]`

**Goal**: Vitest untuk web + backend; basic test coverage untuk login, products CRUD, finance basics.

**Dependencies**: P0-01, P0-04

**Outputs**:
- `apps/web/vitest.config.ts` + `apps/web/src/__tests__/`
- `apps/backend/vitest.config.ts` + `apps/backend/src/__tests__/`
- React Testing Library setup untuk web component tests
- Supertest untuk backend integration tests
- Sample tests: auth login, products list, finance accounts list

**Acceptance criteria**:
- [ ] `npm test` jalan di kedua workspace
- [ ] Coverage report generated (target awal 30%, akan naik per task)
- [ ] CI jalankan tests + fail kalau test fail
- [ ] Sample tests lulus

**Branch**: `devin/P0-05-testing-framework`
**Estimasi**: 1-2 hari

---

## Definition of Done — Phase 0

- [ ] Monorepo working
- [ ] CI/CD enabled, every PR auto-checked
- [ ] Lint/format/git hooks enforced
- [ ] Type-safe API contract foundation
- [ ] Testing framework ready

Setelah Phase 0 selesai, Phase 1 (web dashboard) bisa dijalankan dengan banyak Devin paralel karena setiap task punya:
- Branch terpisah
- CI auto-validate
- Type-safe contract jadi tidak conflict di API

# How to Use This Workflow — Spawn New Devin Sessions

> Panduan praktis: cara assign task ke Devin baru, branch convention, PR convention, dan tracking progress.

## Secrets / kredensial yang sudah disiapkan

Organization VIPOS sudah punya secret org-level berikut yang **auto-inject** ke setiap session Devin baru. Cukup reference dengan `${VAR_NAME}` di prompt — Devin substitusi otomatis saat runtime. **Jangan** tulis nilai literal token/password di prompt, file, atau commit.

| Secret | Scope | Kegunaan |
|---|---|---|
| `${GITHUB_PAT}` | org | Fallback push ke GitHub kalau Devin git proxy gagal: `git push "https://x-access-token:${GITHUB_PAT}@github.com/alviarts/VIPOS.git" <branch>` |
| `${VPS_PASSWORD}` | org | Password root VPS `103.74.5.44` untuk SSH deploy + maintenance (dipakai di P0-02 CI/CD setup, P2-01 Postgres install, dll) |

**VPS info (literal, aman ditulis)**:
- Host: `103.74.5.44`
- User: `root`
- Deploy path: `/var/www/vipos`
- Backend pm2 service: `vipos-backend`
- Web served via nginx di prefix `/vipos/`
- Live URL: http://103.74.5.44/vipos/

**Cara akses VPS dari Devin shell**:

```bash
# Install sshpass kalau belum ada
which sshpass || (apt-get update && apt-get install -y sshpass)

# Run command remote
sshpass -p "${VPS_PASSWORD}" ssh -o StrictHostKeyChecking=no root@103.74.5.44 "ls /var/www/vipos"

# Copy file ke VPS
sshpass -p "${VPS_PASSWORD}" scp -o StrictHostKeyChecking=no localfile.txt root@103.74.5.44:/tmp/

# Untuk task yang butuh akses extensive, rekomendasi setup SSH key sekali (di task P0-02):
# 1) Generate key di Devin shell, append public ke /root/.ssh/authorized_keys di VPS via sshpass
# 2) Save private key sebagai org secret VPS_SSH_KEY
# 3) Future task pakai SSH key (lebih cepat, no password prompt overhead)
```

## Quick start (RECOMMENDED — pakai 1 prompt universal)

Lihat `templates/devin_continuation_prompt.md`. **Satu prompt yang sama** dipaste ke setiap session Devin baru — Devin auto-detect task berikutnya:

1. Buka https://app.devin.ai → New Session.
2. Paste prompt universal dari `templates/devin_continuation_prompt.md`.
3. Devin auto-pick task next dari `docs/v3/workflow/phase_*.md`, eksekusi, commit incremental, buka PR.
4. Anda review + merge PR.
5. Repeat untuk Devin 02, 03, ... (paste prompt yang sama).

## Continuation pattern (handoff antar Devin)

Tidak butuh intervensi user untuk handoff. Devin 02 baca state aktual repo:

```
Devin 01 paste prompt → eksekusi P0-01 → commit incremental → PR → MERGED
                                                                      │
                                                                      ▼
User paste prompt yang sama → Devin 02 auto-detect (P0-01 [done],
                                                    P0-02 dependency [done])
                                              → eksekusi P0-02 → MERGED
                                                                      │
                                                                      ▼
                              ... dan seterusnya sampai Phase 6 selesai.
```

Devin 02 tidak butuh tahu apa yang Devin 01 kerjakan — cukup baca `docs/v3/workflow/phase_*.md` markers + git log + merged PR list.

## Incremental commit policy

Setiap Devin **WAJIB commit + push setiap milestone**, bukan tunggu sampai akhir task. Tujuan: user bisa monitor progress real-time + recovery mudah kalau session crash.

Milestone yang pantas commit:
1. Setelah setup awal (file/folder structure created)
2. Setelah backend/API selesai
3. Setelah frontend/UI selesai
4. Setelah test pass
5. Setelah lint pass
6. Setelah dokumentasi update
7. Final commit (squash-able saat merge)

Format commit message untuk WIP: `wip(P{X}-{nn}): {milestone}`. Format final: `{type}(P{X}-{nn}): {title}` (Conventional Commits).

Push setiap commit ke remote (`git push origin <branch>`). User pantau di:
- `https://github.com/alviarts/VIPOS/commits/devin/{{task-ID}}-{{slug}}` (per branch)
- `https://github.com/alviarts/VIPOS/pulls` (PR aktif)

## Quick start (alternatif — pakai task-specific prompt)

Kalau mau eksekusi task spesifik (bukan auto-pick):

1. Buka `docs/v3/workflow/phase_X_*.md` (lihat `00_OVERVIEW.md` untuk daftar phases).
2. Pilih task yang status `[pending]` dan dependency-nya sudah `[done]`.
3. Copy block "**Devin prompt**" dari task itu (atau pakai template di `templates/devin_task_prompt.md`).
4. Buat session Devin baru di https://app.devin.ai (atau via Devin MCP `create_session`).
5. Paste prompt, kirim. Devin akan kerjakan task end-to-end + buka PR.
6. Review PR, merge.
7. Mark task `[done]` di phase doc (kalau Devin tidak otomatis update).

## Template prompt (untuk task baru)

Copy block ini, ganti placeholder `{{...}}`, paste ke session Devin baru:

````markdown
Lanjutkan development VIPOS di https://github.com/alviarts/VIPOS.

**Task**: {{P3-07: POS Cart UI}}
**Branch baru**: `devin/{{P3-07-pos-cart-ui}}`
**Phase**: {{Phase 3 - Android Kasir MVP}}

**Reference**:
- `docs/v3/workflow/phase_{{3}}_*.md` (cari section "{{P3-07}}")
- `docs/v2/menus/penjualan/pos_kasir.md` (UI/UX blueprint)
- `docs/v2/{{02_DATA_MODELS.md, 09_OFFLINE_AND_SYNC.md}}` (cross-cutting refs)

**Goal**: {{1-line goal copy dari task spec}}

**Acceptance criteria** (dari task spec):
{{Checklist langsung copy dari task spec}}

**Workflow**:
1. Pull latest: `cd /home/ubuntu/repos/VIPOS && git fetch && git checkout main && git pull`
2. Buat branch: `git checkout -b devin/{{P3-07-pos-cart-ui}}`
3. Implement sesuai spec di phase doc + reference v2 docs
4. Test lokal (jalankan instruksi di bagian "Verifikasi" task spec)
5. Commit + push: `git push origin devin/{{P3-07-pos-cart-ui}}`
6. Buat PR ke `main` pakai template `docs/v3/workflow/templates/pr_template.md`
7. Pass CI checks
8. Update `docs/v3/workflow/phase_{{3}}_*.md` → mark task `{{P3-07}}` jadi `[done]`
9. Notify user dengan link PR

**Catatan penting**:
- VIPOS standalone (tidak proxy ke Majoo). Pinjam pola UI/struktur API saja.
- Push pakai proxy bawaan Devin (sudah authenticated) atau direct PAT fallback `https://x-access-token:${GITHUB_PAT}@github.com/alviarts/VIPOS.git`
- Tidak skip CI checks. Tidak push ke `main` langsung.
- Tailwind primary color = teal #04C99E
- Lokasi file: lihat task spec untuk path eksak
````

## Multi-task assignment (kalau Devin multi-task per session)

Kalau mau assign 2-3 tasks sekaligus ke 1 Devin (bisa 1 PR atau multi PR):

```markdown
Lanjutkan development VIPOS di https://github.com/alviarts/VIPOS.

**Tasks** (sequential, dalam 1 session):
1. P1-04: Products Page
2. P1-05: Categories Page
3. P1-06: Customers Page

**Strategi**: 1 PR per task, ATAU 1 PR untuk seluruh batch (kalau saling terkait).
**Reference**: `docs/v3/workflow/phase_1_web_dashboard.md` sections P1-04, P1-05, P1-06.

[lanjutkan dengan workflow standard...]
```

## Dependency check

Sebelum mulai task X, pastikan:
- Semua dependency task sudah `[done]` (lihat field "Dependencies" di task spec)
- Branch `main` sudah ada hasil dari dependency

Kalau dependency belum done, jangan paksakan paralel — atau modifikasi task spec untuk mock data sementara.

## Branch convention

```
devin/P{phase}-{nn}-{slug}
```

| Pola | Contoh |
|---|---|
| Phase task | `devin/P0-01-monorepo-setup` |
| Phase task | `devin/P3-15-promo-discount-ui` |
| Hotfix | `devin/hotfix-{slug}` |
| Bug fix on existing feature | `devin/P3-07-cart-fix-quantity-bug` |

## PR title convention

```
feat(P{phase}-{nn}): {title}    — untuk task fitur baru
fix(P{phase}-{nn}): {title}     — untuk bug fix
docs(P{phase}-{nn}): {title}    — untuk doc update
chore(P{phase}-{nn}): {title}   — untuk infra/setup task
```

Contoh:
- `feat(P3-07): POS Cart UI dengan adaptive layout`
- `fix(P3-07): cart total tidak update saat quantity stepper`

## PR template

Lihat `docs/v3/workflow/templates/pr_template.md`.

## Merge strategy

- **Squash merge** untuk semua PR (default).
- 1 task = 1 commit di `main` setelah squash.
- Branch delete setelah merge.

## CI requirements

Setelah Phase 0 selesai, tiap PR harus pass:

| Check | Phase 0 | Phase 1+ | Phase 3+ |
|---|---|---|---|
| Lint web | — | ✅ | ✅ |
| Lint backend | — | ✅ | ✅ |
| Lint Android (ktlint/detekt) | — | — | ✅ |
| Type check (tsc / kotlinc) | — | ✅ | ✅ |
| Unit test web | — | ✅ | ✅ |
| Unit test backend | — | ✅ | ✅ |
| Unit test Android | — | — | ✅ |
| Build web | — | ✅ | ✅ |
| Build Android debug APK | — | — | ✅ |

## Tracking progress

### Update progress di Phase doc

Setelah task selesai dan PR merged:

```markdown
### P3-07: POS Cart UI  [done]  ← was [pending]

PR: #34 (merged 2026-05-15)
Devin session: https://app.devin.ai/sessions/abc123
```

### Update progress di 00_OVERVIEW.md (per phase)

```markdown
| Phase | Goal | Tasks | Done | Pending | Blocked |
|---|---|---|---|---|---|
| Phase 3 | Android Kasir MVP | 22 | 7 | 14 | 1 |
```

(Auto-grep cara: `grep -c '\[done\]' phase_3_*.md` etc.)

## Konvensi kode (cross-task)

### Web (React)

- Komponen: `PascalCase.jsx` di `frontend/src/components/`
- Halaman: `PascalCasePage.jsx` di `frontend/src/pages/`
- Hooks: `useFooBar.js` di `frontend/src/hooks/`
- API client: `frontend/src/api/{resource}.js`
- State (kalau perlu): React Context atau Zustand (jangan Redux unless ada alasan kuat)
- Styling: Tailwind utility classes; primary color `teal-500` (#04C99E)
- Form: React Hook Form + zod schema (mulai di Phase 0)

### Backend (Express)

- Routes: `backend/src/routes/{resource}.js`
- Models/queries: `backend/src/models/`
- Middleware: `backend/src/middleware/`
- Utils: `backend/src/utils/`
- API contract: derived from `docs/v2/03_API_CONTRACT.md` patterns

### Android (Kotlin + Compose)

- Package: `com.vipos.{module}` (e.g. `com.vipos.pos`, `com.vipos.inventory`)
- Modul Gradle: `:app`, `:core`, `:feature-pos`, `:feature-inventory`, etc (modular setelah Phase 3 stabil)
- UI: Composable di `ui/{feature}/`
- ViewModel: `viewmodel/{feature}/`
- DB: Room di `data/local/`
- Network: Retrofit di `data/remote/`
- DI: Hilt di `di/`

## Konvensi commit message

Conventional commits:
```
feat(P3-07): add cart panel composable
fix(P3-07): cart total updates on stepper change
docs(P0-04): document API contract conventions
chore(P0-01): set up monorepo workspaces
test(P3-07): add cart unit tests
refactor(P3-15): extract DiscountCalculator
```

## Recovery: kalau Devin error mid-task

1. User lihat session Devin via app.devin.ai → review error.
2. Kalau bug di Devin: restart session dengan instruksi tambahan.
3. Kalau bug di task spec: update spec di phase doc, restart session.
4. Kalau dependency miss: cancel task, kerjakan dependency dulu.

## FAQ

**Q: Bisa 2 Devin kerjakan task yang sama?**
A: Tidak. 1 task = 1 branch = 1 Devin. Kalau dua paralel, conflict di branch & PR.

**Q: Bisa 1 Devin handle 5 tasks sekaligus?**
A: Bisa, tapi tidak recommended. Better 1 task per session, biar context fokus & PR clean.

**Q: Task estimasi 5 hari, Devin pasti bisa selesai 5 hari?**
A: Devin hari = ~6-8 jam aktif. Kalau task butuh 5 jam human-equivalent, Devin selesai 1 hari.

**Q: Bagaimana kalau task ternyata lebih kompleks dari estimasi?**
A: Devin akan message user, mungkin minta task dipecah lebih kecil atau scope di-clarify.

**Q: Bagaimana kalau ada bug di task yang sudah done?**
A: Buat task baru (e.g. `devin/P3-07-cart-fix-quantity-bug`) di branch terpisah. Jangan reopen task lama.

**Q: Bisa skip phase?**
A: Tidak, dependency keras antar phase. Tapi dalam phase, banyak task paralel.

**Q: Kalau user butuh fitur urgent yang belum di-spec?**
A: Update phase doc → tambah task baru di posisi yang sesuai → assign ke Devin.

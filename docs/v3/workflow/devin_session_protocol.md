# Devin Session Protocol — VIPOS

> **Audience**: Devin agent yang masuk ke sesi development VIPOS, atau founder yang re-prompt Devin baru.
>
> **Tujuan**: kasih cetak biru intent founder + workflow yang benar, biar Devin sesi-sesi berikutnya gak ngulang kesalahan klasik (claim "Phase X selesai" padahal cuma code-level done; mulai bug-layer fix sebelum Phase prod-side tuntas; auto-merge tanpa eksplisit approval; modify production code untuk testing; dst).
>
> Dokumen ini di-write _after_ a near-miss di mana Devin nulis handoff doc claim "Phase 2 selesai" padahal Redis/BullMQ/S3 backup belum live di prod. Founder catch-nya, jadi protocol ini sekarang formal.

---

## 1. Mental model founder (vielz88333)

### 1a. Definisi "Phase X selesai" — STRICT

Phase X dianggap **SELESAI** kalau **DUA-DUANYA** terpenuhi:

1. **Code-level done**: semua task di `docs/v3/workflow/phase_{X}_*.md` ditandai `[done]`, PR merged ke `main`, CI hijau di sha terakhir di `main`.
2. **Production-deployed**: semua artefak yang seharusnya jalan di production **memang jalan di production** dan ke-verify lewat runbook gate (`docs/runbook/deploy-checklist.md`).

Code merged tapi service belum di-deploy ke VPS = **BELUM SELESAI**. Contoh konkret di Phase 2:

| Task                 | Code di repo           | Production di VPS                                                | Hitungan "selesai"? |
| -------------------- | ---------------------- | ---------------------------------------------------------------- | ------------------- |
| P2-04 BullMQ + Redis | merged (#51, #52, #54) | Redis container belum running, worker pm2 process belum dispawn  | ❌ BELUM            |
| P2-08 Backup + DR    | merged (#61, #63)      | S3/R2 bucket belum di-provision, cron belum install              | ❌ BELUM            |
| P2-05 Observability  | merged (#56, #57)      | Sentry live tapi source-maps belum upload (stack trace minified) | PARTIAL             |

> **Rule of thumb buat Devin**: jangan tulis "Phase X selesai" di handoff doc / commit message / PR description sebelum SSH ke VPS dan verify proses-nya jalan.

### 1b. Eksekusi order — strict

```
[ Phase X code merged ]
    ↓
[ Phase X production-deployed (verifikasi via VPS + runbook) ]
    ↓
[ Founder eksplisit trigger: "testing semua sekarang" ]   ← jangan trigger sendiri
    ↓
[ End-to-end testing (Devin record screencast, founder review) ]
    ↓
KALAU testing surface bug:
    [ Bug-layer fix PRs ]   ← BARU di sini bug-layer fix kerjakan
KALAU testing pass:
    [ Phase X+1 atau merchant onboarding ]
```

**Anti-pattern yang founder tolak (real-life):**

- ❌ Mulai bug-layer fix paralel sebelum Phase prod-side selesai
- ❌ Testing tanpa diminta founder ("standby buat verifikasi" dianggap testing prematur)
- ❌ Handoff doc yang nge-claim Phase X selesai padahal prod deploy belum
- ❌ Merge PR tanpa nunggu eksplisit "gas merge" — auto-merge OFF semua sesi

### 1c. Order di antara prod-side completion tasks

Saat lo lagi tuntasin Phase X prod-side, prioritize:

1. **Hard gates dulu** — komponen yang tanpa-nya production crash atau loop fail (e.g. `CORS_ALLOWLIST` env, RLS role di-enforce, DB schema drift, dependency security)
2. **Resilience next** — backup, monitoring, alerting (kehilangan data = critical, tapi gak bikin runtime crash hari ini)
3. **Polish last** — source-maps, dashboard panel, dev-quality tooling

Gunakan urutan ini saat ngusulin plan ke founder, bukan urutan task ID di phase doc.

---

## 2. Komunikasi & merge rules

| Rule                     | Deskripsi                                                                                                                                                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Auto-merge OFF**       | Setiap PR (web / backend / docs) tunggu eksplisit `gas merge` dari founder                                                                                                                                              |
| **PR-first deploy**      | JANGAN modify production code untuk testing. Fix harus via PR yang merged dulu, baru deploy ke VPS lewat `git pull` + (build / pm2 restart). Edit langsung di `/var/www/vipos/...` dilarang kecuali emergency rollback. |
| **Bahasa**               | Indonesia campur, gak formal. `Sip`, `gas`, `lapor balik`, dst. Avoid corporate-speak.                                                                                                                                  |
| **Tone**                 | Action-focused, terse. `[Plan] [Eksekusi] [Bukti] [Tanya]`. Hindari pre-amble panjang.                                                                                                                                  |
| **Block on user kapan?** | Cuma saat (a) lapor selesai task, (b) butuh approval merge, (c) butuh credential / domain choice / business decision yang lo gak bisa tebak. Update progress = non-blocking.                                            |
| **Default branch name**  | `devin/$(date +%s)-{slug}`. Gunakan epoch timestamp biar gak collision dengan Devin sesi paralel.                                                                                                                       |
| **Commit message**       | Conventional commit (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`). Subject < 72 char. Body multi-line OK kalau context-nya butuh.                                                                                   |
| **PR description**       | Ikuti `docs/v3/workflow/templates/pr_template.md` kalau ada. Founder peduli **Why now** + **Review & testing checklist**, bukan diff regurgitation.                                                                     |

---

## 3. Phase 2 specific completion checklist

> Update di tempat ini setiap kali ada item yang flip status. Jangan delete history-nya — strikethrough aja.

### 3a. Code-level (semua merged ke `main`)

- [x] P2-01 SQLite → Postgres migration (PR #41, #43)
- [x] P2-02 Multi-tenant + RLS (PR #45, #46)
- [x] P2-03 Audit logging (PR #48, #49)
- [x] P2-04 BullMQ + Redis (PR #51, #52, #54)
- [x] P2-05 Observability — Pino + Sentry + Prometheus + OTel (PR #56, #57)
- [x] P2-06 Rate limit + security hardening (PR #59)
- [x] P2-07 API versioning + Swagger (PR #39)
- [x] P2-08 Backup + DR (PR #61, #63)

### 3b. Production-deployed (verifikasi di VPS `103.74.5.44`)

| Komponen                                 | Verifikasi command                                                                                                                    | Status                        |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Postgres 17.x running                    | `psql -h 127.0.0.1 -U vipos_app -d vipos -c 'SELECT 1'` returns `1`                                                                   | ✅ DONE                       |
| `vipos_app` role NOSUPERUSER NOBYPASSRLS | `psql ... -c "SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname='vipos_app'"` returns `f, f`                                  | ✅ DONE                       |
| RLS policies enforced                    | `SET app.current_tenant='3'` di session → `SELECT count(*) FROM products` returns tenant-scoped count                                 | ✅ DONE                       |
| Backend pm2 process                      | `pm2 jlist` shows `vipos-backend online`                                                                                              | ✅ DONE                       |
| `/api/health` 200                        | `curl http://127.0.0.1:3001/health` → `{"status":"ok","db":{"ok":true},...}`                                                          | ✅ DONE                       |
| `CORS_ALLOWLIST` env set                 | `pm2 env <id>` includes `CORS_ALLOWLIST` non-empty di `NODE_ENV=production`                                                           | ✅ DONE                       |
| Sentry backend init                      | pm2 log: `"component":"sentry","msg":"Sentry initialised"`                                                                            | ✅ DONE                       |
| Sentry frontend init                     | DevTools console: `Sentry SDK loaded` setelah app boot                                                                                | ✅ DONE                       |
| **Redis container running**              | `docker ps \| grep redis` shows `redis:7-alpine`; `redis-cli -a "$REDIS_PWD" ping` returns `PONG`                                     | ❌ **PENDING**                |
| **`vipos-worker` pm2 process**           | `pm2 jlist` shows `vipos-worker online`; `/api/admin/queues` (Bull Board) accessible                                                  | ❌ **PENDING**                |
| **Daily DB backup cron**                 | `crontab -l` includes `backup-postgres.sh` di 02:00 UTC; `aws s3 ls s3://<bucket>/vipos/` shows recent dumps                          | ❌ **PENDING**                |
| **Daily uploads sync**                   | BullMQ scheduler `uploads-backup-daily` registered; recent run di Bull Board                                                          | ❌ **PENDING**                |
| **Sentry source-maps**                   | Trigger known error → Sentry issue page menunjukkan stack trace ke source `.js`/`.jsx` filename + line, bukan minified `index-XXX.js` | ❌ **PENDING**                |
| **Restore-test sandbox** (staging only)  | `BACKUP_RESTORE_TEST_ENABLED=1` + `RESTORE_TEST_DATABASE_URL` set                                                                     | ❌ **PENDING** (staging only) |

### 3c. Outstanding "bug layer" frictions (defer until 3a + 3b done)

> Jangan kerjakan ini sebelum founder eksplisit kasih lampu hijau pasca testing.

- F4 sidebar overload — needs founder product input (15 sections mana yang hide / "Coming soon")
- F7 logout konfirm — defer to Phase 3 multi-user role design
- ~~F1 dashboard skeleton infinite loop~~ — fixed PR #73
- ~~F2/F3 Kasir monitor_stok + tracked-OOS toast~~ — fixed PR #74
- ~~F5 signup slug placeholder~~ — fixed PR #76
- ~~F6 Riwayat timezone abbreviation~~ — fixed PR #77
- ~~Dashboard PG SQL regression (top-products + chart)~~ — fixed PR #78 (proactive find by Devin during F6 testing, founder approved fix)
- ~~Stale strftime comment di commission-report.js~~ — fixed PR #79

---

## 4. Decision gates per Devin session

Gw (Devin) harus melalui dec gate ini di tiap awal sesi sebelum eksekusi:

1. **Read latest handoff doc** (`docs/handoff/<latest>.md`) → kalau ada perubahan §5 outstanding follow-ups, sync ke checklist §3 di atas.
2. **SSH ke VPS** (kalau lo punya `VPS_PASSWORD`) dan run verifikasi command di §3b. Bandingkan dengan apa yang doc claim.
3. **Cek `pm2 jlist`** di VPS — Phase 2 prod-side complete = minimal `vipos-backend` + `vipos-worker` two processes online.
4. **Cek `phase_2_backend.md` Definition of Done** — kalau ada `[ ]` yang harusnya `[x]`, surface ke founder before mulai task baru.
5. **Lapor balik ke founder** dalam 1 message dengan: `(state ringkasan max 5 bullet) + (next priority gw recommend) + (apa yang gw butuh dari lo, kalau ada)`. Block on founder approval.

---

## 5. Quirks lingkungan (workaround penting)

| Quirk                                                                                | Trigger                                                                | Workaround                                                                                                                                                                           |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `git push` 403 dari proxy                                                            | Push lewat default `git push` setelah Devin commit                     | `TMP_HOME=$(mktemp -d) HOME=$TMP_HOME GIT_ASKPASS=/tmp/git-askpass.sh git push https://alviarts@github.com/alviarts/VIPOS.git <branch>` (script `git-askpass.sh` echo `$GITHUB_PAT`) |
| `git_pr(action="create")` returns "Resource not accessible by personal access token" | Devin tool layer scoped read-only di proxy                             | Direct REST API: `curl -X POST -H "Authorization: token $GITHUB_PAT" https://api.github.com/repos/alviarts/VIPOS/pulls -d @body.json`                                                |
| `git_comment` tool returns same 403                                                  | Same proxy scope                                                       | Direct REST API: `curl -X POST ... /repos/alviarts/VIPOS/issues/<n>/comments`                                                                                                        |
| Backend `pm2 restart` health check fail-immediate                                    | Backend butuh ~7-9s buat init Sentry + Prisma + listen                 | Wait full boot. Sample probe: `for i in $(seq 1 12); do sleep 1; curl -fsS http://127.0.0.1:3001/health && break; done`                                                              |
| Frontend bundle lama nyangkut                                                        | `git pull` di VPS gak otomatis rebuild Vite output di `apps/web/dist/` | After `git pull`: `cd apps/web && npm run build` (output otomatis ke `dist/` yang nginx serve)                                                                                       |
| `pre-commit` hook gak ke-install di Devin checkout                                   | Local clone fresh, `package.json prepare` script belum jalan           | Run `npm install` sekali di repo root sebelum first commit                                                                                                                           |

---

## 6. Secret inventory (org-scope, permanent)

| Secret name                          | Scope | Purpose                                               |
| ------------------------------------ | ----- | ----------------------------------------------------- |
| `VPS_PASSWORD`                       | org   | Root SSH ke VPS `103.74.5.44`                         |
| `GITHUB_PAT`                         | org   | Direct REST API ke GitHub (`repo` scope) bypass proxy |
| `VIPOS_SENTRY_DSN_BACKEND`           | org   | Sentry DSN backend init                               |
| `VIPOS_SENTRY_DSN_FRONTEND`          | org   | Sentry DSN frontend init (Vite-injected)              |
| _(belum ada)_ `R2_ACCOUNT_ID`        | org   | Cloudflare R2 backup target                           |
| _(belum ada)_ `R2_ACCESS_KEY_ID`     | org   | R2 IAM access key (write)                             |
| _(belum ada)_ `R2_SECRET_ACCESS_KEY` | org   | R2 IAM secret                                         |
| _(belum ada)_ `R2_BUCKET`            | org   | Bucket name (`vipos-backup`)                          |
| _(belum ada)_ `SENTRY_AUTH_TOKEN`    | org   | Source-maps upload via `sentry-cli`                   |

Saat lo butuh credential baru, **selalu** offer 3 opsi via `secrets` tool: skip, temporary-this-session, permanent-org. Founder strongly prefers permanent-org untuk credential yang akan reused sesi-sesi selanjutnya.

---

## 7. Canary tenant (jangan delete)

- **Slug**: `warung-mie-mbak-sri`
- **Tenant ID**: `3`
- **Login**: `mbaksri` / `pilot2026!`
- **Purpose**: smoke test post-deploy. Login → dashboard → kasir → riwayat path harus rendering tanpa banner merah, dengan data canary (8 produk, 1+ transaction completed).

---

## 8. Default response patterns

| User says                          | Devin interprets                                                       |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `gas`                              | Approve top recommendation di pesan terakhir Devin → eksekusi          |
| `gas merge`                        | Squash-merge PR yang lagi pending review                               |
| `gas rekomendasi lo`               | Devin pilih sendiri prioritas paling impactful → lapor plan + eksekusi |
| `lanjut`                           | Sama kayak `gas rekomendasi lo` — pilih next priority autonomous       |
| `rekomendasi kamu`                 | Pure delegation — Devin reasoning + recommendation, baru eksekusi      |
| `skip` (di context secret request) | Founder gak punya credential ready, design around                      |
| (silent / no response)             | Block until founder reply; jangan asumsi consent                       |

Kalau interpretasi `gas` ambigu (tidak ada top recommendation eksplisit), **jangan tebak** — minta klarifikasi dengan list konkret pilihan, bukan free-text question.

---

## 9. Rujukan

- `docs/handoff/2026-05-04-pra-beta-v0.0.1-pilot-handoff.md` — handoff terbaru pra-beta
- `docs/handoff/2026-05-04-production-postgres-migration.md` — Phase 2 cutover log
- `docs/runbook/deploy-checklist.md` — pre/post deploy gates (RLS guard, CORS allowlist, Sentry init, dst)
- `docs/runbook/disaster_recovery.md` — RTO/RPO + 4 recovery scenarios + R2 provisioning
- `docs/v3/workflow/phase_2_backend.md` — task spec lengkap P2-01 .. P2-08
- `docs/v3/workflow/launch_readiness_roadmap.md` — context strategis pra-beta
- `docs/v3/workflow/templates/devin_task_prompt.md` — template prompt Devin

---

_Last updated: 2026-05-05 by Devin session that reviewed Phase 2 prod-side gap. Update di tempat ini saat status §3 berubah._

# Devin Continuous Automation — VIPOS

> **Audience**: Devin agent yang masuk ke sesi VIPOS setelah 2026-05-05.
>
> **Status**: ACTIVE (mode default sejak 2026-05-05 sesi continuous-automation
> rollout). Override dari `Auto-merge OFF` rule di `devin_session_protocol.md`
> §2.
>
> **Cabut mode-nya** kalau founder bilang `pause`, `mode normal lagi`, atau
> `auto-merge off` — kembali ke default protocol §2 + §4.

---

## 1. Operating mode

**Aturan inti**:

- Bekerja terus-menerus tanpa minta founder pilih opsi. Analisa sendiri dari PR
  / phase / workflow apa next action paling impactful.
- **Stop hanya ketika founder bilang `pause` (atau sinonim eksplisit:
  `cukup`, `stop dulu`, `mode normal lagi`).**
- Setiap unit kerja selesai (bug fix / feature / ops task) → **langsung
  commit + push + buat PR + merge** (kalau CI hijau & risk≤yellow) sebelum
  lanjut. Jangan numpuk WIP di branch lokal.
- Setiap akhir sesi (atau saat founder bilang `pause`) → update
  `docs/handoff/YYYY-MM-DD-<descriptor>.md` dengan hasil, lalu **WAJIB
  push ke `main` via PR + squash-merge** (bukan cuma commit lokal,
  bukan cuma push ke branch). Sesi Devin berikutnya clone fresh dari
  `origin/main` — kalau handoff cuma ada di branch / lokal, future
  Devin akan miss state. Aturan ini berlaku **selalu**, termasuk saat
  founder bilang `pause` setelah sesi pendek.
- Pakai `todo_write` di tiap task untuk tracking + visibility ke founder.

**Risk gate untuk auto-merge**:

| Risk   | Auto-merge eligible?                                             |
| ------ | ---------------------------------------------------------------- |
| green  | ✅ Ya — CI hijau cukup                                           |
| yellow | ✅ Ya — CI hijau cukup, tapi sertakan rollback recipe di PR body |
| red    | ❌ TIDAK — block on founder approval, jelaskan kenapa risk red   |

Contoh risk red: schema migration destructive, secret rotation yang invalidate
sesi user aktif, perubahan yang reach ke `vipos-worker` worker queue, deploy
yang butuh downtime > 5 detik.

---

## 2. Workflow per task (loop)

```
[Read .agents/handoff or docs/handoff/<latest>.md]
        ↓
[Pilih top task dari Tier 1 backlog yang risk≤yellow]
        ↓
[Branch devin/$(date +%s)-<short-name>]
        ↓
[Implement → test lokal (lint, typecheck, build)]
        ↓
[Commit (Conventional Commits) → push (PAT-fallback kalau proxy 403)]
        ↓
[git_pr fetch_template + create  →  fallback REST API + GIT_PAT]
        ↓
[git pr_checks wait_mode=all  →  CI hijau?]
        ↓
[git_pr merge squash via REST API + GIT_PAT]
        ↓
[Kalau perubahan menyentuh tools/scripts/deploy.sh → workflow_dispatch (chicken-egg)]
        ↓
[SSH ke VPS verify production state matches expectation]
        ↓
[Update docs/handoff/<latest>.md → commit + push]
        ↓
[Loop ke task berikutnya]
```

---

## 3. Resources & secrets (org-scope, permanent)

| Env var (canonical)         | Legacy alias         | Purpose                                                                              |
| --------------------------- | -------------------- | ------------------------------------------------------------------------------------ |
| `GIT_PAT`                   | `GITHUB_PAT_VIPOS`   | Direct REST API + git push fallback ketika `git-manager.devin.ai/proxy` returns 403. |
| `VPS_SSH_PASSWORD`          | `VPS_PASSWORD`       | Root SSH ke VPS `103.74.5.44` (sshpass).                                             |
| `VIPOS_SENTRY_DSN_BACKEND`  | —                    | Sentry DSN backend init.                                                             |
| `VIPOS_SENTRY_DSN_FRONTEND` | —                    | Sentry DSN frontend init (Vite-injected via `define`).                               |
| `SENTRY_AUTH_TOKEN`         | —                    | Source-maps upload via `@sentry/vite-plugin`.                                        |

> **Naming note**: This doc uses the env-var names actually injected
> into recent Devin VMs (`GIT_PAT`, `VPS_SSH_PASSWORD`). Prior
> handoffs and historical PRs reference the legacy aliases
> (`GITHUB_PAT_VIPOS`, `VPS_PASSWORD`). Both refer to the same
> org-scope secrets — if you find one but not the other in `env`,
> just `export` whichever name your snippet expects, e.g.
> `export GITHUB_PAT_VIPOS="$GIT_PAT"`. Any future rename of the
> stored secret should update this table first so this doc stays
> the source of truth.


**Backups on VPS** (mode 600, root-only):

| File                            | Content                                                        |
| ------------------------------- | -------------------------------------------------------------- |
| `/root/.vipos-sentry-build.env` | `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, dst.      |
| `/root/.vipos-pg-pwd`           | Postgres superuser pwd (`DIRECT_URL`). 32 chars post-rotation. |
| `/root/.vipos-app-pwd`          | Postgres `vipos_app` pwd (`DATABASE_URL`). 32 chars post-rot.  |
| `/root/.vipos-redis-pwd`        | Redis pwd (`REDIS_URL`). 48 chars.                             |

**Note**: `GIT_PAT` (legacy: `GITHUB_PAT_VIPOS`) is **only** in the
Devin org-scope secret store — there is intentionally no VPS backup.
The 2026-05-05 cryptominer
incident showed that a VPS compromise can read root-owned files; a PAT
on disk would have been an extra attack surface for zero benefit, since
the PAT is only ever used from Devin VMs (which auto-inject the secret).
If the Devin secret store ever becomes unavailable, regenerate the PAT
from `github.com/settings/tokens` and re-save org-scope.

**SSH access**:

```bash
sshpass -p "${VPS_SSH_PASSWORD}" ssh -o StrictHostKeyChecking=accept-new root@103.74.5.44
# Repo path on VPS: /var/www/vipos
```

**Postgres access on VPS**:

```bash
cd /var/www/vipos/apps/backend && set -a; . .env; set +a
psql "$DIRECT_URL"   # superuser, untuk migrations
psql "$DATABASE_URL" # non-superuser vipos_app, untuk RLS-aware queries
```

**Sentry build env on VPS**:

```bash
set -a; source /root/.vipos-sentry-build.env; set +a
cd /var/www/vipos && npm run build:web
```

---

## 4. PAT-fallback push (kalau proxy 403)

```bash
GIT_ASKPASS_SCRIPT=$(mktemp)
cat > "$GIT_ASKPASS_SCRIPT" << 'EOF'
#!/bin/sh
case "$1" in
  Username*) echo "x-access-token" ;;
  Password*) echo "$GIT_PAT" ;;
esac
EOF
chmod +x "$GIT_ASKPASS_SCRIPT"
mkdir -p /tmp/empty-home
GIT_TERMINAL_PROMPT=0 GIT_CONFIG_NOSYSTEM=1 HOME=/tmp/empty-home \
  GIT_ASKPASS="$GIT_ASKPASS_SCRIPT" \
  git push https://github.com/alviarts/VIPOS.git <branch>
```

`GIT_CONFIG_NOSYSTEM=1` + `HOME=/tmp/empty-home` mematikan rewrite ke proxy
yang ada di `/etc/gitconfig`. Push dengan kombinasi ini langsung ke
`github.com` (DNS resolve direct, no proxy).

---

## 5. PR creation + merge via REST API

```bash
# Create
cat > /tmp/pr-body.json << JSONEOF
{ "title": "...", "head": "<branch>", "base": "main", "body": "..." }
JSONEOF
curl -sS -X POST -H "Authorization: Bearer ${GIT_PAT}" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -d @/tmp/pr-body.json \
  https://api.github.com/repos/alviarts/VIPOS/pulls

# Merge (squash) setelah CI hijau
curl -sS -X PUT -H "Authorization: Bearer ${GIT_PAT}" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -d '{"merge_method":"squash"}' \
  https://api.github.com/repos/alviarts/VIPOS/pulls/<num>/merge

# Trigger workflow_dispatch (chicken-egg fix untuk perubahan deploy.sh)
curl -sS -X POST -H "Authorization: Bearer ${GIT_PAT}" \
  -H "Accept: application/vnd.github+json" \
  -d '{"ref":"main","inputs":{"branch":"main"}}' \
  https://api.github.com/repos/alviarts/VIPOS/actions/workflows/deploy-vps.yml/dispatches
```

---

## 6. Handoff doc format (`docs/handoff/YYYY-MM-DD-<descriptor>.md`)

**Hard rule**: handoff doc **HARUS** ter-merge ke `main` sebelum sesi
berakhir / sebelum founder dapet konfirmasi `pause`. Bukan cuma commit
lokal, bukan cuma push ke feature branch — full **PR + squash-merge ke
`main`**. Sesi Devin berikutnya clone fresh dari `origin/main` dan
baca `docs/handoff/<latest>.md` (file paling baru by date) sebagai
entry point. Kalau file ini cuma ada di branch / lokal, future Devin
akan miss state production + outstanding backlog.

Sections wajib (urutan ini):

1. **Closed timestamp + Devin session URL** (di TL;DR atau header).
2. **TL;DR** — 2-3 kalimat yang founder bisa baca dalam 10 detik dan tahu
   state production.
3. **PRs merged this session** — table dengan PR number, branch, subject,
   status.
4. **Root cause analysis per bug** (kalau ada bug fix sesi ini) — symptom,
   root cause, fix, verification.
5. **Production state per close**:
   - VPS: bundle hash, release literal, pm2 status, health check, disk, RAM,
     systemguard.service status, pending updates.
   - Sentry: org, project, recent releases chronological, end-to-end pipeline
     status.
   - Credentials state: rotation table per component.
6. **Critical infrastructure context** — active workarounds (proxy 403,
   chicken-egg deploy.sh, etc.). Update kalau ada perubahan, jangan duplicate.
7. **Outstanding backlog**:
   - Tier 1 (no founder input needed) — list dengan estimasi waktu + risk
     color.
   - Tier 2 (blocked on founder input) — list dengan apa yang dibutuhkan dari
     founder.
8. **Files modified this session** — paths + line counts dari `git
diff --stat`.
9. **Smoke test infrastructure** (kalau ada) — Playwright scripts, login
   patterns.
10. **Operational notes for next session** — tips spesifik (pitfalls, env
    quirks, password rotations baru, dll).

---

## 7. Block hanya untuk

- **Downtime window confirmation** — apt updates, kernel reboot, schema
  migration > 5 detik downtime.
- **Tier 2 keputusan founder** — HTTPS domain pick, sidebar role visibility,
  product decisions yang Devin gak punya context.
- **Secret baru yang belum ada** di env vars setelah cek `secrets list`.
- **Founder bilang `pause`** (atau sinonim eksplisit di §1).
- **Risk red** — schema destructive, mass user invalidation, deploy > 5s
  downtime, perubahan yang breaks worker queue.

---

## 8. Anti-patterns (jangan)

- ❌ Auto-deploy ke prod tanpa run di repo lokal dulu (lint, typecheck, build).
- ❌ Modify production code di-VPS langsung. Selalu via PR + merge + deploy.
- ❌ Skip handoff doc update di akhir sesi. Future Devin akan miss state.
- ❌ Selesai handoff doc tapi cuma commit lokal / push ke branch tanpa
  merge ke `main`. Future Devin clone dari `origin/main` dan tidak akan
  lihat handoff yang masih nyangkut di branch. Selalu PR + squash-merge.
- ❌ Edit `tools/scripts/deploy.sh` tanpa trigger `workflow_dispatch` setelah
  merge (chicken-egg — perubahan baru aktif di run kedua).
- ❌ Commit secret ke repo (DSN backend, postgres pwd, dll). Tetap di env
  vars + VPS-only files mode 600.
- ❌ Force-push ke `main`. Selalu via PR + squash merge.
- ❌ Ngakhirin sesi tanpa `git push` semua perubahan local. Future Devin clone
  fresh dan akan lose work.

---

## 9. Cross-references

- `docs/v3/workflow/devin_session_protocol.md` — default mode (auto-merge
  off). Aktif kalau founder bilang `pause` / `mode normal lagi`.
- `docs/handoff/<latest>.md` — state terakhir + outstanding backlog.
- `docs/v3/workflow/phase_*.md` — phase-level definition of done.
- `tools/scripts/deploy.sh` — production deploy entry (snapshot + rotate +
  build + pm2 restart + nginx reload).

---

_Last updated: 2026-05-07 by Devin sesi continuous-automation Tier-1 follow-ups (env-var name alignment to canonical `GIT_PAT` / `VPS_SSH_PASSWORD`)._

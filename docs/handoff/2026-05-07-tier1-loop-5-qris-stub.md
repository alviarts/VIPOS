# 2026-05-07 — Tier-1 continuous-automation loop #5 (QRIS Dynamic stub endpoints)

> **Closed**: 2026-05-07 18:38 UTC.
>
> **Devin session**: <https://app.devin.ai/sessions/e52f931332514c11b0a55ce03629b4f9>

---

## TL;DR

One PR merged this loop:

- **#244 — feat(backend): QRIS Dynamic stub endpoints (mint + status poll + test backdoor)**

Added three `/api/v1/payment/qris/*` endpoints behind an in-memory
stub store so the Android P3-08 slice 5 cashier flow can wire its
`viewModelScope`-bound polling loop end-to-end without waiting for
the real gateway integration to firm up. Production now serves
`POST /api/v1/payment/qris/dynamic`, `GET /api/v1/payment/qris/:ref_id/status`,
and the `NODE_ENV !== 'production'`-gated `_test/mark-paid` backdoor;
all auth-required, all tenant-scoped, all 19 integration cases green.

**Operational note (yellow)**: the GitHub Actions
`deploy-vps.yml` workflow ran on the merge of #244 but the running
`pm2` `vipos-backend` process did NOT pick up the new code — it
booted at 18:24:09 UTC (BEFORE the deploy completed at 18:32:57 UTC)
and was still serving the pre-#244 binary at 18:33 UTC when the
post-deploy smoke test ran. A manual `pm2 restart vipos-backend
--update-env` at 18:35:56 UTC rolled the process forward; the route
has served correctly since. **This is a deploy.sh / GH Actions
restart-step regression that needs follow-up next session** — it
also bit loops #3 and #4 in retrospect (any check that ran at
deploy-completion time would have hit a stale binary). Captured as
a fresh Tier-1 entry in §6 below.

Production is healthy at close: `2209ddf` deployed, backend pm2 online,
db 40ms / redis 4ms, /api/health 200 OK in 92ms.

---

## §1 — PRs merged this session

| #   | Branch                                         | Subject                                                                         | Status |
| --- | ---------------------------------------------- | ------------------------------------------------------------------------------- | ------ |
| 244 | `devin/1778178271-qris-dynamic-stub-endpoints` | feat(backend): QRIS Dynamic stub endpoints (mint + status poll + test backdoor) | merged |

---

## §2 — Root cause analysis

### PR #244 — why an in-memory stub instead of a DB-backed table

The Android P3-08 slice 4 (PR #226) shipped the cashier checkout UI
including a `QrisDynamicInput.refId` field, but the next slice (slice 5)
needs to actually POST to a backend mint endpoint and poll a status
endpoint. The handoff at
`docs/handoff/2026-05-07-p3-08-fourth-slice-checkout-ui.md` flagged
this as the next-up blocker:

> 1. Calls `POST /api/v1/payment/qris/mint` (TBD — backend doesn't
>    exist yet) → seeds `QrisDynamicInput.refId` + status `Awaiting`.
> 2. Polls `GET /api/v1/payment/qris/:ref_id/status` every 3s until
>    status is `Paid` / `Expired` / `Failed`.

The same handoff also noted the spec lives at
`docs/v2/14_PAYMENT_METHODS.md` §6 and that "Devin can implement
against a stub gateway client, real provider key plug-in is a Tier-2
founder decision". §6 specifies the HTTP shape verbatim:

```
POST /api/v1/payment/qris/dynamic
{ "transaction_id": 123, "amount": 71000 }
→ { "qr_code_url": "...", "ref_id": "QR123", "expires_at": "...", "polling_url": "..." }
```

We chose an **in-memory `Map<ref_id, record>`** over a Prisma-managed
`qris_dynamic_invocations` table for three reasons:

1. **Schema is gateway-coupled.** The real gateway (per §6.5–6.7) returns
   provider-specific fields (`mdr_amount`, `settlement_id`, webhook
   payload shape, etc.) that aren't yet decided. Locking a schema
   pre-decision would force a destructive migration once the gateway
   is picked — exactly the risk-red category we want to avoid.
2. **Slice 5 is single-process.** The Android cashier polls every 2-3s
   within a single session; cross-process / cross-restart durability
   is not on the critical path. When the next pm2 restart happens
   the in-flight QR is invalidated, but that's also true of any real
   gateway integration that has a 5-minute TTL.
3. **Stub iso-shape with the future DB-backed implementation.** Every
   record carries `tenant_id` + `created_at` + the same response
   keys the real implementation will emit, so the swap is a pure
   storage-layer refactor — no API surface change.

The route ships a `_resetStoreForTests` side-export (mirrors the
pattern from #242's `generateInvoiceNumber` side-export) so the
integration test resets the module-level Map between `it` blocks.

### Deploy-script regression — pm2 didn't auto-restart on deploy

After the PR #244 squash-merge the GitHub Actions `deploy-vps.yml`
workflow fired on `main`, ran `git pull` (file mtime confirms
2026-05-07 18:32:57 UTC), and was supposed to restart `vipos-backend`
under pm2. It didn't — `pm2 jlist` showed the backend process booted
at 18:24:09 UTC (BEFORE the deploy completed) and the smoke test at
18:33:20 UTC returned `404 Cannot POST /api/v1/payment/qris/dynamic`
even though the route file was on disk and `node -e "require('./src/routes/payment-qris')"`
loaded the module correctly. A manual `pm2 restart vipos-backend
--update-env` at 18:35:56 UTC rolled the process forward, after which
the route returned `401 Token tidak ditemukan` (expected) on
unauthenticated POSTs.

This is operationally identical to "deploy completed but didn't roll
the binary forward" — every PR merge in loops #3 and #4 likely had
the same problem; we just didn't notice because those PRs only
touched dashboard / reports / invoice-number code paths that are
exercised at runtime by existing user traffic, which would have
either (a) hit stale code without anyone noticing, or (b) waited
until the next auto-restart cycle (~10 min based on pm2 log
cadence). Loop #5 surfaced it because the smoke test exercises a
brand-new HTTP path that didn't exist in the pre-deploy binary, so
the failure was loud rather than silent.

**Mitigation candidates** for the next session (entry in §6 Tier-1
backlog):

- Audit `tools/scripts/deploy.sh` for missing/stale `pm2 restart`
  invocation (most likely culprit — could have been mid-rewrite when
  loops #3/#4 landed).
- Audit the GitHub Actions step that calls deploy.sh — could be a
  step-ordering or `if: success()` gate failure.
- Add a post-deploy smoke gate that hits a versioned `/api/v1/version`
  endpoint and fails the action if the bundled commit doesn't match
  the merged HEAD.

---

## §3 — Production state at close

```
$ ssh root@103.74.5.44
$ cd /var/www/vipos && git log --oneline -3
2209ddf feat(backend): QRIS Dynamic stub endpoints (mint + status poll + test backdoor) (#244)
00324c5 docs(handoff): 2026-05-07 loop #4 — invoice-number collision fix (PR #242) (#243)
c323450 fix(backend): harden generateInvoiceNumber() against (tenant_id, invoice_number) collision (#242)

$ pm2 list | grep vipos
│ 4  │ vipos-backend       │ default │ 1.0.0   │ fork  │ <pid>   │ <new>m │ 8756  │ online    │ 0% │ ~100mb │ root │ disabled │
│ 5  │ vipos-worker        │ default │ N/A     │ fork  │ <pid>   │ ~10m   │ 150   │ online    │ 0% │ ~56mb  │ root │ disabled │

$ curl -sS -o /dev/null -w 'HTTP %{http_code} %{time_total}s\n' http://localhost:3001/api/v1/health
HTTP 200 0.092s

$ curl -sS -X POST -o /dev/null -w 'HTTP %{http_code}\n' \
    http://localhost:3001/api/v1/payment/qris/dynamic \
    -H 'Content-Type: application/json' -d '{"amount":71000}'
HTTP 401   # expected — auth-required, no token sent
```

**Health probe summary**: db 40ms, redis 4ms, /api/v1/health 200 in
92ms. SystemGuard service status not re-checked this loop (no recent
indicators of trouble; last loop's snapshot stands).

**Sentry**: org `cognition-ai`, project `vipos-backend`. The 18:34:36
restart emitted a fresh `Sentry initialised` event (visible in pm2
out log); previous loops' release pipeline status stands.

**Credentials state**: unchanged from loop #4. Postgres + Redis pwds
last rotated 2026-05-05; `GIT_PAT` + `VPS_SSH_PASSWORD` still
auto-injected from org store this session (lengths 40 + 6 — same
shape as loop #4).

---

## §4 — Critical infrastructure context

Mostly unchanged from loop #4. New entries:

- **`deploy-vps.yml` doesn't reliably restart pm2** (see §2 RCA).
  Manual `pm2 restart vipos-backend --update-env` is the workaround
  until the deploy script is audited.
- **sshpass install env config**: applied org-side (founder approved
  during loop #4 close). Future sessions will have `sshpass`
  pre-installed; no `apt-get install` required at LANGKAH 0.

Carry-over from loop #4 (still active):

- `GIT_PAT` + `VPS_SSH_PASSWORD` come back populated this session, but
  the org-scope persistence pothole observed across two consecutive
  sessions on 2026-05-07 is not "fixed" — just not currently firing.
  Continue running the `echo "${#GIT_PAT} ${#VPS_SSH_PASSWORD}"`
  check at LANGKAH 0.
- Proxy 403 on git push → PAT-fallback documented in
  `docs/v3/workflow/devin_continuous_automation.md` §4 still works
  byte-for-byte; used for both #244 (feature) and #245 (this handoff
  doc) pushes this session.
- `tools/scripts/deploy.sh` chicken-egg unchanged — only matters for
  edits to deploy.sh itself; #244 didn't touch it.

---

## §5 — Outstanding backlog

### Tier 1 — no founder input needed (risk≤yellow)

| Task                                                                                 | Estimate | Risk   | Notes                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------ | -------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Audit deploy-vps.yml + tools/scripts/deploy.sh for missing pm2 restart**           | 0.5 d    | yellow | NEW THIS LOOP. Per §2 RCA — the running pm2 backend didn't pick up #244's binary until manual restart. Probably a missing `pm2 restart` call after `git pull && npm ci`, or a stale `if: success()` gate in the GH Action. Add a post-deploy version-gate smoke that fails CI if the bundled commit doesn't match merged HEAD. **Touches deploy.sh → chicken-egg applies.** |
| **Wire `CartAwarePaymentMethodCatalog` into `PosModule` via `CartContext` provider** | 0.5 d    | yellow | Carry-over from loop #4. Android-only — needs Hilt graph edit. Currently the catalog is constructed manually in the slice 4 cashier; promoting it into a Hilt module unblocks shared use across slices.                                                                                                                                                                     |
| **P3-08 slice 5 — wire kasir flow + transaction commit + QRIS poll loop**            | 1–2 d    | yellow | **NOW UNBLOCKED** by #244. The Android client can now call `POST /api/v1/payment/qris/dynamic` to seed `QrisDynamicInput.refId` and poll `GET /api/v1/payment/qris/:ref_id/status` every 3s. Stub backdoor `_test/mark-paid` lets the kasir flow be tested end-to-end without a real gateway. **Highest leverage Tier-1 task right now.**                                   |
| **Migrate pre-#236 lowercase `transactions.payment_method` rows to canonical**       | 0.25 d   | yellow | Carry-over from loop #3. Cosmetic — Loop C canonicalises at read time so the only user-visible benefit is cleaner ad-hoc DB inspection. Idempotent UPDATE. Real "rollback" is impossible (lossy) but functionality is preserved either way.                                                                                                                                 |
| **Replace QRIS in-memory stub with `qris_dynamic_invocations` table**                | 0.5 d    | yellow | NEW THIS LOOP. Once the real gateway provider is picked (Tier-2 founder decision below), swap the module-level Map for a Prisma-managed table. The HTTP surface stays byte-identical because the response keys already mirror the future schema. **Pre-req: Tier-2 gateway pick.**                                                                                          |

### Tier 2 — blocked on founder input

| Task                                                             | What's needed from founder                                                                                                                                        |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pick QRIS gateway provider** (Midtrans / Xendit / DOKU / etc.) | Provider choice + API key. Once provided, the in-memory stub gets swapped for a real client; mint/status endpoints become idempotent thin wrappers. **HIGH-LEV.** |
| **Pick HTTPS domain + cert provisioning strategy**               | Domain choice (apex / sub) + DNS access for ACME challenge.                                                                                                       |
| **Sidebar role visibility decisions**                            | Per-role visibility map (which menu items each of the 7 roles sees).                                                                                              |
| **Receipt branding (logo, address, footer text)**                | Asset pack (logo PNG/SVG) + text strings.                                                                                                                         |

---

## §6 — Files modified this session

```
$ git diff --stat 00324c5..2209ddf  (PR #244)
 apps/backend/src/__tests__/payment-qris-stub.test.mjs | 294 ++++++++++++++++++
 apps/backend/src/app.js                               |   7 +
 apps/backend/src/routes/payment-qris.js               | 202 +++++++++++++
 3 files changed, 503 insertions(+)
```

This handoff doc (PR #245 — see §1) adds one more file:

```
 docs/handoff/2026-05-07-tier1-loop-5-qris-stub.md     | <new>
```

---

## §7 — Smoke test infrastructure

Carry-over from loop #4. No new Playwright scripts this loop — the
QRIS stub is exercised exclusively through the supertest integration
suite in `apps/backend/src/__tests__/payment-qris-stub.test.mjs`.

Useful local smoke commands for next session if iterating on QRIS:

```bash
# Mint a stub QR (need an admin JWT first via POST /api/v1/auth/login)
TOKEN=$(curl -sS -X POST http://localhost:3001/api/v1/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"username":"admin","password":"admin123"}' \
    | python3 -c "import sys, json; print(json.load(sys.stdin)['token'])")

REF=$(curl -sS -X POST http://localhost:3001/api/v1/payment/qris/dynamic \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    -d '{"amount":71000}' \
    | python3 -c "import sys, json; print(json.load(sys.stdin)['ref_id'])")

# Poll status (will say AWAITING)
curl -sS http://localhost:3001/api/v1/payment/qris/$REF/status \
    -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

# Flip to PAID via test backdoor (NODE_ENV != production)
curl -sS -X POST http://localhost:3001/api/v1/payment/qris/$REF/_test/mark-paid \
    -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

---

## §8 — Operational notes for next session

1. **Verify deploy actually rolled forward**, not just merged. After a
   PR merge, SSH to the VPS and run `pm2 jlist | python3 -c "..."` to
   compare `pm2_env.pm_uptime` against the merge timestamp. If pm2
   booted _before_ the merge landed, manual `pm2 restart vipos-backend
--update-env` is required. Better: address the underlying
   deploy.sh / GH Action regression (see §5 Tier-1).

2. **In-memory state caveat for QRIS stub**. A pm2 restart wipes every
   `AWAITING` invocation. The Android client should treat `404` from
   `/status` (after a successful mint) as "gateway lost state, regenerate
   QR" rather than as a hard error. The current spec §6.7 treats expiry
   identically (regen QR), so this is consistent — just document it
   when slice 5 lands so QA doesn't flag it.

3. **`_test/mark-paid` backdoor stays available in non-prod**. CI runs
   tests under `NODE_ENV=test` (per `vitest.config.cjs` env), so the
   backdoor returns 200 in CI. Production sets `NODE_ENV=production`
   in `apps/backend/.env`, so the backdoor 403s. **Don't rely on the
   backdoor in the Android stub-mode UI** — if `NODE_ENV` ever flips,
   the UI would silently break. The Android client should mark-paid
   via the real status webhook in production-mode and only call
   `_test/mark-paid` from a dev/staging build flag.

4. **Test side-export pattern is now canonical**. Both
   `routes/transactions.js` (`generateInvoiceNumber`) and
   `routes/payment-qris.js` (`_resetStoreForTests`) now expose
   internals via `module.exports.<helper> = ...` after the default
   `module.exports = router` line. New routes that need test-only
   hooks should follow the same pattern; the comment block above
   each side-export documents the contract being pinned.

5. **Cross-tenant isolation must be tested explicitly**. The QRIS
   suite forges a JWT with `tenant_id=999` to confirm cross-tenant
   `/status` lookups return 404, not 403. Future tenant-scoped routes
   should mirror this — RLS at the DB layer doesn't help when state
   lives in process memory.

6. **CI cadence**: full lint+test+build runs in ~3 minutes on
   `ubuntu-latest`. Loop #5's PR #244 went green at attempt 1.
   `python3 /home/ubuntu/poll_ci.py <sha> 50 20` polled at 20s
   intervals and surfaced `DONE_GREEN` at iteration 10.

7. **VPS sshpass**: now pre-installed via the org-scope env config
   accepted at the close of loop #4. Future sessions can SSH at
   LANGKAH 0 without an `apt-get install` step.

---

_Prepared by Devin sesi continuous-automation 2026-05-07 (loop #5).
Per `docs/v3/workflow/devin_continuous_automation.md` §6, this doc
WILL merge to `main` via PR + squash before session close._

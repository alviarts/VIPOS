# 2026-05-07 — Tier-1 continuous-automation loop #6 (deploy.sh RCA errata)

> **Closed**: 2026-05-07 18:50 UTC.
>
> **Devin session**: <https://app.devin.ai/sessions/e52f931332514c11b0a55ce03629b4f9>
>
> **Supersedes**: `docs/handoff/2026-05-07-tier1-loop-5-qris-stub.md` §2 (RCA),
> §4 (Critical infrastructure context — "deploy-vps.yml doesn't reliably restart
> pm2"), and §5 Tier-1 entry "Audit deploy-vps.yml + tools/scripts/deploy.sh
> for missing pm2 restart".

---

## TL;DR

**No code PRs this loop** — pure documentation correction. The Loop #5
handoff doc (PR #245, sha `0d80947`) recorded a wrong RCA blaming
`tools/scripts/deploy.sh` for not restarting `pm2 vipos-backend` after
deploys. Subsequent verification with the deploy of #245 itself
(workflow run sha `0d809471`, completed 18:44:24 UTC) shows that
deploy.sh **does** restart pm2 correctly — pm2 booted at 18:44:07 UTC
(~17 sec before the GH Actions run reported `success`), and a
`POST /api/v1/payment/qris/dynamic` smoke test against the new route
returned the expected 401 (auth required) immediately afterward
without any manual intervention.

The actual reason loop #5's smoke test returned 404 was a **race
between the smoke test and deploy.sh's pm2-restart step**: I ran the
smoke at 18:33:20 UTC against the OLD process (booted 18:24:09 UTC at
the previous deploy of #243), while deploy.sh was still mid-`npm run
build:web` (which takes ~1.5 min). Deploy.sh's pm2-restart fired at
18:34:36 UTC and the deploy completed `success` at 18:34:54 UTC; my
manual `pm2 restart vipos-backend --update-env` at 18:35:56 UTC was
therefore redundant — pm2 had already picked up the new code a minute
earlier.

This errata is critical because next session's Devin reads
`docs/handoff/<latest>.md` as entry point and would have wasted time
auditing a non-existent deploy.sh regression.

Production state at close is identical to loop #5's snapshot
(`0d80947` deployed, /api/v1 surface healthy, db 40ms / redis 4ms,
no manual intervention currently required).

---

## §1 — PRs merged this session

| #          | Branch                                              | Subject                                                          | Status              |
| ---------- | --------------------------------------------------- | ---------------------------------------------------------------- | ------------------- |
| _this doc_ | `devin/1778179507-handoff-loop-6-deploy-rca-errata` | docs(handoff): correct Loop #5's wrong deploy.sh RCA + close out | merged (pending CI) |

---

## §2 — Corrected root cause analysis

### Loop #5's wrong claim

`docs/handoff/2026-05-07-tier1-loop-5-qris-stub.md` §2 said:

> the GitHub Actions `deploy-vps.yml` workflow ran on the merge of
> #244 but the running pm2 `vipos-backend` process did NOT pick up
> the new code — it booted at 18:24:09 UTC (BEFORE the deploy
> completed at 18:32:57 UTC) and was still serving the pre-#244
> binary at 18:33 UTC when the post-deploy smoke test ran.

The "deploy completed at 18:32:57 UTC" in that paragraph is wrong. I
mis-read **the file mtime of `payment-qris.js` after `git pull` ran
inside deploy.sh** as the deploy completion time. Deploy.sh has six
stages — `git pull` is stage 1/6; the actual deploy completes after
stage 6/6 (nginx reload). Stages 2-3 alone (`npm install` +
`npm run build:web`) take ~1.5 minutes on the VPS, so the file mtime
of 18:32:57 UTC was followed by another ~2 minutes of work before
deploy.sh reached the pm2 restart step at 18:34:36 UTC.

### Actual timeline

```
18:32:41  GH Actions deploy-vps.yml run created (PR #244 merge trigger)
18:32:5?  ssh into VPS, deploy.sh starts; stage 1/6 git pull completes
            → file mtime stamp 18:32:57 UTC for payment-qris.js
18:32:5?  stage 2/6 npm install (~30s)
18:33:20  ← MY SMOKE TEST RAN HERE — too early!
            POST /api/v1/payment/qris/dynamic → 404 from old process
            (booted at 18:24:09 UTC, no /payment/qris route loaded)
18:33:2?  stage 3/6 npm run build:web (~90s)
18:34:36  stage 5/6 pm2 restart vipos-backend --update-env
            → fresh process loads new payment-qris.js + app.js mount
18:34:5?  stage 6/6 nginx reload
18:34:54  GH Actions deploy-vps.yml run reports `success`
18:35:56  ← MY MANUAL `pm2 restart vipos-backend --update-env` HERE
            redundant — pm2 was already on the new code
```

### Verification with PR #245 deploy

The deploy of PR #245 (this errata's predecessor handoff doc) ran
without any manual intervention and behaved correctly:

```
18:42:05  GH Actions deploy-vps.yml run created
18:42:1?  deploy.sh starts (stage 1/6 git pull)
18:44:07  pm2 booted_at_utc (per pm2 jlist on the VPS post-deploy)
18:44:24  GH Actions reports `success`
~18:44:30  POST /api/v1/payment/qris/dynamic → HTTP 401 (correct;
            auth-required, no token sent)
```

The new process picked up the new code and served the new route
correctly immediately after deploy.sh exited — no manual restart
needed.

### Lesson

- **Don't smoke-test during the deploy window**. GH Actions reports
  `success` only AFTER deploy.sh finishes its 6 stages, not when
  `git pull` lands. Future Devins should poll the workflow run via
  REST API until `conclusion=='success'` BEFORE running any smoke
  test.
- **deploy.sh works correctly**. Specifically lines 174-186 in
  `tools/scripts/deploy.sh` do call `pm2 restart "$PM2_NAME"
--update-env` when the cwd matches (and `start_fresh` otherwise).
  No regression there.
- The Loop #5 Tier-1 backlog entry "Audit deploy-vps.yml +
  tools/scripts/deploy.sh for missing pm2 restart" is now CLOSED
  AS NOT-A-BUG — see §4 Tier-1 backlog below for the refreshed list.

---

## §3 — Production state at close

Identical to Loop #5's snapshot, no changes since 18:44:24 UTC:

```
$ ssh root@103.74.5.44
$ cd /var/www/vipos && git log --oneline -1
0d80947 docs(handoff): 2026-05-07 loop #5 — QRIS Dynamic stub endpoints (PR #244) (#245)

$ pm2 jlist 2>/dev/null | python3 -c "
    import sys, json, datetime
    d=[x for x in json.load(sys.stdin) if x['name']=='vipos-backend'][0]
    print('booted_at_utc=', datetime.datetime.utcfromtimestamp(d['pm2_env']['pm_uptime']/1000).isoformat())"
booted_at_utc= 2026-05-07T18:44:07.466000

$ curl -sS -X POST -o /dev/null -w 'POST mint (no auth) → HTTP %{http_code}\n' \
    http://localhost:3001/api/v1/payment/qris/dynamic \
    -H 'Content-Type: application/json' -d '{"amount":71000}'
POST mint (no auth) → HTTP 401   # expected — auth-required
```

This errata's own merge will trigger a fresh deploy + pm2 restart
(stage 5/6), at which point pm2 boot time will tick forward another
~1m. That's expected and correct.

---

## §4 — Refreshed outstanding backlog

### Tier 1 — no founder input needed (risk≤yellow)

| Task                                                                                 | Estimate | Risk   | Notes                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------ | -------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Wire `CartAwarePaymentMethodCatalog` into `PosModule` via `CartContext` provider** | 0.5 d    | yellow | Carry-over from loop #4. Android-only — needs Hilt graph edit. Currently the catalog is constructed manually in the slice 4 cashier; promoting it into a Hilt module unblocks shared use across slices.                                                                                                                                            |
| **P3-08 slice 5 — wire kasir flow + transaction commit + QRIS poll loop**            | 1–2 d    | yellow | UNBLOCKED by #244. The Android client can now call `POST /api/v1/payment/qris/dynamic` to seed `QrisDynamicInput.refId` and poll `GET /api/v1/payment/qris/:ref_id/status` every 3s. Stub backdoor `_test/mark-paid` lets the kasir flow be tested end-to-end without a real gateway. **Highest leverage Tier-1 task.**                            |
| **Migrate pre-#236 lowercase `transactions.payment_method` rows to canonical**       | 0.25 d   | yellow | Carry-over from loop #3. Cosmetic — Loop C canonicalises at read time so the only user-visible benefit is cleaner ad-hoc DB inspection. Idempotent UPDATE. Real "rollback" is impossible (lossy) but functionality is preserved either way.                                                                                                        |
| **Replace QRIS in-memory stub with `qris_dynamic_invocations` table**                | 0.5 d    | yellow | Pre-req: Tier-2 gateway pick (below). Once the real gateway is selected, swap the module-level Map for a Prisma-managed table. The HTTP surface stays byte-identical because the response keys already mirror the future schema.                                                                                                                   |
| **(Optional) Add `/api/v1/version` smoke gate to deploy-vps.yml**                    | 0.25 d   | green  | Defence-in-depth even though deploy.sh works correctly today: emit `process.env.GIT_SHA` (or a baked-in build hash) at app boot, expose at `/api/v1/version`, and have the GH Actions "Smoke check live site" step assert it matches the merged HEAD before reporting `success`. Catches future regressions where deploy.sh silently skips a step. |

**Removed** (was in Loop #5 §5 Tier 1):

- ~~Audit deploy-vps.yml + tools/scripts/deploy.sh for missing pm2 restart~~ — NOT-A-BUG, see §2 above.

### Tier 2 — blocked on founder input

Identical to Loop #5 §5 Tier 2:

- Pick QRIS gateway provider (Midtrans / Xendit / DOKU / etc.) + API key
- HTTPS domain + cert provisioning strategy
- Sidebar role visibility decisions
- Receipt branding (logo, address, footer text)

---

## §5 — Operational notes for next session (delta vs Loop #5)

Most of Loop #5 §8's notes carry over verbatim. Two specific items
need updating:

1. **Don't smoke-test during the deploy window** (NEW — replaces Loop
   #5 §8 item 1). After a PR merge:

   ```bash
   # Wait for deploy-vps.yml workflow to report `success` BEFORE
   # smoke-testing. Do NOT just sleep — poll the run status.
   SHA=$(git rev-parse HEAD)
   while true; do
     STATUS=$(curl -sS -H "Authorization: Bearer ${GIT_PAT}" \
         "https://api.github.com/repos/alviarts/VIPOS/actions/workflows/deploy-vps.yml/runs?head_sha=${SHA}" \
         | python3 -c "import sys, json; r=json.load(sys.stdin)['workflow_runs']; print(r[0]['conclusion'] or r[0]['status']) if r else print('queued')")
     [ "$STATUS" = "success" ] && break
     [ "$STATUS" = "failure" ] && { echo "deploy failed"; exit 1; }
     sleep 10
   done
   # Now safe to ssh + smoke-test against the new code.
   ```

   Rule of thumb: deploy.sh takes ~2-3 minutes from `git pull` to
   `pm2 restart`, dominated by `npm run build:web`. Smoke-testing
   inside that window will hit the OLD process and produce
   misleading 404s.

2. **Loop #5 RCA is wrong** (NEW — supersedes Loop #5 §2). If any
   future Devin reads Loop #5's RCA and starts auditing deploy.sh,
   stop and read this doc instead. Deploy.sh is not the bug —
   smoke-test timing is.

All other items from Loop #5 §8 (in-memory state caveat, test
backdoor gating, side-export pattern, cross-tenant isolation testing,
CI cadence, sshpass install) carry over unchanged.

---

_Prepared by Devin sesi continuous-automation 2026-05-07 (loop #6).
Per `docs/v3/workflow/devin_continuous_automation.md` §6, this doc
WILL merge to `main` via PR + squash before session close. No code
changes — single-file documentation correction._

// VIPOS — deploy provenance probe.
//
// `GET /api/v1/version` returns the git sha and build timestamp baked
// into the running pm2 process. Two consumers:
//
//   1. The `deploy-vps.yml` smoke step (loop #6 follow-up). After
//      `tools/scripts/deploy.sh` completes, CI curls this endpoint and
//      asserts `sha === ${{ github.sha }}` to catch any future
//      regression where pm2 fails to pick up the new code (the
//      symptom that mis-attributed loop #5's 404 to a deploy.sh bug —
//      see `docs/handoff/2026-05-07-tier1-loop-6-deploy-rca-errata.md`).
//
//   2. Humans + monitors that want a cheap "what's deployed?" probe
//      without ssh-ing into the VPS.
//
// State is read from env vars exported by `deploy.sh` immediately
// before pm2 restart:
//   - `VIPOS_GIT_SHA`   = `git rev-parse HEAD`
//   - `VIPOS_BUILT_AT`  = ISO 8601 UTC timestamp at build time
//
// Both default to a sentinel string when unset (local dev where no
// deploy ran). The endpoint is intentionally unauthenticated so the
// smoke step can run without seeding a token; nothing here is
// sensitive (sha is already public via /actions/runs).
//
// Risk: green — no DB, no auth dependency, no I/O.

const express = require('express');

const router = express.Router();

router.get('/', (_req, res) => {
  res.status(200).json({
    sha: process.env.VIPOS_GIT_SHA || 'unknown',
    builtAt: process.env.VIPOS_BUILT_AT || null,
    env: process.env.NODE_ENV || 'development',
  });
});

module.exports = router;

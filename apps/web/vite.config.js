import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';

// Sentry source-map upload is opt-in via env. When SENTRY_AUTH_TOKEN +
// SENTRY_ORG + SENTRY_PROJECT are all set the plugin emits source-maps
// (build.sourcemap='hidden' so the bundle does NOT reference them in
// browser dev-tools), uploads them to Sentry tied to VITE_SENTRY_RELEASE,
// and deletes the local .map files after upload so we don't ship them.
// Local dev / CI without these vars is a pure no-op — vite.config stays
// runnable without any Sentry credentials.
const sentryEnabled =
  Boolean(process.env.SENTRY_AUTH_TOKEN) &&
  Boolean(process.env.SENTRY_ORG) &&
  Boolean(process.env.SENTRY_PROJECT);

// Auto-derive `VITE_SENTRY_RELEASE` from `git rev-parse --short HEAD` when
// the deploy operator forgot to set it. Without this fallback the plugin's
// auto-detect picks the *full* git sha (no `<project>@` prefix), which then
// drifts away from the runtime SDK's release tag (src/lib/sentry.js reads
// `import.meta.env.VITE_SENTRY_RELEASE`) and source-map symbolication
// silently breaks. We mutate `process.env` so both the plugin AND Vite's
// `import.meta.env` exposure read the same value. See devin_session_protocol.md
// §3b for the source-map verification gate this is meant to keep green.
if (sentryEnabled && !process.env.VITE_SENTRY_RELEASE) {
  try {
    const sha = execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    if (sha) {
      process.env.VITE_SENTRY_RELEASE = `${process.env.SENTRY_PROJECT}@${sha}`;
    }
  } catch {
    // Not a git checkout (tarball deploy?) — leave VITE_SENTRY_RELEASE unset.
    // The plugin will fall back to its own detection; release tracking may
    // be partial but the bundle itself is unaffected.
  }
}

// Vite reads `process.env` for `import.meta.env` injection BEFORE this
// module's top-level code runs, so the auto-derive above wouldn't reach the
// runtime SDK without an explicit `define` override. Mirror the env vars we
// actually depend on at runtime so they survive Vite's static replacement
// regardless of when the operator set them. Empty/missing values fall
// through to Vite's default behavior (undefined at runtime).
const sentryDefineEntries = {};
if (process.env.VITE_SENTRY_RELEASE) {
  sentryDefineEntries['import.meta.env.VITE_SENTRY_RELEASE'] = JSON.stringify(
    process.env.VITE_SENTRY_RELEASE
  );
}
if (process.env.VITE_SENTRY_DSN_FRONTEND) {
  sentryDefineEntries['import.meta.env.VITE_SENTRY_DSN_FRONTEND'] = JSON.stringify(
    process.env.VITE_SENTRY_DSN_FRONTEND
  );
}

export default defineConfig(({ mode }) => ({
  // Use /vipos/ in production builds (deployed at http://<host>/vipos/),
  // and / in dev for convenience (localhost:5173).
  base: mode === 'production' ? '/vipos/' : '/',
  build: {
    // 'hidden' = emit .map files but omit the //# sourceMappingURL=
    // comment from the JS bundle. Browsers won't auto-load them; only
    // Sentry (via the upload step) consumes them. Keeps prod debugging
    // at parity with the backend without leaking source to end users.
    sourcemap: sentryEnabled ? 'hidden' : false,
  },
  define: sentryDefineEntries,
  plugins: [
    react(),
    sentryEnabled &&
      sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        release: {
          // Match the convention used by the backend Sentry init
          // (`vipos-backend@<sha>`). VITE_SENTRY_RELEASE is set explicitly
          // by the operator or auto-derived from `git rev-parse --short HEAD`
          // above when running inside a git checkout.
          name: process.env.VITE_SENTRY_RELEASE,
        },
        sourcemaps: {
          // Delete .map files after upload so they don't end up shipped
          // to nginx static under /var/www/vipos/apps/web/dist.
          filesToDeleteAfterUpload: ['./dist/**/*.map'],
        },
        // Don't fail the whole build if Sentry network is flaky — the
        // bundle is still good, only release-tracking metadata is lost.
        errorHandler: (err) => {
          console.warn('[sentry-vite-plugin] upload failed:', err.message);
        },
      }),
  ].filter(Boolean),
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
}));

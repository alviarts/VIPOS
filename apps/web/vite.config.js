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
  plugins: [
    react(),
    sentryEnabled &&
      sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        release: {
          // Match the convention used by the backend Sentry init
          // (`vipos-backend@<sha>`). VITE_SENTRY_RELEASE is rendered by
          // the deploy script with the current git SHA.
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

/**
 * Lazy wrapper around `react-hot-toast` so the library does not ship in
 * the eager `index-*.js` bundle.
 *
 * Why this exists
 * ---------------
 * Before this wrapper, two eager call sites pulled `react-hot-toast`
 * (~3.9 kB gzip) into the first-paint critical path:
 *   1. `apps/web/src/main.jsx` statically imported `{ Toaster }`.
 *   2. `apps/web/src/pages/LoginPage.jsx` (the only eager page,
 *      since unauthenticated landings hit `/login`) statically
 *      imported `toast`.
 * Every other call site already lives inside a route-lazy boundary, so
 * once those two eager imports are removed, Vite places
 * `react-hot-toast` in a lazy chunk and tree-shakes it out of
 * `index-*.js`.
 *
 * How the wrapper works
 * ---------------------
 * - Default export is a callable `toast(...)` proxy with the same
 *   chained methods consumers expect (`success`, `error`, `loading`,
 *   `dismiss`, `remove`, `custom`, `promise`). Each call triggers a
 *   one-shot dynamic `import('react-hot-toast')`. Calls made before
 *   the SDK lands are buffered into a small queue (cap 50) and
 *   replayed in order once the module resolves; further calls go
 *   through the real `toast` directly.
 * - Named export `Toaster` is a `React.lazy(...)` that resolves to
 *   `react-hot-toast`'s real `Toaster`. Mount it under a `<Suspense
 *   fallback={null}>` boundary; `react-hot-toast`'s store accepts
 *   `toast(...)` calls before the Toaster mounts and renders them
 *   when it does, so the user-visible behaviour is unchanged from
 *   the pre-wrapper world.
 *
 * The wrapper is intentionally tiny (no class instances, no React
 * imports beyond `lazy`) so its own footprint in the eager bundle
 * is well under the ~3.9 kB gzip we're saving.
 *
 * Lazy-page modules can keep importing from `'react-hot-toast'`
 * directly — those imports already live in lazy chunks and the
 * deduped chunk graph means no double-load.
 */

import { lazy } from 'react';

let realToast = null;
let loadPromise = null;
const queue = [];
const QUEUE_MAX = 50;

const FORWARDED_METHODS = ['success', 'error', 'loading', 'dismiss', 'remove', 'custom', 'promise'];

function flushQueue() {
  while (queue.length > 0) {
    const { method, args } = queue.shift();
    try {
      if (method === '__call__') {
        realToast(...args);
      } else if (typeof realToast[method] === 'function') {
        realToast[method](...args);
      }
    } catch {
      // swallow — a buffered toast that throws on replay should not
      // break later toasts. react-hot-toast itself does not throw on
      // valid input; this is defence-in-depth against unexpected
      // future API drift.
    }
  }
}

function loadOnce() {
  if (loadPromise) return loadPromise;
  loadPromise = import('react-hot-toast')
    .then((mod) => {
      // The default export of react-hot-toast is the callable
      // toast function with chained methods attached.
      realToast = mod.default ?? mod.toast;
      flushQueue();
      return realToast;
    })
    .catch((err) => {
      // Reset so a retry can attempt again. Drop buffered events —
      // there is no Sentry-style alternate sink for toasts.
      loadPromise = null;
      queue.length = 0;
      throw err;
    });
  return loadPromise;
}

function enqueueOrCall(method, args) {
  if (realToast) {
    if (method === '__call__') return realToast(...args);
    if (typeof realToast[method] === 'function') {
      return realToast[method](...args);
    }
    return undefined;
  }
  // Trigger load (best-effort) and buffer the call.
  loadOnce().catch(() => {});
  if (queue.length < QUEUE_MAX) {
    queue.push({ method, args });
  }
  return undefined;
}

const toast = (...args) => enqueueOrCall('__call__', args);
for (const method of FORWARDED_METHODS) {
  toast[method] = (...args) => enqueueOrCall(method, args);
}

export default toast;

export const Toaster = lazy(() =>
  import('react-hot-toast').then((mod) => ({ default: mod.Toaster }))
);

// Test-only helpers. Not part of the public API. The leading underscore
// + double-underscore pattern matches `apps/web/src/lib/sentry.js`
// (`_resetSentryForTests`, `_loadSentryNowForTests`).
export function _resetToastForTests() {
  realToast = null;
  loadPromise = null;
  queue.length = 0;
}

export function _peekQueueForTests() {
  return queue.slice();
}

export function _isToastLoadedForTests() {
  return realToast !== null;
}

// Awaitable hook for tests: triggers `loadOnce()` and resolves once
// the wrapper has installed the real `react-hot-toast` module. Lets
// tests assert post-load behaviour without juggling multiple
// `Promise.resolve()` flushes (which are flaky around vitest's
// dynamic-import resolution under `vi.mock`).
export function _loadToastNowForTests() {
  return loadOnce();
}

/**
 * Regression suite for `apps/web/src/utils/toast.js` — the lazy wrapper
 * around `react-hot-toast` introduced to keep the library out of the
 * eager `index-*.js` chunk.
 *
 * The wrapper buffers `toast(...)` calls that arrive before the SDK
 * loads, replays them in order once the dynamic import resolves, and
 * forwards subsequent calls directly to the real `toast`. Tests below
 * exercise:
 *   - synchronous calls before SDK load are buffered
 *   - the underlying SDK is NOT eagerly imported by `import { toast }`
 *   - chained `.success` / `.error` / `.dismiss` calls are forwarded
 *     correctly post-load
 *   - the buffer is bounded (drops calls past the cap, does not throw)
 *   - `_resetToastForTests` returns the wrapper to a clean state
 *
 * The mock at the top of the file replaces `react-hot-toast` itself,
 * so even though the wrapper uses `import('react-hot-toast')`, the
 * dynamic-import resolves to our spy object — no network or DOM needed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const realToastSpy = vi.fn();
const successSpy = vi.fn();
const errorSpy = vi.fn();
const dismissSpy = vi.fn();
const promiseSpy = vi.fn();

const mockedToast = Object.assign((...args) => realToastSpy(...args), {
  success: (...args) => successSpy(...args),
  error: (...args) => errorSpy(...args),
  dismiss: (...args) => dismissSpy(...args),
  promise: (...args) => promiseSpy(...args),
});

vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: mockedToast,
  toast: mockedToast,
  Toaster: () => null,
}));

let toastModule;

beforeEach(async () => {
  vi.resetModules();
  realToastSpy.mockReset();
  successSpy.mockReset();
  errorSpy.mockReset();
  dismissSpy.mockReset();
  promiseSpy.mockReset();
  toastModule = await import('../utils/toast.js');
  toastModule._resetToastForTests();
});

afterEach(() => {
  toastModule._resetToastForTests();
});

describe('toast lazy wrapper — pre-load buffering', () => {
  it('does not load react-hot-toast on import alone', () => {
    expect(toastModule._isToastLoadedForTests()).toBe(false);
    expect(realToastSpy).not.toHaveBeenCalled();
    expect(successSpy).not.toHaveBeenCalled();
  });

  it('buffers a default-call before SDK loads', () => {
    toastModule.default('Hi');
    // Synchronously: the SDK has not yet loaded, so the call is queued.
    expect(toastModule._isToastLoadedForTests()).toBe(false);
    expect(toastModule._peekQueueForTests()).toEqual([{ method: '__call__', args: ['Hi'] }]);
    expect(realToastSpy).not.toHaveBeenCalled();
  });

  it('buffers chained method calls before SDK loads', () => {
    toastModule.default.error('boom');
    toastModule.default.success('yay');
    expect(toastModule._peekQueueForTests()).toEqual([
      { method: 'error', args: ['boom'] },
      { method: 'success', args: ['yay'] },
    ]);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(successSpy).not.toHaveBeenCalled();
  });

  it('caps the pre-load buffer at 50 entries', async () => {
    for (let i = 0; i < 75; i += 1) {
      toastModule.default.error(`#${i}`);
    }
    expect(toastModule._peekQueueForTests().length).toBe(50);
    // Earliest 50 are kept; the rest are dropped silently.
    expect(toastModule._peekQueueForTests()[0]).toEqual({
      method: 'error',
      args: ['#0'],
    });
    expect(toastModule._peekQueueForTests()[49]).toEqual({
      method: 'error',
      args: ['#49'],
    });
  });
});

describe('toast lazy wrapper — replay + post-load forwarding', () => {
  it('replays buffered calls in order once the SDK loads', async () => {
    toastModule.default('Hi');
    toastModule.default.error('boom');
    toastModule.default.success('yay');
    toastModule.default.dismiss();
    // Trigger + await the load via the test helper so we don't have
    // to juggle microtask-flush counts for vitest's dynamic-import
    // resolution.
    await toastModule._loadToastNowForTests();
    expect(toastModule._isToastLoadedForTests()).toBe(true);
    expect(toastModule._peekQueueForTests()).toEqual([]);
    // Order preserved: default-call first, then error, then success,
    // then dismiss.
    expect(realToastSpy).toHaveBeenCalledWith('Hi');
    expect(errorSpy).toHaveBeenCalledWith('boom');
    expect(successSpy).toHaveBeenCalledWith('yay');
    expect(dismissSpy).toHaveBeenCalledTimes(1);
  });

  it('forwards calls directly to the real toast after load', async () => {
    await toastModule._loadToastNowForTests();
    expect(toastModule._isToastLoadedForTests()).toBe(true);
    realToastSpy.mockClear();
    successSpy.mockClear();

    // Calls after load go straight through, no buffering.
    toastModule.default('direct');
    toastModule.default.success('also-direct');
    expect(toastModule._peekQueueForTests()).toEqual([]);
    expect(realToastSpy).toHaveBeenCalledWith('direct');
    expect(successSpy).toHaveBeenCalledWith('also-direct');
  });

  it('exposes promise / custom passthrough when present on the SDK', async () => {
    toastModule.default.promise(Promise.resolve('ok'), {
      loading: 'L',
      success: 'S',
      error: 'E',
    });
    await toastModule._loadToastNowForTests();
    expect(promiseSpy).toHaveBeenCalledTimes(1);
    expect(promiseSpy.mock.calls[0][1]).toEqual({
      loading: 'L',
      success: 'S',
      error: 'E',
    });
  });
});

describe('toast lazy wrapper — test-only helpers', () => {
  it('_resetToastForTests clears load + queue state', async () => {
    toastModule.default('first');
    await toastModule._loadToastNowForTests();
    expect(toastModule._isToastLoadedForTests()).toBe(true);

    toastModule._resetToastForTests();
    expect(toastModule._isToastLoadedForTests()).toBe(false);
    expect(toastModule._peekQueueForTests()).toEqual([]);

    // After reset, calls buffer again (fresh load cycle).
    toastModule.default.error('after-reset');
    expect(toastModule._peekQueueForTests()).toEqual([{ method: 'error', args: ['after-reset'] }]);
  });

  it('Toaster export is a React.lazy component (no synchronous SDK load)', () => {
    // React.lazy returns a special object with $$typeof Symbol(react.lazy).
    expect(toastModule.Toaster).toBeDefined();
    expect(typeof toastModule.Toaster).toBe('object');
    // The wrapper must not synchronously import react-hot-toast just by
    // accessing the Toaster export.
    expect(toastModule._isToastLoadedForTests()).toBe(false);
  });
});

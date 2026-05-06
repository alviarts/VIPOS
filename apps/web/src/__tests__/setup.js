import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// jsdom (vitest default `environment: jsdom`) doesn't implement
// `window.matchMedia`. Several deps (react-hot-toast Toaster, Tailwind
// dark-mode helpers, headlessui/etc.) call it at render time and crash
// without a stub. Provide a permissive default that always reports
// "doesn't match" so tests don't accidentally depend on real CSS
// media-query state.
if (typeof window !== 'undefined' && typeof window.matchMedia === 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn((query) => ({
      matches: false,
      media: query,
      onchange: null,
      // Legacy API.
      addListener: vi.fn(),
      removeListener: vi.fn(),
      // Modern API.
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// Same story for `ResizeObserver` and `IntersectionObserver` — recharts,
// react-hot-toast, and other UI libs reach for them at mount time.
if (typeof window !== 'undefined' && typeof window.ResizeObserver === 'undefined') {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (typeof window !== 'undefined' && typeof window.IntersectionObserver === 'undefined') {
  window.IntersectionObserver = class {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
}

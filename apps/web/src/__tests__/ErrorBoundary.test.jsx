// VIPOS — ErrorBoundary unit tests (PR-1, pra-beta v0.0.1).
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '../components/ErrorBoundary';
import { _internal, _resetSentryForTests, isSentryInitialized } from '../lib/sentry';

function Boom({ msg = 'kaboom' }) {
  throw new Error(msg);
}

function NotBoom() {
  return <div>renders fine</div>;
}

describe('ErrorBoundary', () => {
  let errorSpy;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('renders children when no error', () => {
    render(
      <ErrorBoundary scope="app">
        <NotBoom />
      </ErrorBoundary>
    );
    expect(screen.getByText('renders fine')).toBeInTheDocument();
  });

  it('renders the app-scope fallback when a child throws', () => {
    render(
      <ErrorBoundary scope="app">
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Terjadi error')).toBeInTheDocument();
    expect(screen.getByText(/notifikasi otomatis/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /muat ulang halaman/i })).toBeInTheDocument();
  });

  it('renders the route-scope fallback (compact, with Coba lagi button)', () => {
    render(
      <ErrorBoundary scope="route">
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByText('Halaman ini sedang bermasalah')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /coba lagi/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /muat ulang/i })).toBeInTheDocument();
  });

  it('forwards error to the optional onError callback', () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary scope="route" onError={onError}>
        <Boom msg="from-callback" />
      </ErrorBoundary>
    );
    expect(onError).toHaveBeenCalledOnce();
    const [err, info] = onError.mock.calls[0];
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('from-callback');
    expect(info).toBeTruthy();
  });

  it('uses a render-prop fallback when provided', () => {
    render(
      <ErrorBoundary
        scope="route"
        fallback={({ error, reset }) => (
          <button type="button" onClick={reset}>
            custom: {error.message}
          </button>
        )}
      >
        <Boom msg="custom-fallback" />
      </ErrorBoundary>
    );
    expect(screen.getByRole('button', { name: /custom: custom-fallback/ })).toBeInTheDocument();
  });

  it('Coba lagi resets state and re-renders children', () => {
    let shouldThrow = true;
    function Toggleable() {
      if (shouldThrow) throw new Error('flaky');
      return <div>recovered</div>;
    }
    render(
      <ErrorBoundary scope="route">
        <Toggleable />
      </ErrorBoundary>
    );
    expect(screen.getByText('Halaman ini sedang bermasalah')).toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /coba lagi/i }));
    expect(screen.getByText('recovered')).toBeInTheDocument();
  });
});

describe('lib/sentry — PII scrubbing helpers', () => {
  beforeEach(() => {
    _resetSentryForTests();
  });

  it('scrubObject masks every sensitive key, recursively', () => {
    const out = _internal.scrubObject({
      username: 'alice',
      password: 'hunter2',
      access_token: 'ghp_xxx',
      nested: { refresh_token: 'rt_xxx', safe: 'value' },
      arr: [{ token: 't', label: 'ok' }],
    });
    expect(out.password).toBe('[redacted]');
    expect(out.access_token).toBe('[redacted]');
    expect(out.nested.refresh_token).toBe('[redacted]');
    expect(out.nested.safe).toBe('value');
    expect(out.arr[0].token).toBe('[redacted]');
    expect(out.arr[0].label).toBe('ok');
    expect(out.username).toBe('alice');
  });

  it('scrubBreadcrumb redacts Bearer tokens + password=… in messages', () => {
    const out = _internal.scrubBreadcrumb({
      message: 'fetch /api/auth/login Authorization=Bearer abc.def.ghi password=hunter2',
      data: { token: 'abc' },
    });
    expect(out.message).toContain('Bearer [redacted]');
    expect(out.message).toContain('password=[redacted]');
    expect(out.data.token).toBe('[redacted]');
  });

  it('scrubEvent strips user identifiers and request data', () => {
    const out = _internal.scrubEvent({
      user: { username: 'alice', email: 'a@b.com', ip_address: '1.2.3.4' },
      request: {
        cookies: 'session=xyz',
        headers: { Authorization: 'Bearer secret', 'x-request-id': 'r1' },
        data: { password: 'p' },
        query_string: 'token=abc&page=2',
      },
      breadcrumbs: [{ message: 'auth Bearer abc', data: { token: 'leak' } }],
    });
    expect(out.user.username).toBeUndefined();
    expect(out.user.email).toBeUndefined();
    expect(out.user.ip_address).toBeUndefined();
    expect(out.request.cookies).toBe('[redacted]');
    expect(out.request.headers.Authorization).toBe('[redacted]');
    expect(out.request.headers['x-request-id']).toBe('r1');
    expect(out.request.data.password).toBe('[redacted]');
    expect(out.request.query_string).toBe('token=[redacted]&page=2');
    expect(out.breadcrumbs[0].message).toContain('Bearer [redacted]');
    expect(out.breadcrumbs[0].data.token).toBe('[redacted]');
  });

  it('isSentryInitialized stays false when no DSN is configured', () => {
    expect(isSentryInitialized()).toBe(false);
  });
});

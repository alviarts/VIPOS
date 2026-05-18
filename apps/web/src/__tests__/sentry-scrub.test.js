// VIPOS — PII-scrubbing regression for `lib/sentry.js`.
//
// `apps/web/src/lib/sentry.js` ships three pure-helper PII scrubbers
// before Sentry events leave the browser:
//
//   - `scrubObject(value)`: deep-redact properties whose key is in
//     SENSITIVE_KEYS (case-insensitive). Recursive over plain objects
//     and arrays; passthrough for primitives and null.
//   - `scrubBreadcrumb(b)`: scrub `b.data` via scrubObject, plus
//     regex-redact `Bearer <token>` and `password=` / `token=`
//     fragments in `b.message` strings.
//   - `scrubEvent(e)`: applied as Sentry's `beforeSend`. Strips
//     `event.request.cookies`, recursively scrubs headers/data,
//     redacts `token` / `password` / `totp` query-string params,
//     removes user PII (username/email/ip_address), maps
//     `event.breadcrumbs` through scrubBreadcrumb, and scrubs
//     `event.extra` + `event.contexts`.
//
// A regression in any of these is a P0 privacy bug — tokens or
// passwords could end up in Sentry. The helpers are exported via
// `_internal` specifically for unit testing (per the comment in
// sentry.js), so we exercise them directly without firing
// Sentry.init().

import { describe, expect, it } from 'vitest';
import { _internal } from '../lib/sentry';

const { scrubObject, scrubBreadcrumb, scrubEvent, SENSITIVE_KEYS } = _internal;

describe('SENSITIVE_KEYS', () => {
  it('lists the keys we expect to redact (lowercase form)', () => {
    expect(SENSITIVE_KEYS).toEqual([
      'password',
      'access_token',
      'refresh_token',
      'token',
      'login_token',
      'authorization',
      'cookie',
      'set-cookie',
      'totp',
      'totp_code',
    ]);
  });
});

describe('scrubObject', () => {
  it('passes through primitives unchanged', () => {
    expect(scrubObject(null)).toBe(null);
    expect(scrubObject(undefined)).toBe(undefined);
    expect(scrubObject('hello')).toBe('hello');
    expect(scrubObject(42)).toBe(42);
    expect(scrubObject(true)).toBe(true);
    expect(scrubObject(false)).toBe(false);
  });

  it('redacts top-level sensitive keys', () => {
    expect(
      scrubObject({
        username: 'budi',
        password: 's3cret',
        token: 'abc.def.ghi',
        access_token: 'xyz',
      })
    ).toEqual({
      username: 'budi',
      password: '[redacted]',
      token: '[redacted]',
      access_token: '[redacted]',
    });
  });

  it('matches sensitive keys case-insensitively', () => {
    expect(
      scrubObject({
        Password: 's3cret',
        AUTHORIZATION: 'Bearer abc',
        Cookie: 'session=...',
      })
    ).toEqual({
      Password: '[redacted]',
      AUTHORIZATION: '[redacted]',
      Cookie: '[redacted]',
    });
  });

  it('recurses into nested objects', () => {
    expect(
      scrubObject({
        outer: {
          inner: {
            password: 's3cret',
            keep: 'me',
          },
        },
      })
    ).toEqual({
      outer: {
        inner: {
          password: '[redacted]',
          keep: 'me',
        },
      },
    });
  });

  it('recurses into arrays', () => {
    expect(scrubObject([{ password: 'a' }, { password: 'b' }, { keep: 'me' }])).toEqual([
      { password: '[redacted]' },
      { password: '[redacted]' },
      { keep: 'me' },
    ]);
  });

  it('handles deeply mixed object/array structures', () => {
    expect(
      scrubObject({
        items: [
          { name: 'one', token: 'tok1' },
          { name: 'two', meta: { authorization: 'Bearer x' } },
        ],
      })
    ).toEqual({
      items: [
        { name: 'one', token: '[redacted]' },
        { name: 'two', meta: { authorization: '[redacted]' } },
      ],
    });
  });

  it('does not mutate the input object', () => {
    const input = { password: 's3cret', keep: 'me' };
    const copy = { password: 's3cret', keep: 'me' };
    scrubObject(input);
    expect(input).toEqual(copy);
  });

  it('preserves keys not in SENSITIVE_KEYS', () => {
    expect(
      scrubObject({
        username: 'budi',
        email: 'budi@example.com',
        api_key: 'should-not-redact', // not in SENSITIVE_KEYS
      })
    ).toEqual({
      username: 'budi',
      email: 'budi@example.com',
      api_key: 'should-not-redact',
    });
  });
});

describe('scrubBreadcrumb', () => {
  it('passes through null / undefined unchanged', () => {
    expect(scrubBreadcrumb(null)).toBe(null);
    expect(scrubBreadcrumb(undefined)).toBe(undefined);
  });

  it('scrubs breadcrumb.data via scrubObject', () => {
    expect(
      scrubBreadcrumb({
        category: 'fetch',
        message: 'POST /api/login',
        data: { url: '/api/login', password: 's3cret' },
      })
    ).toEqual({
      category: 'fetch',
      message: 'POST /api/login',
      data: { url: '/api/login', password: '[redacted]' },
    });
  });

  it('redacts Bearer tokens in breadcrumb.message', () => {
    expect(
      scrubBreadcrumb({
        message: 'fetch with header Authorization: Bearer abc.def.ghi-_123',
      })
    ).toEqual({
      message: 'fetch with header Authorization: Bearer [redacted]',
    });
  });

  it('redacts inline password / token assignments in breadcrumb.message', () => {
    expect(
      scrubBreadcrumb({
        message: '{"password":"s3cret","keep":"me"}',
      }).message
    ).toContain('"password":"[redacted]"');

    expect(
      scrubBreadcrumb({
        message: 'token=abc123 keep=me',
      }).message
    ).toMatch(/token=\[redacted\]/);
  });

  it('does not crash on non-string message', () => {
    // The regex branch is gated by `typeof message === 'string'`, so a
    // numeric or undefined message should pass through.
    expect(scrubBreadcrumb({ message: 42 })).toEqual({ message: 42 });
    expect(scrubBreadcrumb({ category: 'navigation' })).toEqual({
      category: 'navigation',
    });
  });

  it('does not mutate the input breadcrumb', () => {
    const input = {
      message: 'Bearer abc',
      data: { password: 's3cret' },
    };
    const copyMessage = input.message;
    const copyData = { ...input.data };
    scrubBreadcrumb(input);
    expect(input.message).toBe(copyMessage);
    expect(input.data).toEqual(copyData);
  });
});

describe('scrubEvent', () => {
  it('passes through null / undefined unchanged', () => {
    expect(scrubEvent(null)).toBe(null);
    expect(scrubEvent(undefined)).toBe(undefined);
  });

  it('redacts request.cookies wholesale', () => {
    const out = scrubEvent({
      request: { cookies: 'session=abc; csrf=xyz' },
    });
    expect(out.request.cookies).toBe('[redacted]');
  });

  it('scrubs request.headers via scrubObject', () => {
    const out = scrubEvent({
      request: {
        headers: {
          Authorization: 'Bearer abc',
          'X-Trace-Id': 'keep-me',
          Cookie: 'session=abc',
        },
      },
    });
    expect(out.request.headers.Authorization).toBe('[redacted]');
    expect(out.request.headers.Cookie).toBe('[redacted]');
    expect(out.request.headers['X-Trace-Id']).toBe('keep-me');
  });

  it('scrubs request.data via scrubObject', () => {
    const out = scrubEvent({
      request: {
        data: { username: 'budi', password: 's3cret', token: 'abc' },
      },
    });
    expect(out.request.data).toEqual({
      username: 'budi',
      password: '[redacted]',
      token: '[redacted]',
    });
  });

  it('redacts token / password / totp in request.query_string', () => {
    const out = scrubEvent({
      request: {
        query_string: 'foo=bar&token=abc.def.ghi&password=s3cret&totp=123456&keep=me',
      },
    });
    expect(out.request.query_string).toBe(
      'foo=bar&token=[redacted]&password=[redacted]&totp=[redacted]&keep=me'
    );
  });

  it('matches query_string param keys case-insensitively', () => {
    const out = scrubEvent({
      request: { query_string: 'TOKEN=abc&Password=xyz&Totp=000' },
    });
    expect(out.request.query_string).toBe('TOKEN=[redacted]&Password=[redacted]&Totp=[redacted]');
  });

  it('skips query_string scrubbing when value is not a string', () => {
    const out = scrubEvent({
      request: { query_string: { token: 'abc' } },
    });
    // Non-string is left untouched (the impl only operates on strings).
    expect(out.request.query_string).toEqual({ token: 'abc' });
  });

  it('strips user PII (username, email, ip_address) but keeps user.id', () => {
    const out = scrubEvent({
      user: {
        id: 'user-123',
        username: 'budi',
        email: 'budi@example.com',
        ip_address: '203.0.113.7',
        role: 'cashier',
      },
    });
    expect(out.user).toEqual({ id: 'user-123', role: 'cashier' });
    expect(out.user.username).toBeUndefined();
    expect(out.user.email).toBeUndefined();
    expect(out.user.ip_address).toBeUndefined();
  });

  it('maps event.breadcrumbs through scrubBreadcrumb', () => {
    const out = scrubEvent({
      breadcrumbs: [
        { message: 'Bearer abc', data: { password: 's3cret' } },
        { message: 'normal log', data: { keep: 'me' } },
      ],
    });
    expect(out.breadcrumbs[0].message).toBe('Bearer [redacted]');
    expect(out.breadcrumbs[0].data).toEqual({ password: '[redacted]' });
    expect(out.breadcrumbs[1].message).toBe('normal log');
    expect(out.breadcrumbs[1].data).toEqual({ keep: 'me' });
  });

  it('scrubs event.extra and event.contexts via scrubObject', () => {
    const out = scrubEvent({
      extra: { password: 's3cret', detail: 'keep-me' },
      contexts: {
        runtime: { token: 'abc', name: 'browser' },
      },
    });
    expect(out.extra.password).toBe('[redacted]');
    expect(out.extra.detail).toBe('keep-me');
    expect(out.contexts.runtime.token).toBe('[redacted]');
    expect(out.contexts.runtime.name).toBe('browser');
  });

  it('handles a realistic Sentry event end-to-end', () => {
    const event = {
      message: 'TypeError: foo is not a function',
      request: {
        url: 'https://app.vipos.id/cashier?token=abc&q=hello',
        query_string: 'token=abc&q=hello',
        headers: { Authorization: 'Bearer xyz', 'User-Agent': 'jsdom' },
        cookies: 'session=...',
        data: { password: 's3cret', keep: 'me' },
      },
      user: { id: 'u-1', username: 'budi', email: 'budi@example.com', ip_address: '1.2.3.4' },
      breadcrumbs: [{ message: 'POST /api/login Bearer abc', data: { password: 's3cret' } }],
      extra: { token: 'abc', detail: 'panel-mounted' },
      contexts: { app: { release: 'v1.0.0', authorization: 'Bearer x' } },
    };
    const out = scrubEvent(event);

    // request
    expect(out.request.cookies).toBe('[redacted]');
    expect(out.request.query_string).toBe('token=[redacted]&q=hello');
    expect(out.request.headers.Authorization).toBe('[redacted]');
    expect(out.request.headers['User-Agent']).toBe('jsdom');
    expect(out.request.data.password).toBe('[redacted]');
    expect(out.request.data.keep).toBe('me');

    // user
    expect(out.user).toEqual({ id: 'u-1' });

    // breadcrumbs
    expect(out.breadcrumbs[0].message).toBe('POST /api/login Bearer [redacted]');
    expect(out.breadcrumbs[0].data.password).toBe('[redacted]');

    // extra + contexts
    expect(out.extra.token).toBe('[redacted]');
    expect(out.extra.detail).toBe('panel-mounted');
    expect(out.contexts.app.authorization).toBe('[redacted]');
    expect(out.contexts.app.release).toBe('v1.0.0');
  });
});

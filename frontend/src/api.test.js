import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api, tokenManager } from './api';

const CONNECTION_MESSAGE =
  'Connection error — check your internet connection and try again.';

describe('network failures', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('shows a connection error instead of "Failed to fetch" on login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('Failed to fetch')))
    );

    await expect(api.login('admin@coop.rw', 'pw')).rejects.toThrow(
      CONNECTION_MESSAGE
    );
  });

  it('keeps the session when the token refresh fails on the network', async () => {
    tokenManager.setTokens('access-token', 'refresh-token');
    const unauthorized = { ok: false, status: 401, json: async () => ({}) };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(unauthorized) // original request → 401
        .mockRejectedValueOnce(new TypeError('Failed to fetch')) // refresh → offline
    );

    await expect(api.getCurrentUser()).rejects.toThrow(CONNECTION_MESSAGE);
    // A network outage is not an auth failure — the user must stay signed in.
    expect(tokenManager.isAuthenticated()).toBe(true);
    expect(window.location.pathname).not.toBe('/login');
  });

  it('still signs the user out when the refresh token is genuinely rejected', async () => {
    tokenManager.setTokens('access-token', 'refresh-token');
    const unauthorized = { ok: false, status: 401, json: async () => ({}) };
    const rejected = {
      ok: false,
      status: 401,
      json: async () => ({ detail: 'Invalid refresh token' }),
    };
    // auth/me → 401; refresh → 401 → tokens cleared.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(unauthorized).mockResolvedValueOnce(rejected)
    );

    await expect(api.getCurrentUser()).rejects.toThrow();
    expect(tokenManager.isAuthenticated()).toBe(false);
  });
});

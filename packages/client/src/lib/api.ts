/**
 * API client.
 *
 * One place that knows how to talk to the server, so token handling, error
 * translation, and refresh-on-expiry live in exactly one file.
 *
 * Behaviours worth knowing:
 *   - A 401 triggers ONE refresh attempt, and concurrent 401s share it rather
 *     than each firing their own refresh.
 *   - Failed refreshes clear the session and send the user to sign in, so the
 *     UI never sits in a half-authenticated state.
 *   - Errors come back as `ApiRequestError` with a stable `code` the UI can
 *     branch on, never a raw string.
 */

import type { ApiError, ErrorCode } from '@skillmap/shared';

const BASE_URL = (import.meta.env['VITE_API_URL'] as string | undefined) ?? '/api';

const ACCESS_TOKEN_KEY = 'skillmap.accessToken';
const REFRESH_TOKEN_KEY = 'skillmap.refreshToken';
const USER_KEY = 'skillmap.user';

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'admin';
  createdAt: string;
}

export class ApiRequestError extends Error {
  readonly code: ErrorCode | 'NETWORK_ERROR';
  readonly status: number;
  readonly details: { path: string; message: string }[];

  constructor(
    code: ApiRequestError['code'],
    message: string,
    status: number,
    details: { path: string; message: string }[] = [],
  ) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.status = status;
    this.details = details;
  }

  /** True when the user simply needs to sign in again. */
  get isAuthError(): boolean {
    return this.status === 401;
  }
}

export const tokenStore = {
  get accessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  get refreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  get user(): StoredUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredUser;
    } catch {
      return null;
    }
  },
  save(input: { accessToken: string; refreshToken: string; user?: StoredUser }): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, input.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, input.refreshToken);
    if (input.user) localStorage.setItem(USER_KEY, JSON.stringify(input.user));
  },
  clear(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Skip the Authorization header, for register and login. */
  anonymous?: boolean;
  signal?: AbortSignal;
  /** Internal: prevents an infinite refresh loop. */
  isRetry?: boolean;
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  const refreshToken = tokenStore.refreshToken;
  if (!refreshToken) return false;

  refreshInFlight = (async () => {
    try {
      const response = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        tokenStore.clear();
        return false;
      }

      const data = (await response.json()) as {
        accessToken: string;
        refreshToken: string;
        user?: StoredUser;
      };
      tokenStore.save(data);
      return true;
    } catch {
      tokenStore.clear();
      return false;
    } finally {
      // Cleared on the next tick so simultaneous callers all see the result.
      setTimeout(() => {
        refreshInFlight = null;
      }, 0);
    }
  })();

  return refreshInFlight;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, anonymous = false, signal, isRetry = false } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (!anonymous) {
    const token = tokenStore.accessToken;
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      ...(body !== undefined
        ? { body: body instanceof FormData ? body : JSON.stringify(body) }
        : {}),
      ...(signal ? { signal } : {}),
    });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new ApiRequestError(
      'NETWORK_ERROR',
      'Could not reach the server. Check your connection and try again.',
      0,
    );
  }

  if (response.status === 401 && !anonymous && !isRetry) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return apiRequest<T>(path, { ...options, isRetry: true });
    }
    tokenStore.clear();
    if (!window.location.pathname.startsWith('/login')) {
      window.location.assign('/login');
    }
    throw new ApiRequestError('UNAUTHORIZED', 'Your session has ended. Please sign in again.', 401);
  }

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    if (!response.ok) {
      throw new ApiRequestError(
        'INTERNAL_ERROR',
        'The server returned an unexpected response.',
        response.status,
      );
    }
    return undefined as T;
  }

  const payload = (await response.json()) as T | ApiError;

  if (!response.ok) {
    const apiError = payload as ApiError;
    throw new ApiRequestError(
      apiError.error?.code ?? 'INTERNAL_ERROR',
      apiError.error?.message ?? 'Something went wrong.',
      response.status,
      apiError.error?.details ?? [],
    );
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) =>
    apiRequest<T>(path, { method: 'GET', ...(signal ? { signal } : {}) }),
  post: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
  anonymous: {
    post: <T>(path: string, body?: unknown) =>
      apiRequest<T>(path, { method: 'POST', body, anonymous: true }),
  },
};

/** Turns any thrown value into something safe to show a user. */
export function toUserMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error && error.name === 'AbortError') return '';
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

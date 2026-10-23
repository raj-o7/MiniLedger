import { Platform } from 'react-native';

/**
 * Where the backend lives. Set EXPO_PUBLIC_API_URL in mobile/.env, for example
 * EXPO_PUBLIC_API_URL=http://192.168.1.20:4000 when testing on a real phone.
 * Without it we fall back to the address that reaches your computer from a simulator:
 * Android emulators see your computer as 10.0.2.2, iOS simulators as localhost.
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000');

const REQUEST_TIMEOUT_MS = 15_000;

/** An error we can show to the user, with the backend's error code when there is one. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

/** Called by AuthContext after login/logout so every request carries the token. */
export function setAuthToken(token: string | null): void {
  authToken = token;
}

/** AuthContext registers a function that logs the user out when the token stops working. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

/** Pulls `error.message` / `error.code` out of the backend's error JSON, if present. */
function readErrorBody(data: unknown): { code?: string; message?: string } {
  if (typeof data !== 'object' || data === null || !('error' in data)) {
    return {};
  }
  const error = data.error;
  if (typeof error !== 'object' || error === null) {
    return {};
  }
  return {
    code: 'code' in error && typeof error.code === 'string' ? error.code : undefined,
    message: 'message' in error && typeof error.message === 'string' ? error.message : undefined,
  };
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      `Could not reach the server at ${API_URL}. Check that the backend is running and the address is correct.`,
    );
  } finally {
    clearTimeout(timeout);
  }

  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const { code, message } = readErrorBody(data);
    if (response.status === 401 && authToken && onUnauthorized) {
      onUnauthorized();
    }
    throw new ApiError(
      response.status,
      code ?? 'HTTP_ERROR',
      message ?? `Request failed with status ${response.status}.`,
    );
  }

  // We trust our own backend to send the documented shape for successful responses.
  return data as T;
}

/** Turns any thrown value into a sentence for the UI. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}

import { ApiError, apiRequest, setAuthToken, setUnauthorizedHandler } from '../src/api/client';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('apiRequest', () => {
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch');
    setAuthToken(null);
    setUnauthorizedHandler(null);
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('sends JSON and the auth token, and returns the parsed body', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));
    setAuthToken('abc123');

    const result = await apiRequest<{ ok: boolean }>('/api/loans', { method: 'POST', body: { a: 1 } });

    expect(result).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toMatch(/\/api\/loans$/);
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{"a":1}');
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer abc123',
      'Content-Type': 'application/json',
    });
  });

  it('turns backend errors into ApiError with the server message', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, { error: { code: 'VALIDATION_ERROR', message: 'Amount must be greater than 0' } }),
    );

    await expect(apiRequest('/api/loans')).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'Amount must be greater than 0',
    });
  });

  it('explains network failures in plain language', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    const error = await apiRequest('/api/health').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: 'NETWORK_ERROR',
      message: expect.stringMatching(/Could not reach the server/),
    });
  });

  it('logs the user out when a logged-in request returns 401', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { error: { code: 'UNAUTHORIZED', message: 'Expired' } }));
    const onUnauthorized = jest.fn();
    setUnauthorizedHandler(onUnauthorized);
    setAuthToken('expired-token');

    await expect(apiRequest('/api/loans')).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('does not log out on 401 when there was no token (e.g. a wrong OTP)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { error: { code: 'OTP_INCORRECT', message: 'Wrong' } }));
    const onUnauthorized = jest.fn();
    setUnauthorizedHandler(onUnauthorized);

    await expect(apiRequest('/api/auth/verify-otp')).rejects.toMatchObject({ code: 'OTP_INCORRECT' });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});

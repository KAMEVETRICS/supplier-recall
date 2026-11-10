export class ProviderError extends Error {
  constructor(
    readonly code: string,
    readonly retryAfterSeconds?: number,
    options?: { cause?: unknown },
  ) {
    super(code, options);
  }
}
export async function requestJson(
  url: string,
  init: RequestInit = {},
  timeout = 20000,
  fetcher: typeof fetch = fetch,
): Promise<unknown> {
  try {
    const response = await fetcher(url, {
      ...init,
      signal: AbortSignal.timeout(timeout),
      redirect: 'error',
    });
    if (!response.ok) {
      const retry = Number(response.headers.get('Retry-After'));
      throw new ProviderError(
        response.status === 429
          ? 'rate_limited'
          : response.status === 401 || response.status === 403
            ? 'unauthorized'
            : 'unavailable',
        Number.isFinite(retry) && retry > 0 ? Math.min(retry, 3600) : undefined,
      );
    }
    try {
      return await response.json();
    } catch {
      throw new ProviderError('invalid_response');
    }
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    throw new ProviderError(
      error instanceof Error && /timeout|abort/i.test(error.name) ? 'timeout' : 'unavailable',
    );
  }
}

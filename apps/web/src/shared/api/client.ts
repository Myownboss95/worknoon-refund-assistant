import { ErrorResponseSchema } from '@worknoon/contracts';
import type { z } from 'zod';
import { ApiError, type ClientErrorCode } from './ApiError';

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

export interface ApiClientOptions {
  /** e.g. `/api/laravel/v1` */
  baseUrl: string;
  /** Sent as `X-Admin-Token` when present. */
  adminToken?: string | null;
  fetchImpl?: typeof fetch;
}

export interface ApiClient {
  readonly baseUrl: string;
  get<S extends z.ZodType>(
    path: string,
    query: QueryParams | undefined,
    schema: S,
  ): Promise<z.infer<S>>;
  post<S extends z.ZodType>(path: string, body: unknown, schema: S): Promise<z.infer<S>>;
}

function statusFallbackCode(status: number): ClientErrorCode {
  if (status === 401) return 'ADMIN_UNAUTHORIZED';
  if (status === 404) return 'NOT_FOUND';
  if (status === 422) return 'VALIDATION_FAILED';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 502 || status === 503 || status === 504) return 'NETWORK_ERROR';
  return 'INTERNAL_ERROR';
}

function buildUrl(baseUrl: string, path: string, query?: QueryParams): string {
  const url = `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${url}?${search}` : url;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export function createApiClient({ baseUrl, adminToken, fetchImpl }: ApiClientOptions): ApiClient {
  async function request<S extends z.ZodType>(
    method: 'GET' | 'POST',
    path: string,
    schema: S,
    options: { query?: QueryParams; body?: unknown },
  ): Promise<z.infer<S>> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (adminToken) headers['X-Admin-Token'] = adminToken;

    const doFetch = fetchImpl ?? globalThis.fetch.bind(globalThis);
    let response: Response;
    try {
      response = await doFetch(buildUrl(baseUrl, path, options.query), {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
    } catch {
      throw new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'Network request failed' });
    }

    const payload = await readJson(response);

    if (!response.ok) {
      const parsed = ErrorResponseSchema.safeParse(payload);
      if (parsed.success) {
        const { code, message, details } = parsed.data.error;
        throw new ApiError({ status: response.status, code, message, details });
      }
      throw new ApiError({
        status: response.status,
        code: statusFallbackCode(response.status),
        message: `Request failed with status ${response.status}`,
      });
    }

    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new ApiError({
        status: response.status,
        code: 'INVALID_RESPONSE',
        message: `Response from ${method} ${path} did not match the contract`,
        details: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    return parsed.data;
  }

  return {
    baseUrl,
    get: (path, query, schema) => request('GET', path, schema, { query }),
    post: (path, body, schema) => request('POST', path, schema, { body: body ?? {} }),
  };
}

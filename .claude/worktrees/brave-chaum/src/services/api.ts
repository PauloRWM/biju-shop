/**
 * Cliente base para a API do Biju Shop Connector (plugin WordPress).
 *
 * Endpoint base: VITE_API_URL (ex: https://loja.bijushop.com.br/wp-json/biju/v1)
 */

const BASE_URL = (import.meta.env.VITE_API_URL as string) || '/wp-json/biju/v1';

// Token JWT armazenado em memória (evita XSS via localStorage)
let _token: string | null = null;

export function setAuthToken(token: string | null) {
  _token = token;
  if (token) {
    sessionStorage.setItem('biju_token', token);
  } else {
    sessionStorage.removeItem('biju_token');
  }
}

export function getAuthToken(): string | null {
  return _token ?? sessionStorage.getItem('biju_token');
}

// ---------------------------------------------------------------------------

interface RequestOptions {
  method?: string;
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params } = opts;

  let url = `${BASE_URL}${path}`;
  if (params) {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => [k, String(v)]),
    );
    if (qs.toString()) url += `?${qs}`;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token = getAuthToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let code = 'api_error';
    let message = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      code = err.code ?? code;
      message = err.message ?? message;
    } catch {
      // ignore parse error
    }
    throw new ApiError(res.status, code, message);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Helpers públicos

export const api = {
  get: <T>(path: string, params?: RequestOptions['params']) =>
    request<T>(path, { params }),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body }),

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body }),
};

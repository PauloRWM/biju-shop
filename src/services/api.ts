/**
 * Cliente base para a API do Biju Shop Connector (plugin WordPress).
 *
 * Endpoint base: VITE_API_URL (ex: https://loja.bijushop.com.br/wp-json/biju/v1)
 */

const BASE_URL = (import.meta.env.VITE_API_URL as string) || '/wp-json/biju/v1';

// Token JWT em localStorage para persistir entre sessões/abas. O JWT tem
// expiração no servidor (biju_jwt_expiry, padrão 1h), então o risco de XSS
// roubar o token é limitado pela vida útil dele.
let _token: string | null = null;

export function setAuthToken(token: string | null) {
  _token = token;
  try {
    if (token) {
      localStorage.setItem('biju_token', token);
    } else {
      localStorage.removeItem('biju_token');
    }
    // Migra/limpa o storage antigo se existir
    sessionStorage.removeItem('biju_token');
  } catch {
    // Modo privado pode bloquear storage — tudo bem, o token fica em memória
  }
}

export function getAuthToken(): string | null {
  if (_token) return _token;
  try {
    // Lê primeiro do localStorage (novo). Se vier do sessionStorage antigo,
    // migra para localStorage para não perder no próximo refresh.
    const fromLocal = localStorage.getItem('biju_token');
    if (fromLocal) {
      _token = fromLocal;
      return fromLocal;
    }
    const fromSession = sessionStorage.getItem('biju_token');
    if (fromSession) {
      _token = fromSession;
      localStorage.setItem('biju_token', fromSession);
      sessionStorage.removeItem('biju_token');
      return fromSession;
    }
  } catch {
    // ignore
  }
  return null;
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

  delete: <T>(path: string) =>
    request<T>(path, { method: 'DELETE' }),
};

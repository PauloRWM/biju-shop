import { api, setAuthToken } from './api';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
  created?: boolean; // true se a conta foi criada agora (ex: 1º login Google)
}

export async function login(username: string, password: string): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/auth/login', { username, password });
  setAuthToken(res.token);
  clearAccountCache();
  return res;
}

export async function register(
  name: string,
  email: string,
  password: string,
): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/auth/register', { name, email, password });
  setAuthToken(res.token);
  clearAccountCache();
  return res;
}

export async function forgotPassword(
  email: string,
): Promise<{ success: boolean; message: string }> {
  return api.post<{ success: boolean; message: string }>('/auth/forgot-password', { email });
}

export async function loginWithGoogle(credential: string): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/auth/google', { credential });
  setAuthToken(res.token);
  clearAccountCache();
  return res;
}

export interface GoogleConfig {
  enabled: boolean;
  client_id: string;
}

export async function fetchGoogleConfig(): Promise<GoogleConfig> {
  // Quando o client_id está disponível em build-time (VITE_GOOGLE_CLIENT_ID),
  // usamos direto e NÃO dependemos da resposta de status do backend. Isso garante
  // que o botão de login com Google sempre apareça (ex: no checkout), mesmo que
  // o endpoint /auth/google/config esteja lento, fora do ar ou com enabled=false.
  const envClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim();
  if (envClientId) {
    return { enabled: true, client_id: envClientId };
  }
  // Fallback: config pública do Google (só client_id) — cacheável, sem Authorization.
  return api.getPublic<GoogleConfig>('/auth/google/config');
}

export function logout() {
  setAuthToken(null);
  clearAccountCache();
}

export type AccountData = {
  user: AuthUser;
  billing: Record<string, string>;
  shipping: Record<string, string>;
};

// Dedupe de /account: Header e Checkout pedem a conta quase ao mesmo tempo no
// carregamento. Coalescemos requisições em voo e mantemos um cache curto para
// que essas chamadas compartilhem uma única ida ao servidor.
const ACCOUNT_TTL_MS = 15_000;
let _accountInFlight: Promise<AccountData> | null = null;
let _accountCache: { data: AccountData; at: number } | null = null;

/** Limpa o cache de conta (chamar ao logar/deslogar ou após editar o perfil). */
export function clearAccountCache() {
  _accountInFlight = null;
  _accountCache = null;
}

export async function fetchAccount(opts?: { force?: boolean }): Promise<AccountData> {
  if (!opts?.force) {
    if (_accountCache && Date.now() - _accountCache.at < ACCOUNT_TTL_MS) {
      return _accountCache.data;
    }
    if (_accountInFlight) return _accountInFlight;
  }

  _accountInFlight = api
    .get<AccountData>('/account')
    .then((data) => {
      _accountCache = { data, at: Date.now() };
      return data;
    })
    .finally(() => {
      _accountInFlight = null;
    });

  return _accountInFlight;
}

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
  return res;
}

export async function register(
  name: string,
  email: string,
  password: string,
): Promise<AuthResponse> {
  const res = await api.post<AuthResponse>('/auth/register', { name, email, password });
  setAuthToken(res.token);
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
  return res;
}

export interface GoogleConfig {
  enabled: boolean;
  client_id: string;
}

export async function fetchGoogleConfig(): Promise<GoogleConfig> {
  return api.get<GoogleConfig>('/auth/google/config');
}

export function logout() {
  setAuthToken(null);
}

export async function fetchAccount(): Promise<{ user: AuthUser; billing: Record<string, string>; shipping: Record<string, string> }> {
  return api.get('/account');
}

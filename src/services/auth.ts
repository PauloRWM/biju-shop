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

export function logout() {
  setAuthToken(null);
}

export async function fetchAccount(): Promise<{ user: AuthUser; billing: Record<string, string>; shipping: Record<string, string> }> {
  return api.get('/account');
}

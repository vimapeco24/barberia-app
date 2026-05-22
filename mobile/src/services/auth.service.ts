import api from './api';
import { AuthResponse, LoginDTO, RegisterDTO } from '../types';

export async function loginRequest(data: LoginDTO): Promise<AuthResponse> {
  const response = await api.post<{ success: true; data: AuthResponse }>(
    '/auth/login',
    data
  );
  return response.data.data;
}

export async function registerRequest(data: RegisterDTO): Promise<AuthResponse> {
  const response = await api.post<{ success: true; data: AuthResponse }>(
    '/auth/register',
    data
  );
  return response.data.data;
}

export async function refreshTokenRequest(refreshToken: string): Promise<AuthResponse> {
  const response = await api.post<{ success: true; data: AuthResponse }>(
    '/auth/refresh',
    { refreshToken }
  );
  return response.data.data;
}

export async function logoutRequest(): Promise<void> {
  await api.post('/auth/logout');
}

import { create } from 'zustand';
import { UserProfile } from '../types';
import {
  loginRequest,
  registerRequest,
  logoutRequest,
} from '../services/auth.service';

interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  lockoutUntil: number | null;

  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    name: string,
    phone?: string
  ) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  hydrate: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  lockoutUntil: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null, lockoutUntil: null });
    try {
      const data = await loginRequest({ email, password });
      console.log('[useAuth] Login success:', data.user.email, data.user.role);
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      set({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (err: unknown) {
      console.error('[useAuth] Login error:', err);
      const error = err as { response?: { data?: { error?: { code?: string; message?: string } } } };
      const code = error.response?.data?.error?.code;
      const message = error.response?.data?.error?.message;

      if (code === 'ACCOUNT_LOCKED') {
        // Parse lockout time from message if available
        const minutesMatch = message?.match(/(\d+)/);
        const lockoutMinutes = minutesMatch ? parseInt(minutesMatch[1], 10) : 15;
        const lockoutUntil = Date.now() + lockoutMinutes * 60 * 1000;
        set({
          isLoading: false,
          error: message || 'Cuenta bloqueada temporalmente. Intente nuevamente más tarde.',
          lockoutUntil,
        });
      } else {
        set({
          isLoading: false,
          error: 'Credenciales inválidas. Verifique su email y contraseña.',
          lockoutUntil: null,
        });
      }
    }
  },

  register: async (email: string, password: string, name: string, phone?: string) => {
    set({ isLoading: true, error: null });
    try {
      const data = await registerRequest({ email, password, name, phone });
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      set({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: { code?: string; message?: string; details?: Record<string, string[]> } } } };
      const code = error.response?.data?.error?.code;
      const message = error.response?.data?.error?.message;

      if (code === 'VALIDATION_ERROR') {
        set({
          isLoading: false,
          error: message || 'Los datos ingresados no cumplen los requisitos.',
        });
      } else if (message?.toLowerCase().includes('ya está registrado') || message?.toLowerCase().includes('already')) {
        set({
          isLoading: false,
          error: 'El correo electrónico ya está registrado. ¿Desea iniciar sesión?',
        });
      } else {
        set({
          isLoading: false,
          error: message || 'Error al crear la cuenta. Intente nuevamente.',
        });
      }
    }
  },

  logout: async () => {
    try {
      await logoutRequest();
    } catch {
      // Proceed with local logout even if API call fails
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      error: null,
      lockoutUntil: null,
    });
  },

  clearError: () => set({ error: null }),

  hydrate: () => {
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    const userStr = localStorage.getItem('user');

    if (accessToken && refreshToken && userStr) {
      try {
        const user = JSON.parse(userStr) as UserProfile;
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
        });
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
      }
    }
  },
}));

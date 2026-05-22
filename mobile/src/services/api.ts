import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach access token
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await SecureStore.getItemAsync('accessToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 and auto-refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (originalRequest.url?.includes('/auth/refresh')) {
        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      if (!refreshToken) {
        await SecureStore.deleteItemAsync('accessToken');
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const newAccessToken = data.data.accessToken;
        const newRefreshToken = data.data.refreshToken;

        await SecureStore.setItemAsync('accessToken', newAccessToken);
        if (newRefreshToken) {
          await SecureStore.setItemAsync('refreshToken', newRefreshToken);
        }

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

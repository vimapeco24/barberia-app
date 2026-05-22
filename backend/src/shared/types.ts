/**
 * Tipos e interfaces compartidos del sistema de reservas.
 * Estructura de respuesta JSON consistente según Requisito 8.7.
 */

/** Roles del sistema */
export type Role = 'client' | 'barber' | 'admin';

/** Perfil de usuario autenticado */
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: Role;
  isActive: boolean;
}

/** Respuesta exitosa de la API */
export interface SuccessResponse<T> {
  success: true;
  data: T;
}

/** Respuesta de error de la API */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}

/** Tipo unión para cualquier respuesta de la API */
export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

import { z } from 'zod';

/**
 * Esquemas de validación para el módulo de autenticación.
 * Valida: Requisitos 1.1, 1.6
 */

/**
 * Validación de email según RFC 5322 con máximo 254 caracteres.
 */
export const emailSchema = z
  .string()
  .min(1, 'El correo electrónico es obligatorio')
  .max(254, 'El correo electrónico no puede exceder 254 caracteres')
  .email('El correo electrónico no tiene un formato válido');

/**
 * Validación de contraseña:
 * - Mínimo 8 caracteres
 * - Al menos una letra mayúscula
 * - Al menos una letra minúscula
 * - Al menos un número
 */
export const passwordSchema = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .regex(/[A-Z]/, 'La contraseña debe contener al menos una letra mayúscula')
  .regex(/[a-z]/, 'La contraseña debe contener al menos una letra minúscula')
  .regex(/[0-9]/, 'La contraseña debe contener al menos un número');

/**
 * DTO para registro de clientes.
 * Requisitos: 1.1, 1.6
 */
export const RegisterDTO = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().min(1, 'El nombre es obligatorio').max(100, 'El nombre no puede exceder 100 caracteres'),
  phone: z.string().max(20, 'El teléfono no puede exceder 20 caracteres').optional(),
});

export type RegisterDTO = z.infer<typeof RegisterDTO>;

/**
 * DTO para inicio de sesión.
 * Requisitos: 1.2
 */
export const LoginDTO = z.object({
  email: emailSchema,
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

export type LoginDTO = z.infer<typeof LoginDTO>;

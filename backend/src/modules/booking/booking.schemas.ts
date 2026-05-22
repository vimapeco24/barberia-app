import { z } from 'zod';

/**
 * Esquemas de validación para el módulo de reservas.
 * Valida: Requisitos 3.1, 3.2, 8.5
 */

/**
 * Validación de fecha en formato ISO 8601 (YYYY-MM-DD).
 * Verifica que la fecha sea real (e.g., rechaza 2025-02-30).
 */
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato YYYY-MM-DD')
  .refine((val) => {
    const [year, month, day] = val.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  }, 'La fecha no es válida');

/**
 * Validación de hora en formato 24h (HH:mm).
 */
const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'La hora debe tener formato HH:mm (24 horas)');

/**
 * Validación de UUID.
 */
const uuidSchema = z.string().uuid('El identificador no tiene un formato válido');

/**
 * DTO para creación de turnos.
 * Requisitos: 3.1
 */
export const CreateBookingDTO = z.object({
  barberId: uuidSchema,
  date: dateSchema,
  startTime: timeSchema,
  serviceType: z.string().min(1, 'El tipo de servicio es obligatorio').max(50, 'El tipo de servicio no puede exceder 50 caracteres'),
});

export type CreateBookingDTO = z.infer<typeof CreateBookingDTO>;

/**
 * Parámetros para consulta de disponibilidad.
 * Requisitos: 3.2
 */
export const AvailabilityParamsDTO = z.object({
  barberId: uuidSchema,
});

export type AvailabilityParamsDTO = z.infer<typeof AvailabilityParamsDTO>;

/**
 * Query params para consulta de disponibilidad.
 */
export const AvailabilityQueryDTO = z.object({
  date: dateSchema,
});

export type AvailabilityQueryDTO = z.infer<typeof AvailabilityQueryDTO>;

/**
 * Parámetros para cancelación de turno.
 * Requisitos: 4.1
 */
export const BookingIdParamDTO = z.object({
  id: uuidSchema,
});

export type BookingIdParamDTO = z.infer<typeof BookingIdParamDTO>;

import { pool } from '../../config/database';
import { AppError } from '../../shared/errors';
import {
  BOOKING_DURATION_MINUTES,
  MAX_ACTIVE_BOOKINGS,
  MAX_BOOKING_DAYS_AHEAD,
  MIN_BOOKING_DAYS_AHEAD,
  MIN_CANCELLATION_HOURS,
} from '../../shared/constants';
import { bookingRepository, BookingRow, BookingWithBarberRow } from './booking.repository';
import { barberRepository } from './barber.repository';
import { CreateBookingDTO } from './booking.schemas';

/**
 * Días de la semana mapeados a claves del working_hours JSONB.
 */
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/**
 * Convierte un string HH:mm a minutos desde medianoche.
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Verifica si dos rangos de tiempo se solapan.
 * Rango A: [startA, startA + durationA)
 * Rango B: [startB, startB + durationB)
 */
function timesOverlap(
  startA: string,
  durationA: number,
  startB: string,
  durationB: number
): boolean {
  const aStart = timeToMinutes(startA);
  const aEnd = aStart + durationA;
  const bStart = timeToMinutes(startB);
  const bEnd = bStart + durationB;
  return aStart < bEnd && bStart < aEnd;
}

export const bookingService = {
  /**
   * Crea un nuevo turno con todas las validaciones de negocio.
   * Usa una transacción con SELECT FOR UPDATE para prevenir condiciones de carrera.
   * Requisitos: 3.1, 3.3, 3.4, 3.5
   */
  async createBooking(dto: CreateBookingDTO, clientId: string): Promise<BookingRow> {
    const { barberId, date, startTime, serviceType } = dto;

    // 1. Validar que la fecha esté entre MIN_BOOKING_DAYS_AHEAD y MAX_BOOKING_DAYS_AHEAD días a futuro
    this.validateBookingDate(date);

    // 2. Validar que el horario esté dentro del horario laboral del barbero
    await this.validateWorkingHours(barberId, date, startTime);

    // 3. Verificar que el cliente no exceda MAX_ACTIVE_BOOKINGS turnos activos
    const activeCount = await bookingRepository.countActiveByClient(clientId);
    if (activeCount >= MAX_ACTIVE_BOOKINGS) {
      throw new AppError('MAX_BOOKINGS_REACHED');
    }

    // 4. Verificar no solapamiento con turnos del cliente en la misma fecha/hora
    await this.validateClientOverlap(clientId, date, startTime);

    // 5. Usar transacción con SELECT FOR UPDATE para verificar solapamiento del barbero
    //    y crear el turno de forma atómica (previene condiciones de carrera)
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // SELECT FOR UPDATE bloquea las filas del barbero en esa fecha para evitar inserciones concurrentes
      const barberBookings = await client.query<BookingRow>(
        `SELECT id, start_time, duration_minutes FROM bookings
         WHERE barber_id = $1 AND booking_date = $2 AND status = 'confirmed'
         FOR UPDATE`,
        [barberId, date]
      );

      // Verificar solapamiento con turnos existentes del barbero
      for (const existing of barberBookings.rows) {
        if (timesOverlap(startTime, BOOKING_DURATION_MINUTES, existing.start_time, existing.duration_minutes)) {
          await client.query('ROLLBACK');
          throw new AppError('SLOT_UNAVAILABLE');
        }
      }

      // Insertar el nuevo turno dentro de la transacción
      const result = await client.query<BookingRow>(
        `INSERT INTO bookings (client_id, barber_id, booking_date, start_time, duration_minutes, service_type)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, client_id, barber_id, booking_date, start_time, duration_minutes, service_type, status, created_at, cancelled_at`,
        [clientId, barberId, date, startTime, BOOKING_DURATION_MINUTES, serviceType]
      );

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error: unknown) {
      // Rollback si no se hizo ya (AppError ya hace rollback antes de throw)
      if (!(error instanceof AppError)) {
        await client.query('ROLLBACK');
      }
      // Capturar violación de constraint único como fallback adicional
      if (this.isUniqueViolation(error)) {
        throw new AppError('SLOT_UNAVAILABLE');
      }
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Valida que la fecha de reserva esté dentro del rango permitido (1-30 días a futuro).
   */
  validateBookingDate(date: string): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const bookingDate = new Date(date + 'T00:00:00');

    const diffMs = bookingDate.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < MIN_BOOKING_DAYS_AHEAD || diffDays > MAX_BOOKING_DAYS_AHEAD) {
      throw new AppError(
        'VALIDATION_ERROR',
        `La fecha debe estar entre ${MIN_BOOKING_DAYS_AHEAD} y ${MAX_BOOKING_DAYS_AHEAD} días a futuro`
      );
    }
  },

  /**
   * Valida que el horario esté dentro del horario laboral del barbero para el día de la semana.
   */
  async validateWorkingHours(barberId: string, date: string, startTime: string): Promise<void> {
    const workingHours = await barberRepository.getWorkingHours(barberId);
    if (!workingHours) {
      throw new AppError('VALIDATION_ERROR', 'Barbero no encontrado');
    }

    const bookingDate = new Date(date + 'T00:00:00');
    const dayOfWeek = bookingDate.getDay();
    const dayKey = DAY_KEYS[dayOfWeek];

    const daySchedule = workingHours[dayKey];
    if (!daySchedule) {
      throw new AppError('SLOT_UNAVAILABLE', 'El barbero no trabaja en el día seleccionado');
    }

    const slotStart = timeToMinutes(startTime);
    const slotEnd = slotStart + BOOKING_DURATION_MINUTES;
    const workStart = timeToMinutes(daySchedule.start);
    const workEnd = timeToMinutes(daySchedule.end);

    if (slotStart < workStart || slotEnd > workEnd) {
      throw new AppError(
        'SLOT_UNAVAILABLE',
        'El horario seleccionado está fuera del horario laboral del barbero'
      );
    }
  },

  /**
   * Verifica que el cliente no tenga un turno que se solape en la misma fecha/hora.
   */
  async validateClientOverlap(clientId: string, date: string, startTime: string): Promise<void> {
    const clientBookings = await pool.query<BookingRow>(
      `SELECT start_time, duration_minutes FROM bookings
       WHERE client_id = $1 AND booking_date = $2 AND status = 'confirmed'`,
      [clientId, date]
    );

    for (const existing of clientBookings.rows) {
      if (timesOverlap(startTime, BOOKING_DURATION_MINUTES, existing.start_time, existing.duration_minutes)) {
        throw new AppError('CLIENT_OVERLAP');
      }
    }
  },

  /**
   * Verifica si un error de PostgreSQL es una violación de constraint único.
   */
  isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === '23505'
    );
  },

  /**
   * Cancela un turno existente con todas las validaciones de negocio.
   * Requisitos: 4.1, 4.3, 4.4, 4.5, 4.6
   *
   * Validaciones:
   * - El turno debe existir y pertenecer al cliente solicitante (BOOKING_NOT_FOUND)
   * - El turno no debe estar ya cancelado (BOOKING_ALREADY_CANCELLED)
   * - El turno no debe estar ya completado (BOOKING_ALREADY_COMPLETED)
   * - Deben faltar al menos MIN_CANCELLATION_HOURS horas para la hora programada (CANCELLATION_TOO_LATE)
   */
  async cancelBooking(bookingId: string, clientId: string): Promise<BookingRow> {
    // 1. Buscar el turno por ID
    const booking = await bookingRepository.findById(bookingId);

    // 2. Verificar que el turno existe y pertenece al cliente solicitante
    if (!booking || booking.client_id !== clientId) {
      throw new AppError('BOOKING_NOT_FOUND');
    }

    // 3. Verificar que el turno no esté ya cancelado
    if (booking.status === 'cancelled') {
      throw new AppError('BOOKING_ALREADY_CANCELLED');
    }

    // 4. Verificar que el turno no esté ya completado
    if (booking.status === 'completed') {
      throw new AppError('BOOKING_ALREADY_COMPLETED');
    }

    // 5. Verificar que faltan al menos MIN_CANCELLATION_HOURS horas para la hora programada
    const now = new Date();
    const bookingDate = booking.booking_date instanceof Date
      ? booking.booking_date
      : new Date(booking.booking_date);
    const bookingDateStr = bookingDate.toISOString().split('T')[0];
    const bookingDateTime = new Date(`${bookingDateStr}T${booking.start_time}`);

    const diffMs = bookingDateTime.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < MIN_CANCELLATION_HOURS) {
      throw new AppError('CANCELLATION_TOO_LATE');
    }

    // 6. Cambiar estado a 'cancelled' y registrar timestamp de cancelación
    const updatedBooking = await bookingRepository.updateStatus(bookingId, 'cancelled');
    if (!updatedBooking) {
      throw new AppError('BOOKING_NOT_FOUND');
    }

    return updatedBooking;
  },

  /**
   * Retorna los turnos del cliente autenticado con información del barbero.
   * Requisitos: 3.1
   */
  async getClientBookings(clientId: string): Promise<BookingWithBarberRow[]> {
    return bookingRepository.findByClientWithBarberInfo(clientId);
  },
};

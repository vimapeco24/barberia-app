import { BookingRow } from '../booking/booking.repository';

/**
 * Configuración de reintentos para notificaciones.
 * Máximo 3 intentos con intervalo de 2 segundos entre cada uno.
 * Requisitos: 4.2, 7.4 (sincronización cross-platform con reintentos)
 */
const RETRY_CONFIG = {
  maxAttempts: 3,
  intervalMs: 2000,
} as const;

/**
 * Tipo de notificación soportado.
 */
export type NotificationType = 'booking_confirmation' | 'booking_cancellation';

/**
 * Entrada en la cola de notificaciones.
 */
export interface NotificationQueueEntry {
  id: string;
  type: NotificationType;
  booking: BookingRow;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt: Date | null;
  status: 'pending' | 'sent' | 'failed';
  createdAt: Date;
}

/**
 * Resultado del envío de una notificación.
 */
export interface NotificationResult {
  success: boolean;
  attempts: number;
  error?: string;
}

/**
 * Función de delay utilizada entre reintentos.
 * Exportada para permitir inyección en tests.
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Servicio de notificaciones.
 * Implementa envío de confirmaciones y cancelaciones con cola de reintentos.
 *
 * Actualmente funciona como stub/placeholder que registra notificaciones en log.
 * La integración con un proveedor real de email/SMS se realizará en una fase posterior.
 *
 * Requisitos: 4.2
 */
export const notificationService = {
  /**
   * Cola interna de notificaciones (en memoria para el stub).
   * En producción se reemplazaría por una cola persistente (Redis, RabbitMQ, etc.)
   */
  _queue: [] as NotificationQueueEntry[],

  /**
   * Envía una notificación de confirmación de turno al cliente.
   * Integra con cola de reintentos (máximo 3 intentos, intervalo 2 segundos).
   *
   * Requisitos: 4.2
   */
  async notifyBookingConfirmation(booking: BookingRow): Promise<NotificationResult> {
    return this._sendWithRetry('booking_confirmation', booking);
  },

  /**
   * Envía una notificación de cancelación de turno al cliente.
   * Integra con cola de reintentos (máximo 3 intentos, intervalo 2 segundos).
   *
   * Requisitos: 4.2
   */
  async notifyBookingCancellation(booking: BookingRow): Promise<NotificationResult> {
    return this._sendWithRetry('booking_cancellation', booking);
  },

  /**
   * Lógica interna de envío con reintentos.
   * Intenta enviar la notificación hasta RETRY_CONFIG.maxAttempts veces,
   * esperando RETRY_CONFIG.intervalMs entre cada intento.
   */
  async _sendWithRetry(
    type: NotificationType,
    booking: BookingRow
  ): Promise<NotificationResult> {
    const entry: NotificationQueueEntry = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type,
      booking,
      attempts: 0,
      maxAttempts: RETRY_CONFIG.maxAttempts,
      lastAttemptAt: null,
      status: 'pending',
      createdAt: new Date(),
    };

    this._queue.push(entry);

    for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
      entry.attempts = attempt;
      entry.lastAttemptAt = new Date();

      try {
        await this._deliver(type, booking);
        entry.status = 'sent';
        return { success: true, attempts: attempt };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (attempt < RETRY_CONFIG.maxAttempts) {
          console.warn(
            `[NotificationService] Attempt ${attempt}/${RETRY_CONFIG.maxAttempts} failed for ${type} (booking: ${booking.id}): ${errorMessage}. Retrying in ${RETRY_CONFIG.intervalMs}ms...`
          );
          await delay(RETRY_CONFIG.intervalMs);
        } else {
          console.error(
            `[NotificationService] All ${RETRY_CONFIG.maxAttempts} attempts failed for ${type} (booking: ${booking.id}): ${errorMessage}`
          );
          entry.status = 'failed';
          return { success: false, attempts: attempt, error: errorMessage };
        }
      }
    }

    // This should never be reached, but TypeScript needs it
    entry.status = 'failed';
    return { success: false, attempts: RETRY_CONFIG.maxAttempts, error: 'Max attempts reached' };
  },

  /**
   * Método de entrega real de la notificación.
   * Actualmente es un stub que registra en consola.
   * En producción se reemplazaría por integración con email/SMS provider.
   *
   * @throws Error si la entrega falla (para activar reintentos)
   */
  async _deliver(type: NotificationType, booking: BookingRow): Promise<void> {
    const bookingDate = booking.booking_date instanceof Date
      ? booking.booking_date.toISOString().split('T')[0]
      : booking.booking_date;

    if (type === 'booking_confirmation') {
      console.log(
        `[NotificationService] ✓ Booking confirmation sent - Booking: ${booking.id}, Client: ${booking.client_id}, Date: ${bookingDate}, Time: ${booking.start_time}`
      );
    } else if (type === 'booking_cancellation') {
      console.log(
        `[NotificationService] ✓ Booking cancellation sent - Booking: ${booking.id}, Client: ${booking.client_id}, Date: ${bookingDate}, Time: ${booking.start_time}`
      );
    }
  },

  /**
   * Retorna las entradas de la cola de notificaciones (útil para testing/debugging).
   */
  getQueue(): NotificationQueueEntry[] {
    return [...this._queue];
  },

  /**
   * Limpia la cola de notificaciones (útil para testing).
   */
  clearQueue(): void {
    this._queue = [];
  },
};

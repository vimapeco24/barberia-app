import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { notificationService, NotificationType } from './notification.service';
import { BookingRow } from '../booking/booking.repository';

/**
 * Tests para el servicio de notificaciones.
 * Valida: Requisitos 4.2 (notificación al cancelar/crear turno)
 */

function createMockBooking(overrides: Partial<BookingRow> = {}): BookingRow {
  return {
    id: 'booking-123',
    client_id: 'client-456',
    barber_id: 'barber-789',
    booking_date: new Date('2025-02-15'),
    start_time: '10:00',
    duration_minutes: 30,
    service_type: 'corte',
    status: 'confirmed',
    created_at: new Date(),
    cancelled_at: null,
    ...overrides,
  };
}

describe('NotificationService', () => {
  beforeEach(() => {
    notificationService.clearQueue();
    vi.useFakeTimers();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('notifyBookingConfirmation', () => {
    it('should send a confirmation notification successfully', async () => {
      const booking = createMockBooking();

      const result = await notificationService.notifyBookingConfirmation(booking);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(1);
      expect(result.error).toBeUndefined();
    });

    it('should add entry to queue with correct type', async () => {
      const booking = createMockBooking();

      await notificationService.notifyBookingConfirmation(booking);

      const queue = notificationService.getQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].type).toBe('booking_confirmation');
      expect(queue[0].status).toBe('sent');
      expect(queue[0].booking).toBe(booking);
    });
  });

  describe('notifyBookingCancellation', () => {
    it('should send a cancellation notification successfully', async () => {
      const booking = createMockBooking({ status: 'cancelled' });

      const result = await notificationService.notifyBookingCancellation(booking);

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(1);
      expect(result.error).toBeUndefined();
    });

    it('should add entry to queue with correct type', async () => {
      const booking = createMockBooking({ status: 'cancelled' });

      await notificationService.notifyBookingCancellation(booking);

      const queue = notificationService.getQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].type).toBe('booking_cancellation');
      expect(queue[0].status).toBe('sent');
    });
  });

  describe('retry logic', () => {
    it('should retry up to 3 times on failure', async () => {
      const booking = createMockBooking();
      let callCount = 0;

      // Mock _deliver to always fail
      vi.spyOn(notificationService, '_deliver').mockImplementation(async () => {
        callCount++;
        throw new Error('Delivery failed');
      });

      const resultPromise = notificationService.notifyBookingCancellation(booking);

      // Advance timers for each retry interval
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(2000);

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3);
      expect(result.error).toBe('Delivery failed');
      expect(callCount).toBe(3);
    });

    it('should succeed on second attempt after first failure', async () => {
      const booking = createMockBooking();
      let callCount = 0;

      vi.spyOn(notificationService, '_deliver').mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Temporary failure');
        }
        // Succeed on second attempt
      });

      const resultPromise = notificationService.notifyBookingConfirmation(booking);

      // Advance timer for the retry interval
      await vi.advanceTimersByTimeAsync(2000);

      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
      expect(callCount).toBe(2);
    });

    it('should succeed on third attempt after two failures', async () => {
      const booking = createMockBooking();
      let callCount = 0;

      vi.spyOn(notificationService, '_deliver').mockImplementation(async () => {
        callCount++;
        if (callCount <= 2) {
          throw new Error('Temporary failure');
        }
        // Succeed on third attempt
      });

      const resultPromise = notificationService.notifyBookingConfirmation(booking);

      // Advance timers for each retry interval
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(2000);

      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
      expect(callCount).toBe(3);
    });

    it('should mark queue entry as failed after all retries exhausted', async () => {
      const booking = createMockBooking();

      vi.spyOn(notificationService, '_deliver').mockImplementation(async () => {
        throw new Error('Persistent failure');
      });

      const resultPromise = notificationService.notifyBookingConfirmation(booking);

      // Advance timers for each retry interval
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(2000);

      await resultPromise;

      const queue = notificationService.getQueue();
      expect(queue[0].status).toBe('failed');
      expect(queue[0].attempts).toBe(3);
    });

    it('should mark queue entry as sent on successful delivery', async () => {
      const booking = createMockBooking();

      await notificationService.notifyBookingConfirmation(booking);

      const queue = notificationService.getQueue();
      expect(queue[0].status).toBe('sent');
      expect(queue[0].attempts).toBe(1);
    });
  });

  describe('queue management', () => {
    it('should clear queue', async () => {
      const booking = createMockBooking();
      await notificationService.notifyBookingConfirmation(booking);
      await notificationService.notifyBookingCancellation(booking);

      expect(notificationService.getQueue()).toHaveLength(2);

      notificationService.clearQueue();

      expect(notificationService.getQueue()).toHaveLength(0);
    });

    it('should return a copy of the queue', () => {
      const queue = notificationService.getQueue();
      queue.push({} as any);

      expect(notificationService.getQueue()).toHaveLength(0);
    });
  });
});

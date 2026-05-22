import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bookingService } from './booking.service';
import { AppError, ErrorCodes } from '../../shared/errors';
import { BookingRow } from './booking.repository';

// Mock pool client for transactions
const mockClientQuery = vi.fn();
const mockClientRelease = vi.fn();
const mockPoolConnect = vi.fn();
const mockPoolQuery = vi.fn();

vi.mock('../../config/database', () => ({
  pool: {
    query: (...args: unknown[]) => mockPoolQuery(...args),
    connect: () => mockPoolConnect(),
  },
}));

// Mock booking repository
const mockBookingRepository = {
  create: vi.fn(),
  countActiveByClient: vi.fn(),
  findByClientWithBarberInfo: vi.fn(),
  findById: vi.fn(),
  updateStatus: vi.fn(),
};

vi.mock('./booking.repository', () => ({
  bookingRepository: {
    create: (...args: unknown[]) => mockBookingRepository.create(...args),
    countActiveByClient: (...args: unknown[]) => mockBookingRepository.countActiveByClient(...args),
    findByClientWithBarberInfo: (...args: unknown[]) => mockBookingRepository.findByClientWithBarberInfo(...args),
    findById: (...args: unknown[]) => mockBookingRepository.findById(...args),
    updateStatus: (...args: unknown[]) => mockBookingRepository.updateStatus(...args),
  },
}));

// Mock barber repository
const mockBarberRepository = {
  getWorkingHours: vi.fn(),
};

vi.mock('./barber.repository', () => ({
  barberRepository: {
    getWorkingHours: (...args: unknown[]) => mockBarberRepository.getWorkingHours(...args),
  },
}));

describe('BookingService', () => {
  const clientId = 'client-uuid-123';
  const barberId = 'barber-uuid-456';

  // Helper to get a future date string (N days from now)
  function getFutureDate(daysAhead: number): string {
    const date = new Date();
    date.setDate(date.getDate() + daysAhead);
    return date.toISOString().split('T')[0];
  }

  // Helper to get the day key for a given date
  function getDayKey(dateStr: string): string {
    const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const date = new Date(dateStr + 'T00:00:00');
    return dayKeys[date.getDay()];
  }

  // Helper to get a future weekday (not Sunday)
  function getFutureWeekday(startDays = 3): string {
    let futureDate = getFutureDate(startDays);
    let attempts = 0;
    while (getDayKey(futureDate) === 'sun' && attempts < 7) {
      const nextDay = new Date(futureDate + 'T00:00:00');
      nextDay.setDate(nextDay.getDate() + 1);
      futureDate = nextDay.toISOString().split('T')[0];
      attempts++;
    }
    return futureDate;
  }

  const defaultWorkingHours: Record<string, { start: string; end: string } | null> = {
    mon: { start: '09:00', end: '18:00' },
    tue: { start: '09:00', end: '18:00' },
    wed: { start: '09:00', end: '18:00' },
    thu: { start: '09:00', end: '18:00' },
    fri: { start: '09:00', end: '18:00' },
    sat: { start: '09:00', end: '14:00' },
    sun: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockBarberRepository.getWorkingHours.mockResolvedValue(defaultWorkingHours);
    mockBookingRepository.countActiveByClient.mockResolvedValue(0);
    // Mock pool.query for client overlap check (returns no existing bookings)
    mockPoolQuery.mockResolvedValue({ rows: [] });
    // Mock pool.connect for transaction
    mockClientQuery.mockResolvedValue({ rows: [] });
    mockPoolConnect.mockResolvedValue({
      query: mockClientQuery,
      release: mockClientRelease,
    });
  });

  describe('createBooking', () => {
    it('should create a booking successfully when all validations pass', async () => {
      const futureDate = getFutureWeekday();

      const dto = {
        barberId,
        date: futureDate,
        startTime: '10:00',
        serviceType: 'corte',
      };

      const expectedBooking = {
        id: 'booking-uuid-789',
        client_id: clientId,
        barber_id: barberId,
        booking_date: new Date(futureDate),
        start_time: '10:00',
        duration_minutes: 30,
        service_type: 'corte',
        status: 'confirmed',
        created_at: new Date(),
        cancelled_at: null,
      };

      // Mock transaction: BEGIN, SELECT FOR UPDATE (no conflicts), INSERT, COMMIT
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // SELECT FOR UPDATE - no existing bookings
        .mockResolvedValueOnce({ rows: [expectedBooking] }) // INSERT RETURNING
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await bookingService.createBooking(dto, clientId);

      expect(result).toEqual(expectedBooking);
      // Verify transaction was used
      expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
      expect(mockClientRelease).toHaveBeenCalled();
    });

    it('should throw SLOT_UNAVAILABLE when barber has overlapping booking (SELECT FOR UPDATE)', async () => {
      const futureDate = getFutureWeekday();

      const dto = {
        barberId,
        date: futureDate,
        startTime: '10:00',
        serviceType: 'corte',
      };

      // Mock transaction: BEGIN, SELECT FOR UPDATE returns conflicting booking
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [{ id: 'existing-booking', start_time: '09:45', duration_minutes: 30 }],
        }) // SELECT FOR UPDATE - overlapping booking
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      await expect(
        bookingService.createBooking(dto, clientId)
      ).rejects.toMatchObject({ code: ErrorCodes.SLOT_UNAVAILABLE });

      expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClientRelease).toHaveBeenCalled();
    });

    it('should not throw SLOT_UNAVAILABLE when barber bookings do not overlap', async () => {
      const futureDate = getFutureWeekday();

      const dto = {
        barberId,
        date: futureDate,
        startTime: '11:00',
        serviceType: 'corte',
      };

      const expectedBooking = {
        id: 'booking-uuid-new',
        client_id: clientId,
        barber_id: barberId,
        booking_date: new Date(futureDate),
        start_time: '11:00',
        duration_minutes: 30,
        service_type: 'corte',
        status: 'confirmed',
        created_at: new Date(),
        cancelled_at: null,
      };

      // Mock transaction: BEGIN, SELECT FOR UPDATE (non-overlapping booking), INSERT, COMMIT
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [{ id: 'existing-booking', start_time: '10:00', duration_minutes: 30 }],
        }) // SELECT FOR UPDATE - non-overlapping
        .mockResolvedValueOnce({ rows: [expectedBooking] }) // INSERT RETURNING
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await bookingService.createBooking(dto, clientId);
      expect(result).toEqual(expectedBooking);
    });

    it('should throw VALIDATION_ERROR when date is in the past (0 days ahead)', () => {
      const today = new Date().toISOString().split('T')[0];

      expect(() => bookingService.validateBookingDate(today)).toThrow(AppError);
      expect(() => bookingService.validateBookingDate(today)).toThrow(
        expect.objectContaining({ code: ErrorCodes.VALIDATION_ERROR })
      );
    });

    it('should throw VALIDATION_ERROR when date is more than 30 days ahead', () => {
      const farDate = getFutureDate(31);

      expect(() => bookingService.validateBookingDate(farDate)).toThrow(AppError);
      expect(() => bookingService.validateBookingDate(farDate)).toThrow(
        expect.objectContaining({ code: ErrorCodes.VALIDATION_ERROR })
      );
    });

    it('should accept a date exactly 1 day ahead', () => {
      const tomorrow = getFutureDate(1);
      expect(() => bookingService.validateBookingDate(tomorrow)).not.toThrow();
    });

    it('should accept a date exactly 30 days ahead', () => {
      const maxDate = getFutureDate(30);
      expect(() => bookingService.validateBookingDate(maxDate)).not.toThrow();
    });

    it('should throw SLOT_UNAVAILABLE when barber does not work on the selected day', async () => {
      // Find a Sunday
      let sundayDate = getFutureDate(1);
      while (getDayKey(sundayDate) !== 'sun') {
        const nextDay = new Date(sundayDate + 'T00:00:00');
        nextDay.setDate(nextDay.getDate() + 1);
        sundayDate = nextDay.toISOString().split('T')[0];
      }

      const dto = {
        barberId,
        date: sundayDate,
        startTime: '10:00',
        serviceType: 'corte',
      };

      await expect(
        bookingService.createBooking(dto, clientId)
      ).rejects.toMatchObject({ code: ErrorCodes.SLOT_UNAVAILABLE });
    });

    it('should throw SLOT_UNAVAILABLE when time is before working hours', async () => {
      const futureDate = getFutureWeekday();

      const dto = {
        barberId,
        date: futureDate,
        startTime: '07:00',
        serviceType: 'corte',
      };

      await expect(
        bookingService.createBooking(dto, clientId)
      ).rejects.toMatchObject({ code: ErrorCodes.SLOT_UNAVAILABLE });
    });

    it('should throw SLOT_UNAVAILABLE when booking would end after working hours', async () => {
      const futureDate = getFutureWeekday();

      const dto = {
        barberId,
        date: futureDate,
        startTime: '17:45',
        serviceType: 'corte',
      };

      await expect(
        bookingService.createBooking(dto, clientId)
      ).rejects.toMatchObject({ code: ErrorCodes.SLOT_UNAVAILABLE });
    });

    it('should throw MAX_BOOKINGS_REACHED when client has 3 active bookings', async () => {
      mockBookingRepository.countActiveByClient.mockResolvedValue(3);

      const futureDate = getFutureWeekday();

      const dto = {
        barberId,
        date: futureDate,
        startTime: '10:00',
        serviceType: 'corte',
      };

      await expect(
        bookingService.createBooking(dto, clientId)
      ).rejects.toMatchObject({ code: ErrorCodes.MAX_BOOKINGS_REACHED });
    });

    it('should throw CLIENT_OVERLAP when client has overlapping booking', async () => {
      mockPoolQuery.mockResolvedValue({
        rows: [{ start_time: '10:00', duration_minutes: 30 }],
      });

      const futureDate = getFutureWeekday();

      const dto = {
        barberId,
        date: futureDate,
        startTime: '10:15',
        serviceType: 'corte',
      };

      await expect(
        bookingService.createBooking(dto, clientId)
      ).rejects.toMatchObject({ code: ErrorCodes.CLIENT_OVERLAP });
    });

    it('should not throw CLIENT_OVERLAP when client bookings do not overlap', async () => {
      mockPoolQuery.mockResolvedValue({
        rows: [{ start_time: '10:00', duration_minutes: 30 }],
      });

      const futureDate = getFutureWeekday();

      const dto = {
        barberId,
        date: futureDate,
        startTime: '10:30',
        serviceType: 'corte',
      };

      const expectedBooking = {
        id: 'booking-uuid',
        client_id: clientId,
        barber_id: barberId,
        booking_date: new Date(futureDate),
        start_time: '10:30',
        duration_minutes: 30,
        service_type: 'corte',
        status: 'confirmed',
        created_at: new Date(),
        cancelled_at: null,
      };

      // Mock transaction: BEGIN, SELECT FOR UPDATE (no conflicts), INSERT, COMMIT
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // SELECT FOR UPDATE - no overlapping
        .mockResolvedValueOnce({ rows: [expectedBooking] }) // INSERT RETURNING
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      await expect(
        bookingService.createBooking(dto, clientId)
      ).resolves.toBeDefined();
    });

    it('should throw SLOT_UNAVAILABLE when unique constraint violation occurs (fallback)', async () => {
      const futureDate = getFutureWeekday();

      const dto = {
        barberId,
        date: futureDate,
        startTime: '10:00',
        serviceType: 'corte',
      };

      // Mock transaction: BEGIN, SELECT FOR UPDATE (no conflicts), INSERT throws unique violation
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // SELECT FOR UPDATE
        .mockRejectedValueOnce({ code: '23505' }); // INSERT - unique violation

      await expect(
        bookingService.createBooking(dto, clientId)
      ).rejects.toMatchObject({ code: ErrorCodes.SLOT_UNAVAILABLE });

      expect(mockClientRelease).toHaveBeenCalled();
    });

    it('should rethrow non-unique-constraint errors and rollback', async () => {
      const futureDate = getFutureWeekday();

      const dto = {
        barberId,
        date: futureDate,
        startTime: '10:00',
        serviceType: 'corte',
      };

      const dbError = new Error('Connection lost');

      // Mock transaction: BEGIN, SELECT FOR UPDATE (no conflicts), INSERT throws error
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // SELECT FOR UPDATE
        .mockRejectedValueOnce(dbError); // INSERT - connection error

      await expect(
        bookingService.createBooking(dto, clientId)
      ).rejects.toThrow('Connection lost');

      expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClientRelease).toHaveBeenCalled();
    });

    it('should throw VALIDATION_ERROR when barber is not found', async () => {
      mockBarberRepository.getWorkingHours.mockResolvedValue(null);

      const futureDate = getFutureWeekday();

      const dto = {
        barberId,
        date: futureDate,
        startTime: '10:00',
        serviceType: 'corte',
      };

      await expect(
        bookingService.createBooking(dto, clientId)
      ).rejects.toMatchObject({ code: ErrorCodes.VALIDATION_ERROR });
    });

    it('should release client connection even when AppError is thrown in transaction', async () => {
      const futureDate = getFutureWeekday();

      const dto = {
        barberId,
        date: futureDate,
        startTime: '10:00',
        serviceType: 'corte',
      };

      // Mock transaction: BEGIN, SELECT FOR UPDATE returns conflicting booking
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [{ id: 'existing', start_time: '10:00', duration_minutes: 30 }],
        }) // SELECT FOR UPDATE - exact overlap
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      await expect(
        bookingService.createBooking(dto, clientId)
      ).rejects.toMatchObject({ code: ErrorCodes.SLOT_UNAVAILABLE });

      // Ensure connection is always released
      expect(mockClientRelease).toHaveBeenCalledTimes(1);
    });
  });

  describe('isUniqueViolation', () => {
    it('should return true for PostgreSQL unique violation code 23505', () => {
      expect(bookingService.isUniqueViolation({ code: '23505' })).toBe(true);
    });

    it('should return false for other error codes', () => {
      expect(bookingService.isUniqueViolation({ code: '23503' })).toBe(false);
    });

    it('should return false for null', () => {
      expect(bookingService.isUniqueViolation(null)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(bookingService.isUniqueViolation('error')).toBe(false);
    });
  });

  describe('cancelBooking', () => {
    const bookingId = 'booking-uuid-789';

    // Helper to create a booking row for testing
    function createMockBooking(overrides: Partial<BookingRow> = {}): BookingRow {
      // Create a date 5 days in the future to ensure cancellation is allowed
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      return {
        id: bookingId,
        client_id: clientId,
        barber_id: barberId,
        booking_date: futureDate,
        start_time: '14:00',
        duration_minutes: 30,
        service_type: 'corte',
        status: 'confirmed',
        created_at: new Date(),
        cancelled_at: null,
        ...overrides,
      };
    }

    it('should cancel a booking successfully when all validations pass', async () => {
      const mockBooking = createMockBooking();
      const cancelledBooking = { ...mockBooking, status: 'cancelled' as const, cancelled_at: new Date() };

      mockBookingRepository.findById.mockResolvedValue(mockBooking);
      mockBookingRepository.updateStatus.mockResolvedValue(cancelledBooking);

      const result = await bookingService.cancelBooking(bookingId, clientId);

      expect(result.status).toBe('cancelled');
      expect(result.cancelled_at).not.toBeNull();
      expect(mockBookingRepository.updateStatus).toHaveBeenCalledWith(bookingId, 'cancelled');
    });

    it('should throw BOOKING_NOT_FOUND when booking does not exist', async () => {
      mockBookingRepository.findById.mockResolvedValue(null);

      await expect(
        bookingService.cancelBooking(bookingId, clientId)
      ).rejects.toMatchObject({ code: ErrorCodes.BOOKING_NOT_FOUND });
    });

    it('should throw BOOKING_NOT_FOUND when booking belongs to a different client', async () => {
      const mockBooking = createMockBooking({ client_id: 'other-client-id' });
      mockBookingRepository.findById.mockResolvedValue(mockBooking);

      await expect(
        bookingService.cancelBooking(bookingId, clientId)
      ).rejects.toMatchObject({ code: ErrorCodes.BOOKING_NOT_FOUND });
    });

    it('should throw BOOKING_ALREADY_CANCELLED when booking is already cancelled', async () => {
      const mockBooking = createMockBooking({ status: 'cancelled', cancelled_at: new Date() });
      mockBookingRepository.findById.mockResolvedValue(mockBooking);

      await expect(
        bookingService.cancelBooking(bookingId, clientId)
      ).rejects.toMatchObject({ code: ErrorCodes.BOOKING_ALREADY_CANCELLED });
    });

    it('should throw BOOKING_ALREADY_COMPLETED when booking is already completed', async () => {
      const mockBooking = createMockBooking({ status: 'completed' });
      mockBookingRepository.findById.mockResolvedValue(mockBooking);

      await expect(
        bookingService.cancelBooking(bookingId, clientId)
      ).rejects.toMatchObject({ code: ErrorCodes.BOOKING_ALREADY_COMPLETED });
    });

    it('should throw CANCELLATION_TOO_LATE when less than 2 hours before scheduled time', async () => {
      // Create a booking that starts in 1 hour (less than MIN_CANCELLATION_HOURS)
      const now = new Date();
      const bookingDateTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now

      const hours = bookingDateTime.getHours().toString().padStart(2, '0');
      const minutes = bookingDateTime.getMinutes().toString().padStart(2, '0');
      const startTime = `${hours}:${minutes}`;

      const mockBooking = createMockBooking({
        booking_date: new Date(now.toISOString().split('T')[0] + 'T00:00:00'),
        start_time: startTime,
      });
      mockBookingRepository.findById.mockResolvedValue(mockBooking);

      await expect(
        bookingService.cancelBooking(bookingId, clientId)
      ).rejects.toMatchObject({ code: ErrorCodes.CANCELLATION_TOO_LATE });
    });

    it('should allow cancellation when more than 2 hours before scheduled time', async () => {
      // Create a booking that starts in 3 hours (more than MIN_CANCELLATION_HOURS)
      const now = new Date();
      const bookingDateTime = new Date(now.getTime() + 3 * 60 * 60 * 1000); // 3 hours from now

      const hours = bookingDateTime.getHours().toString().padStart(2, '0');
      const minutes = bookingDateTime.getMinutes().toString().padStart(2, '0');
      const startTime = `${hours}:${minutes}`;

      const mockBooking = createMockBooking({
        booking_date: new Date(now.toISOString().split('T')[0] + 'T00:00:00'),
        start_time: startTime,
      });
      const cancelledBooking = { ...mockBooking, status: 'cancelled' as const, cancelled_at: new Date() };

      mockBookingRepository.findById.mockResolvedValue(mockBooking);
      mockBookingRepository.updateStatus.mockResolvedValue(cancelledBooking);

      const result = await bookingService.cancelBooking(bookingId, clientId);
      expect(result.status).toBe('cancelled');
    });

    it('should throw CANCELLATION_TOO_LATE for a booking in the past', async () => {
      // Create a booking that was yesterday
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const mockBooking = createMockBooking({
        booking_date: yesterday,
        start_time: '10:00',
      });
      mockBookingRepository.findById.mockResolvedValue(mockBooking);

      await expect(
        bookingService.cancelBooking(bookingId, clientId)
      ).rejects.toMatchObject({ code: ErrorCodes.CANCELLATION_TOO_LATE });
    });
  });

  describe('getClientBookings', () => {
    it('should return client bookings with barber information', async () => {
      const bookingsWithBarber = [
        {
          id: 'booking-1',
          client_id: clientId,
          barber_id: 'barber-uuid-456',
          booking_date: new Date('2025-02-01'),
          start_time: '10:00',
          duration_minutes: 30,
          service_type: 'corte',
          status: 'confirmed' as const,
          created_at: new Date(),
          cancelled_at: null,
          barber_name: 'Carlos López',
          barber_specialty: 'Cortes clásicos',
        },
        {
          id: 'booking-2',
          client_id: clientId,
          barber_id: 'barber-uuid-789',
          booking_date: new Date('2025-02-02'),
          start_time: '14:00',
          duration_minutes: 30,
          service_type: 'barba',
          status: 'confirmed' as const,
          created_at: new Date(),
          cancelled_at: null,
          barber_name: 'Miguel Fernández',
          barber_specialty: null,
        },
      ];

      mockBookingRepository.findByClientWithBarberInfo.mockResolvedValue(bookingsWithBarber);

      const result = await bookingService.getClientBookings(clientId);

      expect(result).toEqual(bookingsWithBarber);
      expect(result).toHaveLength(2);
      expect(result[0].barber_name).toBe('Carlos López');
      expect(result[1].barber_name).toBe('Miguel Fernández');
      expect(mockBookingRepository.findByClientWithBarberInfo).toHaveBeenCalledWith(clientId);
    });

    it('should return empty array when client has no bookings', async () => {
      mockBookingRepository.findByClientWithBarberInfo.mockResolvedValue([]);

      const result = await bookingService.getClientBookings(clientId);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
      expect(mockBookingRepository.findByClientWithBarberInfo).toHaveBeenCalledWith(clientId);
    });
  });
});

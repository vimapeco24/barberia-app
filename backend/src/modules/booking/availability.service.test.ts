import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  addMinutes,
  timeToMinutes,
  generateSlots,
  slotsOverlap,
  filterAvailableSlots,
  getAvailability,
} from './availability.service';
import { BookingRow } from './booking.repository';

// Mock the repositories
vi.mock('./barber.repository', () => ({
  barberRepository: {
    getWorkingHours: vi.fn(),
  },
}));

vi.mock('./booking.repository', () => ({
  bookingRepository: {
    findByBarberAndDate: vi.fn(),
  },
}));

import { barberRepository } from './barber.repository';
import { bookingRepository } from './booking.repository';

describe('availability.service', () => {
  describe('addMinutes', () => {
    it('should add minutes to a time string', () => {
      expect(addMinutes('09:00', 30)).toBe('09:30');
      expect(addMinutes('09:30', 30)).toBe('10:00');
      expect(addMinutes('23:30', 30)).toBe('24:00');
    });

    it('should handle zero minutes', () => {
      expect(addMinutes('09:00', 0)).toBe('09:00');
    });
  });

  describe('timeToMinutes', () => {
    it('should convert time string to minutes since midnight', () => {
      expect(timeToMinutes('00:00')).toBe(0);
      expect(timeToMinutes('09:00')).toBe(540);
      expect(timeToMinutes('18:00')).toBe(1080);
      expect(timeToMinutes('09:30')).toBe(570);
    });
  });

  describe('generateSlots', () => {
    it('should generate 30-minute slots within working hours', () => {
      const slots = generateSlots('09:00', '11:00');
      expect(slots).toHaveLength(4);
      expect(slots[0]).toEqual({ startTime: '09:00', endTime: '09:30', available: true });
      expect(slots[1]).toEqual({ startTime: '09:30', endTime: '10:00', available: true });
      expect(slots[2]).toEqual({ startTime: '10:00', endTime: '10:30', available: true });
      expect(slots[3]).toEqual({ startTime: '10:30', endTime: '11:00', available: true });
    });

    it('should not generate a slot if remaining time is less than 30 minutes', () => {
      const slots = generateSlots('09:00', '09:20');
      expect(slots).toHaveLength(0);
    });

    it('should generate exactly one slot for a 30-minute window', () => {
      const slots = generateSlots('09:00', '09:30');
      expect(slots).toHaveLength(1);
      expect(slots[0]).toEqual({ startTime: '09:00', endTime: '09:30', available: true });
    });

    it('should handle a full day schedule', () => {
      const slots = generateSlots('09:00', '18:00');
      expect(slots).toHaveLength(18); // 9 hours * 2 slots/hour
    });
  });

  describe('slotsOverlap', () => {
    it('should detect overlap when booking starts during slot', () => {
      // Slot: 09:00-09:30, Booking: 09:15 (30 min)
      expect(slotsOverlap(540, 570, 555, 30)).toBe(true);
    });

    it('should detect overlap when booking contains slot', () => {
      // Slot: 09:30-10:00, Booking: 09:00 (60 min)
      expect(slotsOverlap(570, 600, 540, 60)).toBe(true);
    });

    it('should not detect overlap when booking ends at slot start', () => {
      // Slot: 10:00-10:30, Booking: 09:30 (30 min) → ends at 10:00
      expect(slotsOverlap(600, 630, 570, 30)).toBe(false);
    });

    it('should not detect overlap when booking starts at slot end', () => {
      // Slot: 09:00-09:30, Booking: 09:30 (30 min)
      expect(slotsOverlap(540, 570, 570, 30)).toBe(false);
    });

    it('should detect overlap when slot is within booking', () => {
      // Slot: 10:00-10:30, Booking: 09:00 (120 min) → ends at 11:00
      expect(slotsOverlap(600, 630, 540, 120)).toBe(true);
    });
  });

  describe('filterAvailableSlots', () => {
    it('should mark slots as unavailable when they overlap with bookings', () => {
      const slots = generateSlots('09:00', '10:30');
      const bookings: BookingRow[] = [
        {
          id: '1',
          client_id: 'c1',
          barber_id: 'b1',
          booking_date: new Date('2024-01-15'),
          start_time: '09:30',
          duration_minutes: 30,
          service_type: 'corte',
          status: 'confirmed',
          created_at: new Date(),
          cancelled_at: null,
        },
      ];

      const result = filterAvailableSlots(slots, bookings);
      expect(result[0].available).toBe(true);  // 09:00-09:30
      expect(result[1].available).toBe(false); // 09:30-10:00 (overlaps)
      expect(result[2].available).toBe(true);  // 10:00-10:30
    });

    it('should return all slots as available when there are no bookings', () => {
      const slots = generateSlots('09:00', '10:00');
      const result = filterAvailableSlots(slots, []);
      expect(result.every((s) => s.available)).toBe(true);
    });

    it('should mark multiple slots as unavailable for a longer booking', () => {
      const slots = generateSlots('09:00', '11:00');
      const bookings: BookingRow[] = [
        {
          id: '1',
          client_id: 'c1',
          barber_id: 'b1',
          booking_date: new Date('2024-01-15'),
          start_time: '09:30',
          duration_minutes: 60,
          service_type: 'corte',
          status: 'confirmed',
          created_at: new Date(),
          cancelled_at: null,
        },
      ];

      const result = filterAvailableSlots(slots, bookings);
      expect(result[0].available).toBe(true);  // 09:00-09:30
      expect(result[1].available).toBe(false); // 09:30-10:00 (overlaps)
      expect(result[2].available).toBe(false); // 10:00-10:30 (overlaps)
      expect(result[3].available).toBe(true);  // 10:30-11:00
    });
  });

  describe('getAvailability', () => {
    beforeEach(() => {
      vi.resetAllMocks();
    });

    it('should return empty array if barber has no working hours', async () => {
      vi.mocked(barberRepository.getWorkingHours).mockResolvedValue(null);

      const result = await getAvailability('barber-1', '2024-01-15');
      expect(result).toEqual([]);
    });

    it('should return empty array if barber does not work on requested day', async () => {
      vi.mocked(barberRepository.getWorkingHours).mockResolvedValue({
        mon: { start: '09:00', end: '18:00' },
        tue: { start: '09:00', end: '18:00' },
        wed: { start: '09:00', end: '18:00' },
        thu: { start: '09:00', end: '18:00' },
        fri: { start: '09:00', end: '18:00' },
        sat: null,
        sun: null,
      });

      // 2024-01-14 is a Sunday
      const result = await getAvailability('barber-1', '2024-01-14');
      expect(result).toEqual([]);
    });

    it('should return available slots filtering out booked ones', async () => {
      vi.mocked(barberRepository.getWorkingHours).mockResolvedValue({
        mon: { start: '09:00', end: '10:30' },
        tue: null,
        wed: null,
        thu: null,
        fri: null,
        sat: null,
        sun: null,
      });

      vi.mocked(bookingRepository.findByBarberAndDate).mockResolvedValue([
        {
          id: '1',
          client_id: 'c1',
          barber_id: 'barber-1',
          booking_date: new Date('2024-01-15'),
          start_time: '09:00',
          duration_minutes: 30,
          service_type: 'corte',
          status: 'confirmed',
          created_at: new Date(),
          cancelled_at: null,
        },
      ]);

      // 2024-01-15 is a Monday
      const result = await getAvailability('barber-1', '2024-01-15');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ startTime: '09:30', endTime: '10:00', available: true });
      expect(result[1]).toEqual({ startTime: '10:00', endTime: '10:30', available: true });
    });

    it('should return all slots when no bookings exist', async () => {
      vi.mocked(barberRepository.getWorkingHours).mockResolvedValue({
        mon: { start: '09:00', end: '10:00' },
        tue: null,
        wed: null,
        thu: null,
        fri: null,
        sat: null,
        sun: null,
      });

      vi.mocked(bookingRepository.findByBarberAndDate).mockResolvedValue([]);

      // 2024-01-15 is a Monday
      const result = await getAvailability('barber-1', '2024-01-15');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ startTime: '09:00', endTime: '09:30', available: true });
      expect(result[1]).toEqual({ startTime: '09:30', endTime: '10:00', available: true });
    });
  });
});

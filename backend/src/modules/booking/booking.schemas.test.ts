import { describe, it, expect } from 'vitest';
import { CreateBookingDTO, AvailabilityParamsDTO, AvailabilityQueryDTO, BookingIdParamDTO } from './booking.schemas';

describe('Booking Schemas', () => {
  describe('CreateBookingDTO', () => {
    it('should accept valid booking data', () => {
      const result = CreateBookingDTO.safeParse({
        barberId: '550e8400-e29b-41d4-a716-446655440000',
        date: '2025-03-15',
        startTime: '10:00',
        serviceType: 'Corte de cabello',
      });
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID for barberId', () => {
      const result = CreateBookingDTO.safeParse({
        barberId: 'not-a-uuid',
        date: '2025-03-15',
        startTime: '10:00',
        serviceType: 'Corte',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid date format', () => {
      const result = CreateBookingDTO.safeParse({
        barberId: '550e8400-e29b-41d4-a716-446655440000',
        date: '15-03-2025',
        startTime: '10:00',
        serviceType: 'Corte',
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid time format', () => {
      const result = CreateBookingDTO.safeParse({
        barberId: '550e8400-e29b-41d4-a716-446655440000',
        date: '2025-03-15',
        startTime: '25:00',
        serviceType: 'Corte',
      });
      expect(result.success).toBe(false);
    });

    it('should reject time with invalid minutes', () => {
      const result = CreateBookingDTO.safeParse({
        barberId: '550e8400-e29b-41d4-a716-446655440000',
        date: '2025-03-15',
        startTime: '10:60',
        serviceType: 'Corte',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty serviceType', () => {
      const result = CreateBookingDTO.safeParse({
        barberId: '550e8400-e29b-41d4-a716-446655440000',
        date: '2025-03-15',
        startTime: '10:00',
        serviceType: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject serviceType exceeding 50 characters', () => {
      const result = CreateBookingDTO.safeParse({
        barberId: '550e8400-e29b-41d4-a716-446655440000',
        date: '2025-03-15',
        startTime: '10:00',
        serviceType: 'a'.repeat(51),
      });
      expect(result.success).toBe(false);
    });

    it('should accept time at boundary 23:59', () => {
      const result = CreateBookingDTO.safeParse({
        barberId: '550e8400-e29b-41d4-a716-446655440000',
        date: '2025-03-15',
        startTime: '23:59',
        serviceType: 'Corte',
      });
      expect(result.success).toBe(true);
    });

    it('should accept time at boundary 00:00', () => {
      const result = CreateBookingDTO.safeParse({
        barberId: '550e8400-e29b-41d4-a716-446655440000',
        date: '2025-03-15',
        startTime: '00:00',
        serviceType: 'Corte',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('AvailabilityParamsDTO', () => {
    it('should accept a valid UUID', () => {
      const result = AvailabilityParamsDTO.safeParse({
        barberId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('should reject an invalid UUID', () => {
      const result = AvailabilityParamsDTO.safeParse({
        barberId: 'invalid',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('AvailabilityQueryDTO', () => {
    it('should accept a valid date', () => {
      const result = AvailabilityQueryDTO.safeParse({
        date: '2025-06-15',
      });
      expect(result.success).toBe(true);
    });

    it('should reject an invalid date format', () => {
      const result = AvailabilityQueryDTO.safeParse({
        date: '2025/06/15',
      });
      expect(result.success).toBe(false);
    });

    it('should reject a non-existent date', () => {
      const result = AvailabilityQueryDTO.safeParse({
        date: '2025-02-30',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('BookingIdParamDTO', () => {
    it('should accept a valid UUID', () => {
      const result = BookingIdParamDTO.safeParse({
        id: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.success).toBe(true);
    });

    it('should reject an invalid UUID', () => {
      const result = BookingIdParamDTO.safeParse({
        id: 'not-valid',
      });
      expect(result.success).toBe(false);
    });
  });
});

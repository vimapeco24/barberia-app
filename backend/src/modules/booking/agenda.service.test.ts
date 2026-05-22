import { describe, it, expect, vi, beforeEach } from 'vitest';
import { agendaService, AgendaEntry } from './agenda.service';

// Mock the database pool
vi.mock('../../config/database', () => ({
  pool: {
    query: vi.fn(),
  },
}));

import { pool } from '../../config/database';

describe('agenda.service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('getBarberAgenda', () => {
    it('should return confirmed bookings for the barber on the given date', async () => {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [
          {
            id: 'booking-1',
            client_name: 'Juan Pérez',
            start_time: '09:00:00',
            duration_minutes: 30,
            service_type: 'corte',
            status: 'confirmed',
          },
          {
            id: 'booking-2',
            client_name: 'María García',
            start_time: '10:00:00',
            duration_minutes: 30,
            service_type: 'barba',
            status: 'confirmed',
          },
        ],
        command: 'SELECT',
        rowCount: 2,
        oid: 0,
        fields: [],
      } as any);

      const result = await agendaService.getBarberAgenda('barber-1', '2024-01-15');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        bookingId: 'booking-1',
        clientName: 'Juan Pérez',
        startTime: '09:00:00',
        duration: 30,
        serviceType: 'corte',
        status: 'confirmed',
      });
      expect(result[1]).toEqual({
        bookingId: 'booking-2',
        clientName: 'María García',
        startTime: '10:00:00',
        duration: 30,
        serviceType: 'barba',
        status: 'confirmed',
      });
    });

    it('should return an empty array when no confirmed bookings exist', async () => {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: [],
      } as any);

      const result = await agendaService.getBarberAgenda('barber-1', '2024-01-15');

      expect(result).toEqual([]);
    });

    it('should query with the correct barberId and date parameters', async () => {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: [],
      } as any);

      await agendaService.getBarberAgenda('barber-abc', '2024-03-20');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE b.barber_id = $1'),
        ['barber-abc', '2024-03-20']
      );
    });

    it('should only query confirmed bookings', async () => {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: [],
      } as any);

      await agendaService.getBarberAgenda('barber-1', '2024-01-15');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("b.status = 'confirmed'"),
        expect.any(Array)
      );
    });

    it('should order results by start_time ascending', async () => {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [],
        command: 'SELECT',
        rowCount: 0,
        oid: 0,
        fields: [],
      } as any);

      await agendaService.getBarberAgenda('barber-1', '2024-01-15');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY b.start_time ASC'),
        expect.any(Array)
      );
    });

    it('should include all required fields in the response', async () => {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [
          {
            id: 'booking-1',
            client_name: 'Carlos López',
            start_time: '14:30:00',
            duration_minutes: 30,
            service_type: 'corte y barba',
            status: 'confirmed',
          },
        ],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      } as any);

      const result = await agendaService.getBarberAgenda('barber-1', '2024-01-15');

      const entry: AgendaEntry = result[0];
      expect(entry).toHaveProperty('bookingId');
      expect(entry).toHaveProperty('clientName');
      expect(entry).toHaveProperty('startTime');
      expect(entry).toHaveProperty('duration');
      expect(entry).toHaveProperty('serviceType');
      expect(entry).toHaveProperty('status');
    });
  });
});

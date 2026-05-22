import { pool } from '../../config/database';

export interface BookingRow {
  id: string;
  client_id: string;
  barber_id: string;
  booking_date: Date;
  start_time: string;
  duration_minutes: number;
  service_type: string;
  status: 'confirmed' | 'cancelled' | 'completed';
  created_at: Date;
  cancelled_at: Date | null;
}

export interface BookingWithBarberRow extends BookingRow {
  barber_name: string;
  barber_specialty: string | null;
}

export interface CreateBookingData {
  client_id: string;
  barber_id: string;
  booking_date: string;
  start_time: string;
  duration_minutes?: number;
  service_type: string;
}

export const bookingRepository = {
  async create(data: CreateBookingData): Promise<BookingRow> {
    const result = await pool.query<BookingRow>(
      `INSERT INTO bookings (client_id, barber_id, booking_date, start_time, duration_minutes, service_type)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, client_id, barber_id, booking_date, start_time, duration_minutes, service_type, status, created_at, cancelled_at`,
      [
        data.client_id,
        data.barber_id,
        data.booking_date,
        data.start_time,
        data.duration_minutes || 30,
        data.service_type,
      ]
    );
    return result.rows[0];
  },

  async findById(id: string): Promise<BookingRow | null> {
    const result = await pool.query<BookingRow>(
      `SELECT id, client_id, barber_id, booking_date, start_time, duration_minutes, service_type, status, created_at, cancelled_at
       FROM bookings WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  async findByClient(clientId: string): Promise<BookingRow[]> {
    const result = await pool.query<BookingRow>(
      `SELECT id, client_id, barber_id, booking_date, start_time, duration_minutes, service_type, status, created_at, cancelled_at
       FROM bookings WHERE client_id = $1
       ORDER BY booking_date ASC, start_time ASC`,
      [clientId]
    );
    return result.rows;
  },

  async findByClientWithBarberInfo(clientId: string): Promise<BookingWithBarberRow[]> {
    const result = await pool.query<BookingWithBarberRow>(
      `SELECT b.id, b.client_id, b.barber_id, b.booking_date, b.start_time, b.duration_minutes,
              b.service_type, b.status, b.created_at, b.cancelled_at,
              u.name AS barber_name, bp.specialty AS barber_specialty
       FROM bookings b
       JOIN barber_profiles bp ON bp.id = b.barber_id
       JOIN users u ON u.id = bp.user_id
       WHERE b.client_id = $1
       ORDER BY b.booking_date ASC, b.start_time ASC`,
      [clientId]
    );
    return result.rows;
  },

  async findByBarberAndDate(barberId: string, date: string): Promise<BookingRow[]> {
    const result = await pool.query<BookingRow>(
      `SELECT id, client_id, barber_id, booking_date, start_time, duration_minutes, service_type, status, created_at, cancelled_at
       FROM bookings
       WHERE barber_id = $1 AND booking_date = $2 AND status = 'confirmed'
       ORDER BY start_time ASC`,
      [barberId, date]
    );
    return result.rows;
  },

  async updateStatus(id: string, status: 'confirmed' | 'cancelled' | 'completed'): Promise<BookingRow | null> {
    const result = await pool.query<BookingRow>(
      `UPDATE bookings SET status = $1, cancelled_at = ${status === 'cancelled' ? 'NOW()' : 'cancelled_at'}
       WHERE id = $2
       RETURNING id, client_id, barber_id, booking_date, start_time, duration_minutes, service_type, status, created_at, cancelled_at`,
      [status, id]
    );
    return result.rows[0] || null;
  },

  async countActiveByClient(clientId: string): Promise<number> {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM bookings
       WHERE client_id = $1 AND status = 'confirmed'`,
      [clientId]
    );
    return parseInt(result.rows[0].count, 10);
  },
};

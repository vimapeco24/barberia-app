import { pool } from '../../config/database';

export interface BarberProfileRow {
  id: string;
  user_id: string;
  specialty: string | null;
  working_hours: Record<string, { start: string; end: string } | null>;
  is_available: boolean;
}

export const barberRepository = {
  async findById(id: string): Promise<BarberProfileRow | null> {
    const result = await pool.query<BarberProfileRow>(
      `SELECT id, user_id, specialty, working_hours, is_available
       FROM barber_profiles WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  async findByUserId(userId: string): Promise<BarberProfileRow | null> {
    const result = await pool.query<BarberProfileRow>(
      `SELECT id, user_id, specialty, working_hours, is_available
       FROM barber_profiles WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0] || null;
  },

  async findAll(): Promise<BarberProfileRow[]> {
    const result = await pool.query<BarberProfileRow>(
      `SELECT id, user_id, specialty, working_hours, is_available
       FROM barber_profiles WHERE is_available = true
       ORDER BY id`
    );
    return result.rows;
  },

  async getWorkingHours(barberId: string): Promise<Record<string, { start: string; end: string } | null> | null> {
    const result = await pool.query<{ working_hours: Record<string, { start: string; end: string } | null> }>(
      `SELECT working_hours FROM barber_profiles WHERE id = $1`,
      [barberId]
    );
    if (!result.rows[0]) return null;
    return result.rows[0].working_hours;
  },
};

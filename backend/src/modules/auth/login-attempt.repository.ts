import { pool } from '../../config/database';

export interface LoginAttemptRow {
  id: string;
  user_id: string | null;
  email: string;
  success: boolean;
  ip_address: string | null;
  attempted_at: Date;
}

export interface CreateLoginAttemptData {
  user_id?: string | null;
  email: string;
  success: boolean;
  ip_address?: string | null;
}

export const loginAttemptRepository = {
  async create(data: CreateLoginAttemptData): Promise<LoginAttemptRow> {
    const result = await pool.query<LoginAttemptRow>(
      `INSERT INTO login_attempts (user_id, email, success, ip_address)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, email, success, ip_address, attempted_at`,
      [data.user_id || null, data.email, data.success, data.ip_address || null]
    );
    return result.rows[0];
  },

  async countRecentFailed(email: string, windowMinutes: number = 15): Promise<number> {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM login_attempts
       WHERE email = $1
         AND success = false
         AND attempted_at > NOW() - INTERVAL '1 minute' * $2`,
      [email, windowMinutes]
    );
    return parseInt(result.rows[0].count, 10);
  },

  async getLastSuccessful(email: string): Promise<LoginAttemptRow | null> {
    const result = await pool.query<LoginAttemptRow>(
      `SELECT id, user_id, email, success, ip_address, attempted_at
       FROM login_attempts
       WHERE email = $1 AND success = true
       ORDER BY attempted_at DESC
       LIMIT 1`,
      [email]
    );
    return result.rows[0] || null;
  },
};

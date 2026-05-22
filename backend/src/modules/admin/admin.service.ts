import bcrypt from 'bcrypt';
import { pool } from '../../config/database';
import { AppError, ErrorCodes } from '../../shared/errors';
import { BCRYPT_SALT_ROUNDS } from '../../shared/constants';
import { userRepository } from '../auth/user.repository';
import type { UserProfile } from '../../shared/types';

export interface CreateBarberDTO {
  email: string;
  password: string;
  name: string;
  phone?: string;
  specialty?: string;
  workingHours?: Record<string, { start: string; end: string } | null>;
}

export interface BarberListItem {
  id: string;
  userId: string;
  email: string;
  name: string;
  phone?: string;
  specialty: string | null;
  workingHours: Record<string, { start: string; end: string } | null>;
  isAvailable: boolean;
}

export const adminService = {
  /**
   * Crea una cuenta de barbero con su perfil asociado.
   * Solo accesible por usuarios con rol 'admin'.
   * Requisitos: 2.4, 2.5
   */
  async createBarber(data: CreateBarberDTO): Promise<{ user: UserProfile; barberId: string }> {
    // Check if email already exists
    const existingUser = await userRepository.findByEmail(data.email);
    if (existingUser) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'El correo electrónico ya está registrado', {
        email: ['El correo electrónico ya está registrado'],
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, BCRYPT_SALT_ROUNDS);

    // Create user with role 'barber' and barber profile in a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create user with barber role
      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, name, phone, role)
         VALUES ($1, $2, $3, $4, 'barber')
         RETURNING id, email, password_hash, name, phone, role, is_active, created_at, updated_at`,
        [data.email, passwordHash, data.name, data.phone || null]
      );
      const user = userResult.rows[0];

      // Create barber profile
      const defaultWorkingHours = JSON.stringify(
        data.workingHours || {
          mon: { start: '09:00', end: '18:00' },
          tue: { start: '09:00', end: '18:00' },
          wed: { start: '09:00', end: '18:00' },
          thu: { start: '09:00', end: '18:00' },
          fri: { start: '09:00', end: '18:00' },
          sat: { start: '09:00', end: '14:00' },
        }
      );

      const profileResult = await client.query(
        `INSERT INTO barber_profiles (user_id, specialty, working_hours)
         VALUES ($1, $2, $3::jsonb)
         RETURNING id`,
        [user.id, data.specialty || null, defaultWorkingHours]
      );

      await client.query('COMMIT');

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone ?? undefined,
          role: user.role,
          isActive: user.is_active,
        },
        barberId: profileResult.rows[0].id,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Lista todos los barberos con sus perfiles.
   * Solo accesible por usuarios con rol 'admin'.
   * Requisitos: 2.4, 2.5
   */
  async listBarbers(): Promise<BarberListItem[]> {
    const result = await pool.query<{
      id: string;
      user_id: string;
      email: string;
      name: string;
      phone: string | null;
      specialty: string | null;
      working_hours: Record<string, { start: string; end: string } | null>;
      is_available: boolean;
    }>(
      `SELECT bp.id, bp.user_id, u.email, u.name, u.phone, bp.specialty, bp.working_hours, bp.is_available
       FROM barber_profiles bp
       JOIN users u ON u.id = bp.user_id
       WHERE u.is_active = true
       ORDER BY u.name`
    );

    return result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      email: row.email,
      name: row.name,
      phone: row.phone ?? undefined,
      specialty: row.specialty,
      workingHours: row.working_hours,
      isAvailable: row.is_available,
    }));
  },
};

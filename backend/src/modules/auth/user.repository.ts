import { pool } from '../../config/database';

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  phone: string | null;
  role: 'client' | 'barber' | 'admin';
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserData {
  email: string;
  password_hash: string;
  name: string;
  phone?: string;
  role?: 'client' | 'barber' | 'admin';
}

export const userRepository = {
  async findById(id: string): Promise<UserRow | null> {
    const result = await pool.query<UserRow>(
      'SELECT id, email, password_hash, name, phone, role, is_active, created_at, updated_at FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  },

  async findByEmail(email: string): Promise<UserRow | null> {
    const result = await pool.query<UserRow>(
      'SELECT id, email, password_hash, name, phone, role, is_active, created_at, updated_at FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  },

  async create(data: CreateUserData): Promise<UserRow> {
    const result = await pool.query<UserRow>(
      `INSERT INTO users (email, password_hash, name, phone, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, password_hash, name, phone, role, is_active, created_at, updated_at`,
      [data.email, data.password_hash, data.name, data.phone || null, data.role || 'client']
    );
    return result.rows[0];
  },

  async updateLastLogin(userId: string): Promise<void> {
    await pool.query(
      'UPDATE users SET updated_at = NOW() WHERE id = $1',
      [userId]
    );
  },
};

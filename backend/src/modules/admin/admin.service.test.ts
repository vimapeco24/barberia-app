import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminService } from './admin.service';
import { AppError, ErrorCodes } from '../../shared/errors';

// Mock dependencies
vi.mock('../../config/database', () => {
  const mockClient = {
    query: vi.fn(),
    release: vi.fn(),
  };
  return {
    pool: {
      query: vi.fn(),
      connect: vi.fn().mockResolvedValue(mockClient),
    },
  };
});

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed_password_123'),
  },
}));

vi.mock('../auth/user.repository', () => ({
  userRepository: {
    findByEmail: vi.fn(),
  },
}));

import { pool } from '../../config/database';
import { userRepository } from '../auth/user.repository';

describe('adminService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createBarber', () => {
    it('should create a barber user and profile in a transaction', async () => {
      const mockUserRow = {
        id: 'user-uuid-1',
        email: 'barber@test.com',
        password_hash: 'hashed_password_123',
        name: 'Juan Barbero',
        phone: '+5491155551234',
        role: 'barber',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockProfileRow = { id: 'profile-uuid-1' };

      // No existing user
      vi.mocked(userRepository.findByEmail).mockResolvedValue(null);

      // Mock transaction client
      const mockClient = await (pool as any).connect();
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({ rows: [mockUserRow] }) // INSERT user
        .mockResolvedValueOnce({ rows: [mockProfileRow] }) // INSERT barber_profile
        .mockResolvedValueOnce(undefined); // COMMIT

      const result = await adminService.createBarber({
        email: 'barber@test.com',
        password: 'SecurePass1',
        name: 'Juan Barbero',
        phone: '+5491155551234',
        specialty: 'Corte clásico',
      });

      expect(result.user).toEqual({
        id: 'user-uuid-1',
        email: 'barber@test.com',
        name: 'Juan Barbero',
        phone: '+5491155551234',
        role: 'barber',
        isActive: true,
      });
      expect(result.barberId).toBe('profile-uuid-1');

      // Verify transaction was used
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw VALIDATION_ERROR if email already exists', async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue({
        id: 'existing-user',
        email: 'barber@test.com',
        password_hash: 'hash',
        name: 'Existing',
        phone: null,
        role: 'barber',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await expect(
        adminService.createBarber({
          email: 'barber@test.com',
          password: 'SecurePass1',
          name: 'Juan Barbero',
        })
      ).rejects.toThrow(AppError);

      try {
        await adminService.createBarber({
          email: 'barber@test.com',
          password: 'SecurePass1',
          name: 'Juan Barbero',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).code).toBe(ErrorCodes.VALIDATION_ERROR);
      }
    });

    it('should rollback transaction on error', async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue(null);

      const mockClient = await (pool as any).connect();
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockRejectedValueOnce(new Error('DB error')); // INSERT user fails

      await expect(
        adminService.createBarber({
          email: 'barber@test.com',
          password: 'SecurePass1',
          name: 'Juan Barbero',
        })
      ).rejects.toThrow('DB error');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should use default working hours when not provided', async () => {
      vi.mocked(userRepository.findByEmail).mockResolvedValue(null);

      const mockClient = await (pool as any).connect();
      mockClient.query
        .mockResolvedValueOnce(undefined) // BEGIN
        .mockResolvedValueOnce({
          rows: [{
            id: 'user-uuid-1',
            email: 'barber@test.com',
            password_hash: 'hash',
            name: 'Juan',
            phone: null,
            role: 'barber',
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
          }],
        }) // INSERT user
        .mockResolvedValueOnce({ rows: [{ id: 'profile-uuid-1' }] }) // INSERT barber_profile
        .mockResolvedValueOnce(undefined); // COMMIT

      await adminService.createBarber({
        email: 'barber@test.com',
        password: 'SecurePass1',
        name: 'Juan',
      });

      // Verify the INSERT for barber_profiles includes default working hours
      const insertProfileCall = mockClient.query.mock.calls[2];
      const workingHoursArg = insertProfileCall[1][2];
      const parsed = JSON.parse(workingHoursArg);
      expect(parsed.mon).toEqual({ start: '09:00', end: '18:00' });
      expect(parsed.sat).toEqual({ start: '09:00', end: '14:00' });
    });
  });

  describe('listBarbers', () => {
    it('should return all active barbers with their profiles', async () => {
      const mockRows = [
        {
          id: 'profile-1',
          user_id: 'user-1',
          email: 'barber1@test.com',
          name: 'Barbero Uno',
          phone: '+5491155551111',
          specialty: 'Corte clásico',
          working_hours: { mon: { start: '09:00', end: '18:00' } },
          is_available: true,
        },
        {
          id: 'profile-2',
          user_id: 'user-2',
          email: 'barber2@test.com',
          name: 'Barbero Dos',
          phone: null,
          specialty: null,
          working_hours: { mon: { start: '10:00', end: '17:00' } },
          is_available: true,
        },
      ];

      vi.mocked(pool.query).mockResolvedValue({ rows: mockRows } as any);

      const result = await adminService.listBarbers();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'profile-1',
        userId: 'user-1',
        email: 'barber1@test.com',
        name: 'Barbero Uno',
        phone: '+5491155551111',
        specialty: 'Corte clásico',
        workingHours: { mon: { start: '09:00', end: '18:00' } },
        isAvailable: true,
      });
      expect(result[1]).toEqual({
        id: 'profile-2',
        userId: 'user-2',
        email: 'barber2@test.com',
        name: 'Barbero Dos',
        phone: undefined,
        specialty: null,
        workingHours: { mon: { start: '10:00', end: '17:00' } },
        isAvailable: true,
      });
    });

    it('should return empty array when no barbers exist', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: [] } as any);

      const result = await adminService.listBarbers();

      expect(result).toEqual([]);
    });

    it('should query with JOIN on users table and filter active users', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: [] } as any);

      await adminService.listBarbers();

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('JOIN users u ON u.id = bp.user_id')
      );
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE u.is_active = true')
      );
    });
  });
});

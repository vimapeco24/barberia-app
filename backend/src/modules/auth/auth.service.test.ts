import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { authService } from './auth.service';
import { AppError, ErrorCodes } from '../../shared/errors';

// Mock bcrypt
const mockBcryptCompare = vi.fn();
const mockBcryptHash = vi.fn().mockResolvedValue('$2b$12$hashedpassword');

vi.mock('bcrypt', () => ({
  default: {
    compare: (...args: unknown[]) => mockBcryptCompare(...args),
    hash: (...args: unknown[]) => mockBcryptHash(...args),
  },
}));

// Mock dependencies
vi.mock('../../config/env', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-key-for-testing',
    JWT_REFRESH_SECRET: 'test-jwt-refresh-secret-key-for-testing',
    JWT_ACCESS_EXPIRATION: '15m',
    JWT_REFRESH_EXPIRATION: '7d',
  },
}));

vi.mock('../../config/database', () => ({
  pool: {
    query: vi.fn(),
  },
}));

const mockRedisClient = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
};

vi.mock('../../config/redis', () => ({
  redisClient: {
    get: (...args: unknown[]) => mockRedisClient.get(...args),
    set: (...args: unknown[]) => mockRedisClient.set(...args),
    del: (...args: unknown[]) => mockRedisClient.del(...args),
  },
}));

const mockUserRepository = {
  findByEmail: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  updateLastLogin: vi.fn(),
};

vi.mock('./user.repository', () => ({
  userRepository: {
    findByEmail: (...args: unknown[]) => mockUserRepository.findByEmail(...args),
    findById: (...args: unknown[]) => mockUserRepository.findById(...args),
    create: (...args: unknown[]) => mockUserRepository.create(...args),
    updateLastLogin: (...args: unknown[]) => mockUserRepository.updateLastLogin(...args),
  },
}));

const mockLoginAttemptRepository = {
  create: vi.fn(),
  countRecentFailed: vi.fn(),
};

vi.mock('./login-attempt.repository', () => ({
  loginAttemptRepository: {
    create: (...args: unknown[]) => mockLoginAttemptRepository.create(...args),
    countRecentFailed: (...args: unknown[]) => mockLoginAttemptRepository.countRecentFailed(...args),
  },
}));

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('register', () => {
    const validRegisterData = {
      email: 'newuser@example.com',
      password: 'Password1',
      name: 'John Doe',
      phone: '+1234567890',
    };

    it('should register a new client successfully', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue({
        id: 'user-uuid-123',
        email: validRegisterData.email,
        password_hash: '$2b$12$hashedpassword',
        name: validRegisterData.name,
        phone: validRegisterData.phone,
        role: 'client',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await authService.register(validRegisterData);

      expect(result.user.email).toBe(validRegisterData.email);
      expect(result.user.name).toBe(validRegisterData.name);
      expect(result.user.phone).toBe(validRegisterData.phone);
      expect(result.user.role).toBe('client');
      expect(result.user.isActive).toBe(true);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(typeof result.accessToken).toBe('string');
      expect(typeof result.refreshToken).toBe('string');
    });

    it('should hash the password with bcrypt', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue({
        id: 'user-uuid-123',
        email: validRegisterData.email,
        password_hash: '$2b$12$hashedpassword',
        name: validRegisterData.name,
        phone: validRegisterData.phone,
        role: 'client',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await authService.register(validRegisterData);

      expect(mockBcryptHash).toHaveBeenCalledWith(validRegisterData.password, 12);
    });

    it('should throw VALIDATION_ERROR when email already exists', async () => {
      mockUserRepository.findByEmail.mockResolvedValue({
        id: 'existing-user-id',
        email: validRegisterData.email,
        password_hash: 'some-hash',
        name: 'Existing User',
        phone: null,
        role: 'client',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await expect(authService.register(validRegisterData)).rejects.toThrow(AppError);
      await expect(authService.register(validRegisterData)).rejects.toMatchObject({
        code: ErrorCodes.VALIDATION_ERROR,
      });
    });

    it('should generate valid JWT access and refresh tokens', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue({
        id: 'user-uuid-123',
        email: validRegisterData.email,
        password_hash: '$2b$12$hashedpassword',
        name: validRegisterData.name,
        phone: validRegisterData.phone,
        role: 'client',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await authService.register(validRegisterData);

      // JWT tokens have 3 parts separated by dots
      expect(result.accessToken.split('.')).toHaveLength(3);
      expect(result.refreshToken.split('.')).toHaveLength(3);
    });

    it('should register without phone (optional field)', async () => {
      const dataWithoutPhone = {
        email: 'nophone@example.com',
        password: 'Password1',
        name: 'No Phone User',
      };

      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue({
        id: 'user-uuid-456',
        email: dataWithoutPhone.email,
        password_hash: '$2b$12$hashedpassword',
        name: dataWithoutPhone.name,
        phone: null,
        role: 'client',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await authService.register(dataWithoutPhone);

      expect(result.user.email).toBe(dataWithoutPhone.email);
      expect(result.user.phone).toBeUndefined();
    });

    it('should always create users with role client', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue({
        id: 'user-uuid-789',
        email: validRegisterData.email,
        password_hash: '$2b$12$hashedpassword',
        name: validRegisterData.name,
        phone: validRegisterData.phone,
        role: 'client',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await authService.register(validRegisterData);

      const createCall = mockUserRepository.create.mock.calls[0][0];
      expect(createCall.role).toBe('client');
    });
  });

  describe('login', () => {
    const validLoginData = {
      email: 'user@example.com',
      password: 'Password1',
    };

    const mockUser = {
      id: 'user-uuid-123',
      email: 'user@example.com',
      password_hash: '$2b$12$LJ3m4sMKfRzlTEhTdSqGaOQZpGBsEbVqJJ1nKMvHPxFCz5FZyXwHe',
      name: 'Test User',
      phone: '+1234567890',
      role: 'client' as const,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    beforeEach(() => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.del.mockResolvedValue(1);
      mockLoginAttemptRepository.create.mockResolvedValue({});
      mockLoginAttemptRepository.countRecentFailed.mockResolvedValue(0);
      mockUserRepository.updateLastLogin.mockResolvedValue(undefined);
    });

    it('should login successfully with correct credentials', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockBcryptCompare.mockResolvedValue(true);

      const result = await authService.login(validLoginData);

      expect(result.user.email).toBe(validLoginData.email);
      expect(result.user.role).toBe('client');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.accessToken.split('.')).toHaveLength(3);
      expect(result.refreshToken.split('.')).toHaveLength(3);
    });

    it('should record successful login attempt', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockBcryptCompare.mockResolvedValue(true);

      await authService.login(validLoginData, '192.168.1.1');

      expect(mockLoginAttemptRepository.create).toHaveBeenCalledWith({
        user_id: mockUser.id,
        email: validLoginData.email,
        success: true,
        ip_address: '192.168.1.1',
      });
    });

    it('should delete Redis lock key on successful login', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockBcryptCompare.mockResolvedValue(true);

      await authService.login(validLoginData);

      expect(mockRedisClient.del).toHaveBeenCalledWith('account_lock:user@example.com');
    });

    it('should throw INVALID_CREDENTIALS when user not found (generic message)', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      await expect(authService.login(validLoginData)).rejects.toThrow(AppError);
      await expect(authService.login(validLoginData)).rejects.toMatchObject({
        code: ErrorCodes.INVALID_CREDENTIALS,
      });
    });

    it('should throw INVALID_CREDENTIALS when password is wrong (generic message)', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockBcryptCompare.mockResolvedValue(false);

      await expect(authService.login(validLoginData)).rejects.toThrow(AppError);
      await expect(authService.login(validLoginData)).rejects.toMatchObject({
        code: ErrorCodes.INVALID_CREDENTIALS,
      });
    });

    it('should record failed login attempt when user not found', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      await expect(authService.login(validLoginData, '10.0.0.1')).rejects.toThrow();

      expect(mockLoginAttemptRepository.create).toHaveBeenCalledWith({
        user_id: null,
        email: validLoginData.email,
        success: false,
        ip_address: '10.0.0.1',
      });
    });

    it('should record failed login attempt when password is wrong', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockBcryptCompare.mockResolvedValue(false);

      await expect(authService.login(validLoginData, '10.0.0.1')).rejects.toThrow();

      expect(mockLoginAttemptRepository.create).toHaveBeenCalledWith({
        user_id: mockUser.id,
        email: validLoginData.email,
        success: false,
        ip_address: '10.0.0.1',
      });
    });

    it('should throw ACCOUNT_LOCKED when account is already locked in Redis', async () => {
      mockRedisClient.get.mockResolvedValue('1');

      await expect(authService.login(validLoginData)).rejects.toThrow(AppError);
      await expect(authService.login(validLoginData)).rejects.toMatchObject({
        code: ErrorCodes.ACCOUNT_LOCKED,
      });
    });

    it('should not check user or password when account is locked', async () => {
      mockRedisClient.get.mockResolvedValue('1');

      await expect(authService.login(validLoginData)).rejects.toThrow();

      expect(mockUserRepository.findByEmail).not.toHaveBeenCalled();
    });

    it('should lock account after 5 failed attempts (user not found)', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockLoginAttemptRepository.countRecentFailed.mockResolvedValue(5);

      await expect(authService.login(validLoginData)).rejects.toMatchObject({
        code: ErrorCodes.ACCOUNT_LOCKED,
      });

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'account_lock:user@example.com',
        '1',
        { EX: 15 * 60 }
      );
    });

    it('should lock account after 5 failed attempts (wrong password)', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockBcryptCompare.mockResolvedValue(false);
      mockLoginAttemptRepository.countRecentFailed.mockResolvedValue(5);

      await expect(authService.login(validLoginData)).rejects.toMatchObject({
        code: ErrorCodes.ACCOUNT_LOCKED,
      });

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'account_lock:user@example.com',
        '1',
        { EX: 15 * 60 }
      );
    });

    it('should not lock account when failed attempts are below threshold', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockBcryptCompare.mockResolvedValue(false);
      mockLoginAttemptRepository.countRecentFailed.mockResolvedValue(3);

      await expect(authService.login(validLoginData)).rejects.toMatchObject({
        code: ErrorCodes.INVALID_CREDENTIALS,
      });

      expect(mockRedisClient.set).not.toHaveBeenCalled();
    });

    it('should update last login timestamp on successful login', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);
      mockBcryptCompare.mockResolvedValue(true);

      await authService.login(validLoginData);

      expect(mockUserRepository.updateLastLogin).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('refreshToken', () => {
    const mockUser = {
      id: 'user-uuid-123',
      email: 'user@example.com',
      password_hash: '$2b$12$hashedpassword',
      name: 'Test User',
      phone: '+1234567890',
      role: 'client' as const,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    function createValidRefreshToken() {
      return jwt.sign(
        { sub: mockUser.id, email: mockUser.email, role: mockUser.role },
        'test-jwt-refresh-secret-key-for-testing',
        { expiresIn: '7d' }
      );
    }

    beforeEach(() => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.del.mockResolvedValue(1);
    });

    it('should return new access and refresh tokens for a valid refresh token', async () => {
      const validToken = createValidRefreshToken();
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await authService.refreshToken(validToken);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.accessToken.split('.')).toHaveLength(3);
      expect(result.refreshToken.split('.')).toHaveLength(3);
    });

    it('should return user profile in the response', async () => {
      const validToken = createValidRefreshToken();
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await authService.refreshToken(validToken);

      expect(result.user.id).toBe(mockUser.id);
      expect(result.user.email).toBe(mockUser.email);
      expect(result.user.name).toBe(mockUser.name);
      expect(result.user.role).toBe(mockUser.role);
    });

    it('should blacklist the old refresh token in Redis', async () => {
      const validToken = createValidRefreshToken();
      mockUserRepository.findById.mockResolvedValue(mockUser);

      await authService.refreshToken(validToken);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `blacklist:${validToken}`,
        '1',
        expect.objectContaining({ EX: expect.any(Number) })
      );
    });

    it('should store new session in Redis', async () => {
      const validToken = createValidRefreshToken();
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await authService.refreshToken(validToken);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `session:${mockUser.id}:${result.refreshToken}`,
        '1',
        expect.objectContaining({ EX: expect.any(Number) })
      );
    });

    it('should throw TOKEN_INVALID when refresh token is blacklisted', async () => {
      const validToken = createValidRefreshToken();
      mockRedisClient.get.mockResolvedValue('1');

      await expect(authService.refreshToken(validToken)).rejects.toMatchObject({
        code: ErrorCodes.TOKEN_INVALID,
      });
    });

    it('should throw TOKEN_EXPIRED when refresh token is expired', async () => {
      const expiredToken = jwt.sign(
        { sub: mockUser.id, email: mockUser.email, role: mockUser.role },
        'test-jwt-refresh-secret-key-for-testing',
        { expiresIn: '0s' }
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      await expect(authService.refreshToken(expiredToken)).rejects.toMatchObject({
        code: ErrorCodes.TOKEN_EXPIRED,
      });
    });

    it('should throw TOKEN_INVALID when refresh token has invalid signature', async () => {
      const invalidToken = jwt.sign(
        { sub: mockUser.id, email: mockUser.email, role: mockUser.role },
        'wrong-secret-key',
        { expiresIn: '7d' }
      );

      await expect(authService.refreshToken(invalidToken)).rejects.toMatchObject({
        code: ErrorCodes.TOKEN_INVALID,
      });
    });

    it('should throw TOKEN_INVALID when user no longer exists', async () => {
      const validToken = createValidRefreshToken();
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(authService.refreshToken(validToken)).rejects.toMatchObject({
        code: ErrorCodes.TOKEN_INVALID,
      });
    });

    it('should throw TOKEN_INVALID when user is inactive', async () => {
      const validToken = createValidRefreshToken();
      mockUserRepository.findById.mockResolvedValue({ ...mockUser, is_active: false });

      await expect(authService.refreshToken(validToken)).rejects.toMatchObject({
        code: ErrorCodes.TOKEN_INVALID,
      });
    });
  });

  describe('logout', () => {
    const mockUser = {
      id: 'user-uuid-123',
      email: 'user@example.com',
      role: 'client' as const,
    };

    function createValidRefreshToken() {
      return jwt.sign(
        { sub: mockUser.id, email: mockUser.email, role: mockUser.role },
        'test-jwt-refresh-secret-key-for-testing',
        { expiresIn: '7d' }
      );
    }

    beforeEach(() => {
      mockRedisClient.set.mockResolvedValue('OK');
      mockRedisClient.del.mockResolvedValue(1);
    });

    it('should blacklist the refresh token in Redis with correct TTL', async () => {
      const validToken = createValidRefreshToken();

      await authService.logout(validToken);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `blacklist:${validToken}`,
        '1',
        expect.objectContaining({ EX: expect.any(Number) })
      );

      const setCall = mockRedisClient.set.mock.calls[0];
      const ttl = setCall[2].EX;
      expect(ttl).toBeGreaterThan(604700);
      expect(ttl).toBeLessThanOrEqual(604800);
    });

    it('should remove the session tracking key from Redis', async () => {
      const validToken = createValidRefreshToken();

      await authService.logout(validToken);

      expect(mockRedisClient.del).toHaveBeenCalledWith(
        `session:${mockUser.id}:${validToken}`
      );
    });

    it('should handle expired tokens gracefully', async () => {
      const expiredToken = jwt.sign(
        { sub: mockUser.id, email: mockUser.email, role: mockUser.role },
        'test-jwt-refresh-secret-key-for-testing',
        { expiresIn: '0s' }
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      await expect(authService.logout(expiredToken)).resolves.toBeUndefined();
    });

    it('should blacklist with max TTL when token cannot be decoded', async () => {
      const malformedToken = 'not-a-valid-jwt-token';

      await authService.logout(malformedToken);

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `blacklist:${malformedToken}`,
        '1',
        { EX: 7 * 24 * 60 * 60 }
      );
    });
  });
});

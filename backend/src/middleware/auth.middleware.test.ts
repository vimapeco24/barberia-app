import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { authMiddleware, AuthenticatedRequest } from './auth.middleware';
import { ErrorCodes } from '../shared/errors';

// Mock dependencies
vi.mock('../config/env', () => ({
  env: {
    JWT_SECRET: 'test-secret-key',
  },
}));

vi.mock('../modules/auth/user.repository', () => ({
  userRepository: {
    findById: vi.fn(),
  },
}));

import { userRepository } from '../modules/auth/user.repository';

const mockFindById = vi.mocked(userRepository.findById);

function createMockRequest(authHeader?: string): Partial<Request> {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
  };
}

function createMockResponse(): Partial<Response> {
  return {};
}

describe('authMiddleware', () => {
  const next = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return TOKEN_MISSING when no Authorization header is present', async () => {
    const req = createMockRequest();
    const res = createMockResponse();

    await authMiddleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: ErrorCodes.TOKEN_MISSING })
    );
  });

  it('should return TOKEN_MISSING when Authorization header does not start with Bearer', async () => {
    const req = createMockRequest('Basic some-token');
    const res = createMockResponse();

    await authMiddleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: ErrorCodes.TOKEN_MISSING })
    );
  });

  it('should return TOKEN_MISSING when Bearer token is empty', async () => {
    const req = createMockRequest('Bearer ');
    const res = createMockResponse();

    await authMiddleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: ErrorCodes.TOKEN_MISSING })
    );
  });

  it('should return TOKEN_EXPIRED when token has expired', async () => {
    const expiredToken = jwt.sign(
      { sub: 'user-123', email: 'test@example.com', role: 'client' },
      'test-secret-key',
      { expiresIn: '-1s' }
    );
    const req = createMockRequest(`Bearer ${expiredToken}`);
    const res = createMockResponse();

    await authMiddleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: ErrorCodes.TOKEN_EXPIRED })
    );
  });

  it('should return TOKEN_INVALID when token has wrong signature', async () => {
    const invalidToken = jwt.sign(
      { sub: 'user-123', email: 'test@example.com', role: 'client' },
      'wrong-secret-key',
      { expiresIn: '15m' }
    );
    const req = createMockRequest(`Bearer ${invalidToken}`);
    const res = createMockResponse();

    await authMiddleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: ErrorCodes.TOKEN_INVALID })
    );
  });

  it('should return TOKEN_INVALID when token is malformed', async () => {
    const req = createMockRequest('Bearer not-a-valid-jwt-token');
    const res = createMockResponse();

    await authMiddleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: ErrorCodes.TOKEN_INVALID })
    );
  });

  it('should return TOKEN_INVALID when token payload is missing required fields', async () => {
    const incompleteToken = jwt.sign(
      { sub: 'user-123' },
      'test-secret-key',
      { expiresIn: '15m' }
    );
    const req = createMockRequest(`Bearer ${incompleteToken}`);
    const res = createMockResponse();

    await authMiddleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: ErrorCodes.TOKEN_INVALID })
    );
  });

  it('should return TOKEN_INVALID when user does not exist', async () => {
    mockFindById.mockResolvedValue(null);

    const validToken = jwt.sign(
      { sub: 'nonexistent-user', email: 'test@example.com', role: 'client' },
      'test-secret-key',
      { expiresIn: '15m' }
    );
    const req = createMockRequest(`Bearer ${validToken}`);
    const res = createMockResponse();

    await authMiddleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: ErrorCodes.TOKEN_INVALID })
    );
  });

  it('should return TOKEN_INVALID when user is inactive', async () => {
    mockFindById.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
      password_hash: 'hash',
      name: 'Test User',
      phone: null,
      role: 'client',
      is_active: false,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const validToken = jwt.sign(
      { sub: 'user-123', email: 'test@example.com', role: 'client' },
      'test-secret-key',
      { expiresIn: '15m' }
    );
    const req = createMockRequest(`Bearer ${validToken}`);
    const res = createMockResponse();

    await authMiddleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: ErrorCodes.TOKEN_INVALID })
    );
  });

  it('should attach user to request and call next() on valid token with active user', async () => {
    mockFindById.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
      password_hash: 'hash',
      name: 'Test User',
      phone: null,
      role: 'client',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const validToken = jwt.sign(
      { sub: 'user-123', email: 'test@example.com', role: 'client' },
      'test-secret-key',
      { expiresIn: '15m' }
    );
    const req = createMockRequest(`Bearer ${validToken}`);
    const res = createMockResponse();

    await authMiddleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith();
    const authenticatedReq = req as AuthenticatedRequest;
    expect(authenticatedReq.user).toEqual({
      id: 'user-123',
      email: 'test@example.com',
      role: 'client',
    });
  });

  it('should work with barber role', async () => {
    mockFindById.mockResolvedValue({
      id: 'barber-456',
      email: 'barber@example.com',
      password_hash: 'hash',
      name: 'Barber User',
      phone: '123456789',
      role: 'barber',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const validToken = jwt.sign(
      { sub: 'barber-456', email: 'barber@example.com', role: 'barber' },
      'test-secret-key',
      { expiresIn: '15m' }
    );
    const req = createMockRequest(`Bearer ${validToken}`);
    const res = createMockResponse();

    await authMiddleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledWith();
    const authenticatedReq = req as AuthenticatedRequest;
    expect(authenticatedReq.user).toEqual({
      id: 'barber-456',
      email: 'barber@example.com',
      role: 'barber',
    });
  });
});

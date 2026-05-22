import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Response } from 'express';
import { authorize } from './role.middleware';
import { AuthenticatedRequest } from './auth.middleware';
import { ErrorCodes } from '../shared/errors';

function createMockAuthenticatedRequest(role: string): Partial<AuthenticatedRequest> {
  return {
    user: {
      id: 'user-123',
      email: 'test@example.com',
      role: role as 'client' | 'barber' | 'admin',
    },
  };
}

function createMockRequestWithoutUser(): Partial<AuthenticatedRequest> {
  return {};
}

function createMockResponse(): Partial<Response> {
  return {};
}

describe('authorize middleware', () => {
  const next = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call next() when user role is in the allowed roles', () => {
    const req = createMockAuthenticatedRequest('client');
    const res = createMockResponse();
    const middleware = authorize('client');

    middleware(req as AuthenticatedRequest, res as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should call next() when user role matches one of multiple allowed roles', () => {
    const req = createMockAuthenticatedRequest('barber');
    const res = createMockResponse();
    const middleware = authorize('client', 'barber');

    middleware(req as AuthenticatedRequest, res as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should return INSUFFICIENT_PERMISSIONS when user role is not in allowed roles', () => {
    const req = createMockAuthenticatedRequest('client');
    const res = createMockResponse();
    const middleware = authorize('admin');

    middleware(req as AuthenticatedRequest, res as Response, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: ErrorCodes.INSUFFICIENT_PERMISSIONS })
    );
  });

  it('should return INSUFFICIENT_PERMISSIONS when barber tries to access client-only endpoint', () => {
    const req = createMockAuthenticatedRequest('barber');
    const res = createMockResponse();
    const middleware = authorize('client');

    middleware(req as AuthenticatedRequest, res as Response, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: ErrorCodes.INSUFFICIENT_PERMISSIONS })
    );
  });

  it('should return INSUFFICIENT_PERMISSIONS when client tries to access admin-only endpoint', () => {
    const req = createMockAuthenticatedRequest('client');
    const res = createMockResponse();
    const middleware = authorize('admin');

    middleware(req as AuthenticatedRequest, res as Response, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: ErrorCodes.INSUFFICIENT_PERMISSIONS })
    );
  });

  it('should return INSUFFICIENT_PERMISSIONS when req.user is undefined', () => {
    const req = createMockRequestWithoutUser();
    const res = createMockResponse();
    const middleware = authorize('client');

    middleware(req as AuthenticatedRequest, res as Response, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: ErrorCodes.INSUFFICIENT_PERMISSIONS })
    );
  });

  it('should allow admin to access admin-only endpoint', () => {
    const req = createMockAuthenticatedRequest('admin');
    const res = createMockResponse();
    const middleware = authorize('admin');

    middleware(req as AuthenticatedRequest, res as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('should allow access when all roles are permitted', () => {
    const req = createMockAuthenticatedRequest('barber');
    const res = createMockResponse();
    const middleware = authorize('client', 'barber', 'admin');

    middleware(req as AuthenticatedRequest, res as Response, next);

    expect(next).toHaveBeenCalledWith();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { authRouter } from './auth.routes';
import { ErrorCodes } from '../../shared/errors';

// Mock dependencies
vi.mock('./auth.service', () => ({
  authService: {
    register: vi.fn(),
    login: vi.fn(),
    refreshToken: vi.fn(),
    logout: vi.fn(),
  },
}));

vi.mock('../../middleware/auth.middleware', () => ({
  authMiddleware: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
}));

vi.mock('../../config/env', () => ({
  env: {
    JWT_SECRET: 'test-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
  },
}));

vi.mock('./user.repository', () => ({
  userRepository: {
    findByEmail: vi.fn(),
    findById: vi.fn(),
  },
}));

import { authService } from './auth.service';

const mockRegister = vi.mocked(authService.register);
const mockLogin = vi.mocked(authService.login);
const mockRefreshToken = vi.mocked(authService.refreshToken);
const mockLogout = vi.mocked(authService.logout);

/**
 * Helper to find a route handler from the router stack.
 */
function findRouteHandler(method: string, path: string) {
  const layer = (authRouter as any).stack.find(
    (l: any) => l.route?.path === path && l.route?.methods[method]
  );
  return layer?.route?.stack;
}

/**
 * Helper to execute route handlers in sequence (simulating Express).
 * Returns null if no error was passed to next(), or the error object if one was.
 */
async function executeRoute(handlers: any[], req: Partial<Request>, res: Partial<Response>) {
  let error: any = null;
  let errorCalled = false;
  const next: NextFunction = (err?: any) => {
    if (err) {
      error = err;
      errorCalled = true;
    }
  };

  for (const handler of handlers) {
    if (errorCalled) break;
    await handler.handle(req as Request, res as Response, next);
  }

  return error;
}

function createMockResponse(): Partial<Response> & { statusCode?: number; body?: any } {
  const res: any = {
    statusCode: undefined,
    body: undefined,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: any) {
      res.body = data;
      return res;
    },
  };
  return res;
}

describe('Auth Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /register', () => {
    it('should have a register route', () => {
      const handlers = findRouteHandler('post', '/register');
      expect(handlers).toBeDefined();
      expect(handlers.length).toBeGreaterThan(0);
    });

    it('should return 400 for invalid registration data (missing fields)', async () => {
      const handlers = findRouteHandler('post', '/register');
      const req: Partial<Request> = { body: {} };
      const res = createMockResponse();

      const error = await executeRoute(handlers, req, res);

      expect(error).toBeDefined();
      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR);
      expect(error.details).toBeDefined();
    });

    it('should return 400 for invalid email format', async () => {
      const handlers = findRouteHandler('post', '/register');
      const req: Partial<Request> = {
        body: {
          email: 'not-an-email',
          password: 'Password1',
          name: 'Test User',
        },
      };
      const res = createMockResponse();

      const error = await executeRoute(handlers, req, res);

      expect(error).toBeDefined();
      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR);
      expect(error.details?.email).toBeDefined();
    });

    it('should return 400 for weak password', async () => {
      const handlers = findRouteHandler('post', '/register');
      const req: Partial<Request> = {
        body: {
          email: 'test@example.com',
          password: 'weak',
          name: 'Test User',
        },
      };
      const res = createMockResponse();

      const error = await executeRoute(handlers, req, res);

      expect(error).toBeDefined();
      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR);
      expect(error.details?.password).toBeDefined();
    });

    it('should return 201 with auth response on successful registration', async () => {
      const mockResult = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'client' as const,
          isActive: true,
        },
      };
      mockRegister.mockResolvedValue(mockResult);

      const handlers = findRouteHandler('post', '/register');
      const req: Partial<Request> = {
        body: {
          email: 'test@example.com',
          password: 'Password1',
          name: 'Test User',
        },
      };
      const res = createMockResponse();

      const error = await executeRoute(handlers, req, res);

      expect(error).toBeNull();
      expect(res.statusCode).toBe(201);
      expect(res.body).toEqual({ success: true, data: mockResult });
    });
  });

  describe('POST /login', () => {
    it('should have a login route', () => {
      const handlers = findRouteHandler('post', '/login');
      expect(handlers).toBeDefined();
      expect(handlers.length).toBeGreaterThan(0);
    });

    it('should return 400 for missing credentials', async () => {
      const handlers = findRouteHandler('post', '/login');
      const req: Partial<Request> = { body: {} };
      const res = createMockResponse();

      const error = await executeRoute(handlers, req, res);

      expect(error).toBeDefined();
      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR);
    });

    it('should return 200 with auth response on successful login', async () => {
      const mockResult = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'client' as const,
          isActive: true,
        },
      };
      mockLogin.mockResolvedValue(mockResult);

      const handlers = findRouteHandler('post', '/login');
      const req: Partial<Request> = {
        body: {
          email: 'test@example.com',
          password: 'Password1',
        },
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' } as any,
      };
      const res = createMockResponse();

      const error = await executeRoute(handlers, req, res);

      expect(error).toBeNull();
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ success: true, data: mockResult });
    });
  });

  describe('POST /refresh', () => {
    it('should have a refresh route', () => {
      const handlers = findRouteHandler('post', '/refresh');
      expect(handlers).toBeDefined();
    });

    it('should require authMiddleware', () => {
      const layer = (authRouter as any).stack.find(
        (l: any) => l.route?.path === '/refresh' && l.route?.methods.post
      );
      // The route should have at least 2 handlers (authMiddleware + handler)
      expect(layer.route.stack.length).toBeGreaterThanOrEqual(2);
    });

    it('should return 400 for missing refreshToken in body', async () => {
      const handlers = findRouteHandler('post', '/refresh');
      const req: Partial<Request> = {
        body: {},
        headers: { authorization: 'Bearer valid-token' },
      };
      const res = createMockResponse();

      const error = await executeRoute(handlers, req, res);

      expect(error).toBeDefined();
      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR);
    });

    it('should return 200 with new tokens on successful refresh', async () => {
      const mockResult = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        user: {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
          role: 'client' as const,
          isActive: true,
        },
      };
      mockRefreshToken.mockResolvedValue(mockResult);

      const handlers = findRouteHandler('post', '/refresh');
      const req: Partial<Request> = {
        body: { refreshToken: 'old-refresh-token' },
        headers: { authorization: 'Bearer valid-token' },
      };
      const res = createMockResponse();

      const error = await executeRoute(handlers, req, res);

      expect(error).toBeNull();
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ success: true, data: mockResult });
    });
  });

  describe('POST /logout', () => {
    it('should have a logout route', () => {
      const handlers = findRouteHandler('post', '/logout');
      expect(handlers).toBeDefined();
    });

    it('should require authMiddleware', () => {
      const layer = (authRouter as any).stack.find(
        (l: any) => l.route?.path === '/logout' && l.route?.methods.post
      );
      expect(layer.route.stack.length).toBeGreaterThanOrEqual(2);
    });

    it('should return 400 for missing refreshToken in body', async () => {
      const handlers = findRouteHandler('post', '/logout');
      const req: Partial<Request> = {
        body: {},
        headers: { authorization: 'Bearer valid-token' },
      };
      const res = createMockResponse();

      const error = await executeRoute(handlers, req, res);

      expect(error).toBeDefined();
      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR);
    });

    it('should return 200 with success message on logout', async () => {
      mockLogout.mockResolvedValue(undefined);

      const handlers = findRouteHandler('post', '/logout');
      const req: Partial<Request> = {
        body: { refreshToken: 'some-refresh-token' },
        headers: { authorization: 'Bearer valid-token' },
      };
      const res = createMockResponse();

      const error = await executeRoute(handlers, req, res);

      expect(error).toBeNull();
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: { message: 'Sesión cerrada exitosamente' },
      });
    });
  });
});

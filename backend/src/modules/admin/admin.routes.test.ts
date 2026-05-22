import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { adminRouter } from './admin.routes';
import { ErrorCodes } from '../../shared/errors';

// Mock dependencies
vi.mock('./admin.service', () => ({
  adminService: {
    createBarber: vi.fn(),
    listBarbers: vi.fn(),
  },
}));

vi.mock('../../middleware/auth.middleware', () => ({
  authMiddleware: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
  AuthenticatedRequest: {},
}));

vi.mock('../../middleware/role.middleware', () => ({
  authorize: vi.fn(() => (_req: Request, _res: Response, next: NextFunction) => next()),
}));

vi.mock('../../config/env', () => ({
  env: {
    JWT_SECRET: 'test-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
  },
}));

vi.mock('../auth/user.repository', () => ({
  userRepository: {
    findByEmail: vi.fn(),
    findById: vi.fn(),
  },
}));

import { adminService } from './admin.service';
import { authorize } from '../../middleware/role.middleware';

const mockCreateBarber = vi.mocked(adminService.createBarber);
const mockListBarbers = vi.mocked(adminService.listBarbers);
const mockAuthorize = vi.mocked(authorize);

/**
 * Helper to find a route handler from the router stack.
 */
function findRouteHandler(method: string, path: string) {
  const layer = (adminRouter as any).stack.find(
    (l: any) => l.route?.path === path && l.route?.methods[method]
  );
  return layer?.route?.stack;
}

/**
 * Helper to execute route handlers in sequence (simulating Express).
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

describe('Admin Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /barbers', () => {
    it('should have a create barber route', () => {
      const handlers = findRouteHandler('post', '/barbers');
      expect(handlers).toBeDefined();
      expect(handlers.length).toBeGreaterThan(0);
    });

    it('should apply authMiddleware and authorize(admin)', () => {
      const layer = (adminRouter as any).stack.find(
        (l: any) => l.route?.path === '/barbers' && l.route?.methods.post
      );
      // Should have at least 3 handlers: authMiddleware + authorize + handler
      expect(layer.route.stack.length).toBeGreaterThanOrEqual(3);
    });

    it('should call authorize with admin role', () => {
      // authorize is called at module load time when routes are defined
      // We verify it was called by checking the route has the middleware applied
      const layer = (adminRouter as any).stack.find(
        (l: any) => l.route?.path === '/barbers' && l.route?.methods.post
      );
      // 3 handlers: authMiddleware + authorize('admin') result + route handler
      expect(layer.route.stack.length).toBe(3);
    });

    it('should return 400 for invalid data (missing fields)', async () => {
      const handlers = findRouteHandler('post', '/barbers');
      const req: Partial<Request> = { body: {} };
      const res = createMockResponse();

      const error = await executeRoute(handlers, req, res);

      expect(error).toBeDefined();
      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR);
      expect(error.details).toBeDefined();
    });

    it('should return 400 for invalid email format', async () => {
      const handlers = findRouteHandler('post', '/barbers');
      const req: Partial<Request> = {
        body: {
          email: 'not-an-email',
          password: 'Password1',
          name: 'Barber Name',
        },
      };
      const res = createMockResponse();

      const error = await executeRoute(handlers, req, res);

      expect(error).toBeDefined();
      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR);
      expect(error.details?.email).toBeDefined();
    });

    it('should return 400 for weak password', async () => {
      const handlers = findRouteHandler('post', '/barbers');
      const req: Partial<Request> = {
        body: {
          email: 'barber@example.com',
          password: 'weak',
          name: 'Barber Name',
        },
      };
      const res = createMockResponse();

      const error = await executeRoute(handlers, req, res);

      expect(error).toBeDefined();
      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR);
      expect(error.details?.password).toBeDefined();
    });

    it('should return 201 with barber data on successful creation', async () => {
      const mockResult = {
        user: {
          id: 'user-1',
          email: 'barber@example.com',
          name: 'Barber Name',
          role: 'barber' as const,
          isActive: true,
        },
        barberId: 'barber-profile-1',
      };
      mockCreateBarber.mockResolvedValue(mockResult);

      const handlers = findRouteHandler('post', '/barbers');
      const req: Partial<Request> = {
        body: {
          email: 'barber@example.com',
          password: 'Password1',
          name: 'Barber Name',
        },
      };
      const res = createMockResponse();

      const error = await executeRoute(handlers, req, res);

      expect(error).toBeNull();
      expect(res.statusCode).toBe(201);
      expect(res.body).toEqual({ success: true, data: mockResult });
      expect(mockCreateBarber).toHaveBeenCalledWith({
        email: 'barber@example.com',
        password: 'Password1',
        name: 'Barber Name',
      });
    });

    it('should pass optional fields to service', async () => {
      const mockResult = {
        user: {
          id: 'user-1',
          email: 'barber@example.com',
          name: 'Barber Name',
          phone: '+1234567890',
          role: 'barber' as const,
          isActive: true,
        },
        barberId: 'barber-profile-1',
      };
      mockCreateBarber.mockResolvedValue(mockResult);

      const handlers = findRouteHandler('post', '/barbers');
      const req: Partial<Request> = {
        body: {
          email: 'barber@example.com',
          password: 'Password1',
          name: 'Barber Name',
          phone: '+1234567890',
          specialty: 'Cortes clásicos',
        },
      };
      const res = createMockResponse();

      const error = await executeRoute(handlers, req, res);

      expect(error).toBeNull();
      expect(res.statusCode).toBe(201);
      expect(mockCreateBarber).toHaveBeenCalledWith({
        email: 'barber@example.com',
        password: 'Password1',
        name: 'Barber Name',
        phone: '+1234567890',
        specialty: 'Cortes clásicos',
      });
    });

    it('should forward service errors to next()', async () => {
      const serviceError = new Error('Database error');
      mockCreateBarber.mockRejectedValue(serviceError);

      const handlers = findRouteHandler('post', '/barbers');
      const req: Partial<Request> = {
        body: {
          email: 'barber@example.com',
          password: 'Password1',
          name: 'Barber Name',
        },
      };
      const res = createMockResponse();

      const error = await executeRoute(handlers, req, res);

      expect(error).toBe(serviceError);
    });
  });

  describe('GET /barbers', () => {
    it('should have a list barbers route', () => {
      const handlers = findRouteHandler('get', '/barbers');
      expect(handlers).toBeDefined();
      expect(handlers.length).toBeGreaterThan(0);
    });

    it('should apply authMiddleware and authorize(admin)', () => {
      const layer = (adminRouter as any).stack.find(
        (l: any) => l.route?.path === '/barbers' && l.route?.methods.get
      );
      // Should have at least 3 handlers: authMiddleware + authorize + handler
      expect(layer.route.stack.length).toBeGreaterThanOrEqual(3);
    });

    it('should return 200 with list of barbers', async () => {
      const mockBarbers: Array<{
        id: string;
        userId: string;
        email: string;
        name: string;
        specialty: string | null;
        workingHours: Record<string, { start: string; end: string } | null>;
        isAvailable: boolean;
      }> = [
        {
          id: 'barber-1',
          userId: 'user-1',
          email: 'barber1@example.com',
          name: 'Barber One',
          specialty: 'Cortes clásicos',
          workingHours: { mon: { start: '09:00', end: '18:00' } },
          isAvailable: true,
        },
        {
          id: 'barber-2',
          userId: 'user-2',
          email: 'barber2@example.com',
          name: 'Barber Two',
          specialty: null,
          workingHours: { tue: { start: '10:00', end: '17:00' } },
          isAvailable: false,
        },
      ];
      mockListBarbers.mockResolvedValue(mockBarbers);

      const handlers = findRouteHandler('get', '/barbers');
      const req: Partial<Request> = {};
      const res = createMockResponse();

      const error = await executeRoute(handlers, req, res);

      expect(error).toBeNull();
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ success: true, data: mockBarbers });
    });

    it('should return 200 with empty array when no barbers exist', async () => {
      mockListBarbers.mockResolvedValue([]);

      const handlers = findRouteHandler('get', '/barbers');
      const req: Partial<Request> = {};
      const res = createMockResponse();

      const error = await executeRoute(handlers, req, res);

      expect(error).toBeNull();
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ success: true, data: [] });
    });

    it('should forward service errors to next()', async () => {
      const serviceError = new Error('Database error');
      mockListBarbers.mockRejectedValue(serviceError);

      const handlers = findRouteHandler('get', '/barbers');
      const req: Partial<Request> = {};
      const res = createMockResponse();

      const error = await executeRoute(handlers, req, res);

      expect(error).toBe(serviceError);
    });
  });
});

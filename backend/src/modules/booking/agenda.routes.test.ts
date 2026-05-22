import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { agendaRouter } from './agenda.routes';
import { ErrorCodes } from '../../shared/errors';

// Mock dependencies
vi.mock('./agenda.service', () => ({
  agendaService: {
    getBarberAgenda: vi.fn(),
  },
}));

vi.mock('./barber.repository', () => ({
  barberRepository: {
    findByUserId: vi.fn(),
  },
}));

vi.mock('../../middleware/auth.middleware', () => ({
  authMiddleware: vi.fn((_req: Request, _res: Response, next: NextFunction) => next()),
}));

vi.mock('../../middleware/role.middleware', () => ({
  authorize: vi.fn(() => (_req: Request, _res: Response, next: NextFunction) => next()),
}));

vi.mock('../../config/database', () => ({
  pool: { query: vi.fn(), connect: vi.fn() },
}));

vi.mock('../../config/env', () => ({
  env: {
    JWT_SECRET: 'test-secret',
    JWT_REFRESH_SECRET: 'test-refresh-secret',
  },
}));

import { agendaService } from './agenda.service';
import { barberRepository } from './barber.repository';

const mockGetBarberAgenda = vi.mocked(agendaService.getBarberAgenda);
const mockFindByUserId = vi.mocked(barberRepository.findByUserId);

/**
 * Helper to find a route handler from the router stack.
 */
function findRouteHandler(method: string, path: string) {
  const layer = (agendaRouter as any).stack.find(
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

describe('Agenda Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /barber/agenda (today)', () => {
    it('should have a GET / route', () => {
      const handlers = findRouteHandler('get', '/');
      expect(handlers).toBeDefined();
      expect(handlers.length).toBeGreaterThan(0);
    });

    it('should require authMiddleware and authorize(barber)', () => {
      const layer = (agendaRouter as any).stack.find(
        (l: any) => l.route?.path === '/' && l.route?.methods.get
      );
      // authMiddleware + authorize + handler = at least 3
      expect(layer.route.stack.length).toBeGreaterThanOrEqual(3);
    });

    it('should return 200 with agenda for today', async () => {
      const mockBarberProfile = {
        id: 'barber-profile-1',
        user_id: 'barber-user-1',
        specialty: 'cortes clásicos',
        working_hours: {},
        is_available: true,
      };
      const mockAgenda = [
        {
          bookingId: 'booking-1',
          clientName: 'Carlos López',
          startTime: '10:00:00',
          duration: 30,
          serviceType: 'corte',
          status: 'confirmed' as const,
        },
      ];

      mockFindByUserId.mockResolvedValue(mockBarberProfile);
      mockGetBarberAgenda.mockResolvedValue(mockAgenda);

      const handlers = findRouteHandler('get', '/');
      const req: Partial<Request> = {
        user: { id: 'barber-user-1', email: 'barber@test.com', role: 'barber' },
      } as any;
      const res = createMockResponse();

      const error = await executeRoute(handlers, req, res);

      expect(error).toBeNull();
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ success: true, data: mockAgenda });
      expect(mockFindByUserId).toHaveBeenCalledWith('barber-user-1');
      expect(mockGetBarberAgenda).toHaveBeenCalledWith('barber-profile-1', expect.any(String));
    });

    it('should return error when barber profile not found', async () => {
      mockFindByUserId.mockResolvedValue(null);

      const handlers = findRouteHandler('get', '/');
      const req: Partial<Request> = {
        user: { id: 'barber-user-1', email: 'barber@test.com', role: 'barber' },
      } as any;
      const res = createMockResponse();

      const error = await executeRoute(handlers, req, res);

      expect(error).toBeDefined();
      expect(error.code).toBe(ErrorCodes.INSUFFICIENT_PERMISSIONS);
    });

    it('should forward service errors to next()', async () => {
      mockFindByUserId.mockRejectedValue(new Error('DB error'));

      const handlers = findRouteHandler('get', '/');
      const req: Partial<Request> = {
        user: { id: 'barber-user-1', email: 'barber@test.com', role: 'barber' },
      } as any;
      const res = createMockResponse();

      const error = await executeRoute(handlers, req, res);

      expect(error).toBeDefined();
      expect(error.message).toBe('DB error');
    });
  });

  describe('GET /barber/agenda/:date', () => {
    it('should have a GET /:date route', () => {
      const handlers = findRouteHandler('get', '/:date');
      expect(handlers).toBeDefined();
      expect(handlers.length).toBeGreaterThan(0);
    });

    it('should return 400 for invalid date format', async () => {
      const handlers = findRouteHandler('get', '/:date');
      const req: Partial<Request> = {
        params: { date: '15-02-2025' },
        user: { id: 'barber-user-1', email: 'barber@test.com', role: 'barber' },
      } as any;
      const res = createMockResponse();

      const error = await executeRoute(handlers, req, res);

      expect(error).toBeDefined();
      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR);
      expect(error.details?.date).toBeDefined();
    });

    it('should return 200 with agenda for specific date', async () => {
      const mockBarberProfile = {
        id: 'barber-profile-1',
        user_id: 'barber-user-1',
        specialty: 'cortes clásicos',
        working_hours: {},
        is_available: true,
      };
      const mockAgenda = [
        {
          bookingId: 'booking-2',
          clientName: 'Ana García',
          startTime: '14:00:00',
          duration: 30,
          serviceType: 'barba',
          status: 'confirmed' as const,
        },
      ];

      mockFindByUserId.mockResolvedValue(mockBarberProfile);
      mockGetBarberAgenda.mockResolvedValue(mockAgenda);

      const handlers = findRouteHandler('get', '/:date');
      const req: Partial<Request> = {
        params: { date: '2025-03-15' },
        user: { id: 'barber-user-1', email: 'barber@test.com', role: 'barber' },
      } as any;
      const res = createMockResponse();

      const error = await executeRoute(handlers, req, res);

      expect(error).toBeNull();
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ success: true, data: mockAgenda });
      expect(mockFindByUserId).toHaveBeenCalledWith('barber-user-1');
      expect(mockGetBarberAgenda).toHaveBeenCalledWith('barber-profile-1', '2025-03-15');
    });

    it('should return error when barber profile not found', async () => {
      mockFindByUserId.mockResolvedValue(null);

      const handlers = findRouteHandler('get', '/:date');
      const req: Partial<Request> = {
        params: { date: '2025-03-15' },
        user: { id: 'barber-user-1', email: 'barber@test.com', role: 'barber' },
      } as any;
      const res = createMockResponse();

      const error = await executeRoute(handlers, req, res);

      expect(error).toBeDefined();
      expect(error.code).toBe(ErrorCodes.INSUFFICIENT_PERMISSIONS);
    });

    it('should return empty array when no bookings for date', async () => {
      const mockBarberProfile = {
        id: 'barber-profile-1',
        user_id: 'barber-user-1',
        specialty: 'cortes clásicos',
        working_hours: {},
        is_available: true,
      };

      mockFindByUserId.mockResolvedValue(mockBarberProfile);
      mockGetBarberAgenda.mockResolvedValue([]);

      const handlers = findRouteHandler('get', '/:date');
      const req: Partial<Request> = {
        params: { date: '2025-03-20' },
        user: { id: 'barber-user-1', email: 'barber@test.com', role: 'barber' },
      } as any;
      const res = createMockResponse();

      const error = await executeRoute(handlers, req, res);

      expect(error).toBeNull();
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ success: true, data: [] });
    });
  });
});

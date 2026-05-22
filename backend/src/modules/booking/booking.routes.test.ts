import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { bookingRouter } from './booking.routes';
import { ErrorCodes } from '../../shared/errors';

// Mock dependencies
vi.mock('./booking.service', () => ({
  bookingService: {
    createBooking: vi.fn(),
    cancelBooking: vi.fn(),
    getClientBookings: vi.fn(),
  },
}));

vi.mock('./availability.service', () => ({
  getAvailability: vi.fn(),
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

import { bookingService } from './booking.service';
import { getAvailability } from './availability.service';

const mockCreateBooking = vi.mocked(bookingService.createBooking);
const mockCancelBooking = vi.mocked(bookingService.cancelBooking);
const mockGetClientBookings = vi.mocked(bookingService.getClientBookings);
const mockGetAvailability = vi.mocked(getAvailability);

/**
 * Helper to find a route handler from the router stack.
 */
function findRouteHandler(method: string, path: string) {
  const layer = (bookingRouter as any).stack.find(
    (l: any) => l.route?.path === path && l.route?.methods[method]
  );
  return layer?.route?.stack;
}

/**
 * Helper to execute route handlers in sequence (simulating Express).
 * Skips the first two handlers (authMiddleware + authorize) and runs the actual handler.
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

describe('Booking Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /bookings', () => {
    it('should have a GET / route', () => {
      const handlers = findRouteHandler('get', '/');
      expect(handlers).toBeDefined();
      expect(handlers.length).toBeGreaterThan(0);
    });

    it('should require authMiddleware and authorize(client)', () => {
      const layer = (bookingRouter as any).stack.find(
        (l: any) => l.route?.path === '/' && l.route?.methods.get
      );
      // authMiddleware + authorize + handler = at least 3
      expect(layer.route.stack.length).toBeGreaterThanOrEqual(3);
    });

    it('should return 200 with client bookings', async () => {
      const mockBookings = [
        {
          id: 'booking-1',
          client_id: 'client-1',
          barber_id: 'barber-1',
          booking_date: new Date('2025-02-15'),
          start_time: '10:00',
          duration_minutes: 30,
          service_type: 'corte',
          status: 'confirmed' as const,
          created_at: new Date(),
          cancelled_at: null,
          barber_name: 'Juan',
          barber_specialty: 'cortes clásicos',
        },
      ];
      mockGetClientBookings.mockResolvedValue(mockBookings);

      const handlers = findRouteHandler('get', '/');
      const req: Partial<Request> = {
        user: { id: 'client-1', email: 'client@test.com', role: 'client' },
      } as any;
      const res = createMockResponse();

      const error = await executeRoute(handlers, req, res);

      expect(error).toBeNull();
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ success: true, data: mockBookings });
    });

    it('should forward service errors to next()', async () => {
      mockGetClientBookings.mockRejectedValue(new Error('DB error'));

      const handlers = findRouteHandler('get', '/');
      const req: Partial<Request> = {
        user: { id: 'client-1', email: 'client@test.com', role: 'client' },
      } as any;
      const res = createMockResponse();

      const error = await executeRoute(handlers, req, res);

      expect(error).toBeDefined();
      expect(error.message).toBe('DB error');
    });
  });

  describe('POST /bookings', () => {
    it('should have a POST / route', () => {
      const handlers = findRouteHandler('post', '/');
      expect(handlers).toBeDefined();
      expect(handlers.length).toBeGreaterThan(0);
    });

    it('should return 400 for missing body fields', async () => {
      const handlers = findRouteHandler('post', '/');
      const req: Partial<Request> = {
        body: {},
        user: { id: 'client-1', email: 'client@test.com', role: 'client' },
      } as any;
      const res = createMockResponse();

      const error = await executeRoute(handlers, req, res);

      expect(error).toBeDefined();
      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR);
      expect(error.details).toBeDefined();
    });

    it('should return 400 for invalid barberId format', async () => {
      const handlers = findRouteHandler('post', '/');
      const req: Partial<Request> = {
        body: {
          barberId: 'not-a-uuid',
          date: '2025-02-15',
          startTime: '10:00',
          serviceType: 'corte',
        },
        user: { id: 'client-1', email: 'client@test.com', role: 'client' },
      } as any;
      const res = createMockResponse();

      const error = await executeRoute(handlers, req, res);

      expect(error).toBeDefined();
      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR);
      expect(error.details?.barberId).toBeDefined();
    });

    it('should return 400 for invalid date format', async () => {
      const handlers = findRouteHandler('post', '/');
      const req: Partial<Request> = {
        body: {
          barberId: '550e8400-e29b-41d4-a716-446655440000',
          date: '15-02-2025',
          startTime: '10:00',
          serviceType: 'corte',
        },
        user: { id: 'client-1', email: 'client@test.com', role: 'client' },
      } as any;
      const res = createMockResponse();

      const error = await executeRoute(handlers, req, res);

      expect(error).toBeDefined();
      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR);
      expect(error.details?.date).toBeDefined();
    });

    it('should return 400 for invalid startTime format', async () => {
      const handlers = findRouteHandler('post', '/');
      const req: Partial<Request> = {
        body: {
          barberId: '550e8400-e29b-41d4-a716-446655440000',
          date: '2025-02-15',
          startTime: '25:00',
          serviceType: 'corte',
        },
        user: { id: 'client-1', email: 'client@test.com', role: 'client' },
      } as any;
      const res = createMockResponse();

      const error = await executeRoute(handlers, req, res);

      expect(error).toBeDefined();
      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR);
      expect(error.details?.startTime).toBeDefined();
    });

    it('should return 201 with booking on successful creation', async () => {
      const mockBooking = {
        id: 'booking-1',
        client_id: 'client-1',
        barber_id: '550e8400-e29b-41d4-a716-446655440000',
        booking_date: new Date('2025-02-15'),
        start_time: '10:00',
        duration_minutes: 30,
        service_type: 'corte',
        status: 'confirmed' as const,
        created_at: new Date(),
        cancelled_at: null,
      };
      mockCreateBooking.mockResolvedValue(mockBooking);

      const handlers = findRouteHandler('post', '/');
      const req: Partial<Request> = {
        body: {
          barberId: '550e8400-e29b-41d4-a716-446655440000',
          date: '2025-02-15',
          startTime: '10:00',
          serviceType: 'corte',
        },
        user: { id: 'client-1', email: 'client@test.com', role: 'client' },
      } as any;
      const res = createMockResponse();

      const error = await executeRoute(handlers, req, res);

      expect(error).toBeNull();
      expect(res.statusCode).toBe(201);
      expect(res.body).toEqual({ success: true, data: mockBooking });
    });
  });

  describe('DELETE /bookings/:id', () => {
    it('should have a DELETE /:id route', () => {
      const handlers = findRouteHandler('delete', '/:id');
      expect(handlers).toBeDefined();
      expect(handlers.length).toBeGreaterThan(0);
    });

    it('should return 400 for invalid booking id format', async () => {
      const handlers = findRouteHandler('delete', '/:id');
      const req: Partial<Request> = {
        params: { id: 'not-a-uuid' },
        user: { id: 'client-1', email: 'client@test.com', role: 'client' },
      } as any;
      const res = createMockResponse();

      const error = await executeRoute(handlers, req, res);

      expect(error).toBeDefined();
      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR);
      expect(error.details?.id).toBeDefined();
    });

    it('should return 200 with cancelled booking on success', async () => {
      const mockBooking = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        client_id: 'client-1',
        barber_id: 'barber-1',
        booking_date: new Date('2025-02-15'),
        start_time: '10:00',
        duration_minutes: 30,
        service_type: 'corte',
        status: 'cancelled' as const,
        created_at: new Date(),
        cancelled_at: new Date(),
      };
      mockCancelBooking.mockResolvedValue(mockBooking);

      const handlers = findRouteHandler('delete', '/:id');
      const req: Partial<Request> = {
        params: { id: '550e8400-e29b-41d4-a716-446655440000' },
        user: { id: 'client-1', email: 'client@test.com', role: 'client' },
      } as any;
      const res = createMockResponse();

      const error = await executeRoute(handlers, req, res);

      expect(error).toBeNull();
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ success: true, data: mockBooking });
    });
  });

  describe('GET /availability/:barberId', () => {
    it('should have a GET /availability/:barberId route', () => {
      const handlers = findRouteHandler('get', '/availability/:barberId');
      expect(handlers).toBeDefined();
      expect(handlers.length).toBeGreaterThan(0);
    });

    it('should return 400 for invalid barberId param', async () => {
      const handlers = findRouteHandler('get', '/availability/:barberId');
      const req: Partial<Request> = {
        params: { barberId: 'not-a-uuid' },
        query: { date: '2025-02-15' },
        user: { id: 'client-1', email: 'client@test.com', role: 'client' },
      } as any;
      const res = createMockResponse();

      const error = await executeRoute(handlers, req, res);

      expect(error).toBeDefined();
      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR);
      expect(error.details?.barberId).toBeDefined();
    });

    it('should return 400 for missing date query param', async () => {
      const handlers = findRouteHandler('get', '/availability/:barberId');
      const req: Partial<Request> = {
        params: { barberId: '550e8400-e29b-41d4-a716-446655440000' },
        query: {},
        user: { id: 'client-1', email: 'client@test.com', role: 'client' },
      } as any;
      const res = createMockResponse();

      const error = await executeRoute(handlers, req, res);

      expect(error).toBeDefined();
      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR);
      expect(error.details?.date).toBeDefined();
    });

    it('should return 200 with available slots on success', async () => {
      const mockSlots = [
        { startTime: '09:00', endTime: '09:30', available: true },
        { startTime: '09:30', endTime: '10:00', available: true },
      ];
      mockGetAvailability.mockResolvedValue(mockSlots);

      const handlers = findRouteHandler('get', '/availability/:barberId');
      const req: Partial<Request> = {
        params: { barberId: '550e8400-e29b-41d4-a716-446655440000' },
        query: { date: '2025-02-15' },
        user: { id: 'client-1', email: 'client@test.com', role: 'client' },
      } as any;
      const res = createMockResponse();

      const error = await executeRoute(handlers, req, res);

      expect(error).toBeNull();
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ success: true, data: mockSlots });
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodIssue } from 'zod';
import { errorMiddleware } from './error.middleware';
import { AppError, ErrorCodes, ErrorHttpStatus, ErrorMessages } from '../shared/errors';

function createMockRes(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

function createMockReq(): Request {
  return {} as Request;
}

const mockNext: NextFunction = vi.fn();

describe('errorMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ZodError handling', () => {
    it('should return 400 with field-level details for ZodError', () => {
      const issues: ZodIssue[] = [
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['email'],
          message: 'Required',
        },
        {
          code: 'too_small',
          minimum: 8,
          type: 'string',
          inclusive: true,
          exact: false,
          path: ['password'],
          message: 'String must contain at least 8 character(s)',
        },
      ];
      const zodError = new ZodError(issues);

      const req = createMockReq();
      const res = createMockRes();

      errorMiddleware(zodError, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: ErrorMessages[ErrorCodes.VALIDATION_ERROR],
          details: {
            email: ['Required'],
            password: ['String must contain at least 8 character(s)'],
          },
        },
      });
    });

    it('should aggregate multiple errors for the same field', () => {
      const issues: ZodIssue[] = [
        {
          code: 'too_small',
          minimum: 8,
          type: 'string',
          inclusive: true,
          exact: false,
          path: ['password'],
          message: 'String must contain at least 8 character(s)',
        },
        {
          code: 'invalid_string',
          validation: 'regex',
          path: ['password'],
          message: 'Must contain at least one uppercase letter',
        },
      ];
      const zodError = new ZodError(issues);

      const req = createMockReq();
      const res = createMockRes();

      errorMiddleware(zodError, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: ErrorMessages[ErrorCodes.VALIDATION_ERROR],
          details: {
            password: [
              'String must contain at least 8 character(s)',
              'Must contain at least one uppercase letter',
            ],
          },
        },
      });
    });

    it('should use _root for issues with empty path', () => {
      const issues: ZodIssue[] = [
        {
          code: 'invalid_type',
          expected: 'object',
          received: 'undefined',
          path: [],
          message: 'Expected object, received undefined',
        },
      ];
      const zodError = new ZodError(issues);

      const req = createMockReq();
      const res = createMockRes();

      errorMiddleware(zodError, req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: ErrorMessages[ErrorCodes.VALIDATION_ERROR],
          details: {
            _root: ['Expected object, received undefined'],
          },
        },
      });
    });

    it('should handle nested path fields with dot notation', () => {
      const issues: ZodIssue[] = [
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['address', 'city'],
          message: 'Expected string, received number',
        },
      ];
      const zodError = new ZodError(issues);

      const req = createMockReq();
      const res = createMockRes();

      errorMiddleware(zodError, req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: ErrorMessages[ErrorCodes.VALIDATION_ERROR],
          details: {
            'address.city': ['Expected string, received number'],
          },
        },
      });
    });
  });

  describe('AppError handling', () => {
    it('should map TOKEN_MISSING to 401', () => {
      const err = new AppError(ErrorCodes.TOKEN_MISSING);
      const req = createMockReq();
      const res = createMockRes();

      errorMiddleware(err, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'TOKEN_MISSING',
          message: ErrorMessages[ErrorCodes.TOKEN_MISSING],
        },
      });
    });

    it('should map TOKEN_EXPIRED to 401', () => {
      const err = new AppError(ErrorCodes.TOKEN_EXPIRED);
      const req = createMockReq();
      const res = createMockRes();

      errorMiddleware(err, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should map TOKEN_INVALID to 401', () => {
      const err = new AppError(ErrorCodes.TOKEN_INVALID);
      const req = createMockReq();
      const res = createMockRes();

      errorMiddleware(err, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should map INVALID_CREDENTIALS to 401', () => {
      const err = new AppError(ErrorCodes.INVALID_CREDENTIALS);
      const req = createMockReq();
      const res = createMockRes();

      errorMiddleware(err, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should map INSUFFICIENT_PERMISSIONS to 403', () => {
      const err = new AppError(ErrorCodes.INSUFFICIENT_PERMISSIONS);
      const req = createMockReq();
      const res = createMockRes();

      errorMiddleware(err, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should map ACCOUNT_LOCKED to 403', () => {
      const err = new AppError(ErrorCodes.ACCOUNT_LOCKED);
      const req = createMockReq();
      const res = createMockRes();

      errorMiddleware(err, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should map BOOKING_NOT_FOUND to 404', () => {
      const err = new AppError(ErrorCodes.BOOKING_NOT_FOUND);
      const req = createMockReq();
      const res = createMockRes();

      errorMiddleware(err, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should map SLOT_UNAVAILABLE to 409', () => {
      const err = new AppError(ErrorCodes.SLOT_UNAVAILABLE);
      const req = createMockReq();
      const res = createMockRes();

      errorMiddleware(err, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(409);
    });

    it('should map CLIENT_OVERLAP to 409', () => {
      const err = new AppError(ErrorCodes.CLIENT_OVERLAP);
      const req = createMockReq();
      const res = createMockRes();

      errorMiddleware(err, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(409);
    });

    it('should map MAX_BOOKINGS_REACHED to 422', () => {
      const err = new AppError(ErrorCodes.MAX_BOOKINGS_REACHED);
      const req = createMockReq();
      const res = createMockRes();

      errorMiddleware(err, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(422);
    });

    it('should map CANCELLATION_TOO_LATE to 422', () => {
      const err = new AppError(ErrorCodes.CANCELLATION_TOO_LATE);
      const req = createMockReq();
      const res = createMockRes();

      errorMiddleware(err, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(422);
    });

    it('should map BOOKING_ALREADY_CANCELLED to 422', () => {
      const err = new AppError(ErrorCodes.BOOKING_ALREADY_CANCELLED);
      const req = createMockReq();
      const res = createMockRes();

      errorMiddleware(err, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(422);
    });

    it('should map BOOKING_ALREADY_COMPLETED to 422', () => {
      const err = new AppError(ErrorCodes.BOOKING_ALREADY_COMPLETED);
      const req = createMockReq();
      const res = createMockRes();

      errorMiddleware(err, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(422);
    });

    it('should map SERVICE_UNAVAILABLE to 503', () => {
      const err = new AppError(ErrorCodes.SERVICE_UNAVAILABLE);
      const req = createMockReq();
      const res = createMockRes();

      errorMiddleware(err, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(503);
    });

    it('should include details when AppError has details', () => {
      const details = { email: ['Email already registered'] };
      const err = new AppError(ErrorCodes.VALIDATION_ERROR, 'Validation failed', details);
      const req = createMockReq();
      const res = createMockRes();

      errorMiddleware(err, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: { email: ['Email already registered'] },
        },
      });
    });

    it('should use custom message when provided', () => {
      const err = new AppError(ErrorCodes.BOOKING_NOT_FOUND, 'Turno #123 no encontrado');
      const req = createMockReq();
      const res = createMockRes();

      errorMiddleware(err, req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'BOOKING_NOT_FOUND',
          message: 'Turno #123 no encontrado',
        },
      });
    });
  });

  describe('Unknown error handling', () => {
    it('should return 500 for unknown errors in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const err = new Error('Something broke internally');
      const req = createMockReq();
      const res = createMockRes();

      errorMiddleware(err, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: ErrorMessages[ErrorCodes.INTERNAL_ERROR],
        },
      });

      process.env.NODE_ENV = originalEnv;
    });

    it('should include error message in non-production for debugging', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const err = new Error('Database connection failed');
      const req = createMockReq();
      const res = createMockRes();

      errorMiddleware(err, req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Database connection failed',
        },
      });

      process.env.NODE_ENV = originalEnv;
    });

    it('should never expose stack traces in the response', () => {
      const err = new Error('Sensitive error');
      err.stack = 'Error: Sensitive error\n    at /app/src/secret.ts:42:13';
      const req = createMockReq();
      const res = createMockRes();

      errorMiddleware(err, req, res, mockNext);

      const jsonCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(JSON.stringify(jsonCall)).not.toContain('stack');
      expect(JSON.stringify(jsonCall)).not.toContain('secret.ts');
    });
  });

  describe('Response structure consistency', () => {
    it('should always have success: false', () => {
      const errors = [
        new ZodError([
          { code: 'invalid_type', expected: 'string', received: 'number', path: ['x'], message: 'err' },
        ]),
        new AppError(ErrorCodes.TOKEN_MISSING),
        new Error('unknown'),
      ];

      for (const err of errors) {
        const res = createMockRes();
        errorMiddleware(err, createMockReq(), res, mockNext);
        const jsonCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(jsonCall.success).toBe(false);
      }
    });

    it('should always have error.code and error.message', () => {
      const errors = [
        new ZodError([
          { code: 'invalid_type', expected: 'string', received: 'number', path: ['x'], message: 'err' },
        ]),
        new AppError(ErrorCodes.SLOT_UNAVAILABLE),
        new Error('unknown'),
      ];

      for (const err of errors) {
        const res = createMockRes();
        errorMiddleware(err, createMockReq(), res, mockNext);
        const jsonCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(jsonCall.error).toBeDefined();
        expect(jsonCall.error.code).toBeDefined();
        expect(jsonCall.error.message).toBeDefined();
        expect(typeof jsonCall.error.code).toBe('string');
        expect(typeof jsonCall.error.message).toBe('string');
      }
    });
  });
});

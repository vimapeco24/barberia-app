import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { AppError, ErrorCodes } from '../shared/errors';
import { Role } from '../shared/types';

/**
 * Role-based authorization middleware factory.
 * Returns a middleware that checks if the authenticated user's role
 * is included in the list of allowed roles for the endpoint.
 *
 * Must be used AFTER authMiddleware so that req.user is populated.
 *
 * @param roles - One or more roles that are allowed to access the endpoint
 * @returns Express middleware that enforces role-based access control
 *
 * @example
 * router.get('/admin/barbers', authMiddleware, authorize('admin'), handler);
 * router.get('/barber/agenda', authMiddleware, authorize('barber'), handler);
 * router.post('/bookings', authMiddleware, authorize('client'), handler);
 */
export function authorize(...roles: Role[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    const userRole = req.user?.role;

    if (!userRole || !roles.includes(userRole)) {
      return next(new AppError(ErrorCodes.INSUFFICIENT_PERMISSIONS));
    }

    next();
  };
}

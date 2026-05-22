import { Router, Request, Response, NextFunction } from 'express';
import { bookingService } from './booking.service';
import { getAvailability } from './availability.service';
import {
  CreateBookingDTO,
  AvailabilityParamsDTO,
  AvailabilityQueryDTO,
  BookingIdParamDTO,
} from './booking.schemas';
import { authMiddleware, AuthenticatedRequest } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import { AppError, ErrorCodes } from '../../shared/errors';
import type { SuccessResponse } from '../../shared/types';
import { pool } from '../../config/database';

const router = Router();

/**
 * GET /bookings/barbers - Listar barberos disponibles (para clientes)
 * Requisitos: 3.1, 3.2
 */
router.get(
  '/barbers',
  authMiddleware,
  authorize('client') as unknown as (req: Request, res: Response, next: NextFunction) => void,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pool.query<{
        id: string;
        user_id: string;
        specialty: string | null;
        working_hours: Record<string, { start: string; end: string } | null>;
        is_available: boolean;
        name: string;
      }>(
        `SELECT bp.id, bp.user_id, bp.specialty, bp.working_hours, bp.is_available, u.name, u.phone
         FROM barber_profiles bp
         JOIN users u ON u.id = bp.user_id
         WHERE bp.is_available = true AND u.is_active = true
         ORDER BY u.name`
      );

      const barbers = result.rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        name: row.name,
        phone: row.phone || null,
        specialty: row.specialty,
        workingHours: row.working_hours,
        isAvailable: row.is_available,
      }));

      const response: SuccessResponse<typeof barbers> = { success: true, data: barbers };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /bookings - Listar turnos del cliente autenticado
 * Requisitos: 8.1, 8.4
 */
router.get(
  '/',
  authMiddleware,
  authorize('client') as unknown as (req: Request, res: Response, next: NextFunction) => void,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { user } = req as AuthenticatedRequest;
      const bookings = await bookingService.getClientBookings(user.id);
      // Transform snake_case to camelCase for frontend
      const transformed = bookings.map((b: any) => ({
        id: b.id,
        clientId: b.client_id,
        barberId: b.barber_id,
        barberName: b.barber_name || null,
        barberSpecialty: b.barber_specialty || null,
        bookingDate: b.booking_date instanceof Date ? b.booking_date.toISOString().split('T')[0] : b.booking_date,
        startTime: b.start_time,
        durationMinutes: b.duration_minutes,
        serviceType: b.service_type,
        status: b.status,
        createdAt: b.created_at,
        cancelledAt: b.cancelled_at,
      }));
      const response: SuccessResponse<typeof transformed> = { success: true, data: transformed };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /bookings - Crear un nuevo turno
 * Requisitos: 8.1, 8.4, 8.5
 */
router.post(
  '/',
  authMiddleware,
  authorize('client') as unknown as (req: Request, res: Response, next: NextFunction) => void,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = CreateBookingDTO.safeParse(req.body);
      if (!parsed.success) {
        const details: Record<string, string[]> = {};
        for (const issue of parsed.error.issues) {
          const field = issue.path.join('.');
          if (!details[field]) details[field] = [];
          details[field].push(issue.message);
        }
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Datos de entrada inválidos', details);
      }

      const { user } = req as AuthenticatedRequest;
      const booking = await bookingService.createBooking(parsed.data, user.id);
      // Transform to camelCase
      const transformed = {
        id: booking.id,
        clientId: booking.client_id,
        barberId: booking.barber_id,
        bookingDate: booking.booking_date instanceof Date ? booking.booking_date.toISOString().split('T')[0] : booking.booking_date,
        startTime: booking.start_time,
        durationMinutes: booking.duration_minutes,
        serviceType: booking.service_type,
        status: booking.status,
        createdAt: booking.created_at,
        cancelledAt: booking.cancelled_at,
      };
      const response: SuccessResponse<typeof transformed> = { success: true, data: transformed };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /bookings/:id - Cancelar un turno existente
 * Requisitos: 8.1, 8.4, 8.5
 */
router.delete(
  '/:id',
  authMiddleware,
  authorize('client') as unknown as (req: Request, res: Response, next: NextFunction) => void,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = BookingIdParamDTO.safeParse(req.params);
      if (!parsed.success) {
        const details: Record<string, string[]> = {};
        for (const issue of parsed.error.issues) {
          const field = issue.path.join('.');
          if (!details[field]) details[field] = [];
          details[field].push(issue.message);
        }
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Datos de entrada inválidos', details);
      }

      const { user } = req as AuthenticatedRequest;
      const booking = await bookingService.cancelBooking(parsed.data.id, user.id);
      const transformed = {
        id: booking.id,
        clientId: booking.client_id,
        barberId: booking.barber_id,
        bookingDate: booking.booking_date instanceof Date ? booking.booking_date.toISOString().split('T')[0] : booking.booking_date,
        startTime: booking.start_time,
        durationMinutes: booking.duration_minutes,
        serviceType: booking.service_type,
        status: booking.status,
        createdAt: booking.created_at,
        cancelledAt: booking.cancelled_at,
      };
      const response: SuccessResponse<typeof transformed> = { success: true, data: transformed };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /availability/:barberId - Consultar disponibilidad de un barbero
 * Requisitos: 8.1, 8.4, 8.5
 */
router.get(
  '/availability/:barberId',
  authMiddleware,
  authorize('client') as unknown as (req: Request, res: Response, next: NextFunction) => void,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const paramsParsed = AvailabilityParamsDTO.safeParse(req.params);
      if (!paramsParsed.success) {
        const details: Record<string, string[]> = {};
        for (const issue of paramsParsed.error.issues) {
          const field = issue.path.join('.');
          if (!details[field]) details[field] = [];
          details[field].push(issue.message);
        }
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Datos de entrada inválidos', details);
      }

      const queryParsed = AvailabilityQueryDTO.safeParse(req.query);
      if (!queryParsed.success) {
        const details: Record<string, string[]> = {};
        for (const issue of queryParsed.error.issues) {
          const field = issue.path.join('.');
          if (!details[field]) details[field] = [];
          details[field].push(issue.message);
        }
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Datos de entrada inválidos', details);
      }

      const slots = await getAvailability(paramsParsed.data.barberId, queryParsed.data.date);
      const response: SuccessResponse<typeof slots> = { success: true, data: slots };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

export { router as bookingRouter };

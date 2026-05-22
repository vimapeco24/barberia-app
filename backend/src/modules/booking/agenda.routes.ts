import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { agendaService } from './agenda.service';
import { barberRepository } from './barber.repository';
import { authMiddleware, AuthenticatedRequest } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import { AppError, ErrorCodes } from '../../shared/errors';
import type { SuccessResponse } from '../../shared/types';

const router = Router();

/** Schema de validación para el parámetro de fecha */
const AgendaDateParamDTO = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato YYYY-MM-DD'),
});

/**
 * GET /barber/agenda - Agenda del día actual del barbero autenticado
 * Requisitos: 5.1, 6.1, 8.1
 */
router.get(
  '/',
  authMiddleware,
  authorize('barber') as unknown as (req: Request, res: Response, next: NextFunction) => void,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { user } = req as AuthenticatedRequest;

      // Obtener el perfil de barbero a partir del user ID autenticado
      const barberProfile = await barberRepository.findByUserId(user.id);
      if (!barberProfile) {
        throw new AppError(ErrorCodes.INSUFFICIENT_PERMISSIONS, 'No se encontró perfil de barbero para este usuario');
      }

      // Usar la fecha actual en formato YYYY-MM-DD
      const today = new Date().toISOString().split('T')[0];
      const agenda = await agendaService.getBarberAgenda(barberProfile.id, today);

      const response: SuccessResponse<typeof agenda> = { success: true, data: agenda };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /barber/agenda/:date - Agenda del barbero autenticado por fecha específica
 * Requisitos: 5.1, 6.1, 8.1
 */
router.get(
  '/:date',
  authMiddleware,
  authorize('barber') as unknown as (req: Request, res: Response, next: NextFunction) => void,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = AgendaDateParamDTO.safeParse(req.params);
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

      // Obtener el perfil de barbero a partir del user ID autenticado
      const barberProfile = await barberRepository.findByUserId(user.id);
      if (!barberProfile) {
        throw new AppError(ErrorCodes.INSUFFICIENT_PERMISSIONS, 'No se encontró perfil de barbero para este usuario');
      }

      const agenda = await agendaService.getBarberAgenda(barberProfile.id, parsed.data.date);

      const response: SuccessResponse<typeof agenda> = { success: true, data: agenda };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

export { router as agendaRouter };

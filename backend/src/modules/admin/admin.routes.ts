import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { adminService } from './admin.service';
import { authMiddleware, AuthenticatedRequest } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/role.middleware';
import { AppError, ErrorCodes } from '../../shared/errors';
import { emailSchema, passwordSchema } from '../auth/auth.schemas';
import type { SuccessResponse } from '../../shared/types';

const router = Router();

/** Schema de validación para crear barbero */
const CreateBarberDTO = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().min(1, 'El nombre es obligatorio').max(100, 'El nombre no puede exceder 100 caracteres'),
  phone: z.string().max(20, 'El teléfono no puede exceder 20 caracteres').optional(),
  specialty: z.string().max(100, 'La especialidad no puede exceder 100 caracteres').optional(),
  workingHours: z
    .record(
      z.union([
        z.object({
          start: z.string(),
          end: z.string(),
        }),
        z.null(),
      ])
    )
    .optional(),
});

/**
 * POST /admin/barbers - Crear barbero (solo admin)
 * Requisitos: 2.4, 2.5
 */
router.post(
  '/barbers',
  authMiddleware,
  authorize('admin') as any,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = CreateBarberDTO.safeParse(req.body);
      if (!parsed.success) {
        const details: Record<string, string[]> = {};
        for (const issue of parsed.error.issues) {
          const field = issue.path.join('.');
          if (!details[field]) details[field] = [];
          details[field].push(issue.message);
        }
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Datos de entrada inválidos', details);
      }

      const result = await adminService.createBarber(parsed.data);
      const response: SuccessResponse<typeof result> = { success: true, data: result };
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /admin/barbers - Listar barberos (solo admin)
 * Requisitos: 2.4, 2.5
 */
router.get(
  '/barbers',
  authMiddleware,
  authorize('admin') as any,
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const barbers = await adminService.listBarbers();
      const response: SuccessResponse<typeof barbers> = { success: true, data: barbers };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

export { router as adminRouter };

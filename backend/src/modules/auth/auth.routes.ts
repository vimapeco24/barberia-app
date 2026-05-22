import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authService } from './auth.service';
import { RegisterDTO, LoginDTO } from './auth.schemas';
import { authMiddleware, AuthenticatedRequest } from '../../middleware/auth.middleware';
import { AppError, ErrorCodes } from '../../shared/errors';
import type { SuccessResponse } from '../../shared/types';

const router = Router();

/** Schema for refresh and logout requests */
const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'El refresh token es obligatorio'),
});

/**
 * POST /auth/register - Registro de cliente (público)
 */
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = RegisterDTO.safeParse(req.body);
    if (!parsed.success) {
      const details: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path.join('.');
        if (!details[field]) details[field] = [];
        details[field].push(issue.message);
      }
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Datos de entrada inválidos', details);
    }

    const result = await authService.register(parsed.data);
    const response: SuccessResponse<typeof result> = { success: true, data: result };
    res.status(201).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/login - Inicio de sesión (público)
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = LoginDTO.safeParse(req.body);
    if (!parsed.success) {
      const details: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path.join('.');
        if (!details[field]) details[field] = [];
        details[field].push(issue.message);
      }
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Datos de entrada inválidos', details);
    }

    const ipAddress = req.ip || req.socket.remoteAddress;
    const result = await authService.login(parsed.data, ipAddress);
    const response: SuccessResponse<typeof result> = { success: true, data: result };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/refresh - Renovar token (autenticado)
 */
router.post('/refresh', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = RefreshTokenSchema.safeParse(req.body);
    if (!parsed.success) {
      const details: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path.join('.');
        if (!details[field]) details[field] = [];
        details[field].push(issue.message);
      }
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Datos de entrada inválidos', details);
    }

    const result = await authService.refreshToken(parsed.data.refreshToken);
    const response: SuccessResponse<typeof result> = { success: true, data: result };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/logout - Cerrar sesión (autenticado)
 */
router.post('/logout', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = RefreshTokenSchema.safeParse(req.body);
    if (!parsed.success) {
      const details: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path.join('.');
        if (!details[field]) details[field] = [];
        details[field].push(issue.message);
      }
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Datos de entrada inválidos', details);
    }

    await authService.logout(parsed.data.refreshToken);
    const response: SuccessResponse<{ message: string }> = {
      success: true,
      data: { message: 'Sesión cerrada exitosamente' },
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

export { router as authRouter };

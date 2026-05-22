import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, ErrorCodes, ErrorHttpStatus, ErrorMessages } from '../shared/errors';
import { ErrorResponse } from '../shared/types';

/**
 * Middleware global de manejo de errores.
 * Transforma errores en respuestas JSON con estructura consistente.
 *
 * Requisitos:
 * - 8.5: Rechazar solicitudes inválidas con código 400 y detalle de campos con error
 * - 8.7: Estructura consistente { success, data/error }
 */
export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Errores de validación de Zod → 400 con detalle por campo
  if (err instanceof ZodError) {
    const details: Record<string, string[]> = {};

    for (const issue of err.issues) {
      const field = issue.path.join('.') || '_root';
      if (!details[field]) {
        details[field] = [];
      }
      details[field].push(issue.message);
    }

    const response: ErrorResponse = {
      success: false,
      error: {
        code: ErrorCodes.VALIDATION_ERROR,
        message: ErrorMessages[ErrorCodes.VALIDATION_ERROR],
        details,
      },
    };

    res.status(ErrorHttpStatus[ErrorCodes.VALIDATION_ERROR]).json(response);
    return;
  }

  // Errores de negocio (AppError) → código HTTP apropiado
  if (err instanceof AppError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && { details: err.details }),
      },
    };

    res.status(err.httpStatus).json(response);
    return;
  }

  // Errores inesperados → 500 sin exponer stack traces
  const isProduction = process.env.NODE_ENV === 'production';

  const response: ErrorResponse = {
    success: false,
    error: {
      code: ErrorCodes.INTERNAL_ERROR,
      message: isProduction
        ? ErrorMessages[ErrorCodes.INTERNAL_ERROR]
        : err.message || ErrorMessages[ErrorCodes.INTERNAL_ERROR],
    },
  };

  // Log del error para debugging (solo en servidor, nunca en respuesta)
  if (!isProduction) {
    console.error('[ErrorMiddleware]', err);
  }

  res.status(ErrorHttpStatus[ErrorCodes.INTERNAL_ERROR]).json(response);
}

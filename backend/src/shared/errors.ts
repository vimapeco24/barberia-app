/**
 * Códigos de error del sistema definidos en el diseño.
 * Cada código mapea a un código HTTP y un mensaje descriptivo.
 */

export const ErrorCodes = {
  // Validación (400)
  VALIDATION_ERROR: 'VALIDATION_ERROR',

  // Autenticación (401)
  TOKEN_MISSING: 'TOKEN_MISSING',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',

  // Autorización (403)
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',

  // No encontrado (404)
  BOOKING_NOT_FOUND: 'BOOKING_NOT_FOUND',

  // Conflicto (409)
  SLOT_UNAVAILABLE: 'SLOT_UNAVAILABLE',
  CLIENT_OVERLAP: 'CLIENT_OVERLAP',

  // Reglas de negocio (422)
  MAX_BOOKINGS_REACHED: 'MAX_BOOKINGS_REACHED',
  CANCELLATION_TOO_LATE: 'CANCELLATION_TOO_LATE',
  BOOKING_ALREADY_CANCELLED: 'BOOKING_ALREADY_CANCELLED',
  BOOKING_ALREADY_COMPLETED: 'BOOKING_ALREADY_COMPLETED',

  // Servidor (500/503)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/** Mapeo de código de error a código HTTP */
export const ErrorHttpStatus: Record<ErrorCode, number> = {
  [ErrorCodes.VALIDATION_ERROR]: 400,
  [ErrorCodes.TOKEN_MISSING]: 401,
  [ErrorCodes.TOKEN_EXPIRED]: 401,
  [ErrorCodes.TOKEN_INVALID]: 401,
  [ErrorCodes.INVALID_CREDENTIALS]: 401,
  [ErrorCodes.INSUFFICIENT_PERMISSIONS]: 403,
  [ErrorCodes.ACCOUNT_LOCKED]: 403,
  [ErrorCodes.BOOKING_NOT_FOUND]: 404,
  [ErrorCodes.SLOT_UNAVAILABLE]: 409,
  [ErrorCodes.CLIENT_OVERLAP]: 409,
  [ErrorCodes.MAX_BOOKINGS_REACHED]: 422,
  [ErrorCodes.CANCELLATION_TOO_LATE]: 422,
  [ErrorCodes.BOOKING_ALREADY_CANCELLED]: 422,
  [ErrorCodes.BOOKING_ALREADY_COMPLETED]: 422,
  [ErrorCodes.INTERNAL_ERROR]: 500,
  [ErrorCodes.SERVICE_UNAVAILABLE]: 503,
};

/** Mensajes de error por defecto */
export const ErrorMessages: Record<ErrorCode, string> = {
  [ErrorCodes.VALIDATION_ERROR]: 'Datos de entrada inválidos',
  [ErrorCodes.TOKEN_MISSING]: 'No se proporcionó token de autenticación',
  [ErrorCodes.TOKEN_EXPIRED]: 'El token de autenticación ha expirado',
  [ErrorCodes.TOKEN_INVALID]: 'El token de autenticación es inválido',
  [ErrorCodes.INVALID_CREDENTIALS]: 'Credenciales inválidas',
  [ErrorCodes.INSUFFICIENT_PERMISSIONS]: 'No tiene permisos para acceder a este recurso',
  [ErrorCodes.ACCOUNT_LOCKED]: 'Cuenta bloqueada temporalmente por múltiples intentos fallidos',
  [ErrorCodes.BOOKING_NOT_FOUND]: 'Turno no encontrado',
  [ErrorCodes.SLOT_UNAVAILABLE]: 'El horario seleccionado ya no está disponible',
  [ErrorCodes.CLIENT_OVERLAP]: 'Ya tiene un turno reservado en ese horario',
  [ErrorCodes.MAX_BOOKINGS_REACHED]: 'Ha alcanzado el máximo de turnos activos permitidos',
  [ErrorCodes.CANCELLATION_TOO_LATE]: 'No es posible cancelar con menos de 2 horas de anticipación',
  [ErrorCodes.BOOKING_ALREADY_CANCELLED]: 'El turno ya fue cancelado previamente',
  [ErrorCodes.BOOKING_ALREADY_COMPLETED]: 'El turno ya fue completado',
  [ErrorCodes.INTERNAL_ERROR]: 'Error interno del servidor',
  [ErrorCodes.SERVICE_UNAVAILABLE]: 'Servicio temporalmente no disponible',
};

/** Error de aplicación personalizado */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly httpStatus: number;
  public readonly details?: Record<string, string[]>;

  constructor(code: ErrorCode, message?: string, details?: Record<string, string[]>) {
    super(message || ErrorMessages[code]);
    this.code = code;
    this.httpStatus = ErrorHttpStatus[code];
    this.details = details;
    this.name = 'AppError';
  }
}

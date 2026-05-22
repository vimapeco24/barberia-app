/**
 * Constantes del sistema de reservas.
 */

/** Duración de cada turno en minutos */
export const BOOKING_DURATION_MINUTES = 30;

/** Máximo de turnos activos (confirmados) por cliente */
export const MAX_ACTIVE_BOOKINGS = 3;

/** Tiempo mínimo de anticipación para cancelar un turno (en horas) */
export const MIN_CANCELLATION_HOURS = 2;

/** Máximo de intentos de login fallidos antes de bloquear la cuenta */
export const MAX_LOGIN_ATTEMPTS = 5;

/** Duración del bloqueo de cuenta en minutos */
export const ACCOUNT_LOCK_DURATION_MINUTES = 15;

/** Duración del access token en minutos */
export const ACCESS_TOKEN_EXPIRY_MINUTES = 15;

/** Duración del refresh token en días */
export const REFRESH_TOKEN_EXPIRY_DAYS = 7;

/** Tiempo de inactividad para expiración de sesión de cliente (en minutos) */
export const CLIENT_SESSION_TIMEOUT_MINUTES = 60;

/** Tiempo de inactividad para expiración de sesión de barbero (en minutos) */
export const BARBER_SESSION_TIMEOUT_MINUTES = 30;

/** Rango máximo de días a futuro para reservar un turno */
export const MAX_BOOKING_DAYS_AHEAD = 30;

/** Rango mínimo de días a futuro para reservar un turno */
export const MIN_BOOKING_DAYS_AHEAD = 1;

/** Salt rounds para bcrypt */
export const BCRYPT_SALT_ROUNDS = 12;

/** Máximo de reintentos para notificaciones */
export const MAX_NOTIFICATION_RETRIES = 3;

/** Intervalo entre reintentos de notificación (en milisegundos) */
export const NOTIFICATION_RETRY_INTERVAL_MS = 2000;

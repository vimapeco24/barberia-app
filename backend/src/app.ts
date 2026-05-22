import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { authRouter } from './modules/auth/auth.routes';
import { bookingRouter } from './modules/booking/booking.routes';
import { agendaRouter } from './modules/booking/agenda.routes';
import { adminRouter } from './modules/admin/admin.routes';
import { errorMiddleware } from './middleware/error.middleware';

const app = express();

// --- Global Middlewares ---

// CORS - permite solicitudes cross-origin
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// JSON body parser
app.use(express.json());

// Rate limiting global - máximo 1000 solicitudes por minuto por IP (desarrollo)
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Demasiadas solicitudes, intente de nuevo más tarde',
    },
  },
});
app.use(globalLimiter);

// Rate limiting más estricto para autenticación - 20 solicitudes por minuto
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Demasiados intentos de autenticación, intente de nuevo más tarde',
    },
  },
});

// --- Health Check ---
app.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok' } });
});

// --- Route Registration ---
app.use('/auth', authLimiter, authRouter);
app.use('/bookings', bookingRouter);
app.use('/barber/agenda', agendaRouter);
app.use('/admin', adminRouter);

// --- Error Handler (must be last) ---
app.use(errorMiddleware);

export default app;

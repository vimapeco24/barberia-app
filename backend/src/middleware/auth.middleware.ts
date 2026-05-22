import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError, ErrorCodes } from '../shared/errors';
import { Role } from '../shared/types';
import { userRepository } from '../modules/auth/user.repository';

/** Decoded JWT payload attached to authenticated requests */
export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

/** Extended Express Request with authenticated user info */
export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

/**
 * JWT authentication middleware.
 * Extracts the Bearer token from the Authorization header, verifies it,
 * checks that the user exists and is active, then attaches user info to req.user.
 *
 * Returns 401 with appropriate error code:
 * - TOKEN_MISSING: no Authorization header or no Bearer token
 * - TOKEN_EXPIRED: token signature is valid but has expired
 * - TOKEN_INVALID: token signature is invalid or malformed
 */
export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError(ErrorCodes.TOKEN_MISSING));
  }

  const token = authHeader.slice(7);

  if (!token) {
    return next(new AppError(ErrorCodes.TOKEN_MISSING));
  }

  let decoded: jwt.JwtPayload;

  try {
    decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return next(new AppError(ErrorCodes.TOKEN_EXPIRED));
    }
    return next(new AppError(ErrorCodes.TOKEN_INVALID));
  }

  // Validate that the decoded token has the required fields
  if (!decoded.sub || !decoded.email || !decoded.role) {
    return next(new AppError(ErrorCodes.TOKEN_INVALID));
  }

  // Verify the user exists and is active
  const user = await userRepository.findById(decoded.sub);

  if (!user || !user.is_active) {
    return next(new AppError(ErrorCodes.TOKEN_INVALID));
  }

  // Attach user info to request
  (req as AuthenticatedRequest).user = {
    id: user.id,
    email: user.email,
    role: user.role,
  };

  next();
}

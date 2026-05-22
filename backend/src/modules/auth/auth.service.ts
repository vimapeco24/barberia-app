import bcrypt from 'bcrypt';
import jwt, { type SignOptions, type JwtPayload } from 'jsonwebtoken';
import { env } from '../../config/env';
import { redisClient } from '../../config/redis';
import { AppError, ErrorCodes } from '../../shared/errors';
import { BCRYPT_SALT_ROUNDS, MAX_LOGIN_ATTEMPTS, ACCOUNT_LOCK_DURATION_MINUTES } from '../../shared/constants';
import { userRepository } from './user.repository';
import { loginAttemptRepository } from './login-attempt.repository';
import type { LoginDTO, RegisterDTO } from './auth.schemas';
import type { UserProfile } from '../../shared/types';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
}

function generateAccessToken(user: { id: string; email: string; role: string }): string {
  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRATION as SignOptions['expiresIn'],
  };
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    env.JWT_SECRET,
    options
  );
}

function generateRefreshToken(user: { id: string; email: string; role: string }): string {
  const options: SignOptions = {
    expiresIn: env.JWT_REFRESH_EXPIRATION as SignOptions['expiresIn'],
  };
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    env.JWT_REFRESH_SECRET,
    options
  );
}

export const authService = {
  async register(data: RegisterDTO): Promise<AuthResponse> {
    // Check if email already exists
    const existingUser = await userRepository.findByEmail(data.email);
    if (existingUser) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'El correo electrónico ya está registrado', {
        email: ['El correo electrónico ya está registrado'],
      });
    }

    // Hash password with bcrypt (salt rounds: 12)
    const passwordHash = await bcrypt.hash(data.password, BCRYPT_SALT_ROUNDS);

    // Create user in database
    const user = await userRepository.create({
      email: data.email,
      password_hash: passwordHash,
      name: data.name,
      phone: data.phone,
      role: 'client',
    });

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone ?? undefined,
        role: user.role,
        isActive: user.is_active,
      },
    };
  },

  async refreshToken(token: string): Promise<AuthResponse> {
    // Check if the refresh token has been blacklisted (logged out)
    const isBlacklisted = await redisClient.get(`blacklist:${token}`);
    if (isBlacklisted) {
      throw new AppError(ErrorCodes.TOKEN_INVALID, 'El refresh token ha sido invalidado');
    }

    // Verify the refresh token using the refresh secret
    let payload: JwtPayload;
    try {
      payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError(ErrorCodes.TOKEN_EXPIRED);
      }
      throw new AppError(ErrorCodes.TOKEN_INVALID);
    }

    // Ensure the user still exists and is active
    const userId = payload.sub as string;
    const user = await userRepository.findById(userId);
    if (!user || !user.is_active) {
      throw new AppError(ErrorCodes.TOKEN_INVALID, 'El usuario no existe o está inactivo');
    }

    // Generate new tokens
    const accessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    // Blacklist the old refresh token to prevent reuse
    if (payload.exp) {
      const remainingTtl = payload.exp - Math.floor(Date.now() / 1000);
      if (remainingTtl > 0) {
        await redisClient.set(`blacklist:${token}`, '1', { EX: remainingTtl });
      }
    }

    // Store the new refresh token in Redis to track active sessions
    const newPayload = jwt.decode(newRefreshToken) as JwtPayload;
    const sessionTtl = newPayload.exp ? newPayload.exp - Math.floor(Date.now() / 1000) : 7 * 24 * 60 * 60;
    await redisClient.set(`session:${userId}:${newRefreshToken}`, '1', { EX: sessionTtl });

    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone ?? undefined,
        role: user.role,
        isActive: user.is_active,
      },
    };
  },

  async logout(refreshToken: string): Promise<void> {
    // Verify the token to get its expiration (even if expired, we still blacklist it)
    let payload: JwtPayload | null = null;
    try {
      payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as JwtPayload;
    } catch (error) {
      // Even if the token is expired, decode it to blacklist
      payload = jwt.decode(refreshToken) as JwtPayload | null;
    }

    if (payload && payload.exp) {
      const remainingTtl = payload.exp - Math.floor(Date.now() / 1000);
      if (remainingTtl > 0) {
        // Add to blacklist with TTL matching remaining token lifetime
        await redisClient.set(`blacklist:${refreshToken}`, '1', { EX: remainingTtl });
      }
    } else {
      // If we can't determine TTL, blacklist for the max refresh token lifetime (7 days)
      await redisClient.set(`blacklist:${refreshToken}`, '1', { EX: 7 * 24 * 60 * 60 });
    }

    // Remove the session tracking key if it exists
    if (payload && payload.sub) {
      await redisClient.del(`session:${payload.sub}:${refreshToken}`);
    }
  },

  async login(data: LoginDTO, ipAddress?: string): Promise<AuthResponse> {
    const lockKey = `account_lock:${data.email}`;

    // Check if account is locked in Redis
    const lockValue = await redisClient.get(lockKey);
    if (lockValue) {
      throw new AppError(ErrorCodes.ACCOUNT_LOCKED);
    }

    // Look up user by email
    const user = await userRepository.findByEmail(data.email);

    // If user not found, record failed attempt and throw generic error
    if (!user) {
      await loginAttemptRepository.create({
        user_id: null,
        email: data.email,
        success: false,
        ip_address: ipAddress || null,
      });

      // Check if we need to lock the account
      const failedCount = await loginAttemptRepository.countRecentFailed(data.email, ACCOUNT_LOCK_DURATION_MINUTES);
      if (failedCount >= MAX_LOGIN_ATTEMPTS) {
        await redisClient.set(lockKey, '1', { EX: ACCOUNT_LOCK_DURATION_MINUTES * 60 });
        throw new AppError(ErrorCodes.ACCOUNT_LOCKED);
      }

      throw new AppError(ErrorCodes.INVALID_CREDENTIALS);
    }

    // Verify password with bcrypt
    const passwordValid = await bcrypt.compare(data.password, user.password_hash);

    if (!passwordValid) {
      // Record failed attempt
      await loginAttemptRepository.create({
        user_id: user.id,
        email: data.email,
        success: false,
        ip_address: ipAddress || null,
      });

      // Check if we need to lock the account
      const failedCount = await loginAttemptRepository.countRecentFailed(data.email, ACCOUNT_LOCK_DURATION_MINUTES);
      if (failedCount >= MAX_LOGIN_ATTEMPTS) {
        await redisClient.set(lockKey, '1', { EX: ACCOUNT_LOCK_DURATION_MINUTES * 60 });
        throw new AppError(ErrorCodes.ACCOUNT_LOCKED);
      }

      throw new AppError(ErrorCodes.INVALID_CREDENTIALS);
    }

    // Successful login: record attempt and reset lock
    await loginAttemptRepository.create({
      user_id: user.id,
      email: data.email,
      success: true,
      ip_address: ipAddress || null,
    });

    // Remove any existing lock key (reset on successful login)
    await redisClient.del(lockKey);

    // Update last login timestamp
    await userRepository.updateLastLogin(user.id);

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone ?? undefined,
        role: user.role,
        isActive: user.is_active,
      },
    };
  },
};

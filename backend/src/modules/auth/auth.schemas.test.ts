import { describe, it, expect } from 'vitest';
import { RegisterDTO, LoginDTO, emailSchema, passwordSchema } from './auth.schemas';

describe('Auth Schemas', () => {
  describe('emailSchema', () => {
    it('should accept a valid email', () => {
      const result = emailSchema.safeParse('user@example.com');
      expect(result.success).toBe(true);
    });

    it('should reject an empty string', () => {
      const result = emailSchema.safeParse('');
      expect(result.success).toBe(false);
    });

    it('should reject an email without @', () => {
      const result = emailSchema.safeParse('userexample.com');
      expect(result.success).toBe(false);
    });

    it('should reject an email exceeding 254 characters', () => {
      const longEmail = 'a'.repeat(246) + '@test.com'; // 246 + 1 + 8 = 255 chars
      const result = emailSchema.safeParse(longEmail);
      expect(result.success).toBe(false);
    });

    it('should accept an email at exactly 254 characters', () => {
      // local part (max) + @ + domain = 254
      const localPart = 'a'.repeat(243);
      const email = `${localPart}@example.com`;
      // This is 243 + 1 + 11 = 255, so let's adjust
      const email254 = 'a'.repeat(242) + '@example.com'; // 242 + 1 + 11 = 254
      const result = emailSchema.safeParse(email254);
      expect(result.success).toBe(true);
    });
  });

  describe('passwordSchema', () => {
    it('should accept a valid password with uppercase, lowercase, and number', () => {
      const result = passwordSchema.safeParse('Password1');
      expect(result.success).toBe(true);
    });

    it('should reject a password shorter than 8 characters', () => {
      const result = passwordSchema.safeParse('Pass1');
      expect(result.success).toBe(false);
    });

    it('should reject a password without uppercase', () => {
      const result = passwordSchema.safeParse('password1');
      expect(result.success).toBe(false);
    });

    it('should reject a password without lowercase', () => {
      const result = passwordSchema.safeParse('PASSWORD1');
      expect(result.success).toBe(false);
    });

    it('should reject a password without a number', () => {
      const result = passwordSchema.safeParse('Password');
      expect(result.success).toBe(false);
    });

    it('should accept a password with exactly 8 characters', () => {
      const result = passwordSchema.safeParse('Abcdef1x');
      expect(result.success).toBe(true);
    });
  });

  describe('RegisterDTO', () => {
    it('should accept valid registration data', () => {
      const result = RegisterDTO.safeParse({
        email: 'test@example.com',
        password: 'Password1',
        name: 'John Doe',
      });
      expect(result.success).toBe(true);
    });

    it('should accept registration data with optional phone', () => {
      const result = RegisterDTO.safeParse({
        email: 'test@example.com',
        password: 'Password1',
        name: 'John Doe',
        phone: '+1234567890',
      });
      expect(result.success).toBe(true);
    });

    it('should reject registration without name', () => {
      const result = RegisterDTO.safeParse({
        email: 'test@example.com',
        password: 'Password1',
      });
      expect(result.success).toBe(false);
    });

    it('should reject registration with invalid email', () => {
      const result = RegisterDTO.safeParse({
        email: 'invalid-email',
        password: 'Password1',
        name: 'John Doe',
      });
      expect(result.success).toBe(false);
    });

    it('should reject registration with weak password', () => {
      const result = RegisterDTO.safeParse({
        email: 'test@example.com',
        password: 'weak',
        name: 'John Doe',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('LoginDTO', () => {
    it('should accept valid login data', () => {
      const result = LoginDTO.safeParse({
        email: 'test@example.com',
        password: 'anypassword',
      });
      expect(result.success).toBe(true);
    });

    it('should reject login without email', () => {
      const result = LoginDTO.safeParse({
        password: 'anypassword',
      });
      expect(result.success).toBe(false);
    });

    it('should reject login without password', () => {
      const result = LoginDTO.safeParse({
        email: 'test@example.com',
      });
      expect(result.success).toBe(false);
    });

    it('should reject login with invalid email format', () => {
      const result = LoginDTO.safeParse({
        email: 'not-an-email',
        password: 'anypassword',
      });
      expect(result.success).toBe(false);
    });
  });
});

import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

export interface UserPayload {
  id: number;
  email: string;
  role: 'user' | 'professional' | 'admin';
  isVerifiedProfessional: boolean;
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export function generateToken(payload: UserPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): UserPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as UserPayload;
  } catch {
    return null;
  }
}

export async function getAuthUser(request: NextRequest): Promise<UserPayload | null> {
  try {
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return null;
    }
    const payload = verifyToken(token);
    return payload;
  } catch (error) {
    console.error('Error getting auth user:', error);
    return null;
  }
}

export function setAuthCookie(token: string): string {
  return `auth-token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`;
}

export function clearAuthCookie(): string {
  return `auth-token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}


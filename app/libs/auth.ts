import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { NextRequest } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET as string;
const COOKIE_NAME = "delivery_app_token";

export type UserRole = "customer" | "admin" | "driver";

export interface AppJwtPayload {
  userId: string;
  role: UserRole;
  name: string;
  email: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: AppJwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): AppJwtPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (typeof payload === "object" && payload !== null) {
      return payload as unknown as AppJwtPayload;
    }
    return null;
  } catch {
    return null;
  }
}

export const AUTH_COOKIE_NAME = COOKIE_NAME;

export function getUserFromRequest(req: NextRequest): AppJwtPayload | null {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

// --- Password reset helpers ---
// The raw token is emailed to the user and never stored; only its SHA-256
// hash is saved in the database. This way, even if the database were
// compromised, the actual reset tokens couldn't be reconstructed.

export function generateResetToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashResetToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
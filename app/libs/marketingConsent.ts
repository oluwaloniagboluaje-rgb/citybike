import crypto from "crypto";
import { Types } from "mongoose";

const CONSENT_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 365 * 5;

function getTokenSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET must be configured for unsubscribe links.");
  }
  return secret;
}

export function createUnsubscribeToken(userId: string): string {
  const expiresAt = Math.floor(Date.now() / 1000) + CONSENT_TOKEN_TTL_SECONDS;
  const payload = `${userId}.${expiresAt}`;
  const signature = crypto
    .createHmac("sha256", getTokenSecret())
    .update(`marketing-unsubscribe:${payload}`)
    .digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  const [userId, expiresAt, signature, ...rest] = token.split(".");
  if (
    rest.length > 0 ||
    !userId ||
    !Types.ObjectId.isValid(userId) ||
    !expiresAt ||
    !signature ||
    !/^\d+$/.test(expiresAt) ||
    Number(expiresAt) < Math.floor(Date.now() / 1000)
  ) {
    return null;
  }

  const payload = `${userId}.${expiresAt}`;
  const expected = crypto
    .createHmac("sha256", getTokenSecret())
    .update(`marketing-unsubscribe:${payload}`)
    .digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  return userId;
}

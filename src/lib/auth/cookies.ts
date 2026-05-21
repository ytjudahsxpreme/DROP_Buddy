import "server-only";
import crypto from "node:crypto";
import type { NextRequest } from "next/server";

const COOKIE_PREFIX = "fa_";
const MASTER_COOKIE_NAME = "fa_master";
const COOKIE_MAX_AGE = 60 * 60 * 12; // 12 hours

function getSecret(): string {
  const s = process.env.UNLOCK_COOKIE_SECRET;
  if (!s) {
    throw new Error(
      "UNLOCK_COOKIE_SECRET env var is required. Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  return s;
}

export function cookieNameFor(fundraiserId: string): string {
  return `${COOKIE_PREFIX}${fundraiserId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

export function signUnlockValue(fundraiserId: string): string {
  return crypto.createHmac("sha256", getSecret()).update(fundraiserId).digest("hex");
}

export interface UnlockCookieDescriptor {
  name: string;
  value: string;
  options: {
    httpOnly: true;
    secure: boolean;
    sameSite: "lax";
    path: "/";
    maxAge: number;
  };
}

export function buildUnlockCookie(fundraiserId: string): UnlockCookieDescriptor {
  return {
    name: cookieNameFor(fundraiserId),
    value: signUnlockValue(fundraiserId),
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    },
  };
}

export function isUnlockedRequest(req: NextRequest, fundraiserId: string): boolean {
  const cookie = req.cookies.get(cookieNameFor(fundraiserId));
  if (!cookie) return false;
  const expected = signUnlockValue(fundraiserId);
  try {
    return crypto.timingSafeEqual(Buffer.from(cookie.value), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Master-cookie value is HMAC of the literal string "master" + the secret.
 * Issued only when the user enters the master access code.
 */
function signMasterValue(): string {
  return crypto.createHmac("sha256", getSecret()).update("master").digest("hex");
}

export function buildMasterUnlockCookie(): UnlockCookieDescriptor {
  return {
    name: MASTER_COOKIE_NAME,
    value: signMasterValue(),
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    },
  };
}

export function isMasterUnlockedRequest(req: NextRequest): boolean {
  const cookie = req.cookies.get(MASTER_COOKIE_NAME);
  if (!cookie) return false;
  const expected = signMasterValue();
  try {
    return crypto.timingSafeEqual(Buffer.from(cookie.value), Buffer.from(expected));
  } catch {
    return false;
  }
}

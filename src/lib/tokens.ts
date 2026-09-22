import crypto from "crypto";

function getSecret(): string {
  const secret = process.env.GAME_SECRET || process.env.BOOTH_PIN || "default_super_secret_game_signing_key_32_chars";
  return secret;
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64").toString("utf8");
}

export function signToken<T extends object>(payload: T, expiresInSec?: number): string {
  const secret = getSecret();
  const nowSec = Math.floor(Date.now() / 1000);
  const data = {
    ...payload,
    iat: nowSec,
    ...(expiresInSec ? { exp: nowSec + expiresInSec } : {}),
  };

  const jsonStr = JSON.stringify(data);
  const encodedPayload = base64UrlEncode(jsonStr);
  const signature = crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${encodedPayload}.${signature}`;
}

export function verifyToken<T extends object>(
  token: string
): { valid: boolean; payload?: T; expired?: boolean } {
  if (!token || typeof token !== "string") {
    return { valid: false };
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    return { valid: false };
  }

  const [encodedPayload, signature] = parts;
  const secret = getSecret();

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  // Constant-time comparison
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return { valid: false };
  }

  try {
    const jsonStr = base64UrlDecode(encodedPayload);
    const payload = JSON.parse(jsonStr) as T & { exp?: number };

    if (payload.exp && typeof payload.exp === "number") {
      const nowSec = Math.floor(Date.now() / 1000);
      if (nowSec > payload.exp) {
        return { valid: false, expired: true };
      }
    }

    return { valid: true, payload };
  } catch {
    return { valid: false };
  }
}

export interface BoothTokenPayload {
  role: "booth";
  iat?: number;
  exp?: number;
}

export interface AttemptTokenPayload {
  level: number;
  startedAt: number; // Unix timestamp in ms
  nonce: string;
  exp?: number;
}

export interface ClaimTokenPayload {
  level: number;
  points: number;
  nonce: string;
  hintsUsed: number;
  elapsedSec: number;
  exp?: number;
}

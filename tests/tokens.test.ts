import { describe, it, expect } from "vitest";
import {
  signToken,
  verifyToken,
  BoothTokenPayload,
  AttemptTokenPayload,
  ClaimTokenPayload,
} from "../src/lib/tokens";

describe("HMAC-SHA256 Token Security", () => {
  it("successfully signs and verifies a booth token", () => {
    const payload: BoothTokenPayload = { role: "booth" };
    const token = signToken(payload, 3600);
    const result = verifyToken<BoothTokenPayload>(token);

    expect(result.valid).toBe(true);
    expect(result.payload?.role).toBe("booth");
  });

  it("fails verification when token signature is tampered", () => {
    const token = signToken({ level: 1, nonce: "test12345", startedAt: Date.now() }, 3600);
    const parts = token.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({ level: 5, nonce: "test12345", startedAt: Date.now(), exp: 9999999999 })
    ).toString("base64url");

    const tamperedToken = `${tamperedPayload}.${parts[1]}`;
    const result = verifyToken(tamperedToken);

    expect(result.valid).toBe(false);
    expect(result.payload).toBeUndefined();
  });

  it("fails verification for expired tokens", () => {
    const token = signToken({ level: 1, nonce: "nonce1", startedAt: Date.now() }, -10); // expired 10s ago
    const result = verifyToken(token);

    expect(result.valid).toBe(false);
    expect(result.payload).toBeUndefined();
  });

  it("protects level claiming - attemptToken level cannot be substituted", () => {
    const attempt1 = signToken<AttemptTokenPayload>(
      { level: 1, startedAt: Date.now(), nonce: "nonce_l1" },
      300
    );
    const verified = verifyToken<AttemptTokenPayload>(attempt1);
    expect(verified.valid).toBe(true);
    expect(verified.payload?.level).toBe(1);
    expect(verified.payload?.level).not.toBe(2);
  });
});

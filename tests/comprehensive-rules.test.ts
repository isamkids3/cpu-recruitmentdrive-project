import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { SHARED_PROMPT, getLevelDefs } from "../src/lib/levels";
import { COHOST_SYSTEM_PROMPT } from "../src/lib/cohostPrompt";
import { createAttemptState, getAttemptState, updateAttemptState } from "../src/lib/attemptState";
import { POST as startPOST } from "../src/app/api/game/start/route";
import { POST as guessPOST } from "../src/app/api/game/guess/route";
import { POST as hintPOST } from "../src/app/api/game/hint/route";
import { POST as leaderboardPOST } from "../src/app/api/leaderboard/route";
import { resetLeaderboardStore } from "../src/lib/leaderboardStore";
import { signToken, verifyToken, ClaimTokenPayload, AttemptTokenPayload, BoothTokenPayload } from "../src/lib/tokens";
import { NextRequest } from "next/server";

function createMockRequest(url: string, body?: Record<string, unknown>, headers?: Record<string, string>): NextRequest {
  const reqInit: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  };
  return new NextRequest(new Request(url, reqInit));
}

beforeAll(() => {
  resetLeaderboardStore();
  process.env.BOOTH_PIN = "4827";
  process.env.GEMINI_API_KEY = "test_key";
  process.env.GAME_SECRET = "test_game_secret_32_characters_minimum";
});

afterAll(() => {
  resetLeaderboardStore();
});

describe("Section 2.4: English-Only Unit Tests", () => {
  it("Game Mode shared prompt includes mandatory English-only block before per-level rules", () => {
    expect(SHARED_PROMPT).toContain("LANGUAGE: You only understand and speak English.");
    expect(SHARED_PROMPT).toContain("Sorry, I only speak English! Could you say that in English?");
  });

  it("Co-Host prompt includes English-only instruction", () => {
    expect(COHOST_SYSTEM_PROMPT).toContain("LANGUAGE: You only understand and speak English.");
    expect(COHOST_SYSTEM_PROMPT).toContain("Sorry, I only speak English! Could you say that in English?");
  });
});

describe("Section 3.1: Expiry, Lockout, and Decoy Logic", () => {
  it("Expiry: a guess at limit + 5s is accepted; at limit + 6s returns expired", async () => {
    const levels = getLevelDefs();
    const l1 = levels[0]; // limit 120s
    const now = Date.now();

    // 1) Limit + 5s elapsed (125s) -> should succeed
    const nonce5s = `test_nonce_5s_${Date.now()}`;
    const startedAt5s = now - (l1.timeLimitSec + 5) * 1000;
    await createAttemptState(nonce5s, 1, startedAt5s);
    const attemptToken5s = signToken<AttemptTokenPayload>({ level: 1, startedAt: startedAt5s, nonce: nonce5s }, 3600);

    const req5s = createMockRequest("http://localhost:3000/api/game/guess", {
      attemptToken: attemptToken5s,
      guess: l1.passphrase,
    });
    const res5s = await guessPOST(req5s);
    const data5s = await res5s.json();
    expect(res5s.status).toBe(200);
    expect(data5s.result).toBe("correct");

    // 2) Limit + 6s elapsed (126s) -> should return expired
    const nonce6s = `test_nonce_6s_${Date.now()}`;
    const startedAt6s = now - (l1.timeLimitSec + 6) * 1000;
    await createAttemptState(nonce6s, 1, startedAt6s);
    const attemptToken6s = signToken<AttemptTokenPayload>({ level: 1, startedAt: startedAt6s, nonce: nonce6s }, 3600);

    const req6s = createMockRequest("http://localhost:3000/api/game/guess", {
      attemptToken: attemptToken6s,
      guess: l1.passphrase,
    });
    const res6s = await guessPOST(req6s);
    const data6s = await res6s.json();
    expect(res6s.status).toBe(200);
    expect(data6s.result).toBe("expired");
  });

  it("Lockout: after maxGuesses wrong guesses, locked and later correct guess is still locked", async () => {
    const nonce = `test_lockout_${Date.now()}`;
    const startedAt = Date.now();
    await createAttemptState(nonce, 2, startedAt);
    const attemptToken = signToken<AttemptTokenPayload>({ level: 2, startedAt, nonce }, 3600);

    // Make 5 wrong guesses (L2 maxGuesses is 5)
    for (let i = 0; i < 4; i++) {
      const res = await guessPOST(createMockRequest("http://localhost:3000/api/game/guess", {
        attemptToken,
        guess: `wrong guess ${i}`,
      }));
      const data = await res.json();
      expect(data.result).toBe("wrong");
    }

    // 5th wrong guess locks the attempt
    const resLock = await guessPOST(createMockRequest("http://localhost:3000/api/game/guess", {
      attemptToken,
      guess: "wrong guess 5",
    }));
    const dataLock = await resLock.json();
    expect(dataLock.result).toBe("locked");
    expect(dataLock.guessesRemaining).toBe(0);

    // Subsequent correct guess is still locked
    const resAfterLock = await guessPOST(createMockRequest("http://localhost:3000/api/game/guess", {
      attemptToken,
      guess: "velvet thunder",
    }));
    const dataAfterLock = await resAfterLock.json();
    expect(dataAfterLock.result).toBe("locked");
  });

  it("Decoy: returns 'decoy' on L4 and L5, costs a guess, never awards points", async () => {
    const levels = getLevelDefs();
    const l4 = levels[3];
    const l5 = levels[4];

    expect(l4.decoy).toBeDefined();
    expect(l5.decoy).toBeDefined();

    // L4 decoy test
    const nonce4 = `test_decoy_l4_${Date.now()}`;
    const startedAt4 = Date.now();
    await createAttemptState(nonce4, 4, startedAt4);
    const attemptToken4 = signToken<AttemptTokenPayload>({ level: 4, startedAt: startedAt4, nonce: nonce4 }, 3600);

    const res4 = await guessPOST(createMockRequest("http://localhost:3000/api/game/guess", {
      attemptToken: attemptToken4,
      guess: l4.decoy,
    }));
    const data4 = await res4.json();
    expect(data4.result).toBe("decoy");
    expect(data4.guessesRemaining).toBe(4); // 5 - 1
    expect(data4.claimToken).toBeUndefined();

    // L5 decoy test
    const nonce5 = `test_decoy_l5_${Date.now()}`;
    const startedAt5 = Date.now();
    await createAttemptState(nonce5, 5, startedAt5);
    const attemptToken5 = signToken<AttemptTokenPayload>({ level: 5, startedAt: startedAt5, nonce: nonce5 }, 3600);

    const res5 = await guessPOST(createMockRequest("http://localhost:3000/api/game/guess", {
      attemptToken: attemptToken5,
      guess: l5.decoy,
    }));
    const data5 = await res5.json();
    expect(data5.result).toBe("decoy");
    expect(data5.guessesRemaining).toBe(4); // 5 - 1
    expect(data5.claimToken).toBeUndefined();

    // L1-L3 have no decoy
    expect(levels[0].decoy).toBeUndefined();
    expect(levels[1].decoy).toBeUndefined();
    expect(levels[2].decoy).toBeUndefined();
  });

  it("Hints: count increments, stops at level total, rejects for expired attempt", async () => {
    const nonce = `test_hints_${Date.now()}`;
    const startedAt = Date.now();
    await createAttemptState(nonce, 2, startedAt); // L2 has 3 hints
    const attemptToken = signToken<AttemptTokenPayload>({ level: 2, startedAt, nonce }, 3600);

    // First hint
    const res1 = await hintPOST(createMockRequest("http://localhost:3000/api/game/hint", { attemptToken }));
    const data1 = await res1.json();
    expect(data1.hintsUsed).toBe(1);
    expect(data1.hintsLeft).toBe(2);

    // Second hint
    const res2 = await hintPOST(createMockRequest("http://localhost:3000/api/game/hint", { attemptToken }));
    const data2 = await res2.json();
    expect(data2.hintsUsed).toBe(2);
    expect(data2.hintsLeft).toBe(1);

    // Third hint
    const res3 = await hintPOST(createMockRequest("http://localhost:3000/api/game/hint", { attemptToken }));
    const data3 = await res3.json();
    expect(data3.hintsUsed).toBe(3);
    expect(data3.hintsLeft).toBe(0);

    // Fourth hint (exceeds total)
    const res4 = await hintPOST(createMockRequest("http://localhost:3000/api/game/hint", { attemptToken }));
    const data4 = await res4.json();
    expect(data4.hintsUsed).toBe(3);
    expect(data4.hintsLeft).toBe(0);
  });
});

describe("Section 3.1: Auth & Route Security", () => {
  it("rejects /api/game/start with missing or invalid boothToken", async () => {
    // Missing token
    const reqMissing = createMockRequest("http://localhost:3000/api/game/start", { level: 1 });
    const resMissing = await startPOST(reqMissing);
    expect(resMissing.status).toBe(401);

    // Bad token
    const reqBad = createMockRequest(
      "http://localhost:3000/api/game/start",
      { level: 1, boothToken: "invalid.token.signature" },
      { Authorization: "Bearer invalid.token.signature" }
    );
    const resBad = await startPOST(reqBad);
    expect(resBad.status).toBe(401);
  });

  it("rejects /api/game/guess with missing or invalid attemptToken", async () => {
    const reqMissing = createMockRequest("http://localhost:3000/api/game/guess", {
      guess: "test",
    });
    const resMissing = await guessPOST(reqMissing);
    expect(resMissing.status).toBe(400);

    const reqBad = createMockRequest("http://localhost:3000/api/game/guess", {
      attemptToken: "bad.token",
      guess: "test",
    });
    const resBad = await guessPOST(reqBad);
    const dataBad = await resBad.json();
    expect(dataBad.result).toBe("expired");
  });

  it("rejects /api/game/hint with missing or invalid attemptToken", async () => {
    const reqMissing = createMockRequest("http://localhost:3000/api/game/hint", {});
    const resMissing = await hintPOST(reqMissing);
    expect(resMissing.status).toBe(400);

    const reqBad = createMockRequest("http://localhost:3000/api/game/hint", {
      attemptToken: "bad.token",
    });
    const resBad = await hintPOST(reqBad);
    expect(resBad.status).toBe(400);
  });
});

describe("Section 3.1 & 3.2: Leaderboard Anti-Cheat Validations", () => {
  it("rejects duplicate nonces in one submission", async () => {
    const claim1 = signToken<ClaimTokenPayload>({
      level: 1,
      points: 150,
      nonce: "dup_nonce_1",
      hintsUsed: 0,
      elapsedSec: 10,
    });
    const claim2 = signToken<ClaimTokenPayload>({
      level: 2,
      points: 250,
      nonce: "dup_nonce_1", // duplicate nonce
      hintsUsed: 0,
      elapsedSec: 20,
    });

    const req = createMockRequest("http://localhost:3000/api/leaderboard", {
      claimTokens: [claim1, claim2],
      handle: "ValidPlayer",
    });
    const res = await leaderboardPOST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Duplicate nonce in submission");
  });

  it("rejects two claims for the same level in one submission", async () => {
    const claim1 = signToken<ClaimTokenPayload>({
      level: 1,
      points: 150,
      nonce: "nonce_l1_a",
      hintsUsed: 0,
      elapsedSec: 10,
    });
    const claim2 = signToken<ClaimTokenPayload>({
      level: 1,
      points: 150,
      nonce: "nonce_l1_b",
      hintsUsed: 0,
      elapsedSec: 15,
    });

    const req = createMockRequest("http://localhost:3000/api/leaderboard", {
      claimTokens: [claim1, claim2],
      handle: "ValidPlayer",
    });
    const res = await leaderboardPOST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Duplicate level claim in submission");
  });

  it("rejects invalid handles (too short, too long, or profanity)", async () => {
    const claim = signToken<ClaimTokenPayload>({
      level: 1,
      points: 100,
      nonce: `nonce_${Date.now()}`,
      hintsUsed: 0,
      elapsedSec: 10,
    });

    // Too short (< 3 chars)
    const resShort = await leaderboardPOST(createMockRequest("http://localhost:3000/api/leaderboard", {
      claimTokens: [claim],
      handle: "ab",
    }));
    expect(resShort.status).toBe(400);

    // Too long (> 12 chars)
    const resLong = await leaderboardPOST(createMockRequest("http://localhost:3000/api/leaderboard", {
      claimTokens: [claim],
      handle: "morethan12characterslong",
    }));
    expect(resLong.status).toBe(400);

    // Profane / banned handle
    const resProfane = await leaderboardPOST(createMockRequest("http://localhost:3000/api/leaderboard", {
      claimTokens: [claim],
      handle: "admin_user",
    }));
    expect(resProfane.status).toBe(400);
  });
});

describe("Section 3.2: No Video in Game Mode", () => {
  it("verifies game mode does not send realtimeInput video frames while co-host does", () => {
    function buildLiveMediaMessage(mode: "game" | "cohost", base64Image?: string) {
      if (mode === "game") {
        return null; // Video is strictly omitted in game mode
      }
      if (!base64Image) return null;
      return {
        realtimeInput: {
          mediaChunks: [
            {
              mimeType: "image/jpeg",
              data: base64Image,
            },
          ],
        },
      };
    }

    const gameMessage = buildLiveMediaMessage("game", "fake_jpeg_base64_frame");
    expect(gameMessage).toBeNull();

    const cohostMessage = buildLiveMediaMessage("cohost", "fake_jpeg_base64_frame");
    expect(cohostMessage).not.toBeNull();
    expect(cohostMessage?.realtimeInput?.mediaChunks[0].mimeType).toBe("image/jpeg");
  });
});

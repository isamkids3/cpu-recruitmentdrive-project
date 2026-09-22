import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { POST as sessionPOST } from "../src/app/api/session/route";
import { POST as startPOST } from "../src/app/api/game/start/route";
import { POST as hintPOST } from "../src/app/api/game/hint/route";
import { POST as guessPOST } from "../src/app/api/game/guess/route";
import { POST as leaderboardPOST, GET as leaderboardGET } from "../src/app/api/leaderboard/route";
import { resetLeaderboardStore } from "../src/lib/leaderboardStore";
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

describe("Full Game API Integration Flow", () => {
  let boothToken: string;
  let attemptToken: string;
  let claimToken: string;

  beforeAll(() => {
    resetLeaderboardStore();
    process.env.BOOTH_PIN = "4827";
    process.env.GEMINI_API_KEY = "test_gemini_api_key";
    process.env.GAME_SECRET = "test_game_secret_key_32_characters_minimum";
  });

  afterAll(() => {
    resetLeaderboardStore();
  });

  it("Stage 1: Authenticates with valid PIN and receives boothToken", async () => {
    const req = createMockRequest("http://localhost:3000/api/session", { pin: "4827" });
    const res = await sessionPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(typeof data.boothToken).toBe("string");
    boothToken = data.boothToken;
  });

  it("Stage 2: Starts a game level using boothToken", async () => {
    const req = createMockRequest(
      "http://localhost:3000/api/game/start",
      { level: 1, boothToken },
      { Authorization: `Bearer ${boothToken}` }
    );
    const res = await startPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(typeof data.attemptToken).toBe("string");
    expect(data.level.id).toBe(1);
    expect(data.openingLine).toBeDefined();
    attemptToken = data.attemptToken;
  });

  it("Stage 3: Requests a hint with attemptToken", async () => {
    const req = createMockRequest("http://localhost:3000/api/game/hint", { attemptToken });
    const res = await hintPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.hint).toBeDefined();
    expect(data.hintsUsed).toBe(1);
  });

  it("Stage 4: Submits a wrong guess", async () => {
    const req = createMockRequest("http://localhost:3000/api/game/guess", {
      attemptToken,
      guess: "totally wrong guess",
    });
    const res = await guessPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.correct).toBe(false);
    expect(data.guessesRemaining).toBe(4);
  });

  it("Stage 5: Submits the correct guess and receives claimToken", async () => {
    const req = createMockRequest("http://localhost:3000/api/game/guess", {
      attemptToken,
      guess: "purple pizza",
    });
    const res = await guessPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.correct).toBe(true);
    expect(typeof data.claimToken).toBe("string");
    expect(data.pointsAwarded).toBeGreaterThan(0);
    claimToken = data.claimToken;
  });

  it("Stage 6: Prevents duplicate win claim on the same attempt", async () => {
    const req = createMockRequest("http://localhost:3000/api/game/guess", {
      attemptToken,
      guess: "purple pizza",
    });
    const res = await guessPOST(req);
    expect(res.status).toBe(400);
  });

  it("Stage 7: Submits score to Leaderboard with claimToken", async () => {
    const req = createMockRequest("http://localhost:3000/api/leaderboard", {
      claimTokens: [claimToken],
      handle: "GraceHopper",
    });
    const res = await leaderboardPOST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it("Stage 8: Blocks replay attack with the same claimToken", async () => {
    const req = createMockRequest("http://localhost:3000/api/leaderboard", {
      claimTokens: [claimToken],
      handle: "ReplayBad",
    });
    const res = await leaderboardPOST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("Claim token already redeemed");
  });
});

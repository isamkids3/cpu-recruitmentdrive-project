import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getLeaderboard, addLeaderboardEntry, hasClaimedNonce, resetLeaderboardStore, LeaderboardEntry } from "../src/lib/leaderboardStore";

describe("Leaderboard Store & Rules", () => {
  beforeEach(() => {
    resetLeaderboardStore();
  });

  afterAll(() => {
    resetLeaderboardStore();
  });

  it("sorts entries primarily by total points descending, secondarily by elapsedSec ascending", async () => {
    const entryA: LeaderboardEntry = {
      handle: "PlayerA",
      totalPoints: 500,
      levelsCleared: 2,
      totalElapsedSec: 60,
      ts: Date.now(),
    };
    const entryB: LeaderboardEntry = {
      handle: "PlayerB",
      totalPoints: 500,
      levelsCleared: 2,
      totalElapsedSec: 40, // faster time
      ts: Date.now() + 10,
    };
    const entryC: LeaderboardEntry = {
      handle: "PlayerC",
      totalPoints: 800,
      levelsCleared: 3,
      totalElapsedSec: 100,
      ts: Date.now() + 20,
    };

    await addLeaderboardEntry(entryA, ["nonce_a"]);
    await addLeaderboardEntry(entryB, ["nonce_b"]);
    await addLeaderboardEntry(entryC, ["nonce_c"]);

    const board = await getLeaderboard(10);
    const posC = board.findIndex((e) => e.handle === "PlayerC");
    const posB = board.findIndex((e) => e.handle === "PlayerB");
    const posA = board.findIndex((e) => e.handle === "PlayerA");

    expect(posC).toBeLessThan(posB);
    expect(posB).toBeLessThan(posA);
  });

  it("tracks claimed nonces to prevent double spending / replay", async () => {
    const nonce = `test_nonce_${Date.now()}`;
    expect(await hasClaimedNonce(nonce)).toBe(false);

    await addLeaderboardEntry(
      {
        handle: "ReplayTester",
        totalPoints: 100,
        levelsCleared: 1,
        totalElapsedSec: 10,
        ts: Date.now(),
      },
      [nonce]
    );

    expect(await hasClaimedNonce(nonce)).toBe(true);
  });
});

import { describe, it, expect } from "vitest";

function calculateScore(
  basePoints: number,
  timeLimitSec: number,
  elapsedSec: number,
  hintsUsed: number,
  hintPenaltyPct: number
): { base: number; timeBonus: number; penalty: number; total: number } {
  const remainingTime = Math.max(0, timeLimitSec - elapsedSec);
  const timeBonus = Math.round(basePoints * 0.5 * (remainingTime / timeLimitSec));
  const penalty = hintsUsed * Math.round((basePoints * hintPenaltyPct) / 100);
  const floor = Math.round(basePoints * 0.25);
  const total = Math.max(floor, basePoints + timeBonus - penalty);

  return { base: basePoints, timeBonus, penalty, total };
}

describe("Server-enforced Scoring Formula", () => {
  it("computes exact scores at full time, half time, and time limit without hints", () => {
    // Level 1: 100 base, 120s limit, 0% penalty
    const fullTimeL1 = calculateScore(100, 120, 0, 0, 0);
    expect(fullTimeL1.timeBonus).toBe(50); // 100 * 0.5 * 1
    expect(fullTimeL1.total).toBe(150);

    const halfTimeL1 = calculateScore(100, 120, 60, 0, 0);
    expect(halfTimeL1.timeBonus).toBe(25); // 100 * 0.5 * 0.5
    expect(halfTimeL1.total).toBe(125);

    const limitL1 = calculateScore(100, 120, 120, 0, 0);
    expect(limitL1.timeBonus).toBe(0); // 100 * 0.5 * 0
    expect(limitL1.total).toBe(100);
  });

  it("computes exact hint penalties for Level 2 (200 base, 15% penalty = 30 pts/hint)", () => {
    // Full time, 1 hint: 200 + 100 - 30 = 270
    const oneHint = calculateScore(200, 90, 0, 1, 15);
    expect(oneHint.penalty).toBe(30);
    expect(oneHint.total).toBe(270);

    // Full time, 2 hints: 200 + 100 - 60 = 240
    const twoHints = calculateScore(200, 90, 0, 2, 15);
    expect(twoHints.penalty).toBe(60);
    expect(twoHints.total).toBe(240);

    // Full time, 3 hints: 200 + 100 - 90 = 210
    const threeHints = calculateScore(200, 90, 0, 3, 15);
    expect(threeHints.penalty).toBe(90);
    expect(threeHints.total).toBe(210);
  });

  it("respects the 25% floor even with heavy penalties and zero remaining time", () => {
    // Level 3: 300 base, floor is 75 (25% of 300)
    // Elapsed = 120s (0 time bonus), 10 hints used (penalty 450)
    const floored = calculateScore(300, 120, 120, 10, 15);
    expect(floored.total).toBe(75); // 300 * 0.25
  });

  it("Level 1 has 0% hint penalty so hints never reduce score", () => {
    const l1WithHints = calculateScore(100, 120, 0, 3, 0);
    expect(l1WithHints.penalty).toBe(0);
    expect(l1WithHints.total).toBe(150);
  });
});

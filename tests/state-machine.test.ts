import { describe, it, expect } from "vitest";
import { gameReducer, initialGameSessionState, GameSessionState } from "../src/lib/gameReducer";

describe("Game State Machine Pure Reducer", () => {
  it("transitions smoothly through full win loop", () => {
    let state: GameSessionState = initialGameSessionState;
    expect(state.gameState).toBe("ATTRACT");

    // Start Level 1
    state = gameReducer(state, {
      type: "START_LEVEL",
      payload: { levelId: 1, timeLimitSec: 120, maxGuesses: 10, attemptToken: "tok_1" },
    });
    expect(state.gameState).toBe("BRIEFING");
    expect(state.selectedLevelId).toBe(1);
    expect(state.guessesRemaining).toBe(10);

    // Briefing Countdown Finishes -> Live
    state = gameReducer(state, { type: "BRIEFING_COMPLETE" });
    expect(state.gameState).toBe("LIVE");

    // Guess correct
    state = gameReducer(state, {
      type: "CORRECT_GUESS",
      payload: {
        claimToken: "claim_tok_1",
        scoreBreakdown: { base: 100, timeBonus: 50, hintPenalty: 0, total: 150 },
      },
    });
    expect(state.gameState).toBe("CRACKED");
    expect(state.levelsCleared).toEqual([1]);
    expect(state.currentClaimToken).toBe("claim_tok_1");

    // Next Level -> Level 2 Briefing
    state = gameReducer(state, {
      type: "NEXT_LEVEL",
      payload: { nextLevelId: 2, timeLimitSec: 90, maxGuesses: 5 },
    });
    expect(state.gameState).toBe("BRIEFING");
    expect(state.selectedLevelId).toBe(2);
    expect(state.levelsCleared).toEqual([1]); // Preserves previous clears
  });

  it("transitions to LOCKED_OUT when remaining guesses reach 0", () => {
    let state = gameReducer(initialGameSessionState, {
      type: "START_LEVEL",
      payload: { levelId: 2, timeLimitSec: 90, maxGuesses: 2 },
    });
    state = gameReducer(state, { type: "BRIEFING_COMPLETE" });

    // 1 wrong guess
    state = gameReducer(state, {
      type: "WRONG_GUESS",
      payload: { guessesRemaining: 1, message: "Wrong" },
    });
    expect(state.gameState).toBe("LIVE");
    expect(state.guessesRemaining).toBe(1);

    // 2nd wrong guess (out of guesses)
    state = gameReducer(state, {
      type: "WRONG_GUESS",
      payload: { guessesRemaining: 0, message: "Out of guesses" },
    });
    expect(state.gameState).toBe("LOCKED_OUT");
    expect(state.guessesRemaining).toBe(0);
  });

  it("handles timeout and reset to attract correctly", () => {
    let state = gameReducer(initialGameSessionState, {
      type: "START_LEVEL",
      payload: { levelId: 3, timeLimitSec: 120, maxGuesses: 5 },
    });
    state = gameReducer(state, { type: "BRIEFING_COMPLETE" });

    state = gameReducer(state, { type: "TIMEOUT" });
    expect(state.gameState).toBe("TIMEOUT");

    state = gameReducer(state, { type: "RESET_TO_ATTRACT" });
    expect(state.gameState).toBe("ATTRACT");
  });
});

export type GameMode = "game" | "cohost";

export type GameState =
  | "ATTRACT"
  | "BRIEFING"
  | "LIVE"
  | "CRACKED"
  | "TIMEOUT"
  | "LOCKED_OUT";

export interface ScoreBreakdown {
  base: number;
  timeBonus: number;
  hintPenalty: number;
  total: number;
}

export interface GameTranscriptItem {
  id: string;
  sender: "user" | "robot";
  text: string;
  isLeak?: boolean;
}

export interface GameSessionState {
  gameState: GameState;
  selectedLevelId: number;
  levelsCleared: number[];
  attemptToken: string | null;
  claimTokens: string[];
  currentClaimToken: string | null;
  timeLeft: number;
  guessesRemaining: number;
  hintUsed: boolean;
  hintText: string | null;
  transcripts: GameTranscriptItem[];
  scoreBreakdown: ScoreBreakdown | null;
  decoyTripped: boolean;
  feedbackMessage: { text: string; type: "error" | "info" | "warning" } | null;
  isSubmittingGuess: boolean;
}

export const initialGameSessionState: GameSessionState = {
  gameState: "ATTRACT",
  selectedLevelId: 1,
  levelsCleared: [],
  attemptToken: null,
  claimTokens: [],
  currentClaimToken: null,
  timeLeft: 120,
  guessesRemaining: 10,
  hintUsed: false,
  hintText: null,
  transcripts: [],
  scoreBreakdown: null,
  decoyTripped: false,
  feedbackMessage: null,
  isSubmittingGuess: false,
};

export type GameAction =
  | {
      type: "START_LEVEL";
      payload: { levelId: number; timeLimitSec: number; maxGuesses: number; attemptToken?: string };
    }
  | { type: "BRIEFING_COMPLETE" }
  | {
      type: "CORRECT_GUESS";
      payload: { claimToken: string; scoreBreakdown: ScoreBreakdown };
    }
  | {
      type: "WRONG_GUESS";
      payload: { guessesRemaining: number; message: string; decoy?: boolean };
    }
  | { type: "TIMEOUT" }
  | { type: "HINT_RECEIVED"; payload: { hint: string } }
  | { type: "TICK_TIME" }
  | { type: "ADD_TRANSCRIPT"; payload: GameTranscriptItem }
  | { type: "APPEND_ROBOT_TRANSCRIPT"; payload: { chunk: string; isLeak?: boolean } }
  | { type: "SET_FEEDBACK"; payload: { text: string; type: "error" | "info" | "warning" } | null }
  | { type: "SET_SUBMITTING"; payload: boolean }
  | { type: "NEXT_LEVEL"; payload: { nextLevelId: number; timeLimitSec: number; maxGuesses: number } }
  | { type: "RETRY_LEVEL"; payload: { timeLimitSec: number; maxGuesses: number } }
  | { type: "RESET_TO_ATTRACT" };

export function gameReducer(
  state: GameSessionState,
  action: GameAction
): GameSessionState {
  switch (action.type) {
    case "START_LEVEL":
      return {
        ...state,
        gameState: "BRIEFING",
        selectedLevelId: action.payload.levelId,
        attemptToken: action.payload.attemptToken || null,
        currentClaimToken: null,
        timeLeft: action.payload.timeLimitSec,
        guessesRemaining: action.payload.maxGuesses,
        hintUsed: false,
        hintText: null,
        transcripts: [],
        scoreBreakdown: null,
        decoyTripped: false,
        feedbackMessage: null,
        isSubmittingGuess: false,
      };

    case "BRIEFING_COMPLETE":
      return {
        ...state,
        gameState: "LIVE",
      };

    case "CORRECT_GUESS": {
      const cleared = state.levelsCleared.includes(state.selectedLevelId)
        ? state.levelsCleared
        : [...state.levelsCleared, state.selectedLevelId];

      return {
        ...state,
        gameState: "CRACKED",
        currentClaimToken: action.payload.claimToken,
        claimTokens: [...state.claimTokens, action.payload.claimToken],
        scoreBreakdown: action.payload.scoreBreakdown,
        levelsCleared: cleared,
        isSubmittingGuess: false,
        feedbackMessage: null,
      };
    }

    case "WRONG_GUESS": {
      const locked = action.payload.guessesRemaining <= 0;
      return {
        ...state,
        gameState: locked ? "LOCKED_OUT" : state.gameState,
        guessesRemaining: action.payload.guessesRemaining,
        decoyTripped: action.payload.decoy ? true : state.decoyTripped,
        feedbackMessage: {
          text: action.payload.message,
          type: action.payload.decoy ? "warning" : "error",
        },
        isSubmittingGuess: false,
      };
    }

    case "TIMEOUT":
      return {
        ...state,
        gameState: "TIMEOUT",
        timeLeft: 0,
      };

    case "HINT_RECEIVED":
      return {
        ...state,
        hintUsed: true,
        hintText: action.payload.hint,
      };

    case "TICK_TIME":
      if (state.gameState !== "LIVE" || state.timeLeft <= 0) return state;
      if (state.timeLeft === 1) {
        return {
          ...state,
          gameState: "TIMEOUT",
          timeLeft: 0,
        };
      }
      return {
        ...state,
        timeLeft: state.timeLeft - 1,
      };

    case "ADD_TRANSCRIPT":
      return {
        ...state,
        transcripts: [...state.transcripts, action.payload],
      };

    case "APPEND_ROBOT_TRANSCRIPT": {
      const prev = state.transcripts;
      const last = prev[prev.length - 1];
      if (last && last.sender === "robot") {
        const separator =
          last.text.endsWith(" ") || action.payload.chunk.startsWith(" ") || last.text === ""
            ? ""
            : " ";
        const updated = [...prev];
        updated[prev.length - 1] = {
          ...last,
          text: last.text + separator + action.payload.chunk,
          isLeak: last.isLeak || action.payload.isLeak,
        };
        return { ...state, transcripts: updated };
      }
      return {
        ...state,
        transcripts: [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            sender: "robot",
            text: action.payload.chunk.trim(),
            isLeak: action.payload.isLeak,
          },
        ],
      };
    }

    case "SET_FEEDBACK":
      return {
        ...state,
        feedbackMessage: action.payload,
      };

    case "SET_SUBMITTING":
      return {
        ...state,
        isSubmittingGuess: action.payload,
      };

    case "NEXT_LEVEL":
      return {
        ...state,
        gameState: "BRIEFING",
        selectedLevelId: action.payload.nextLevelId,
        timeLeft: action.payload.timeLimitSec,
        guessesRemaining: action.payload.maxGuesses,
        hintUsed: false,
        hintText: null,
        transcripts: [],
        scoreBreakdown: null,
        decoyTripped: false,
        feedbackMessage: null,
        isSubmittingGuess: false,
      };

    case "RETRY_LEVEL":
      return {
        ...state,
        gameState: "BRIEFING",
        timeLeft: action.payload.timeLimitSec,
        guessesRemaining: action.payload.maxGuesses,
        hintUsed: false,
        hintText: null,
        transcripts: [],
        scoreBreakdown: null,
        decoyTripped: false,
        feedbackMessage: null,
        isSubmittingGuess: false,
      };

    case "RESET_TO_ATTRACT":
      return {
        ...initialGameSessionState,
        levelsCleared: state.levelsCleared,
        claimTokens: state.claimTokens,
      };

    default:
      return state;
  }
}

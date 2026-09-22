import { NextRequest, NextResponse } from "next/server";
import {
  verifyToken,
  signToken,
  AttemptTokenPayload,
  ClaimTokenPayload,
} from "@/lib/tokens";
import { getLevelDef } from "@/lib/levels";
import { normalize, levenshtein } from "@/lib/normalize";
import { getAttemptState, updateAttemptState } from "@/lib/attemptState";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { attemptToken, guess } = body;

    if (!attemptToken || typeof guess !== "string") {
      return NextResponse.json({ error: "Missing attemptToken or guess" }, { status: 400 });
    }

    const attemptCheck = verifyToken<AttemptTokenPayload>(attemptToken);
    if (!attemptCheck.valid || !attemptCheck.payload) {
      return NextResponse.json({
        result: "expired",
        correct: false,
        guessesRemaining: 0,
        lockedOut: true,
        message: "Attempt has expired.",
      });
    }

    const { level, startedAt, nonce } = attemptCheck.payload;
    const levelDef = getLevelDef(level);
    if (!levelDef) {
      return NextResponse.json({ error: "Invalid level" }, { status: 400 });
    }

    const attemptState = await getAttemptState(nonce);
    if (!attemptState) {
      return NextResponse.json({
        result: "expired",
        correct: false,
        guessesRemaining: 0,
        lockedOut: true,
        message: "Attempt state not found.",
      });
    }

    if (attemptState.done) {
      return NextResponse.json({ error: "Attempt already completed" }, { status: 400 });
    }

    const now = Date.now();
    const elapsedSec = Math.max(0, Math.floor((now - startedAt) / 1000));
    // Enforce time limit plus 5s grace
    if (elapsedSec > levelDef.timeLimitSec + 5) {
      return NextResponse.json({
        result: "expired",
        correct: false,
        guessesRemaining: 0,
        lockedOut: true,
        message: "Time limit expired.",
      });
    }

    // Check remaining guesses
    const guessesLeft = levelDef.maxGuesses - attemptState.guessesUsed;
    if (guessesLeft <= 0) {
      return NextResponse.json({
        result: "locked",
        correct: false,
        guessesRemaining: 0,
        lockedOut: true,
        message: "No guesses remaining.",
      });
    }

    // Increment guess count
    attemptState.guessesUsed += 1;
    const newGuessesLeft = Math.max(0, levelDef.maxGuesses - attemptState.guessesUsed);

    const normGuess = normalize(guess);
    const normSecret = normalize(levelDef.passphrase);
    const normDecoy = levelDef.decoy ? normalize(levelDef.decoy) : null;

    // Check if guess matches decoy phrase (Level 4)
    if (normDecoy && normGuess === normDecoy) {
      attemptState.decoyTripped = true;
      await updateAttemptState(attemptState);
      return NextResponse.json({
        result: "decoy",
        correct: false,
        decoy: true,
        guessesRemaining: newGuessesLeft,
        message: "Decoy phrase detected.",
      });
    }

    // Check if guess matches secret phrase
    let isCorrect = false;
    if (levelDef.fuzzy) {
      // Level 1 fuzzy Levenshtein match <= 1
      isCorrect = levenshtein(normGuess, normSecret) <= 1;
    } else {
      isCorrect = normGuess === normSecret;
    }

    if (isCorrect) {
      attemptState.done = true;
      await updateAttemptState(attemptState);

      // Server-enforced scoring formula
      const remainingTime = Math.max(0, levelDef.timeLimitSec - elapsedSec);
      const timeBonus = Math.round(levelDef.basePoints * 0.5 * (remainingTime / levelDef.timeLimitSec));
      const penalty = attemptState.hintsUsed * Math.round((levelDef.basePoints * levelDef.hintPenaltyPct) / 100);
      const totalScore = Math.max(
        Math.round(levelDef.basePoints * 0.25),
        levelDef.basePoints + timeBonus - penalty
      );

      // Issue claim token valid for 2 hours
      const claimToken = signToken<ClaimTokenPayload>(
        {
          level,
          points: totalScore,
          nonce,
          hintsUsed: attemptState.hintsUsed,
          elapsedSec,
        },
        7200
      );

      return NextResponse.json({
        result: "correct",
        correct: true,
        guessesRemaining: newGuessesLeft,
        claimToken,
        pointsAwarded: totalScore,
        scoreBreakdown: {
          baseScore: levelDef.basePoints,
          timeBonus,
          hintPenalty: penalty,
          totalScore,
        },
      });
    }

    await updateAttemptState(attemptState);

    if (newGuessesLeft <= 0) {
      return NextResponse.json({
        result: "locked",
        correct: false,
        lockedOut: true,
        guessesRemaining: 0,
        message: "Wrong passcode. Out of guesses!",
      });
    }

    return NextResponse.json({
      result: "wrong",
      correct: false,
      guessesRemaining: newGuessesLeft,
      message: `Incorrect passcode. ${newGuessesLeft} ${newGuessesLeft === 1 ? "guess" : "guesses"} left.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

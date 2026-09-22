import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AttemptTokenPayload } from "@/lib/tokens";
import { getLevelDef } from "@/lib/levels";
import { getAttemptState, updateAttemptState } from "@/lib/attemptState";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { attemptToken } = body;

    if (!attemptToken) {
      return NextResponse.json({ error: "Missing attemptToken" }, { status: 400 });
    }

    const attemptCheck = verifyToken<AttemptTokenPayload>(attemptToken);
    if (!attemptCheck.valid || !attemptCheck.payload) {
      return NextResponse.json({ error: "Attempt expired" }, { status: 400 });
    }

    const { level, startedAt, nonce } = attemptCheck.payload;
    const levelDef = getLevelDef(level);
    if (!levelDef) {
      return NextResponse.json({ error: "Invalid level" }, { status: 400 });
    }

    const attemptState = await getAttemptState(nonce);
    if (!attemptState) {
      return NextResponse.json({ error: "Attempt state not found" }, { status: 400 });
    }

    if (attemptState.done) {
      return NextResponse.json({ error: "Attempt already finished" }, { status: 400 });
    }

    const now = Date.now();
    const elapsedSec = Math.max(0, Math.floor((now - startedAt) / 1000));
    if (elapsedSec > levelDef.timeLimitSec + 5) {
      return NextResponse.json({ error: "Attempt expired" }, { status: 400 });
    }

    const totalHints = levelDef.hints.length;
    if (attemptState.hintsUsed >= totalHints) {
      return NextResponse.json({
        hint: levelDef.hints[totalHints - 1],
        hintsUsed: totalHints,
        hintsLeft: 0,
        penaltyPct: levelDef.hintPenaltyPct,
      });
    }

    // Increment hint index
    attemptState.hintsUsed += 1;
    await updateAttemptState(attemptState);

    const hintText = levelDef.hints[attemptState.hintsUsed - 1];
    const hintsLeft = totalHints - attemptState.hintsUsed;

    return NextResponse.json({
      hint: hintText,
      hintsUsed: attemptState.hintsUsed,
      hintsLeft,
      penaltyPct: levelDef.hintPenaltyPct,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

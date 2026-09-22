import { NextRequest, NextResponse } from "next/server";
import { verifyToken, ClaimTokenPayload } from "@/lib/tokens";
import { getLeaderboard, addLeaderboardEntry, hasClaimedNonce, LeaderboardEntry } from "@/lib/leaderboardStore";

// Lightweight profanity blocklist for booth handles
const BANNED_WORDS = [
  "admin",
  "root",
  "system",
  "fuck",
  "shit",
  "bitch",
  "cunt",
  "ass",
  "dick",
  "cock",
  "nigger",
  "faggot",
];

function sanitizeHandle(handle: string): string | null {
  if (!handle || typeof handle !== "string") return null;
  const clean = handle.trim().replace(/[^a-zA-Z0-9_]/g, "");
  if (clean.length < 3 || clean.length > 12) return null;

  const lower = clean.toLowerCase();
  for (const banned of BANNED_WORDS) {
    if (lower.includes(banned)) return null;
  }

  return clean;
}

export async function GET() {
  try {
    const leaderboard = await getLeaderboard(10);
    return NextResponse.json({ leaderboard });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { handle, claimTokens, claimToken } = body;

    const sanitizedHandle = sanitizeHandle(handle);
    if (!sanitizedHandle) {
      return NextResponse.json(
        { error: "Invalid handle. Must be 3-12 letters/numbers without profanity." },
        { status: 400 }
      );
    }

    const tokensList: string[] = Array.isArray(claimTokens)
      ? claimTokens
      : typeof claimToken === "string"
      ? [claimToken]
      : [];

    if (tokensList.length === 0) {
      return NextResponse.json({ error: "No claim tokens provided" }, { status: 400 });
    }

    const noncesInSubmission = new Set<string>();
    const levelsInSubmission = new Set<number>();
    let totalPoints = 0;
    let totalElapsedSec = 0;

    for (const token of tokensList) {
      const check = verifyToken<ClaimTokenPayload>(token);
      if (!check.valid || !check.payload) {
        return NextResponse.json({ error: "Invalid or expired claim token" }, { status: 400 });
      }

      const { level, points, nonce, elapsedSec } = check.payload;

      // Ensure no duplicate levels in submission
      if (levelsInSubmission.has(level)) {
        return NextResponse.json({ error: "Duplicate level claim in submission" }, { status: 400 });
      }
      levelsInSubmission.add(level);

      // Ensure no duplicate nonces in submission
      if (noncesInSubmission.has(nonce)) {
        return NextResponse.json({ error: "Duplicate nonce in submission" }, { status: 400 });
      }
      noncesInSubmission.add(nonce);

      // Ensure nonce hasn't been claimed before
      const alreadyClaimed = await hasClaimedNonce(nonce);
      if (alreadyClaimed) {
        return NextResponse.json({ error: "Claim token already redeemed" }, { status: 400 });
      }

      totalPoints += points;
      totalElapsedSec += elapsedSec || 0;
    }

    const newEntry: LeaderboardEntry = {
      handle: sanitizedHandle,
      totalPoints,
      levelsCleared: levelsInSubmission.size,
      totalElapsedSec,
      ts: Date.now(),
    };

    const updatedLeaderboard = await addLeaderboardEntry(newEntry, Array.from(noncesInSubmission));

    return NextResponse.json({
      success: true,
      entry: newEntry,
      leaderboard: updatedLeaderboard,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

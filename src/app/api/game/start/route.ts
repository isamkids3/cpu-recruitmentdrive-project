import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { verifyToken, signToken, BoothTokenPayload, AttemptTokenPayload } from "@/lib/tokens";
import {
  getLevelDef,
  getPublicLevel,
  buildSystemInstruction,
  getLeakNeedles,
} from "@/lib/levels";
import { createAttemptState } from "@/lib/attemptState";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    let boothToken = authHeader?.replace("Bearer ", "");

    const body = await req.json().catch(() => ({}));
    if (!boothToken && body.boothToken) {
      boothToken = body.boothToken;
    }

    if (!boothToken) {
      return NextResponse.json({ error: "Missing booth authentication" }, { status: 401 });
    }

    const { valid } = verifyToken<BoothTokenPayload>(boothToken);
    if (!valid) {
      return NextResponse.json({ error: "Invalid or expired booth token" }, { status: 401 });
    }
    const levelId = Number(body.level) || 1;

    const levelDef = getLevelDef(levelId);
    if (!levelDef) {
      return NextResponse.json({ error: "Invalid level requested" }, { status: 400 });
    }

    const nonce = crypto.randomBytes(16).toString("hex");
    const startedAt = Date.now();

    // Create tracking state
    await createAttemptState(nonce, levelId, startedAt);

    // Attempt token expires after level time limit + 30s grace
    const expirySec = levelDef.timeLimitSec + 30;
    const attemptToken = signToken<AttemptTokenPayload>(
      {
        level: levelId,
        startedAt,
        nonce,
      },
      expirySec
    );

    const publicLevel = getPublicLevel(levelDef);
    const systemInstruction = buildSystemInstruction(levelDef);
    const leakNeedles = getLeakNeedles(levelDef);

    return NextResponse.json({
      attemptToken,
      level: publicLevel,
      systemInstruction,
      openingLine: levelDef.openingLine,
      voice: levelDef.voice,
      leakNeedles,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

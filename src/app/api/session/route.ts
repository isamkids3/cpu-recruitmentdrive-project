import { NextRequest, NextResponse } from "next/server";
import { signToken, BoothTokenPayload } from "@/lib/tokens";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { pin } = body;

    const configuredPin = process.env.BOOTH_PIN || "4242";
    const apiKey = process.env.GEMINI_API_KEY;

    if (!pin || pin.toString().trim() !== configuredPin.trim()) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid Booth PIN" },
        { status: 401 }
      );
    }

    if (!apiKey || apiKey.trim() === "") {
      return NextResponse.json(
        { error: "GEMINI_API_KEY not configured on server" },
        { status: 500 }
      );
    }

    // Generate signed boothToken valid for 12 hours (43200 seconds)
    const boothToken = signToken<BoothTokenPayload>({ role: "booth" }, 43200);

    return NextResponse.json({
      success: true,
      apiKey: apiKey.trim(),
      boothToken,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { describe, it, expect } from "vitest";
import {
  normalizeChatInput,
  containsNonLatinScript,
  validateChatInput,
  MAX_MESSAGE_CHARS,
  MIN_MESSAGE_SEND_INTERVAL_MS,
} from "../src/lib/textInputGuard";
import { GAME_COPY } from "../src/lib/copy";

describe("Text Input Guard & Sanitization", () => {
  it("enforces max length cap of 250 chars", () => {
    expect(MAX_MESSAGE_CHARS).toBe(250);
    const longText = "a".repeat(300);
    const res = validateChatInput(longText, { lastSentTimestamp: 0 });
    expect(res.valid).toBe(false);
    expect(res.error).toContain("250");
  });

  it("applies Unicode NFKC normalization, whitespace collapsing, and strips control / zero-width characters", () => {
    // Zero-width space \u200B and control chars \u0000 \u001F
    const dirty = "  Hello \u200B world \u0000 \t \n test  ";
    const cleaned = normalizeChatInput(dirty);
    expect(cleaned).toBe("Hello world test");

    // NFKC compatibility decomposition/composition (e.g. ligature ﬁ -> fi, fullwidth Ａ -> A)
    const ligatures = "ﬁle ＡBC";
    const normalized = normalizeChatInput(ligatures);
    expect(normalized).toBe("file ABC");
  });

  it("allows Latin-script accents and punctuation", () => {
    const accented = "Café au lait, señorita! Naïve façade, élève?";
    expect(containsNonLatinScript(accented)).toBe(false);
    const res = validateChatInput(accented, { lastSentTimestamp: 0 });
    expect(res.valid).toBe(true);
    expect(res.normalizedText).toBe("Café au lait, señorita! Naïve façade, élève?");
  });

  it("rejects non-Latin scripts (Cyrillic, Arabic, CJK, Greek, etc.) with friendly notice", () => {
    // Cyrillic
    expect(containsNonLatinScript("Привет")).toBe(true);
    // Arabic
    expect(containsNonLatinScript("مرحبا")).toBe(true);
    // CJK
    expect(containsNonLatinScript("你好世界")).toBe(true);
    // Greek
    expect(containsNonLatinScript("Γειά σου")).toBe(true);

    const res = validateChatInput("Hello Привет", { lastSentTimestamp: 0 });
    expect(res.valid).toBe(false);
    expect(res.error).toBe(GAME_COPY.englishOnlyNotice);
  });

  it("enforces minimum 800ms throttle interval between sends", () => {
    expect(MIN_MESSAGE_SEND_INTERVAL_MS).toBe(800);
    const now = Date.now();
    const resThrottled = validateChatInput("Hello guard", {
      lastSentTimestamp: now - 300,
      currentTimestamp: now,
    });
    expect(resThrottled.valid).toBe(false);
    expect(resThrottled.error).toContain("fast");

    const resAllowed = validateChatInput("Hello guard", {
      lastSentTimestamp: now - 900,
      currentTimestamp: now,
    });
    expect(resAllowed.valid).toBe(true);
  });

  it("enforces one-in-flight check", () => {
    const resInFlight = validateChatInput("Hello guard", {
      isInFlight: true,
      lastSentTimestamp: 0,
    });
    expect(resInFlight.valid).toBe(false);
    expect(resInFlight.error).toContain("speaking");
  });

  it("enforces level message count limit (default 30)", () => {
    const resUnder = validateChatInput("Hello", {
      messageCount: 29,
      maxMessages: 30,
      lastSentTimestamp: 0,
    });
    expect(resUnder.valid).toBe(true);

    const resOver = validateChatInput("Hello", {
      messageCount: 30,
      maxMessages: 30,
      lastSentTimestamp: 0,
    });
    expect(resOver.valid).toBe(false);
    expect(resOver.error).toBe(GAME_COPY.maxMessagesReached);
  });
});

export const MAX_MESSAGE_CHARS = 250;
export const MIN_MESSAGE_SEND_INTERVAL_MS = 800;

/**
 * Normalizes input text:
 * - Unicode NFKC normalization
 * - Strips zero-width chars and invisible format characters
 * - Strips control characters (keeping standard newlines/tabs if needed, or collapsing all whitespace)
 * - Collapses consecutive whitespace
 * - Trims edges
 */
export function normalizeChatInput(rawText: string): string {
  if (!rawText) return "";

  // 1. Unicode NFKC normalization
  let text = rawText.normalize("NFKC");

  // 2. Strip zero-width & invisible formatting characters
  // \u200B (Zero-width space), \u200C (ZWNJ), \u200D (ZWJ), \uFEFF (BOM), \u200E-\u200F (LTR/RTL marks), \u202A-\u202E (Embedding/override)
  text = text.replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E]/g, "");

  // 3. Strip control characters (C0 and C1 control codes)
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "");

  // 4. Collapse whitespace
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

/**
 * Checks if normalized text contains letters from non-Latin scripts.
 * Allows: Basic Latin (A-Z, a-z), Digits (0-9), ASCII punctuation/symbols, and Latin diacritics/accents (\u00C0-\u024F).
 * Rejects: Cyrillic, Arabic, CJK, Greek, Hebrew, Thai, Devanagari, Hangul, Katakana, Hiragana, etc.
 */
export function containsNonLatinScript(text: string): boolean {
  if (!text) return false;

  // Regular expression detecting non-Latin alphabetic scripts:
  // \u0400-\u04FF (Cyrillic), \u0370-\u03FF (Greek), \u0600-\u06FF (Arabic),
  // \u0590-\u05FF (Hebrew), \u0900-\u097F (Devanagari), \u0E00-\u0E7F (Thai),
  // \u3040-\u309F (Hiragana), \u30A0-\u30FF (Katakana), \u4E00-\u9FFF (CJK Unified),
  // \uAC00-\uD7AF (Hangul Syllables), \uFF00-\uFFEF (Fullwidth forms)
  const nonLatinRegex = /[\u0370-\u03FF\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u0900-\u0D7F\u0E00-\u0E7F\u3040-\u30FF\u3100-\u312F\u3200-\u32FF\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7AF\uFF00-\uFFEF]/;

  return nonLatinRegex.test(text);
}

export interface ValidationOptions {
  maxChars?: number;
  lastSentTimestamp?: number;
  currentTimestamp?: number;
  isInFlight?: boolean;
  messageCount?: number;
  maxMessages?: number;
}

export interface InputValidationResult {
  valid: boolean;
  normalized: string;
  normalizedText: string;
  error?: string;
}

export function validateChatInput(
  rawText: string,
  options?: number | ValidationOptions
): InputValidationResult {
  const opts: ValidationOptions =
    typeof options === "number" ? { maxChars: options } : options || {};

  const maxChars = opts.maxChars ?? MAX_MESSAGE_CHARS;
  const currentTimestamp = opts.currentTimestamp ?? Date.now();

  // 1. One-in-flight check
  if (opts.isInFlight) {
    return {
      valid: false,
      normalized: "",
      normalizedText: "",
      error: "Please wait for the guard to finish speaking before sending another message.",
    };
  }

  // 2. Max messages per level check
  if (
    typeof opts.messageCount === "number" &&
    typeof opts.maxMessages === "number" &&
    opts.messageCount >= opts.maxMessages
  ) {
    return {
      valid: false,
      normalized: "",
      normalizedText: "",
      error: "You've reached the message limit for this level. You can still submit guesses until time runs out!",
    };
  }

  // 3. Throttle interval check
  if (
    typeof opts.lastSentTimestamp === "number" &&
    opts.lastSentTimestamp > 0 &&
    currentTimestamp - opts.lastSentTimestamp < MIN_MESSAGE_SEND_INTERVAL_MS
  ) {
    return {
      valid: false,
      normalized: "",
      normalizedText: "",
      error: "You are sending messages too fast. Please wait a moment.",
    };
  }

  // 4. Empty check
  if (!rawText || rawText.trim().length === 0) {
    return { valid: false, normalized: "", normalizedText: "", error: "Message cannot be empty." };
  }

  const normalized = normalizeChatInput(rawText);

  if (normalized.length === 0) {
    return { valid: false, normalized: "", normalizedText: "", error: "Message cannot be empty." };
  }

  // 5. Length cap
  if (normalized.length > maxChars) {
    return {
      valid: false,
      normalized,
      normalizedText: normalized,
      error: `Message exceeds ${maxChars} characters limit (${normalized.length}/${maxChars}).`,
    };
  }

  // 6. Latin-script check
  if (containsNonLatinScript(normalized)) {
    return {
      valid: false,
      normalized,
      normalizedText: normalized,
      error: "English only, please!",
    };
  }

  return {
    valid: true,
    normalized,
    normalizedText: normalized,
  };
}

import { describe, it, expect } from "vitest";
import { GAME_COPY } from "../src/lib/copy";

describe("Visitor UI Copy Banned-Terms Compliance", () => {
  const BANNED_TERMS = [
    "prompt injection",
    "honeytoken",
    "jailbreak",
    "system prompt",
    "passphrase",
    "red team",
    "attack",
    "breach",
  ];

  it("ensures general visitor copy does not contain any banned technical terms", () => {
    // Visitor general strings
    const visitorStrings: string[] = [
      GAME_COPY.title,
      GAME_COPY.tagline,
      GAME_COPY.subtitle,
      GAME_COPY.steps.step1,
      GAME_COPY.steps.step2,
      GAME_COPY.steps.step3,
      GAME_COPY.startButton,
      GAME_COPY.chatPanelTitle,
      GAME_COPY.leakFlash,
      GAME_COPY.leakBubbleTag,
      GAME_COPY.cutLine,
      GAME_COPY.decoyGuessed,
      GAME_COPY.results.winHeading,
      GAME_COPY.results.lockedOutHeading,
      GAME_COPY.results.timeoutHeading,
      GAME_COPY.results.guardWonMsg,
      GAME_COPY.buttons.nextLevel,
      GAME_COPY.buttons.tryAgain,
      GAME_COPY.buttons.finish,
      GAME_COPY.buttons.submitGuess,
      GAME_COPY.buttons.needHint,
      GAME_COPY.buttons.freeHint,
      GAME_COPY.buttons.exitGame,
      GAME_COPY.inputs.guessPlaceholder,
      GAME_COPY.inputs.handlePlaceholder,
      GAME_COPY.inputs.handleNote,
      GAME_COPY.notices.soundOn,
      GAME_COPY.notices.englishOnly,
    ];

    for (const text of visitorStrings) {
      const lower = text.toLowerCase();
      for (const banned of BANNED_TERMS) {
        // "passphrase" is not allowed in visitor general UI (only "secret phrase")
        expect(lower).not.toContain(banned);
      }
    }
  });

  it("confirms technical terms only exist in the allowed lesson badge mappings", () => {
    expect(GAME_COPY.lessons[1].technicalName).toBe("social engineering");
    expect(GAME_COPY.lessons[2].technicalName).toBe("prompt injection");
    expect(GAME_COPY.lessons[3].technicalName).toBe("red teaming");
    expect(GAME_COPY.lessons[4].technicalName).toBe("honeytokens");
    expect(GAME_COPY.lessons[5].technicalName).toBe("output guardrails");
  });
});

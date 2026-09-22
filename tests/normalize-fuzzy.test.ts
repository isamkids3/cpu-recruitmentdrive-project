import { describe, it, expect } from "vitest";
import { normalize, levenshtein } from "../src/lib/normalize";
import { getLevelDefs } from "../src/lib/levels";

describe("normalize & levenshtein fuzzy matching", () => {
  it("lowercases and strips all non-alphanumerics", () => {
    expect(normalize("Velvet-Thunder!")).toBe("velvetthunder");
    expect(normalize("   Purple   Pizza...   ")).toBe("purplepizza");
    expect(normalize("Solar_Flare#2026")).toBe("solarflare2026");
    expect(normalize("")).toBe("");
  });

  it("calculates accurate Levenshtein distance", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("purplepizza", "purplepizxa")).toBe(1);
    expect(levenshtein("purplepizza", "purplepizzas")).toBe(1);
    expect(levenshtein("purplepizza", "purplepizzxx")).toBe(2);
    expect(levenshtein("same", "same")).toBe(0);
  });

  it("enforces exact normalized matches across levels", () => {
    const levels = getLevelDefs();
    const l1 = levels[0];
    const l2 = levels[1];

    const secret1 = normalize(l1.passphrase);
    const exactGuess1 = "purple pizza";
    const closeGuess1 = secret1.slice(0, -1) + "x";

    expect(normalize(exactGuess1) === secret1).toBe(true);
    expect(normalize(closeGuess1) === secret1).toBe(false);

    // L2 exact only
    expect(l2.fuzzy).toBe(false);
    const secret2 = normalize(l2.passphrase);
    const closeGuess2 = secret2.slice(0, -1) + "x";
    expect(closeGuess2 === secret2).toBe(false);
  });
});

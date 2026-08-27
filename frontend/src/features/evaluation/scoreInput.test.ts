import { describe, expect, it } from "vitest";

import {
  formatScoreScale,
  isDecimalDraft,
  isScoreInputDraft,
  normalizeTo20,
  parseScoreInput,
  scoreInputError,
} from "./scoreInput";

/**
 * Grade entry accepts "8/10", "14/24" or a bare number, and every one of those has to survive a
 * round trip through the input. This is the piece of frontend logic most likely to silently
 * corrupt a student's grade, so it gets the closest coverage.
 */

describe("scoreInputError", () => {
  it("accepts an empty field as 'no grade yet'", () => {
    // Rejecting empty left no way back to ungraded once a score had been typed.
    expect(scoreInputError("")).toBeNull();
    expect(scoreInputError("   ")).toBeNull();
  });

  it("accepts a score/scale pair", () => {
    expect(scoreInputError("8/10")).toBeNull();
    expect(scoreInputError("9,25/10")).toBeNull();
  });

  it("resolves a bare number against the component's own scale", () => {
    // "14" in a component graded over 20 is valid; against the old hardcoded /10 default it
    // was rejected as "greater than its scale", which read as a bug to the student.
    expect(scoreInputError("14", "20")).toBeNull();
    expect(scoreInputError("14", "10")).toMatch(/no puede ser mayor/);
  });

  it("rejects a score above its scale, naming the actual limit", () => {
    // "no puede ser mayor que 20" is more useful than "mayor que su escala": the student can
    // see straight away what the ceiling is.
    expect(scoreInputError("21/20")).toBe("La nota no puede ser mayor que 20.");
  });

  it("rejects a zero scale rather than dividing by it", () => {
    expect(scoreInputError("5/0")).toMatch(/mayor que 0/);
  });

  it("rejects more than two decimals", () => {
    expect(scoreInputError("7.123/10")).toMatch(/2 decimales/);
  });

  it("rejects a negative or malformed value", () => {
    expect(scoreInputError("-5")).not.toBeNull();
    expect(scoreInputError("8/10/12")).not.toBeNull();
    expect(scoreInputError("abc")).not.toBeNull();
  });
});

describe("parseScoreInput", () => {
  it("defaults a bare number to the scale it is given", () => {
    expect(parseScoreInput("8")).toEqual({ score: "8", scale: "10" });
    expect(parseScoreInput("18", "20")).toEqual({ score: "18", scale: "20" });
  });

  it("keeps an explicit scale", () => {
    expect(parseScoreInput("14/24")).toEqual({ score: "14", scale: "24" });
  });

  it("normalises a decimal comma", () => {
    expect(parseScoreInput("9,5/10")).toEqual({ score: "9.5", scale: "10" });
  });

  it("returns null for empty input so the caller can send an explicit null", () => {
    expect(parseScoreInput("")).toBeNull();
  });

  it("returns null for invalid input", () => {
    expect(parseScoreInput("21/20")).toBeNull();
  });
});

describe("normalizeTo20", () => {
  it("rescales onto /20", () => {
    expect(normalizeTo20("7", "10")).toBe(14);
    expect(normalizeTo20("14", "24")).toBeCloseTo(11.6667, 3);
  });

  it("treats a missing scale as already /20", () => {
    expect(normalizeTo20("15", null)).toBe(15);
  });

  it("returns null rather than Infinity for a zero scale", () => {
    expect(normalizeTo20("7", "0")).toBeNull();
  });

  it("returns null when there is no score", () => {
    expect(normalizeTo20(null, "10")).toBeNull();
    expect(normalizeTo20("", "10")).toBeNull();
  });
});

describe("formatScoreScale", () => {
  it("renders the pair and trims trailing zeroes", () => {
    expect(formatScoreScale("8.00", "10.00")).toBe("8/10");
  });

  it("renders an empty string when there is no score", () => {
    expect(formatScoreScale(null, "10")).toBe("");
  });
});

describe("input drafts", () => {
  it("allows a partial score being typed", () => {
    for (const draft of ["", "8", "8.", "8.5", "8.5/", "8.5/1", "8.5/10"]) {
      expect(isScoreInputDraft(draft), draft).toBe(true);
    }
  });

  it("blocks characters that could never become a valid score", () => {
    for (const draft of ["-1", "8..5", "8/10/2", "abc", "8.555"]) {
      expect(isScoreInputDraft(draft), draft).toBe(false);
    }
  });

  it("keeps weight inputs to a plain decimal", () => {
    expect(isDecimalDraft("33.33")).toBe(true);
    expect(isDecimalDraft("33/10")).toBe(false);
  });
});

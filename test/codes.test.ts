import { describe, expect, it } from "vitest";
import { generateCode, isValidCode, RESERVED_CODES } from "../src/lib/codes";

describe("codes", () => {
  it("generates codes of the requested length from the base62 alphabet", () => {
    const code = generateCode(7);
    expect(code).toHaveLength(7);
    expect(code).toMatch(/^[0-9A-Za-z]{7}$/);
  });

  it("generates distinct codes across calls", () => {
    const set = new Set(Array.from({ length: 200 }, () => generateCode()));
    expect(set.size).toBeGreaterThan(190);
  });

  it("accepts url-safe codes and rejects the rest", () => {
    expect(isValidCode("Abc-1_2")).toBe(true);
    expect(isValidCode("with space")).toBe(false);
    expect(isValidCode("with/slash")).toBe(false);
    expect(isValidCode("")).toBe(false);
  });

  it("reserves system paths", () => {
    expect(RESERVED_CODES.has("api")).toBe(true);
    expect(RESERVED_CODES.has("health")).toBe(true);
  });
});

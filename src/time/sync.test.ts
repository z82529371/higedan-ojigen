import { describe, expect, it } from "vitest";
import type { LyricLine } from "../types";
import { currentLineIndex } from "./sync";

const LYRICS: LyricLine[] = [
  { start: 0.5, end: 4.2, text: "君は涙零しながら" },
  { start: 4.2, end: 8.0, text: "笑顔で僕に言った" },
  { start: 12.0, end: 15.0, text: "大丈夫かい？" },
];

describe("currentLineIndex", () => {
  it("returns the line containing the time", () => {
    expect(currentLineIndex(2.0, LYRICS)).toBe(0);
    expect(currentLineIndex(6.0, LYRICS)).toBe(1);
    expect(currentLineIndex(14.0, LYRICS)).toBe(2);
  });

  it("returns null before the first line", () => {
    expect(currentLineIndex(0.1, LYRICS)).toBeNull();
  });

  it("returns null after the last line", () => {
    expect(currentLineIndex(99.0, LYRICS)).toBeNull();
  });

  it("returns null in a gap between lines", () => {
    expect(currentLineIndex(9.0, LYRICS)).toBeNull();
  });

  it("treats the start time as inclusive and the end as exclusive", () => {
    expect(currentLineIndex(0.5, LYRICS)).toBe(0);
    expect(currentLineIndex(4.2, LYRICS)).toBe(1);
    expect(currentLineIndex(15.0, LYRICS)).toBeNull();
  });
});

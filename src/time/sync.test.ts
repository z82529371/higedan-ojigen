import { describe, expect, it } from "vitest";
import type { LyricLine, OuenPoint } from "../types";
import { activeOuenPoint, currentLineIndex, isChorusActive } from "./sync";

const LYRICS: LyricLine[] = [
  { start: 0.5, end: 4.2, text: "君は涙零しながら" },
  { start: 4.2, end: 8.0, text: "笑顔で僕に言った" },
  { start: 12.0, end: 15.0, text: "大丈夫かい？" },
];

const CHORUS_POINT: OuenPoint = { start: 10.0, end: 20.0, actions: [{ type: "chorus" }] };
const GESTURE_POINT: OuenPoint = { start: 30.0, end: 40.0, actions: [{ type: "gesture", gesture: "🙌" }] };
const POINTS = [CHORUS_POINT, GESTURE_POINT];

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

describe("isChorusActive", () => {
  it("is true while inside a point that has a chorus action", () => {
    expect(isChorusActive(12.0, POINTS)).toBe(true);
  });

  it("is false inside a point that only has a gesture", () => {
    expect(isChorusActive(32.0, POINTS)).toBe(false);
  });

  it("is false outside every point", () => {
    expect(isChorusActive(25.0, POINTS)).toBe(false);
  });

  it("is false at the end boundary of a chorus point", () => {
    expect(isChorusActive(20.0, POINTS)).toBe(false);
  });

  it("is false when there are no points", () => {
    expect(isChorusActive(12.0, [])).toBe(false);
  });
});

describe("activeOuenPoint", () => {
  it("returns the point containing the time", () => {
    expect(activeOuenPoint(12.0, POINTS)).toBe(CHORUS_POINT);
    expect(activeOuenPoint(35.0, POINTS)).toBe(GESTURE_POINT);
  });

  it("returns null outside every point", () => {
    expect(activeOuenPoint(25.0, POINTS)).toBeNull();
  });

  it("treats the start as inclusive and the end as exclusive", () => {
    expect(activeOuenPoint(10.0, POINTS)).toBe(CHORUS_POINT);
    expect(activeOuenPoint(20.0, POINTS)).toBeNull();
  });

  it("returns null when there are no points", () => {
    expect(activeOuenPoint(12.0, [])).toBeNull();
  });
});

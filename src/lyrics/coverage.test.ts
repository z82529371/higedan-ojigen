import { describe, expect, it } from "vitest";
import type { LyricLine, ResolvedOuenPoint } from "../types";
import { coveringPoints, isLineCovered, lineActionTypes } from "./coverage";

const LINE: LyricLine = { start: 5.0, end: 10.0, text: "測試行" };

describe("isLineCovered", () => {
  it("covers a line whose interval overlaps the point", () => {
    const point: ResolvedOuenPoint = { start: 4.0, end: 9.0, actions: [{ type: "clap", pattern: "👏" }] };
    expect(isLineCovered(LINE, point)).toBe(true);
  });

  it("does not cover a line strictly after the point", () => {
    const point: ResolvedOuenPoint = { start: 0.0, end: 5.0, actions: [{ type: "clap", pattern: "👏" }] };
    expect(isLineCovered(LINE, point)).toBe(false);
  });

  it("does not cover a line strictly before the point", () => {
    const point: ResolvedOuenPoint = { start: 10.0, end: 15.0, actions: [{ type: "clap", pattern: "👏" }] };
    expect(isLineCovered(LINE, point)).toBe(false);
  });
});

describe("coveringPoints", () => {
  it("returns only the points overlapping the line", () => {
    const p1: ResolvedOuenPoint = { start: 0.0, end: 6.0, actions: [{ type: "gesture", gesture: "🙌" }] };
    const p2: ResolvedOuenPoint = { start: 12.0, end: 16.0, actions: [{ type: "clap", pattern: "👏" }] };
    expect(coveringPoints(LINE, [p1, p2])).toEqual([p1]);
  });
});

describe("lineActionTypes", () => {
  it("returns the distinct action types across covering points", () => {
    const p1: ResolvedOuenPoint = { start: 0.0, end: 6.0, actions: [{ type: "chorus" }, { type: "gesture", gesture: "🙌" }] };
    const p2: ResolvedOuenPoint = { start: 7.0, end: 12.0, actions: [{ type: "chorus" }] };
    expect(lineActionTypes(LINE, [p1, p2])).toEqual(["chorus", "gesture"]);
  });

  it("returns an empty array when no point covers the line", () => {
    const point: ResolvedOuenPoint = { start: 12.0, end: 16.0, actions: [{ type: "clap", pattern: "👏" }] };
    expect(lineActionTypes(LINE, [point])).toEqual([]);
  });
});

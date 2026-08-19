import { describe, expect, it } from "vitest";
import type { LyricLine, ResolvedOuenPoint } from "../types";
import { buildMarkers } from "./markers";

const LYRICS: LyricLine[] = [
  { start: 0.0, end: 10.0, text: "第一句" },
  { start: 10.0, end: 20.0, text: "第二句" },
  { start: 20.0, end: 30.0, text: "第三句" },
];

describe("buildMarkers", () => {
  it("attaches markers to every line the point covers", () => {
    const point: ResolvedOuenPoint = {
      start: 5.0,
      end: 25.0,
      actions: [{ type: "clap", pattern: "👏 👏" }],
    };
    const { byLine, standalone } = buildMarkers(LYRICS, [point]);
    expect(byLine.get(0)?.map((m) => m.label)).toEqual(["👏 👏"]);
    expect(byLine.get(1)?.map((m) => m.label)).toEqual(["👏 👏"]);
    expect(byLine.get(2)?.map((m) => m.label)).toEqual(["👏 👏"]);
    expect(standalone).toEqual([]);
  });

  it("creates a standalone row when the point covers no lyrics", () => {
    const point: ResolvedOuenPoint = {
      start: 50.0,
      end: 55.0,
      actions: [{ type: "gesture", gesture: "🙌" }],
    };
    const { byLine, standalone } = buildMarkers(LYRICS, [point]);
    expect(byLine.size).toBe(0);
    expect(standalone).toHaveLength(1);
    expect(standalone[0].time).toBe(50.0);
    expect(standalone[0].markers.map((m) => m.label)).toEqual(["🙌"]);
  });

  it("creates both a standalone row and line markers when the point covers an interlude then lyrics", () => {
    const point: ResolvedOuenPoint = {
      start: 32.0,
      end: 45.0,
      actions: [{ type: "clap", pattern: "👏 👏" }],
    };
    const lyrics = [
      ...LYRICS,
      { start: 40.0, end: 50.0, text: "第四句" },
    ];
    const { byLine, standalone } = buildMarkers(lyrics, [point]);
    expect(standalone).toHaveLength(1);
    expect(standalone[0].time).toBe(32.0);
    expect(standalone[0].markers.map((m) => m.label)).toEqual(["👏 👏"]);
    expect(byLine.get(3)?.map((m) => m.label)).toEqual(["👏 👏"]);
  });

  it("renders a chorus without text as no marker", () => {
    const point: ResolvedOuenPoint = {
      start: 5.0,
      end: 15.0,
      actions: [{ type: "chorus" }],
    };
    const { byLine, standalone } = buildMarkers(LYRICS, [point]);
    expect(byLine.has(0)).toBe(false);
    expect(standalone).toEqual([]);
  });

  it("removes text-anchored chorus and gesture markers from line markers when text hits lyric", () => {
    const lyricsWithText: LyricLine[] = [
      { start: 0.0, end: 10.0, text: "変わらずにいたいよな？(Yeah)" },
    ];
    const point: ResolvedOuenPoint = {
      start: 0.0,
      end: 10.0,
      actions: [
        { type: "chorus", text: "(Yeah)" },
        { type: "gesture", gesture: "✌️", text: "(Yeah)" },
        { type: "clap", pattern: "👏" },
      ],
    };
    const { byLine, standalone } = buildMarkers(lyricsWithText, [point]);
    // Clap (👏) is unanchored, so it stays in byLine
    expect(byLine.get(0)?.map((m) => m.label)).toEqual(["👏"]);
    // Anchored actions (Chorus text & Gesture ✌️) are removed from byLine and standalone
    expect(standalone).toEqual([]);
  });

  it("renders a chorus with supplementary text as a marker", () => {
    const point: ResolvedOuenPoint = {
      start: 5.0,
      end: 15.0,
      actions: [{ type: "chorus", text: "Yeah", romaji: "yeah" }],
    };
    const { byLine, standalone } = buildMarkers(LYRICS, [point]);
    expect(byLine.get(0)?.map((m) => m.label)).toEqual(["Yeah"]);
    expect(byLine.get(0)?.[0].romaji).toBe("yeah");
    expect(standalone).toEqual([]);
  });

  it("sorts markers by point start time", () => {
    const p1: ResolvedOuenPoint = {
      start: 12.0,
      end: 15.0,
      actions: [{ type: "gesture", gesture: "✌️" }],
    };
    const p2: ResolvedOuenPoint = {
      start: 1.0,
      end: 4.0,
      actions: [{ type: "clap", pattern: "👏" }],
    };
    const { byLine } = buildMarkers(LYRICS, [p1, p2]);
    expect(byLine.get(0)?.map((m) => m.label)).toEqual(["👏"]);
    expect(byLine.get(1)?.map((m) => m.label)).toEqual(["✌️"]);
  });
});

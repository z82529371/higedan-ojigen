import { describe, expect, it } from "vitest";
import type { LyricLine, ResolvedOuenPoint } from "../types";
import { buildLineColoring } from "./lyricColoring";

const LYRICS: LyricLine[] = [
  { start: 0.0, end: 10.0, text: "真っ赤な本能(本能)" },
  { start: 10.0, end: 20.0, text: "汗だくのSoul(soul)" },
  { start: 20.0, end: 30.0, text: "Yeah Yeah" },
];

describe("buildLineColoring", () => {
  describe("三態染色", () => {
    it("colors the whole line for a chorus without text", () => {
      const point: ResolvedOuenPoint = { start: 0.0, end: 30.0, actions: [{ type: "chorus" }] };
      const { type, fragments } = buildLineColoring(LYRICS[0], [point]);
      expect(type).toBe("whole-line");
      expect(fragments).toEqual([{ text: "真っ赤な本能(本能)", color: "#d97706" }]);
    });

    it("colors the whole line for a gesture without text", () => {
      const point: ResolvedOuenPoint = { start: 0.0, end: 30.0, actions: [{ type: "gesture", gesture: "🙌" }] };
      const { type, fragments } = buildLineColoring(LYRICS[0], [point]);
      expect(type).toBe("whole-line");
      expect(fragments).toEqual([{ text: "真っ赤な本能(本能)", color: "#ea580c" }]);
    });

    it("colors the whole line for a clap without text", () => {
      const point: ResolvedOuenPoint = { start: 0.0, end: 30.0, actions: [{ type: "clap", pattern: "👏" }] };
      const { type, fragments } = buildLineColoring(LYRICS[0], [point]);
      expect(type).toBe("whole-line");
      expect(fragments).toEqual([{ text: "真っ赤な本能(本能)", color: "#db2777" }]);
    });

    it("colors only the matching text for a chorus with text", () => {
      const point: ResolvedOuenPoint = { start: 0.0, end: 30.0, actions: [{ type: "chorus", text: "(本能)" }] };
      const { type, fragments } = buildLineColoring(LYRICS[0], [point]);
      expect(type).toBe("partial");
      expect(fragments).toEqual([
        { text: "真っ赤な本能", color: null },
        { text: "(本能)", color: "#d97706" },
      ]);
    });

    it("colors only the matching text for a gesture with text", () => {
      const point: ResolvedOuenPoint = {
        start: 0.0,
        end: 30.0,
        actions: [{ type: "gesture", gesture: "🙌", text: "(本能)" }],
      };
      const { type, fragments } = buildLineColoring(LYRICS[0], [point]);
      expect(type).toBe("partial");
      expect(fragments).toEqual([
        { text: "真っ赤な本能", color: null },
        {
          text: "(本能)",
          color: "#ea580c",
          attachedMarkers: [
            {
              type: "gesture",
              label: "🙌",
              color: "#ea580c",
              point,
            },
          ],
        },
      ]);
    });

    it("colors only the matching text for a clap with text", () => {
      const point: ResolvedOuenPoint = { start: 0.0, end: 30.0, actions: [{ type: "clap", pattern: "👏", text: "本能" }] };
      const { type, fragments } = buildLineColoring(LYRICS[0], [point]);
      expect(type).toBe("partial");
      expect(fragments).toEqual([
        { text: "真っ赤な", color: null },
        { text: "本能", color: "#db2777" },
        { text: "(", color: null },
        { text: "本能", color: "#db2777" },
        { text: ")", color: null },
      ]);
    });

    it("colors all occurrences of the matching text", () => {
      const point: ResolvedOuenPoint = { start: 0.0, end: 30.0, actions: [{ type: "clap", pattern: "👏", text: "Yeah" }] };
      const { type, fragments } = buildLineColoring(LYRICS[2], [point]);
      expect(type).toBe("partial");
      expect(fragments).toEqual([
        { text: "Yeah", color: "#db2777" },
        { text: " ", color: null },
        { text: "Yeah", color: "#db2777" },
      ]);
    });

    it("does not color the line when the text is not found", () => {
      const point: ResolvedOuenPoint = {
        start: 0.0,
        end: 30.0,
        actions: [{ type: "clap", pattern: "👏", text: "Oh Oh!" }],
      };
      const { type, fragments } = buildLineColoring(LYRICS[2], [point]);
      expect(type).toBe("none");
      expect(fragments).toEqual([{ text: "Yeah Yeah", color: null }]);
    });

    it("returns none when no covering point exists", () => {
      const { type, fragments } = buildLineColoring(LYRICS[0], []);
      expect(type).toBe("none");
      expect(fragments).toEqual([{ text: "真っ赤な本能(本能)", color: null }]);
    });
  });

  describe("整行勝過部分", () => {
    it("prefers whole-line over partial within a single point", () => {
      const point: ResolvedOuenPoint = {
        start: 0.0,
        end: 30.0,
        actions: [
          { type: "chorus", text: "(本能)" },
          { type: "chorus" },
        ],
      };
      expect(buildLineColoring(LYRICS[0], [point]).type).toBe("whole-line");
    });

    it("prefers whole-line of a lower-priority type over partial of a higher-priority type", () => {
      const point: ResolvedOuenPoint = {
        start: 0.0,
        end: 30.0,
        actions: [
          { type: "chorus", text: "(本能)" },
          { type: "clap", pattern: "👏" },
        ],
      };
      const { type, fragments } = buildLineColoring(LYRICS[0], [point]);
      expect(type).toBe("whole-line");
      expect(fragments).toEqual([{ text: "真っ赤な本能(本能)", color: "#db2777" }]);
    });
  });

  describe("優先序", () => {
    it("chorus beats gesture when both are whole-line", () => {
      const p1: ResolvedOuenPoint = { start: 0.0, end: 30.0, actions: [{ type: "gesture", gesture: "🙌" }] };
      const p2: ResolvedOuenPoint = { start: 0.0, end: 30.0, actions: [{ type: "chorus" }] };
      const { type, fragments } = buildLineColoring(LYRICS[0], [p1, p2]);
      expect(type).toBe("whole-line");
      expect(fragments).toEqual([{ text: "真っ赤な本能(本能)", color: "#d97706" }]);
    });

    it("gesture beats clap when both are whole-line", () => {
      const p1: ResolvedOuenPoint = { start: 0.0, end: 30.0, actions: [{ type: "clap", pattern: "👏" }] };
      const p2: ResolvedOuenPoint = { start: 0.0, end: 30.0, actions: [{ type: "gesture", gesture: "✌️" }] };
      const { type, fragments } = buildLineColoring(LYRICS[0], [p1, p2]);
      expect(type).toBe("whole-line");
      expect(fragments).toEqual([{ text: "真っ赤な本能(本能)", color: "#ea580c" }]);
    });

    it("chorus partial beats gesture partial", () => {
      const p1: ResolvedOuenPoint = {
        start: 0.0,
        end: 30.0,
        actions: [{ type: "gesture", gesture: "🙌", text: "本能" }],
      };
      const p2: ResolvedOuenPoint = { start: 0.0, end: 30.0, actions: [{ type: "chorus", text: "(本能)" }] };
      const { type, fragments } = buildLineColoring(LYRICS[0], [p1, p2]);
      expect(type).toBe("partial");
      expect(fragments).toEqual([
        { text: "真っ赤な本能", color: null },
        { text: "(本能)", color: "#d97706" },
      ]);
    });

    it("applies all matched texts of the winning type", () => {
      const p1: ResolvedOuenPoint = { start: 0.0, end: 30.0, actions: [{ type: "chorus", text: "真っ赤" }] };
      const p2: ResolvedOuenPoint = { start: 0.0, end: 30.0, actions: [{ type: "chorus", text: "(本能)" }] };
      const { type, fragments } = buildLineColoring(LYRICS[0], [p1, p2]);
      expect(type).toBe("partial");
      expect(fragments).toEqual([
        { text: "真っ赤", color: "#d97706" },
        { text: "な本能", color: null },
        { text: "(本能)", color: "#d97706" },
      ]);
    });
  });
});

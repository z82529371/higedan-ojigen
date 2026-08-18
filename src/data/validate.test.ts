import { describe, expect, it } from "vitest";
import type { GesturesFile, SongsFile } from "../types";
import { parseGestures, parseSong, parseSongs } from "./validate";

const GESTURES = ["✌️", "🤣", "☝️", "🙆", "✊", "🙌"];

describe("parseSongs", () => {
  it("parses a valid songs file", () => {
    const raw: SongsFile = {
      songs: [
        { id: "subtitle", title: "Subtitle", data: "data/subtitle.json" },
        { id: "pretender", title: "Pretender", data: "data/pretender.json" },
      ],
    };
    expect(parseSongs(raw)).toEqual(raw.songs);
  });

  it("accepts an empty song list", () => {
    expect(parseSongs({ songs: [] })).toEqual([]);
  });

  it("rejects a song entry with a missing id", () => {
    const raw = { songs: [{ title: "Subtitle", data: "data/subtitle.json" }] };
    expect(() => parseSongs(raw)).toThrow(/subtitle/i);
  });

  it("rejects a song entry with a non-string data path", () => {
    const raw = { songs: [{ id: "subtitle", title: "Subtitle", data: 42 }] };
    expect(() => parseSongs(raw)).toThrow(/data/);
  });

  it("rejects a file without a songs field", () => {
    expect(() => parseSongs({})).toThrow(/songs/);
  });
});

describe("parseGestures", () => {
  it("parses a valid gestures file", () => {
    const raw: GesturesFile = { gestures: GESTURES };
    expect(parseGestures(raw)).toEqual(GESTURES);
  });

  it("rejects a file without a gestures field", () => {
    expect(() => parseGestures({})).toThrow(/gestures/);
  });

  it("rejects an empty gesture string", () => {
    expect(() => parseGestures({ gestures: ["🙌", ""] })).toThrow(/gesture/);
  });
});

describe("parseSong", () => {
  it("parses a minimal valid song", () => {
    const raw = {
      id: "subtitle",
      title: "Subtitle",
      audio: "audio/subtitle.mp3",
      lyrics: [{ start: 0.5, end: 4.2, text: "君は涙零しながら" }],
      ouenPoints: [],
    };
    expect(parseSong(raw, GESTURES)).toEqual(raw);
  });

  it("parses a chorus action with supplementary text", () => {
    const raw = {
      id: "subtitle",
      title: "Subtitle",
      audio: "audio/subtitle.mp3",
      lyrics: [],
      ouenPoints: [
        {
          start: 120.0,
          end: 126.0,
          actions: [{ type: "chorus", text: "僕らの旅は続く！", romaji: "bokura" }],
        },
      ],
    };
    expect(parseSong(raw, GESTURES)).toEqual(raw);
  });

  it("parses an optional note field", () => {
    const raw = {
      id: "subtitle",
      title: "Subtitle",
      audio: "audio/subtitle.mp3",
      note: "開場有 intro，請提早準備應援",
      lyrics: [],
      ouenPoints: [],
    };
    expect(parseSong(raw, GESTURES)).toEqual(raw);
  });

  it("omits note from the result when absent", () => {
    const raw = {
      id: "subtitle",
      title: "Subtitle",
      audio: "audio/subtitle.mp3",
      lyrics: [],
      ouenPoints: [],
    };
    expect(parseSong(raw, GESTURES)).not.toHaveProperty("note");
  });

  it("rejects an empty note string", () => {
    const raw = {
      id: "subtitle",
      title: "Subtitle",
      audio: "audio/subtitle.mp3",
      note: "",
      lyrics: [],
      ouenPoints: [],
    };
    expect(() => parseSong(raw, GESTURES)).toThrow(/note/);
  });

  it("rejects a lyric line whose end is not after its start", () => {
    const raw = {
      id: "x",
      title: "X",
      audio: "a.mp3",
      lyrics: [{ start: 4.0, end: 4.0, text: "..." }],
      ouenPoints: [],
    };
    expect(() => parseSong(raw, GESTURES)).toThrow(/lyrics|end/);
  });

  it("rejects overlapping lyric lines", () => {
    const raw = {
      id: "x",
      title: "X",
      audio: "a.mp3",
      lyrics: [
        { start: 1.0, end: 3.0, text: "一" },
        { start: 2.5, end: 4.0, text: "二" },
      ],
      ouenPoints: [],
    };
    expect(() => parseSong(raw, GESTURES)).toThrow(/overlap|lyrics/);
  });

  it("rejects a lyric line with a missing text", () => {
    const raw = {
      id: "x",
      title: "X",
      audio: "a.mp3",
      lyrics: [{ start: 1.0, end: 3.0 }],
      ouenPoints: [],
    };
    expect(() => parseSong(raw, GESTURES)).toThrow(/text/);
  });

  it("rejects an ouen point whose end is not after its start", () => {
    const raw = {
      id: "x",
      title: "X",
      audio: "a.mp3",
      lyrics: [],
      ouenPoints: [{ start: 30.0, end: 30.0, actions: [{ type: "clap", pattern: "👏" }] }],
    };
    expect(() => parseSong(raw, GESTURES)).toThrow(/ouenPoints|end/);
  });

  it("rejects overlapping ouen points regardless of order", () => {
    const raw = {
      id: "x",
      title: "X",
      audio: "a.mp3",
      lyrics: [],
      ouenPoints: [
        { start: 45.0, end: 55.0, actions: [{ type: "clap", pattern: "👏" }] },
        { start: 30.0, end: 50.0, actions: [{ type: "gesture", gesture: "🙌" }] },
      ],
    };
    expect(() => parseSong(raw, GESTURES)).toThrow(/overlap|ouenPoints/);
  });

  it("allows unsorted but non-overlapping ouen points", () => {
    const raw = {
      id: "x",
      title: "X",
      audio: "a.mp3",
      lyrics: [],
      ouenPoints: [
        { start: 45.0, end: 55.0, actions: [{ type: "clap", pattern: "👏" }] },
        { start: 30.0, end: 40.0, actions: [{ type: "gesture", gesture: "🙌" }] },
      ],
    };
    expect(() => parseSong(raw, GESTURES)).not.toThrow();
  });

  it("rejects an empty actions list", () => {
    const raw = {
      id: "x",
      title: "X",
      audio: "a.mp3",
      lyrics: [],
      ouenPoints: [{ start: 1.0, end: 2.0, actions: [] }],
    };
    expect(() => parseSong(raw, GESTURES)).toThrow(/actions/);
  });

  it("rejects an unknown action type", () => {
    const raw = {
      id: "x",
      title: "X",
      audio: "a.mp3",
      lyrics: [],
      ouenPoints: [{ start: 1.0, end: 2.0, actions: [{ type: "shout" }] }],
    };
    expect(() => parseSong(raw, GESTURES)).toThrow(/shout/);
  });

  it("rejects a gesture not in the catalog", () => {
    const raw = {
      id: "x",
      title: "X",
      audio: "a.mp3",
      lyrics: [],
      ouenPoints: [{ start: 1.0, end: 2.0, actions: [{ type: "gesture", gesture: "🖖" }] }],
    };
    expect(() => parseSong(raw, GESTURES)).toThrow(/🖖/);
  });

  it("rejects a gesture action with a missing gesture field", () => {
    const raw = {
      id: "x",
      title: "X",
      audio: "a.mp3",
      lyrics: [],
      ouenPoints: [{ start: 1.0, end: 2.0, actions: [{ type: "gesture" }] }],
    };
    expect(() => parseSong(raw, GESTURES)).toThrow(/gesture/);
  });

  it("rejects a clap action with a missing pattern", () => {
    const raw = {
      id: "x",
      title: "X",
      audio: "a.mp3",
      lyrics: [],
      ouenPoints: [{ start: 1.0, end: 2.0, actions: [{ type: "clap" }] }],
    };
    expect(() => parseSong(raw, GESTURES)).toThrow(/pattern/);
  });
});

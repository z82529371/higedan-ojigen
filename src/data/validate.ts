import type { LyricLine, OuenAction, ResolvedOuenPoint, Song, SongMeta } from "../types";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(obj: Record<string, unknown>, key: string, context: string): string {
  const value = obj[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${context} 缺少欄位「${key}」（須為非空字串）`);
  }
  return value;
}

function requireNumber(obj: Record<string, unknown>, key: string, context: string): number {
  const value = obj[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${context} 缺少欄位「${key}」（須為數值）`);
  }
  return value;
}

export function parseSongs(raw: unknown): SongMeta[] {
  if (!isObject(raw) || !Array.isArray(raw.songs)) {
    throw new Error("songs.json 缺少「songs」陣列");
  }
  return raw.songs.map((entry, i) => {
    if (!isObject(entry)) {
      throw new Error(`songs.json 第 ${i + 1} 筆不是物件`);
    }
    const label = typeof entry.title === "string" && entry.title.length > 0 ? `歌曲「${entry.title}」` : `歌曲 ${i + 1}`;
    return {
      id: requireString(entry, "id", label),
      title: requireString(entry, "title", label),
      data: requireString(entry, "data", label),
    };
  });
}

export function parseGestures(raw: unknown): string[] {
  if (!isObject(raw) || !Array.isArray(raw.gestures)) {
    throw new Error("gestures.json 缺少「gestures」陣列");
  }
  return raw.gestures.map((gesture, i) => {
    if (typeof gesture !== "string" || gesture.length === 0) {
      throw new Error(`gestures.json 第 ${i + 1} 個手勢無效`);
    }
    return gesture;
  });
}

function parseLyricLine(raw: unknown, context: string, index: number): LyricLine {
  if (!isObject(raw)) {
    throw new Error(`${context} 的 lyrics 第 ${index} 行不是物件`);
  }
  const lineContext = `${context} 的 lyrics 第 ${index} 行`;
  const start = requireNumber(raw, "start", lineContext);
  const end = requireNumber(raw, "end", lineContext);
  if (end <= start) {
    throw new Error(`${lineContext}：end（${end}）必須大於 start（${start}）`);
  }
  const text = requireString(raw, "text", lineContext);
  const result: LyricLine = { start, end, text };
  if (typeof raw.romaji === "string" && raw.romaji.length > 0) {
    result.romaji = raw.romaji;
  }
  return result;
}

function parseAction(raw: unknown, context: string, gestures: readonly string[]): OuenAction {
  if (!isObject(raw)) {
    throw new Error(`${context} 的應援動作不是物件`);
  }
  const type = raw.type;
  switch (type) {
    case "chorus": {
      const result: OuenAction = { type: "chorus" };
      if (raw.text !== undefined) {
        result.text = requireString(raw, "text", `${context} 的合唱`);
      }
      if (typeof raw.romaji === "string" && raw.romaji.length > 0) {
        result.romaji = raw.romaji;
      }
      return result;
    }
    case "gesture": {
      const gesture = requireString(raw, "gesture", context);
      if (!gestures.includes(gesture)) {
        throw new Error(`${context} 的手勢「${gesture}」不在手勢目錄內`);
      }
      const result: OuenAction = { type: "gesture", gesture };
      if (raw.text !== undefined) {
        result.text = requireString(raw, "text", `${context} 的手勢`);
      }
      return result;
    }
    case "clap": {
      const result: OuenAction = { type: "clap", pattern: requireString(raw, "pattern", context) };
      if (raw.text !== undefined) {
        result.text = requireString(raw, "text", `${context} 的拍手`);
      }
      return result;
    }
    default:
      throw new Error(`${context} 有未知的應援動作型別「${String(type)}」`);
  }
}

function parseOuenPoint(raw: unknown, context: string, index: number, gestures: readonly string[]): ResolvedOuenPoint[] {
  if (!isObject(raw)) {
    throw new Error(`${context} 的 ouenPoints 第 ${index} 個不是物件`);
  }
  const pointContext = `${context} 的 ouenPoints 第 ${index} 個`;
  if (!Array.isArray(raw.actions) || raw.actions.length === 0) {
    throw new Error(`${pointContext} 必須有至少一個「actions」`);
  }
  const actions = raw.actions.map((action) => parseAction(action, pointContext, gestures));

  const hasTimes = Array.isArray(raw.times) && raw.times.length > 0;
  const hasSingleTime = raw.start !== undefined || raw.end !== undefined;
  if (hasTimes && hasSingleTime) {
    throw new Error(`${pointContext} 不能同時宣告「times」與「start/end」`);
  }

  if (hasTimes) {
    const times = raw.times as unknown[];
    return times.map((t, tIdx) => {
      if (!isObject(t)) {
        throw new Error(`${pointContext} 的 times 第 ${tIdx + 1} 個不是物件`);
      }
      const start = requireNumber(t, "start", `${pointContext} 的 times 第 ${tIdx + 1} 個`);
      const end = requireNumber(t, "end", `${pointContext} 的 times 第 ${tIdx + 1} 個`);
      if (end <= start) {
        throw new Error(`${pointContext} 的 times 第 ${tIdx + 1} 個：end（${end}）必須大於 start（${start}）`);
      }
      return { start, end, actions };
    });
  }

  const start = requireNumber(raw, "start", pointContext);
  const end = requireNumber(raw, "end", pointContext);
  if (end <= start) {
    throw new Error(`${pointContext}：end（${end}）必須大於 start（${start}）`);
  }
  return [{ start, end, actions }];
}

export function parseSong(raw: unknown, gestures: readonly string[]): Song {
  if (!isObject(raw)) {
    throw new Error("歌曲資料不是物件");
  }
  const id = requireString(raw, "id", "歌曲");
  const context = `歌曲「${id}」`;
  const title = requireString(raw, "title", context);
  const audio = requireString(raw, "audio", context);
  const result: Song = { id, title, audio, lyrics: [], ouenPoints: [] };
  if (raw.note !== undefined) {
    if (typeof raw.note !== "string" || raw.note.trim().length === 0) {
      throw new Error(`${context} 缺少欄位「note」（須為非空字串）`);
    }
    result.note = raw.note.trim();
  }

  if (!Array.isArray(raw.lyrics)) {
    throw new Error(`${context} 缺少「lyrics」陣列`);
  }
  const lyrics = raw.lyrics.map((line, i) => parseLyricLine(line, context, i + 1));
  for (let i = 1; i < lyrics.length; i++) {
    const prev = lyrics[i - 1];
    const curr = lyrics[i];
    if (curr.start < prev.end) {
      throw new Error(
        `${context} 的 lyrics 時間重疊：第 ${i + 1} 行（${curr.start}–${curr.end}）與第 ${i} 行（${prev.start}–${prev.end}）`,
      );
    }
  }

  if (!Array.isArray(raw.ouenPoints)) {
    throw new Error(`${context} 缺少「ouenPoints」陣列`);
  }
  const ouenPoints = raw.ouenPoints
    .flatMap((point, i) => parseOuenPoint(point, context, i + 1, gestures))
    .sort((a, b) => a.start - b.start);

  for (let i = 1; i < ouenPoints.length; i++) {
    const prev = ouenPoints[i - 1];
    const curr = ouenPoints[i];
    if (curr.start < prev.end) {
      throw new Error(
        `${context} 的 ouenPoints 時間重疊：區間（${curr.start}–${curr.end}）與區間（${prev.start}–${prev.end}）`,
      );
    }
  }

  result.lyrics = lyrics;
  result.ouenPoints = ouenPoints;
  if (Array.isArray(raw.lockedLines)) {
    result.lockedLines = raw.lockedLines.filter((x): x is number => typeof x === "number");
  }
  return result;
}
import type { LyricLine } from "../types";

export function currentLineIndex(time: number, lyrics: readonly LyricLine[]): number | null {
  for (let i = 0; i < lyrics.length; i++) {
    const line = lyrics[i];
    if (time >= line.start && time < line.end) {
      return i;
    }
  }
  return null;
}

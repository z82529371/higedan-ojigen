import type { LyricLine, OuenPoint } from "../types";

export function currentLineIndex(time: number, lyrics: readonly LyricLine[]): number | null {
  for (let i = 0; i < lyrics.length; i++) {
    const line = lyrics[i];
    if (time >= line.start && time < line.end) {
      return i;
    }
  }
  return null;
}

export function isChorusActive(time: number, ouenPoints: readonly OuenPoint[]): boolean {
  return ouenPoints.some((point) => point.start <= time && time < point.end && point.actions.some((a) => a.type === "chorus"));
}

export function activeOuenPoint(time: number, ouenPoints: readonly OuenPoint[]): OuenPoint | null {
  return ouenPoints.find((point) => point.start <= time && time < point.end) ?? null;
}

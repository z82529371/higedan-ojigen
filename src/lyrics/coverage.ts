import type { LyricLine, OuenActionType, ResolvedOuenPoint } from "../types";
import { ACTION_PRIORITY } from "../components/actionColors";

export function isLineCovered(line: LyricLine, point: ResolvedOuenPoint): boolean {
  return line.start < point.end && line.end > point.start;
}

export function coveringPoints(line: LyricLine, ouenPoints: readonly ResolvedOuenPoint[]): ResolvedOuenPoint[] {
  return ouenPoints.filter((p) => isLineCovered(line, p));
}

export function lineActionTypes(line: LyricLine, ouenPoints: readonly ResolvedOuenPoint[]): OuenActionType[] {
  const types: OuenActionType[] = [];
  for (const p of coveringPoints(line, ouenPoints)) {
    for (const a of p.actions) {
      if (!types.includes(a.type)) {
        types.push(a.type);
      }
    }
  }
  return types.sort((a, b) => ACTION_PRIORITY[b] - ACTION_PRIORITY[a]);
}

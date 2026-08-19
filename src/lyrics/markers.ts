import type { LyricLine, OuenActionType, ResolvedOuenPoint } from "../types";
import { ACTION_COLOR, actionLabel } from "../components/actionColors";
import { isLineCovered } from "./coverage";

export interface LineMarker {
  type: OuenActionType;
  label: string;
  color: string;
  romaji?: string;
  point: ResolvedOuenPoint;
}

export interface StandaloneRow {
  time: number;
  markers: LineMarker[];
  point: ResolvedOuenPoint;
}

export interface BuiltMarkers {
  byLine: Map<number, LineMarker[]>;
  standalone: StandaloneRow[];
}

export function buildMarkers(lyrics: readonly LyricLine[], ouenPoints: readonly ResolvedOuenPoint[]): BuiltMarkers {
  const byLine = new Map<number, LineMarker[]>();
  const standalone: StandaloneRow[] = [];
  const sorted = [...ouenPoints].sort((a, b) => a.start - b.start);
  for (const point of sorted) {
    const matchedLines = lyrics.filter((line) => isLineCovered(line, point));
    const matchedLineIndices = lyrics.flatMap((line, idx) => (isLineCovered(line, point) ? [idx] : []));

    // Determine which actions in this point should remain in line markers / standalone rows.
    // Actions whose text matches a covered line (chorus or gesture) are anchored directly to that text fragment,
    // so they are omitted from line markers to avoid duplicating above the line.
    const unanchoredActions = point.actions.filter((action) => {
      if (!action.text) return true;
      return !matchedLines.some((line) => line.text.includes(action.text!));
    });

    const unanchoredMarkers = unanchoredActions.flatMap((action) => {
      const label = actionLabel(action);
      if (label === null) return [];
      return [
        {
          type: action.type,
          label,
          color: ACTION_COLOR[action.type],
          romaji: action.type === "chorus" ? action.romaji : undefined,
          point,
        },
      ];
    });

    if (matchedLineIndices.length > 0) {
      if (unanchoredMarkers.length > 0) {
        const firstCoveredStart = lyrics[matchedLineIndices[0]].start;
        if (point.start < firstCoveredStart) {
          standalone.push({ time: point.start, markers: unanchoredMarkers, point });
        }
        matchedLineIndices.forEach((idx) => {
          const existing = byLine.get(idx) ?? [];
          existing.push(...unanchoredMarkers);
          byLine.set(idx, existing);
        });
      }
    } else {
      const allMarkers = point.actions.flatMap((action) => {
        const label = actionLabel(action);
        if (label === null) return [];
        return [
          {
            type: action.type,
            label,
            color: ACTION_COLOR[action.type],
            romaji: action.type === "chorus" ? action.romaji : undefined,
            point,
          },
        ];
      });
      if (allMarkers.length > 0) {
        standalone.push({ time: point.start, markers: allMarkers, point });
      }
    }
  }
  return { byLine, standalone };
}

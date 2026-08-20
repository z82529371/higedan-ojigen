import type { LyricLine, OuenAction, OuenActionType, ResolvedOuenPoint } from "../types";
import { ACTION_COLOR, ACTION_PRIORITY, actionLabel } from "../components/actionColors";
import { isLineCovered } from "./coverage";
import type { LineMarker } from "./markers";

export interface LyricFragment {
  text: string;
  color: string | null;
  attachedMarkers?: LineMarker[];
  romaji?: string;
}

export type LyricColoring =
  | { type: "whole-line"; fragments: LyricFragment[] }
  | { type: "partial"; fragments: LyricFragment[] }
  | { type: "none"; fragments: LyricFragment[] };

const isActionWithText = (action: OuenAction): action is OuenAction & { text: string } =>
  action.text !== undefined;

function splitOnMatches(lineText: string, matchText: string, color: string): LyricFragment[] {
  const fragments: LyricFragment[] = [];
  let cursor = 0;
  let index = lineText.indexOf(matchText, cursor);
  while (index !== -1) {
    if (index > cursor) {
      fragments.push({ text: lineText.slice(cursor, index), color: null });
    }
    fragments.push({ text: matchText, color });
    cursor = index + matchText.length;
    index = lineText.indexOf(matchText, cursor);
  }
  if (cursor < lineText.length) {
    fragments.push({ text: lineText.slice(cursor), color: null });
  }
  return fragments;
}

function applyMatches(fragments: LyricFragment[], matchText: string, color: string): LyricFragment[] {
  return fragments.flatMap((f) =>
    f.color !== null || !f.text.includes(matchText) ? [f] : splitOnMatches(f.text, matchText, color),
  );
}

function highestPriority(types: readonly OuenActionType[]): OuenActionType {
  return types.reduce((best, t) => (ACTION_PRIORITY[t] > ACTION_PRIORITY[best] ? t : best));
}

export function buildLineColoring(line: LyricLine, ouenPoints: readonly ResolvedOuenPoint[]): LyricColoring {
  const coveringPoints = ouenPoints.filter((p) => isLineCovered(line, p));
  const coveringActions = coveringPoints.flatMap((p) => p.actions);

  // Collect gesture markers with text matching this line
  const gestureMarkersMap = new Map<string, LineMarker[]>();
  for (const point of coveringPoints) {
    for (const action of point.actions) {
      if (action.type === "gesture" && action.text && line.text.includes(action.text)) {
        const label = actionLabel(action);
        if (label !== null) {
          const marker: LineMarker = {
            type: action.type,
            label,
            color: ACTION_COLOR[action.type],
            point,
          };
          const existing = gestureMarkersMap.get(action.text) ?? [];
          existing.push(marker);
          gestureMarkersMap.set(action.text, existing);
        }
      }
    }
  }

  const wholeLineTypes = [...new Set(coveringActions.filter((a) => a.text === undefined).map((a) => a.type))];
  if (wholeLineTypes.length > 0) {
    const winner = highestPriority(wholeLineTypes);
    let frags: LyricFragment[] = [{ text: line.text, color: ACTION_COLOR[winner] }];
    if (gestureMarkersMap.size > 0) {
      const texts = [...gestureMarkersMap.keys()].sort((a, b) => b.length - a.length);
      for (const txt of texts) {
        frags = frags.flatMap((f) => {
          if (f.attachedMarkers || !f.text.includes(txt)) return [f];
          const parts: LyricFragment[] = [];
          let cursor = 0;
          let idx = f.text.indexOf(txt, cursor);
          while (idx !== -1) {
            if (idx > cursor) {
              parts.push({ text: f.text.slice(cursor, idx), color: f.color });
            }
            parts.push({ text: txt, color: f.color, attachedMarkers: gestureMarkersMap.get(txt) });
            cursor = idx + txt.length;
            idx = f.text.indexOf(txt, cursor);
          }
          if (cursor < f.text.length) {
            parts.push({ text: f.text.slice(cursor), color: f.color });
          }
          return parts;
        });
      }
    }
    return { type: "whole-line", fragments: frags };
  }

  const matchedActions = coveringActions.filter(isActionWithText).filter((a) => line.text.includes(a.text));
  if (matchedActions.length > 0) {
    const winner = highestPriority([...new Set(matchedActions.map((a) => a.type))]);
    const texts = [...new Set(matchedActions.filter((a) => a.type === winner).map((a) => a.text))].sort(
      (a, b) => b.length - a.length,
    );
    const fragments: LyricFragment[] = [{ text: line.text, color: null }];
    const colored = texts.reduce((acc, text) => applyMatches(acc, text, ACTION_COLOR[winner]), fragments);

    const romajiByText = new Map<string, string>();
    for (const a of coveringActions) {
      if (a.type === "chorus" && a.text !== undefined && a.romaji !== undefined && line.text.includes(a.text)) {
        romajiByText.set(a.text, a.romaji);
      }
    }

    const withMarkers = colored.map((f) => {
      const extra: LyricFragment = { ...f };
      if (gestureMarkersMap.has(f.text)) {
        extra.attachedMarkers = gestureMarkersMap.get(f.text);
      }
      if (f.color !== null && romajiByText.has(f.text)) {
        extra.romaji = romajiByText.get(f.text);
      }
      return extra;
    });

    return { type: "partial", fragments: withMarkers };
  }

  if (gestureMarkersMap.size > 0) {
    const texts = [...gestureMarkersMap.keys()].sort((a, b) => b.length - a.length);
    let frags: LyricFragment[] = [{ text: line.text, color: null }];
    for (const txt of texts) {
      frags = frags.flatMap((f) => {
        if (f.attachedMarkers || !f.text.includes(txt)) return [f];
        const parts: LyricFragment[] = [];
        let cursor = 0;
        let idx = f.text.indexOf(txt, cursor);
        while (idx !== -1) {
          if (idx > cursor) {
            parts.push({ text: f.text.slice(cursor, idx), color: null });
          }
          parts.push({ text: txt, color: null, attachedMarkers: gestureMarkersMap.get(txt) });
          cursor = idx + txt.length;
          idx = f.text.indexOf(txt, cursor);
        }
        if (cursor < f.text.length) {
          parts.push({ text: f.text.slice(cursor), color: null });
        }
        return parts;
      });
    }
    return { type: "none", fragments: frags };
  }

  return { type: "none", fragments: [{ text: line.text, color: null }] };
}
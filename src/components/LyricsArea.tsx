import { memo, useEffect, useMemo, useRef, type CSSProperties } from "react";
import type { LyricLine, OuenActionType, OuenPoint } from "../types";
import { currentLineIndex } from "../time/sync";
import { formatTime } from "../time/format";
import { ACTION_COLOR, ACTION_LABEL, actionLabel } from "./actionColors";

export type LyricsMode = "read" | "karaoke";

interface LyricsAreaProps {
  lyrics: LyricLine[];
  ouenPoints: OuenPoint[];
  mode: LyricsMode;
  currentIndex: number | null;
  chorusActive: boolean;
  currentTime: number;
  onSeek: (time: number) => void;
}

interface LineMarker {
  type: OuenActionType;
  label: string;
  color: string;
  romaji?: string;
  point: OuenPoint;
}

interface StandaloneRow {
  time: number;
  markers: LineMarker[];
  point: OuenPoint;
}

interface BuiltMarkers {
  byLine: Map<number, LineMarker[]>;
  standalone: StandaloneRow[];
}

type ReadItem =
  | { kind: "line"; line: LyricLine; lineIndex: number; markers: LineMarker[]; chorus: boolean }
  | { kind: "standalone"; time: number; markers: LineMarker[] };

type KaraokeRow =
  | { kind: "line"; line: LyricLine; lineIndex: number; markers: LineMarker[] }
  | { kind: "standalone"; time: number; markers: LineMarker[]; point: OuenPoint };

function isLineInChorus(line: LyricLine, ouenPoints: OuenPoint[]): boolean {
  return ouenPoints.some(
    (p) => p.actions.some((a) => a.type === "chorus") && line.start < p.end && line.end > p.start,
  );
}

function isPointActive(point: OuenPoint, time: number): boolean {
  return point.start <= time && time < point.end;
}

function buildMarkers(lyrics: LyricLine[], ouenPoints: OuenPoint[]): BuiltMarkers {
  const byLine = new Map<number, LineMarker[]>();
  const standalone: StandaloneRow[] = [];
  const sorted = [...ouenPoints].sort((a, b) => a.start - b.start);
  for (const point of sorted) {
    const markers: LineMarker[] = [];
    for (const action of point.actions) {
      const label = actionLabel(action);
      if (label === null) {
        continue;
      }
      markers.push({
        type: action.type,
        label,
        color: ACTION_COLOR[action.type],
        romaji: action.type === "chorus" ? action.romaji : undefined,
        point,
      });
    }
    if (markers.length === 0) {
      continue;
    }
    const lineIndex = currentLineIndex(point.start, lyrics);
    if (lineIndex !== null) {
      const existing = byLine.get(lineIndex) ?? [];
      existing.push(...markers);
      byLine.set(lineIndex, existing);
    } else {
      standalone.push({ time: point.start, markers, point });
    }
  }
  return { byLine, standalone };
}

function byTime(a: number, b: number, aFirst: boolean): number {
  if (a !== b) {
    return a - b;
  }
  return aFirst ? -1 : 1;
}

export const LyricsArea = memo(function LyricsArea({
  lyrics,
  ouenPoints,
  mode,
  currentIndex,
  chorusActive,
  currentTime,
  onSeek,
}: LyricsAreaProps) {
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const built = useMemo(() => buildMarkers(lyrics, ouenPoints), [lyrics, ouenPoints]);

  const karaokeRows = useMemo(() => {
    const rows: KaraokeRow[] = lyrics.map((line, i) => ({
      kind: "line",
      line,
      lineIndex: i,
      markers: built.byLine.get(i) ?? [],
    }));
    for (const row of built.standalone) {
      rows.push({ kind: "standalone", time: row.time, markers: row.markers, point: row.point });
    }
    rows.sort((a, b) => byTime(a.kind === "line" ? a.line.start : a.time, b.kind === "line" ? b.line.start : b.time, false));
    return rows;
  }, [lyrics, built]);

  const readItems = useMemo(() => {
    const items: ReadItem[] = lyrics.map((line, i) => ({
      kind: "line",
      line,
      lineIndex: i,
      markers: built.byLine.get(i) ?? [],
      chorus: isLineInChorus(line, ouenPoints),
    }));
    for (const row of built.standalone) {
      items.push({ kind: "standalone", time: row.time, markers: row.markers });
    }
    items.sort((a, b) => byTime(a.kind === "line" ? a.line.start : a.time, b.kind === "line" ? b.line.start : b.time, true));
    return items;
  }, [lyrics, ouenPoints, built]);

  useEffect(() => {
    if (mode !== "karaoke" || currentIndex === null) {
      return;
    }
    const idx = karaokeRows.findIndex((r) => r.kind === "line" && r.lineIndex === currentIndex);
    if (idx >= 0) {
      rowRefs.current[idx]?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [mode, currentIndex, karaokeRows]);

  if (mode === "read") {
    return (
      <div className="read-mode">
        {readItems.map((item, i) => {
          if (item.kind === "line") {
            const cls = item.chorus ? "chorus" : "lyrics";
            return (
              <button
                key={i}
                type="button"
                className={`chant-line ${cls}`}
                onClick={() => onSeek(item.line.start)}
              >
                <div className="chant-time">
                  {formatTime(item.line.start)} · {item.chorus ? "合唱" : "歌詞"}
                </div>
                {item.markers.length > 0 && (
                  <div className="chant-markers">
                    {item.markers.map((m, j) => (
                      <span
                        key={j}
                        className="chant-marker"
                        style={{ "--marker-color": m.color } as CSSProperties}
                        title={ACTION_LABEL[m.type]}
                      >
                        {m.label}
                      </span>
                    ))}
                  </div>
                )}
                <div className="chant-text">{item.line.text}</div>
                {item.line.romaji && <div className="chant-romaji">{item.line.romaji}</div>}
              </button>
            );
          }
          return (
            <button
              key={i}
              type="button"
              className="chant-line"
              onClick={() => onSeek(item.time)}
            >
              <div className="chant-time">{formatTime(item.time)} · 應援</div>
              <div className="chant-markers">
                {item.markers.map((m, j) => (
                  <span
                    key={j}
                    className="chant-marker"
                    style={{ "--marker-color": m.color } as CSSProperties}
                    title={ACTION_LABEL[m.type]}
                  >
                    {m.label}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="karaoke-scroll-list">
      {karaokeRows.map((row, i) => {
        if (row.kind === "line") {
          const state =
            currentIndex === null
              ? "future"
              : row.lineIndex === currentIndex
                ? "active"
                : row.lineIndex < currentIndex
                  ? "past"
                  : "future";
          const cls = state === "active" && chorusActive ? "active chorus" : state;
          return (
            <button
              key={i}
              type="button"
              ref={(el) => {
                rowRefs.current[i] = el;
              }}
              className={`karaoke-line ${cls}`}
              onClick={() => onSeek(row.line.start)}
            >
              {row.markers.length > 0 && (
                <span className="karaoke-markers">
                  {row.markers.map((m, j) => (
                    <span
                      key={j}
                      className={`karaoke-marker${isPointActive(m.point, currentTime) ? " point-active" : ""}`}
                      style={{ "--marker-color": m.color } as CSSProperties}
                      title={ACTION_LABEL[m.type]}
                    >
                      {m.label}
                    </span>
                  ))}
                </span>
              )}
              <span className="karaoke-text">{row.line.text}</span>
              {row.line.romaji && <span className="karaoke-romaji">{row.line.romaji}</span>}
            </button>
          );
        }
        const active = isPointActive(row.point, currentTime);
        const state = active ? "active" : currentTime >= row.point.end ? "past" : "future";
        return (
          <button
            key={i}
            type="button"
            ref={(el) => {
              rowRefs.current[i] = el;
            }}
            className={`karaoke-line marker-line ${state}`}
            onClick={() => onSeek(row.time)}
          >
            {row.markers.map((m, j) => (
              <span
                key={j}
                className="karaoke-marker"
                style={{ "--marker-color": m.color } as CSSProperties}
                title={ACTION_LABEL[m.type]}
              >
                {m.label}
              </span>
            ))}
          </button>
        );
      })}
    </div>
  );
});
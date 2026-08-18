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
  onAdjustLineTime?: (lineIndex: number, delta: number) => void;
  lockedLines?: Set<number>;
  onToggleLock?: (lineIndex: number) => void;
  devMode?: boolean;
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
  onAdjustLineTime,
  lockedLines,
  onToggleLock,
  devMode,
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
    if (currentIndex === null) {
      return;
    }
    if (mode === "karaoke") {
      const idx = karaokeRows.findIndex((r) => r.kind === "line" && r.lineIndex === currentIndex);
      if (idx >= 0) {
        rowRefs.current[idx]?.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    } else {
      const idx = readItems.findIndex((r) => r.kind === "line" && r.lineIndex === currentIndex);
      if (idx >= 0) {
        rowRefs.current[idx]?.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    }
  }, [mode, currentIndex, karaokeRows, readItems]);

  if (mode === "read") {
    return (
      <div className="read-mode">
        {readItems.map((item, i) => {
          if (item.kind === "line") {
            const isActive = item.lineIndex === currentIndex;
            const cls = `${item.chorus ? "chorus" : "lyrics"}${isActive ? " active" : ""}`;
            return (
              <div
                key={i}
                role="button"
                tabIndex={0}
                ref={(el) => {
                  rowRefs.current[i] = el as unknown as HTMLButtonElement;
                }}
                className={`chant-line ${cls}`}
                onClick={() => onSeek(item.line.start)}
                onKeyDown={(e) => { if (e.key === "Enter") onSeek(item.line.start); }}
              >
                <div className="chant-time" style={{ display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "space-between", alignItems: "center" }}>
                  <span>
                    {devMode ? (
                      <>
                        {item.line.start.toFixed(1)}s ~ {item.line.end.toFixed(1)}s
                        <span style={{ fontSize: "11px", color: "#888", marginLeft: "6px" }}>
                          (長度: {(item.line.end - item.line.start).toFixed(1)}秒)
                        </span>
                        {isActive && (
                          <span style={{ fontSize: "11px", color: "#0071e3", fontWeight: "bold", marginLeft: "6px" }}>
                            ▶ 已唱 {(currentTime - item.line.start).toFixed(1)}s / 剩 {(item.line.end - currentTime).toFixed(1)}s
                          </span>
                        )}
                        {" · "}
                      </>
                    ) : null}
                    {item.chorus ? "合唱" : "歌詞"}
                  </span>
                  {onAdjustLineTime && (
                    <span onClick={(e) => e.stopPropagation()} style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                      {onToggleLock && (
                        <button
                          type="button"
                          style={{
                            padding: "1px 6px",
                            fontSize: "10px",
                            background: lockedLines?.has(item.lineIndex) ? "#ff3b30" : "#eee",
                            color: lockedLines?.has(item.lineIndex) ? "#fff" : "#333",
                            borderRadius: "3px",
                            border: "1px solid #ccc",
                            cursor: "pointer",
                            fontWeight: "bold",
                            marginRight: "4px"
                          }}
                          onClick={() => onToggleLock(item.lineIndex)}
                        >
                          {lockedLines?.has(item.lineIndex) ? "🔒 已鎖定" : "🔓 鎖定"}
                        </button>
                      )}
                      {!lockedLines?.has(item.lineIndex) && (
                        <>
                          <span style={{ fontSize: "11px", color: "#666", marginRight: "2px" }}>切分對齊:</span>
                          <button type="button" style={{ padding: "1px 5px", fontSize: "10px" }} onClick={() => onAdjustLineTime(item.lineIndex, -5)}>-5s</button>
                          <button type="button" style={{ padding: "1px 5px", fontSize: "10px" }} onClick={() => onAdjustLineTime(item.lineIndex, -1)}>-1s</button>
                          <button type="button" style={{ padding: "1px 5px", fontSize: "10px" }} onClick={() => onAdjustLineTime(item.lineIndex, -0.1)}>-0.1s</button>
                          <button type="button" style={{ padding: "1px 5px", fontSize: "10px" }} onClick={() => onAdjustLineTime(item.lineIndex, 0.1)}>+0.1s</button>
                          <button type="button" style={{ padding: "1px 5px", fontSize: "10px" }} onClick={() => onAdjustLineTime(item.lineIndex, 1)}>+1s</button>
                          <button type="button" style={{ padding: "1px 5px", fontSize: "10px" }} onClick={() => onAdjustLineTime(item.lineIndex, 5)}>+5s</button>
                        </>
                      )}
                    </span>
                  )}
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
              </div>
            );
          }
          return (
            <div
              key={i}
              role="button"
              tabIndex={0}
              className="chant-line"
              onClick={() => onSeek(item.time)}
              onKeyDown={(e) => { if (e.key === "Enter") onSeek(item.time); }}
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
            </div>
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
            <div
              key={i}
              role="button"
              tabIndex={0}
              ref={(el) => {
                rowRefs.current[i] = el;
              }}
              className={`karaoke-line ${cls}`}
              onClick={() => onSeek(row.line.start)}
              onKeyDown={(e) => { if (e.key === "Enter") onSeek(row.line.start); }}
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
              <span className="karaoke-text">
                {row.line.text}
                {devMode && (
                  <>
                    <span style={{ fontSize: "11px", opacity: 0.7, marginLeft: "6px" }}>
                      ({row.line.start.toFixed(1)}s ~ {row.line.end.toFixed(1)}s, {(row.line.end - row.line.start).toFixed(1)}s)
                    </span>
                    {state === "active" && (
                      <span style={{ fontSize: "11px", color: "#0071e3", fontWeight: "bold", marginLeft: "6px" }}>
                        ▶ 已唱 {(currentTime - row.line.start).toFixed(1)}s / 剩 {(row.line.end - currentTime).toFixed(1)}s
                      </span>
                    )}
                  </>
                )}
                {onAdjustLineTime && (
                  <span onClick={(e) => e.stopPropagation()} style={{ marginLeft: "6px", display: "inline-flex", gap: "3px", alignItems: "center" }}>
                    {onToggleLock && (
                      <button
                        type="button"
                        style={{
                          padding: "1px 5px",
                          fontSize: "9px",
                          background: lockedLines?.has(row.lineIndex) ? "#ff3b30" : "#eee",
                          color: lockedLines?.has(row.lineIndex) ? "#fff" : "#333",
                          borderRadius: "3px",
                          border: "1px solid #ccc",
                          cursor: "pointer",
                          fontWeight: "bold",
                          marginRight: "2px"
                        }}
                        onClick={() => onToggleLock(row.lineIndex)}
                      >
                        {lockedLines?.has(row.lineIndex) ? "🔒 已鎖定" : "🔓 鎖定"}
                      </button>
                    )}
                    {!lockedLines?.has(row.lineIndex) && (
                      <>
                        <button type="button" style={{ padding: "1px 3px", fontSize: "9px" }} onClick={() => onAdjustLineTime(row.lineIndex, -5)}>-5s</button>
                        <button type="button" style={{ padding: "1px 3px", fontSize: "9px" }} onClick={() => onAdjustLineTime(row.lineIndex, -1)}>-1s</button>
                        <button type="button" style={{ padding: "1px 3px", fontSize: "9px" }} onClick={() => onAdjustLineTime(row.lineIndex, -0.1)}>-0.1s</button>
                        <button type="button" style={{ padding: "1px 3px", fontSize: "9px" }} onClick={() => onAdjustLineTime(row.lineIndex, 0.1)}>+0.1s</button>
                        <button type="button" style={{ padding: "1px 3px", fontSize: "9px" }} onClick={() => onAdjustLineTime(row.lineIndex, 1)}>+1s</button>
                        <button type="button" style={{ padding: "1px 3px", fontSize: "9px" }} onClick={() => onAdjustLineTime(row.lineIndex, 5)}>+5s</button>
                      </>
                    )}
                  </span>
                )}
              </span>
              {row.line.romaji && <span className="karaoke-romaji">{row.line.romaji}</span>}
            </div>
          );
        }
        const active = isPointActive(row.point, currentTime);
        const state = active ? "active" : currentTime >= row.point.end ? "past" : "future";
        return (
          <div
            key={i}
            role="button"
            tabIndex={0}
            ref={(el) => {
              rowRefs.current[i] = el as unknown as HTMLButtonElement;
            }}
            className={`karaoke-line marker-line ${state}`}
            onClick={() => onSeek(row.time)}
            onKeyDown={(e) => { if (e.key === "Enter") onSeek(row.time); }}
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
          </div>
        );
      })}
    </div>
  );
});
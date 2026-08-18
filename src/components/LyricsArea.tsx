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
  onSetLineStart?: (lineIndex: number, targetStart: number) => void;
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

function getLineActionClasses(line: LyricLine, ouenPoints: OuenPoint[]): string {
  const classes: string[] = [];
  ouenPoints.forEach((p) => {
    if (line.start < p.end && line.end > p.start) {
      p.actions.forEach((a) => {
        if (!classes.includes(a.type)) {
          classes.push(a.type);
        }
      });
    }
  });
  return classes.join(" ");
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
    // 方案 A：找到所有與此應援區間（point.start ~ point.end）有交集的歌詞行
    const matchedLineIndices: number[] = [];
    lyrics.forEach((line, idx) => {
      if (line.start < point.end && line.end > point.start) {
        matchedLineIndices.push(idx);
      }
    });

    if (matchedLineIndices.length > 0) {
      matchedLineIndices.forEach((idx) => {
        const existing = byLine.get(idx) ?? [];
        existing.push(...markers);
        byLine.set(idx, existing);
      });
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
  onSetLineStart,
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
            const cls = `${isActive ? "active" : ""}`;
            return (
              <div
                key={i}
                role="button"
                tabIndex={0}
                ref={(el) => {
                  rowRefs.current[i] = el as unknown as HTMLButtonElement;
                }}
                className={`chant-line ${cls} ${getLineActionClasses(item.line, ouenPoints)}`}
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
                    <span className="chant-type-label">
                      {(() => {
                        if (item.markers.length === 0) return "";
                        const labels = Array.from(new Set(item.markers.map((m) => ACTION_LABEL[m.type])));
                        return `(${labels.join("、")})`;
                      })()}
                    </span>
                  </span>
                  {onAdjustLineTime && (
                    <span onClick={(e) => e.stopPropagation()} style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", marginTop: "4px" }}>
                      {onToggleLock && (
                        <button
                          type="button"
                          style={{
                            padding: "4px 10px",
                            fontSize: "13px",
                            background: lockedLines?.has(item.lineIndex) ? "#ff3b30" : "#f0f0f0",
                            color: lockedLines?.has(item.lineIndex) ? "#fff" : "#333",
                            borderRadius: "6px",
                            border: "1px solid #ccc",
                            cursor: "pointer",
                            fontWeight: "bold",
                            marginRight: "6px"
                          }}
                          onClick={() => onToggleLock(item.lineIndex)}
                        >
                          {lockedLines?.has(item.lineIndex) ? "🔒 已鎖定" : "🔓 鎖定"}
                        </button>
                      )}
                      {!lockedLines?.has(item.lineIndex) && (
                        <>
                          <span style={{ fontSize: "13px", color: "#555", fontWeight: "600", marginRight: "2px" }}>切分對齊:</span>
                          <button type="button" style={{ padding: "4px 8px", fontSize: "13px", borderRadius: "5px", border: "1px solid #ccc", background: "#fff", cursor: "pointer" }} onClick={() => onAdjustLineTime(item.lineIndex, -5)}>-5s</button>
                          <button type="button" style={{ padding: "4px 8px", fontSize: "13px", borderRadius: "5px", border: "1px solid #ccc", background: "#fff", cursor: "pointer" }} onClick={() => onAdjustLineTime(item.lineIndex, -1)}>-1s</button>
                          <button type="button" style={{ padding: "4px 8px", fontSize: "13px", borderRadius: "5px", border: "1px solid #ccc", background: "#fff", cursor: "pointer" }} onClick={() => onAdjustLineTime(item.lineIndex, -0.1)}>-0.1s</button>
                          <button type="button" style={{ padding: "4px 8px", fontSize: "13px", borderRadius: "5px", border: "1px solid #ccc", background: "#fff", cursor: "pointer" }} onClick={() => onAdjustLineTime(item.lineIndex, 0.1)}>+0.1s</button>
                          <button type="button" style={{ padding: "4px 8px", fontSize: "13px", borderRadius: "5px", border: "1px solid #ccc", background: "#fff", cursor: "pointer" }} onClick={() => onAdjustLineTime(item.lineIndex, 1)}>+1s</button>
                          <button type="button" style={{ padding: "4px 8px", fontSize: "13px", borderRadius: "5px", border: "1px solid #ccc", background: "#fff", cursor: "pointer" }} onClick={() => onAdjustLineTime(item.lineIndex, 5)}>+5s</button>
                          {onSetLineStart && (
                            <span style={{ marginLeft: "10px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                              <span style={{ fontSize: "13px", color: "#d97706", fontWeight: "bold" }}>開頭秒數:</span>
                              <input
                                type="number"
                                step="0.01"
                                defaultValue={item.line.start}
                                key={item.line.start}
                                style={{
                                  width: "72px",
                                  padding: "3px 6px",
                                  fontSize: "13px",
                                  fontWeight: "bold",
                                  border: "1.5px solid #f59e0b",
                                  borderRadius: "5px",
                                  background: "#fffbe6",
                                  textAlign: "center"
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    const val = parseFloat((e.target as HTMLInputElement).value);
                                    if (!isNaN(val) && val >= 0) {
                                      onSetLineStart(item.lineIndex, val);
                                    }
                                  }
                                }}
                                onBlur={(e) => {
                                  const val = parseFloat(e.target.value);
                                  if (!isNaN(val) && val >= 0 && val !== item.line.start) {
                                    onSetLineStart(item.lineIndex, val);
                                  }
                                }}
                              />
                            </span>
                          )}
                        </>
                      )}
                    </span>
                  )}
                </div>
                {(() => {
                  // 只在該應援區間（point.start ~ point.end）所涵蓋的第一行歌詞進行倒數
                  const upcomingMarker = item.markers.find((m) => {
                    const diff = m.point.start - currentTime;
                    return diff > 0 && diff <= 3.0;
                  });

                  if (!upcomingMarker) return null;

                  // 檢查本行是否為該應援區間涵蓋的第一行歌詞
                  const firstCoveredLine = lyrics.find(
                    (line) => line.start < upcomingMarker.point.end && line.end > upcomingMarker.point.start,
                  );

                  if (firstCoveredLine && firstCoveredLine.start === item.line.start) {
                    const diff = upcomingMarker.point.start - currentTime;
                    return <div className="line-countdown-top">⏳{Math.ceil(diff)}</div>;
                  }

                  return null;
                })()}
                {(() => {
                  const hasParentheses = /\(.*?\)/.test(item.line.text);
                  const visibleMarkers = item.markers.filter((m) => {
                    // 如果歌詞含括號，文字口號與手勢已被垂直對齊顯示在括號上方，頂部列不重複顯示
                    if (hasParentheses && (m.type === "gesture" || (m.label && item.line.text.includes(m.label)))) {
                      return false;
                    }
                    return true;
                  });
                  if (visibleMarkers.length === 0) return null;

                  return (
                    <div className="chant-markers">
                      {visibleMarkers.map((m, j) => {
                        const active = isPointActive(m.point, currentTime);
                        return (
                          <span
                            key={j}
                            className={`chant-marker${active ? " active-point" : ""}`}
                            style={{ "--marker-color": m.color } as CSSProperties}
                            title={ACTION_LABEL[m.type]}
                          >
                            {m.label}
                          </span>
                        );
                      })}
                    </div>
                  );
                })()}
                <div className="chant-text">
                  {(() => {
                    const text = item.line.text;
                    const match = text.match(/^(.*?)\((.*?)\)(.*)$/);
                    if (match && item.markers.length > 0) {
                      const [, before, parenthesized, after] = match;
                      const activeColor = item.markers[0]?.color ?? "#b8a024";
                      const gestureMarker = item.markers.find((m) => m.type === "gesture");

                      return (
                        <>
                          {before}
                          <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", verticalAlign: "bottom" }}>
                            {gestureMarker && (
                              <span style={{ fontSize: "18px", lineHeight: "1.2", marginBottom: "2px" }}>
                                {gestureMarker.label}
                              </span>
                            )}
                            <span style={{ color: activeColor, fontWeight: 800 }}>({parenthesized})</span>
                          </span>
                          {after}
                        </>
                      );
                    }
                    return text;
                  })()}
                </div>
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
          const cls = state;
          return (
            <div
              key={i}
              role="button"
              tabIndex={0}
              ref={(el) => {
                rowRefs.current[i] = el;
              }}
              className={`karaoke-line ${cls} ${getLineActionClasses(row.line, ouenPoints)}`}
              onClick={() => onSeek(row.line.start)}
              onKeyDown={(e) => { if (e.key === "Enter") onSeek(row.line.start); }}
            >
              {(() => {
                const upcomingMarker = row.markers.find((m) => {
                  const diff = m.point.start - currentTime;
                  return diff > 0 && diff <= 3.0;
                });

                if (!upcomingMarker) return null;

                const firstCoveredLine = lyrics.find(
                  (line) => line.start < upcomingMarker.point.end && line.end > upcomingMarker.point.start,
                );

                if (firstCoveredLine && firstCoveredLine.start === row.line.start) {
                  const diff = upcomingMarker.point.start - currentTime;
                  return <div className="line-countdown-top">⏳{Math.ceil(diff)}</div>;
                }

                return null;
              })()}
              {(() => {
                const hasParentheses = /\(.*?\)/.test(row.line.text);
                const visibleMarkers = row.markers.filter((m) => {
                  if (hasParentheses && (m.type === "gesture" || (m.label && row.line.text.includes(m.label)))) {
                    return false;
                  }
                  return true;
                });
                if (visibleMarkers.length === 0) return null;

                return (
                  <span className="karaoke-markers">
                    {visibleMarkers.map((m, j) => {
                      const active = isPointActive(m.point, currentTime);
                      return (
                        <span
                          key={j}
                          className={`karaoke-marker${active ? " point-active" : ""}`}
                          style={{ "--marker-color": m.color } as CSSProperties}
                          title={ACTION_LABEL[m.type]}
                        >
                          {m.label}
                        </span>
                      );
                    })}
                  </span>
                );
              })()}
              <span className="karaoke-text">
                {(() => {
                  const text = row.line.text;
                  const match = text.match(/^(.*?)\((.*?)\)(.*)$/);
                  if (match && row.markers.length > 0) {
                    const [, before, parenthesized, after] = match;
                    const activeColor = row.markers[0]?.color ?? "#b8a024";
                    const gestureMarker = row.markers.find((m) => m.type === "gesture");

                    return (
                      <>
                        {before}
                        <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", verticalAlign: "bottom" }}>
                          {gestureMarker && (
                            <span style={{ fontSize: "clamp(20px, 4.5vw, 26px)", lineHeight: "1.2", marginBottom: "2px" }}>
                              {gestureMarker.label}
                            </span>
                          )}
                          <span style={{ color: activeColor, fontWeight: 900 }}>({parenthesized})</span>
                        </span>
                        {after}
                      </>
                    );
                  }
                  return text;
                })()}
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
                          padding: "3px 8px",
                          fontSize: "11px",
                          background: lockedLines?.has(row.lineIndex) ? "#ff3b30" : "#f0f0f0",
                          color: lockedLines?.has(row.lineIndex) ? "#fff" : "#333",
                          borderRadius: "4px",
                          border: "1px solid #ccc",
                          cursor: "pointer",
                          fontWeight: "bold",
                          marginRight: "4px"
                        }}
                        onClick={() => onToggleLock(row.lineIndex)}
                      >
                        {lockedLines?.has(row.lineIndex) ? "🔒 已鎖定" : "🔓 鎖定"}
                      </button>
                    )}
                    {!lockedLines?.has(row.lineIndex) && (
                      <>
                        <button type="button" style={{ padding: "3px 6px", fontSize: "11px", borderRadius: "4px", border: "1px solid #ccc", background: "#fff", cursor: "pointer" }} onClick={() => onAdjustLineTime(row.lineIndex, -5)}>-5s</button>
                        <button type="button" style={{ padding: "3px 6px", fontSize: "11px", borderRadius: "4px", border: "1px solid #ccc", background: "#fff", cursor: "pointer" }} onClick={() => onAdjustLineTime(row.lineIndex, -1)}>-1s</button>
                        <button type="button" style={{ padding: "3px 6px", fontSize: "11px", borderRadius: "4px", border: "1px solid #ccc", background: "#fff", cursor: "pointer" }} onClick={() => onAdjustLineTime(row.lineIndex, -0.1)}>-0.1s</button>
                        <button type="button" style={{ padding: "3px 6px", fontSize: "11px", borderRadius: "4px", border: "1px solid #ccc", background: "#fff", cursor: "pointer" }} onClick={() => onAdjustLineTime(row.lineIndex, 0.1)}>+0.1s</button>
                        <button type="button" style={{ padding: "3px 6px", fontSize: "11px", borderRadius: "4px", border: "1px solid #ccc", background: "#fff", cursor: "pointer" }} onClick={() => onAdjustLineTime(row.lineIndex, 1)}>+1s</button>
                        <button type="button" style={{ padding: "3px 6px", fontSize: "11px", borderRadius: "4px", border: "1px solid #ccc", background: "#fff", cursor: "pointer" }} onClick={() => onAdjustLineTime(row.lineIndex, 5)}>+5s</button>
                        {onSetLineStart && (
                          <span style={{ marginLeft: "6px", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                            <span style={{ fontSize: "11px", color: "#d97706", fontWeight: "bold" }}>開頭:</span>
                            <input
                              type="number"
                              step="0.01"
                              defaultValue={row.line.start}
                              key={row.line.start}
                              style={{
                                width: "60px",
                                padding: "2px 4px",
                                fontSize: "11px",
                                fontWeight: "bold",
                                border: "1.5px solid #f59e0b",
                                borderRadius: "4px",
                                background: "#fffbe6",
                                textAlign: "center"
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  const val = parseFloat((e.target as HTMLInputElement).value);
                                  if (!isNaN(val) && val >= 0) {
                                    onSetLineStart(row.lineIndex, val);
                                  }
                                }
                              }}
                              onBlur={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val) && val >= 0 && val !== row.line.start) {
                                  onSetLineStart(row.lineIndex, val);
                                }
                              }}
                            />
                          </span>
                        )}
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
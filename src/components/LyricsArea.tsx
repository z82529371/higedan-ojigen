import { memo, useEffect, useMemo, useRef, type CSSProperties } from "react";
import type { LyricLine, ResolvedOuenPoint } from "../types";
import { formatTime } from "../time/format";
import { ACTION_LABEL } from "./actionColors";
import { buildMarkers, type LineMarker } from "../lyrics/markers";
import { buildLineColoring, type LyricFragment } from "../lyrics/lyricColoring";
import { coveringPoints, isLineCovered, lineActionTypes } from "../lyrics/coverage";

export type LyricsMode = "read" | "karaoke";

interface LyricsAreaProps {
  lyrics: LyricLine[];
  ouenPoints: ResolvedOuenPoint[];
  mode: LyricsMode;
  currentIndex: number | null;
  currentTime: number;
  onSeek: (time: number) => void;
  onAdjustLineTime?: (lineIndex: number, delta: number) => void;
  onSetLineStart?: (lineIndex: number, targetStart: number) => void;
  lockedLines?: Set<number>;
  onToggleLock?: (lineIndex: number) => void;
  devMode?: boolean;
}

type ReadItem =
  | { kind: "line"; line: LyricLine; lineIndex: number; markers: LineMarker[] }
  | { kind: "standalone"; time: number; markers: LineMarker[]; point: ResolvedOuenPoint };

type KaraokeRow =
  | { kind: "line"; line: LyricLine; lineIndex: number; markers: LineMarker[] }
  | { kind: "standalone"; time: number; markers: LineMarker[]; point: ResolvedOuenPoint };

function actionLabelText(line: LyricLine, ouenPoints: ResolvedOuenPoint[]): string {
  const labels = Array.from(new Set(lineActionTypes(line, ouenPoints).map((t) => ACTION_LABEL[t])));
  return labels.length > 0 ? `(${labels.join("、")})` : "";
}

function upcomingPointForLine(line: LyricLine, ouenPoints: ResolvedOuenPoint[], currentTime: number): ResolvedOuenPoint | null {
  return (
    coveringPoints(line, ouenPoints).find((p) => {
      const diff = p.start - currentTime;
      return diff > 0 && diff <= 3.0;
    }) ?? null
  );
}

function isFirstCoveredLine(line: LyricLine, point: ResolvedOuenPoint, lyrics: LyricLine[]): boolean {
  const first = lyrics.find((l) => isLineCovered(l, point));
  return first !== undefined && first.start === line.start;
}

function renderLyricFragments(fragments: LyricFragment[], currentTime: number, isKaraoke: boolean = false) {
  return fragments.map((f, i) => {
    const hasMarkers = f.attachedMarkers && f.attachedMarkers.length > 0;
    const textSpan = (
      <span key="txt" style={f.color ? { color: f.color } : undefined}>
        {f.text}
      </span>
    );

    if (!hasMarkers) {
      return textSpan;
    }

    const markerCls = isKaraoke ? "karaoke-marker" : "chant-marker";
    const activeCls = isKaraoke ? "point-active" : "active-point";

    return (
      <span key={i} className="inline-anchored-fragment">
        <span className="inline-anchored-markers">
          {f.attachedMarkers!.map((m, j) => {
            const active = m.point.start <= currentTime && currentTime < m.point.end;
            return (
              <span
                key={j}
                className={`${markerCls}${active ? ` ${activeCls}` : ""}`}
                style={{ "--marker-color": m.color } as CSSProperties}
                title={ACTION_LABEL[m.type]}
              >
                {m.label}
              </span>
            );
          })}
        </span>
        {textSpan}
      </span>
    );
  });
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
  currentTime,
  onSeek,
  onAdjustLineTime,
  onSetLineStart,
  lockedLines,
  onToggleLock,
  devMode,
}: LyricsAreaProps) {
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
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
    }));
    for (const row of built.standalone) {
      items.push({ kind: "standalone", time: row.time, markers: row.markers, point: row.point });
    }
    items.sort((a, b) => byTime(a.kind === "line" ? a.line.start : a.time, b.kind === "line" ? b.line.start : b.time, true));
    return items;
  }, [lyrics, built]);

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
                  rowRefs.current[i] = el;
                }}
                className={`chant-line ${cls} ${lineActionTypes(item.line, ouenPoints).join(" ")}`}
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
                    <span className="chant-type-label">{actionLabelText(item.line, ouenPoints)}</span>
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
                  const upcoming = upcomingPointForLine(item.line, ouenPoints, currentTime);
                  if (!upcoming) return null;

                  if (isFirstCoveredLine(item.line, upcoming, lyrics)) {
                    const diff = upcoming.start - currentTime;
                    return <div className="line-countdown-top">⏳{Math.ceil(diff)}</div>;
                  }

                  return null;
                })()}
                {(() => {
                  const visibleMarkers = item.markers;
                  if (visibleMarkers.length === 0) return null;

                  return (
                    <div className="chant-markers">
                      {visibleMarkers.map((m, j) => {
                        const active = m.point.start <= currentTime && currentTime < m.point.end;
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
                  {renderLyricFragments(buildLineColoring(item.line, ouenPoints).fragments, currentTime, false)}
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
              className={`chant-line marker-line${item.point.start <= currentTime && currentTime < item.point.end ? " active" : ""}`}
              onClick={() => onSeek(item.time)}
              onKeyDown={(e) => { if (e.key === "Enter") onSeek(item.time); }}
            >
              <div className="chant-time">{formatTime(item.time)} · 應援</div>
              <div className="chant-markers">
                {item.markers.map((m, j) => {
                  const active = m.point.start <= currentTime && currentTime < m.point.end;
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
            currentTime >= row.line.end
              ? "past"
              : currentTime >= row.line.start
                ? "active"
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
              className={`karaoke-line ${cls}`}
              onClick={() => onSeek(row.line.start)}
              onKeyDown={(e) => { if (e.key === "Enter") onSeek(row.line.start); }}
            >
              {(() => {
                const upcoming = upcomingPointForLine(row.line, ouenPoints, currentTime);
                if (!upcoming) return null;

                if (isFirstCoveredLine(row.line, upcoming, lyrics)) {
                  const diff = upcoming.start - currentTime;
                  return <div className="line-countdown-top">⏳{Math.ceil(diff)}</div>;
                }

                return null;
              })()}
              {(() => {
                const visibleMarkers = row.markers;
                if (visibleMarkers.length === 0) return null;

                return (
                  <span className="karaoke-markers">
                    {visibleMarkers.map((m, j) => {
                      const active = m.point.start <= currentTime && currentTime < m.point.end;
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
                {renderLyricFragments(buildLineColoring(row.line, ouenPoints).fragments, currentTime, true)}
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
        const active = row.point.start <= currentTime && currentTime < row.point.end;
        const state = active ? "active" : currentTime >= row.point.end ? "past" : "future";
        return (
          <div
            key={i}
            role="button"
            tabIndex={0}
            ref={(el) => {
              rowRefs.current[i] = el;
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
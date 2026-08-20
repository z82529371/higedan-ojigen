import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LyricLine, ResolvedOuenPoint } from "../types";
import { currentLineIndex } from "../time/sync";
import { formatTime } from "../time/format";
import { Controls } from "./Controls";
import { LyricsArea, type LyricsMode } from "./LyricsArea";
import { SetlistDrawer } from "./SetlistDrawer";

function devFromUrl(): boolean {
  const search = new URLSearchParams(window.location.search);
  if (search.get("dev") === "1") return true;
  const hashQuery = window.location.hash.split("?")[1];
  return hashQuery ? new URLSearchParams(hashQuery).get("dev") === "1" : false;
}

interface SetlistEntry {
  id: string;
  title: string;
  audioMissing: boolean;
}

interface PlayerProps {
  audio: string;
  title: string;
  note?: string;
  lyrics: LyricLine[];
  ouenPoints: ResolvedOuenPoint[];
  initialLockedLines?: number[];
  audioMissing: boolean;
  songList: SetlistEntry[];
  currentId: string;
  onPrev?: () => void;
  onNext?: () => void;
  onSelectSong: (id: string) => void;
  onBack: () => void;
}

export function Player({
  audio,
  title,
  note,
  lyrics,
  ouenPoints,
  initialLockedLines,
  audioMissing,
  songList,
  currentId,
  onPrev,
  onNext,
  onSelectSong,
  onBack,
}: PlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [ended, setEnded] = useState(false);
  const [mode, setMode] = useState<LyricsMode>("read");
  const [setlistOpen, setSetlistOpen] = useState(false);

  useEffect(() => {
    const el = new Audio(audio);
    el.preload = "metadata";
    const onLoadedMetadata = () => setDuration(el.duration);
    const onEnded = () => {
      setIsPlaying(false);
      setEnded(true);
    };
    const onError = () => {
      setIsPlaying(false);
    };
    el.addEventListener("loadedmetadata", onLoadedMetadata);
    el.addEventListener("ended", onEnded);
    el.addEventListener("error", onError);
    audioRef.current = el;
    return () => {
      el.pause();
      el.removeEventListener("loadedmetadata", onLoadedMetadata);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("error", onError);
      audioRef.current = null;
    };
  }, [audio]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
    }
  }, [speed]);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }
    let raf = 0;
    const loop = () => {
      setCurrentTime(audioRef.current?.currentTime ?? 0);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  const seekTo = useCallback(
    (time: number) => {
      const audio = audioRef.current;
      if (!audio) {
        return;
      }
      const clamped = Math.max(0, Math.min(duration || time, time));
      audio.currentTime = clamped;
      setCurrentTime(clamped);
      setEnded(false);
    },
    [duration],
  );

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    if (ended) {
      audio.currentTime = 0;
      setEnded(false);
    }
    if (audio.paused) {
      void audio.play();
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, [ended]);

  const seekBy = useCallback(
    (delta: number) => {
      const audio = audioRef.current;
      if (audio) {
        seekTo(audio.currentTime + delta);
      }
    },
    [seekTo],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        seekBy(-5);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        seekBy(5);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, seekBy]);

  const replay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    audio.currentTime = 0;
    setCurrentTime(0);
    setEnded(false);
    if (audio.paused) {
      void audio.play();
      setIsPlaying(true);
    }
  }, []);

  const currentIndex = useMemo(() => currentLineIndex(currentTime, lyrics), [currentTime, lyrics]);

  const [lyricsState, setLyricsState] = useState<LyricLine[]>(lyrics);
  const [lockedLines, setLockedLines] = useState<Set<number>>(() => new Set(initialLockedLines ?? []));

  useEffect(() => {
    setLyricsState(lyrics);
    setLockedLines(new Set(initialLockedLines ?? []));
  }, [lyrics, initialLockedLines]);

  const handleToggleLock = useCallback((lineIndex: number) => {
    setLockedLines((prev) => {
      const next = new Set(prev);
      if (next.has(lineIndex)) {
        next.delete(lineIndex);
      } else {
        next.add(lineIndex);
      }
      // 同步寫入鎖定狀態至硬碟 JSON 檔（數字由小到大排序）
      fetch("/api/save-song-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          songId: currentId,
          lyrics: lyricsState,
          lockedLines: Array.from(next).sort((a, b) => a - b),
        }),
      }).catch((err) => console.error("Save error:", err));
      return next;
    });
  }, [currentId, lyricsState]);

  const handleAdjustLineTime = useCallback(
    (idx: number, delta: number) => {
      if (lockedLines.has(idx)) return;

      setLyricsState((prevLyrics) => {
        const next = prevLyrics.map((l) => ({ ...l }));
        if (!next[idx]) return prevLyrics;

        // 1. 找出從 idx+1 開始直到遇到下一個鎖定行（或歌尾）的所有未鎖定句子
        let unlockedSegment: number[] = [];
        for (let i = idx + 1; i < next.length; i++) {
          if (lockedLines.has(i)) break;
          unlockedSegment.push(i);
        }

        // 2. 確定該段未鎖定區域的總結束邊界
        let boundaryEnd = 0;
        if (unlockedSegment.length > 0) {
          const lastIndex = unlockedSegment[unlockedSegment.length - 1];
          if (lastIndex < next.length - 1) {
            boundaryEnd = next[lastIndex + 1].start;
          } else {
            boundaryEnd = duration > 0 ? duration : Math.max(next[lastIndex].end, next[idx].start + 10);
          }
        }

        // 3. 計算並限制本句 end
        let maxAllowedEnd = unlockedSegment.length > 0
          ? boundaryEnd - unlockedSegment.length * 0.1
          : (duration > 0 ? duration : 9999);

        const newEnd = Number(Math.min(maxAllowedEnd, Math.max(next[idx].start + 0.1, next[idx].end + delta)).toFixed(2));
        next[idx].end = newEnd;

        // 4. 將多出來/減少的時間平均分配給剩餘未鎖定的句子
        if (unlockedSegment.length > 0) {
          const remainingTime = boundaryEnd - newEnd;
          const timePerLine = remainingTime / unlockedSegment.length;

          unlockedSegment.forEach((lineIdx, i) => {
            const lineStart = newEnd + i * timePerLine;
            const lineEnd = newEnd + (i + 1) * timePerLine;
            next[lineIdx].start = Number(lineStart.toFixed(2));
            next[lineIdx].end = Number(lineEnd.toFixed(2));
          });
        }

        // 同步修改原陣列
        next.forEach((l, i) => {
          if (lyrics[i]) {
            lyrics[i].start = l.start;
            lyrics[i].end = l.end;
          }
        });

        // 自動寫入硬碟 JSON 檔
        fetch("/api/save-song-data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            songId: currentId,
            lyrics: next,
            lockedLines: Array.from(lockedLines).sort((a, b) => a - b),
          }),
        }).catch((err) => console.error("Save error:", err));

        return next;
      });
    },
    [currentId, lyrics, lockedLines, duration],
  );

  const handleSetLineStart = useCallback(
    (idx: number, targetStart: number) => {
      if (lockedLines.has(idx)) return;

      setLyricsState((prevLyrics) => {
        const next = prevLyrics.map((l) => ({ ...l }));
        if (!next[idx]) return prevLyrics;

        // 限制開頭時間不能比上一句還前面（上一句存在時，下限為上一句 end）
        let minStart = 0;
        if (idx > 0 && next[idx - 1]) {
          minStart = next[idx - 1].end;
        }

        const validStart = Math.max(minStart, targetStart);
        const currentStart = next[idx].start;
        const delta = validStart - currentStart;

        // 找到從 idx 開始直到遇到鎖定行或歌尾的所有未鎖定行
        let unlockedSegment: number[] = [];
        for (let i = idx; i < next.length; i++) {
          if (lockedLines.has(i)) break;
          unlockedSegment.push(i);
        }

        if (unlockedSegment.length === 0) return prevLyrics;

        // 設定本句 start 為 validStart，保留各句原本長度，平移後續所有未鎖定行
        unlockedSegment.forEach((lineIdx) => {
          const l = next[lineIdx];
          const newStart = Number(Math.max(minStart, l.start + delta).toFixed(2));
          const newEnd = Number(Math.max(newStart + 0.1, l.end + delta).toFixed(2));
          l.start = newStart;
          l.end = newEnd;
        });

        // 同步修改原陣列
        next.forEach((l, i) => {
          if (lyrics[i]) {
            lyrics[i].start = l.start;
            lyrics[i].end = l.end;
          }
        });

        // 自動寫入硬碟 JSON 檔
        fetch("/api/save-song-data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            songId: currentId,
            lyrics: next,
            lockedLines: Array.from(lockedLines).sort((a, b) => a - b),
          }),
        }).catch((err) => console.error("Save error:", err));

        return next;
      });
    },
    [currentId, lyrics, lockedLines],
  );

  const [devMode, setDevMode] = useState(() => devFromUrl());

  useEffect(() => {
    const onUrlChange = () => setDevMode(devFromUrl());
    window.addEventListener("hashchange", onUrlChange);
    window.addEventListener("popstate", onUrlChange);
    return () => {
      window.removeEventListener("hashchange", onUrlChange);
      window.removeEventListener("popstate", onUrlChange);
    };
  }, []);

  const handleModeChange = useCallback((next: LyricsMode) => {
    setMode(next);
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className={`song-page${mode === "karaoke" ? " karaoke-locked" : ""}`}>
      <div className="player-sticky-top">
        <header className="song-header-row">
          <button type="button" className="back-btn" onClick={onBack}>
            ‹ 返回歌單
          </button>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button type="button" className="setlist-btn" onClick={() => setSetlistOpen(true)}>
              ☰ 曲目
            </button>
          </div>
        </header>

        <div className="song-title-row">
          <h1>{title}</h1>
          {audioMissing && <span className="status-chip missing">缺音檔</span>}
          {devMode && !audioMissing && <span className="status-chip">音檔就緒</span>}
          {devMode && (
            <span className="status-chip" style={{ background: "#e3f2fd", color: "#0288d1" }}>
              已鎖定 {lockedLines.size}/{lyricsState.length} 句 (完成率 {lyricsState.length > 0 ? Math.round((lockedLines.size / lyricsState.length) * 100) : 0}%)
            </span>
          )}
        </div>

        <div className="song-actions">
          <div className="mode-switch">
            <button type="button" className={mode === "read" ? "active" : ""} onClick={() => handleModeChange("read")}>
              完整歌詞
            </button>
            <button
              type="button"
              className={mode === "karaoke" ? "active" : ""}
              onClick={() => handleModeChange("karaoke")}
            >
              卡拉OK模式
            </button>
          </div>
        </div>
      </div>

      {note && <p className="song-note">{note}</p>}

      {audioMissing && (
        <div className="song-notice">
          找不到音檔：<code>{audio}</code>
        </div>
      )}

      {mode === "read" ? (
        <LyricsArea
          lyrics={lyricsState}
          ouenPoints={ouenPoints}
          mode="read"
          currentIndex={currentIndex}
          currentTime={currentTime}
          onSeek={seekTo}
          onAdjustLineTime={devMode ? handleAdjustLineTime : undefined}
          onSetLineStart={devMode ? handleSetLineStart : undefined}
          lockedLines={lockedLines}
          onToggleLock={devMode ? handleToggleLock : undefined}
          devMode={devMode}
        />
      ) : (
        <div className="karaoke-mode">
          <div className="karaoke-toolbar">
            <div className="karaoke-clock">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>
          <LyricsArea
            lyrics={lyricsState}
            ouenPoints={ouenPoints}
            mode="karaoke"
            currentIndex={currentIndex}
            currentTime={currentTime}
            onSeek={seekTo}
            onAdjustLineTime={devMode ? handleAdjustLineTime : undefined}
            onSetLineStart={devMode ? handleSetLineStart : undefined}
            lockedLines={lockedLines}
            onToggleLock={devMode ? handleToggleLock : undefined}
            devMode={devMode}
          />
        </div>
      )}

      <Controls
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        speed={speed}
        disabled={audioMissing}
        onPrev={onPrev}
        onNext={onNext}
        onTogglePlay={togglePlay}
        onSeekTo={seekTo}
        onSeekBy={seekBy}
        onReplay={replay}
        onSpeedChange={setSpeed}
      />

      <SetlistDrawer
        open={setlistOpen}
        entries={songList}
        currentId={currentId}
        onClose={() => setSetlistOpen(false)}
        onSelect={(id) => {
          setSetlistOpen(false);
          onSelectSong(id);
        }}
      />
    </div>
  );
}
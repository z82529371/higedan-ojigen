import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LyricLine, OuenPoint } from "../types";
import { currentLineIndex, isChorusActive } from "../time/sync";
import { formatTime } from "../time/format";
import { Controls } from "./Controls";
import { LyricsArea, type LyricsMode } from "./LyricsArea";

interface PlayerProps {
  audio: string;
  title: string;
  lyrics: LyricLine[];
  ouenPoints: OuenPoint[];
  audioMissing: boolean;
  onBack: () => void;
}

export function Player({ audio, title, lyrics, ouenPoints, audioMissing, onBack }: PlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [ended, setEnded] = useState(false);
  const [mode, setMode] = useState<LyricsMode>("karaoke");

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
  const chorusActive = useMemo(() => isChorusActive(currentTime, ouenPoints), [currentTime, ouenPoints]);

  return (
    <div className="song-page">
      <header className="song-header-row">
        <button type="button" className="back-btn" onClick={onBack}>
          ‹ 返回歌單
        </button>
      </header>

      <div className="song-title-row">
        <h1>{title}</h1>
        <span className={`status-chip${audioMissing ? " missing" : ""}`}>
          {audioMissing ? "缺音檔" : "音檔就緒"}
        </span>
      </div>

      {audioMissing && (
        <div className="song-notice">
          找不到音檔：<code>{audio}</code>
        </div>
      )}

      <div className="song-actions">
        <div className="mode-switch">
          <button type="button" className={mode === "read" ? "active" : ""} onClick={() => setMode("read")}>
            完整歌詞
          </button>
          <button
            type="button"
            className={mode === "karaoke" ? "active" : ""}
            onClick={() => setMode("karaoke")}
          >
            卡拉OK模式
          </button>
        </div>
      </div>

      {mode === "read" ? (
        <LyricsArea
          lyrics={lyrics}
          ouenPoints={ouenPoints}
          mode="read"
          currentIndex={currentIndex}
          chorusActive={chorusActive}
          currentTime={currentTime}
          onSeek={seekTo}
        />
      ) : (
        <div className="karaoke-mode">
          <div className="karaoke-toolbar">
            <div className="karaoke-clock">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>
          <LyricsArea
            lyrics={lyrics}
            ouenPoints={ouenPoints}
            mode="karaoke"
            currentIndex={currentIndex}
            chorusActive={chorusActive}
            currentTime={currentTime}
            onSeek={seekTo}
          />
        </div>
      )}

      <Controls
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        speed={speed}
        disabled={audioMissing}
        onTogglePlay={togglePlay}
        onSeekTo={seekTo}
        onSeekBy={seekBy}
        onReplay={replay}
        onSpeedChange={setSpeed}
      />
    </div>
  );
}
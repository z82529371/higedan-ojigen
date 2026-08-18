import { memo } from "react";
import { formatTime } from "../time/format";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5];

interface ControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  speed: number;
  disabled: boolean;
  onTogglePlay: () => void;
  onSeekTo: (time: number) => void;
  onSeekBy: (delta: number) => void;
  onReplay: () => void;
  onSpeedChange: (speed: number) => void;
}

function nextSpeed(current: number): number {
  const i = SPEEDS.indexOf(current);
  return SPEEDS[(i + 1) % SPEEDS.length];
}

export const Controls = memo(function Controls({
  isPlaying,
  currentTime,
  duration,
  speed,
  disabled,
  onTogglePlay,
  onSeekTo,
  onSeekBy,
  onReplay,
  onSpeedChange,
}: ControlsProps) {
  const max = duration || 0;
  return (
    <nav className="song-bottom-bar">
      <div className="controls-progress-row">
        <input
          type="range"
          className="controls-seek"
          min={0}
          max={max}
          step={0.1}
          value={Math.min(currentTime, max)}
          onChange={(e) => onSeekTo(Number(e.target.value))}
          disabled={disabled}
          aria-label="播放進度"
        />
        <span className="controls-time">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
      <div className="controls-buttons">
        <button type="button" onClick={() => onSeekBy(-5)} disabled={disabled}>
          −5
        </button>
        <button type="button" className="controls-play" onClick={onTogglePlay} disabled={disabled}>
          {isPlaying ? "⏸" : "▶"}
        </button>
        <button type="button" onClick={() => onSeekBy(5)} disabled={disabled}>
          +5
        </button>
        <button type="button" onClick={onReplay} disabled={disabled}>
          重播
        </button>
        <button
          type="button"
          className="controls-speed"
          onClick={() => onSpeedChange(nextSpeed(speed))}
          disabled={disabled}
          title="播放速度"
        >
          {speed}x
        </button>
      </div>
    </nav>
  );
});
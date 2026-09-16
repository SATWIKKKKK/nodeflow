import type { CSSProperties } from "react";
import { Pause, Play, RotateCcw, StepBack, StepForward } from "lucide-react";
import { button, field } from "../components/ui";
import { cn } from "../lib/cn";

/**
 * Playback transport. Drives trace position only — it never touches the camera,
 * so whatever angle the user has orbited to survives every step.
 */

const SPEEDS = [0.5, 1, 2, 4];

interface PlaybackControlsProps {
  index: number;
  count: number;
  playing: boolean;
  speed: number;
  line: number | null;
  onIndex: (index: number) => void;
  onPlaying: (playing: boolean) => void;
  onSpeed: (speed: number) => void;
}

const transport = cn(button.icon, "h-9 w-9");

export default function PlaybackControls({
  index,
  count,
  playing,
  speed,
  line,
  onIndex,
  onPlaying,
  onSpeed
}: PlaybackControlsProps) {
  const empty = count === 0;
  const canStepBack = !empty && index > 0;
  const canStepForward = !empty && index < count - 1;
  const fill = count > 1 ? (index / (count - 1)) * 100 : 0;

  return (
    <div className="flex flex-col gap-3 border-t border-blueprint-line bg-card px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={transport}
          aria-label="Reset to first step"
          disabled={empty || index === 0}
          style={{ minHeight: 0 }}
          onClick={() => {
            onPlaying(false);
            onIndex(0);
          }}
        >
          <RotateCcw size={15} aria-hidden />
        </button>
        <button
          type="button"
          className={transport}
          aria-label="Step back"
          disabled={!canStepBack}
          style={{ minHeight: 0 }}
          onClick={() => {
            onPlaying(false);
            onIndex(index - 1);
          }}
        >
          <StepBack size={15} aria-hidden />
        </button>
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-45"
          aria-label={playing ? "Pause playback" : "Play trace"}
          disabled={empty}
          style={{ minHeight: 0 }}
          onClick={() => {
            // Replaying from the end restarts rather than sticking.
            if (!playing && index >= count - 1) onIndex(0);
            onPlaying(!playing);
          }}
        >
          {playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden className="ml-0.5" />}
        </button>
        <button
          type="button"
          className={transport}
          aria-label="Step forward"
          disabled={!canStepForward}
          style={{ minHeight: 0 }}
          onClick={() => {
            onPlaying(false);
            onIndex(index + 1);
          }}
        >
          <StepForward size={15} aria-hidden />
        </button>

        <label className="ml-1">
          <span className="sr-only">Playback speed</span>
          <select
            value={speed}
            onChange={(event) => onSpeed(Number(event.target.value))}
            className={cn(field.select, "h-9 text-xs")}
          >
            {SPEEDS.map((option) => (
              <option key={option} value={option}>
                {option}×
              </option>
            ))}
          </select>
        </label>

        <span className="ml-auto text-technical-mono text-blueprint-muted" aria-live="off">
          {empty ? "No trace yet" : `Step ${index + 1} / ${count}${line ? ` · line ${line}` : ""}`}
        </span>
      </div>

      <input
        className="trace-range"
        type="range"
        min={0}
        max={Math.max(0, count - 1)}
        value={index}
        disabled={empty}
        aria-label="Trace position"
        style={{ "--fill": `${fill}%` } as CSSProperties}
        onChange={(event) => {
          onPlaying(false);
          onIndex(Number(event.target.value));
        }}
      />
    </div>
  );
}

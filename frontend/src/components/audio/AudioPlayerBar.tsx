import { useRef, useEffect, useState } from 'react';
import { Play, Pause, X } from 'lucide-react';
import { useAudioStore } from '../../store/useAudioStore';

export function AudioPlayerBar() {
  const { url, title, playing, toggle, clear } = useAudioStore();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration,    setDuration]    = useState(0);

  useEffect(() => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.play().catch(() => {});
    else          audioRef.current.pause();
  }, [playing, url]);

  if (!url) return null;

  function fmt(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  }

  return (
    <div className="border-t border-ink-100 bg-paper px-6 py-3 flex items-center gap-4 shadow-2">
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => useAudioStore.setState({ playing: false })}
      />

      <button
        onClick={toggle}
        className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full bg-ink-900 text-white hover:bg-black transition-colors"
      >
        {playing ? <Pause size={14} fill="white" /> : <Play size={14} fill="white" />}
      </button>

      <div className="flex-1 min-w-0">
        <p className="text-caption font-medium text-ink-700 truncate mb-1">{title}</p>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-ink-400 tabular-nums">{fmt(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={(e) => {
              const t = Number(e.target.value);
              setCurrentTime(t);
              if (audioRef.current) audioRef.current.currentTime = t;
            }}
            className="flex-1 h-1 accent-accent"
          />
          <span className="text-[11px] text-ink-400 tabular-nums">{fmt(duration)}</span>
        </div>
      </div>

      <button
        onClick={clear}
        className="text-ink-400 hover:text-ink-700 transition-colors"
      >
        <X size={14} strokeWidth={1.7} />
      </button>
    </div>
  );
}

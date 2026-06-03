import type { SubtitleCue } from '@/types/timeline';

const TOLERANCE_MS = 50;

const positionStyle: Record<string, React.CSSProperties> = {
  bottom: { bottom: '8%', left: '50%', transform: 'translateX(-50%)' },
  top:    { top: '8%',    left: '50%', transform: 'translateX(-50%)' },
  center: { top: '50%',  left: '50%', transform: 'translate(-50%, -50%)' },
};

interface Props {
  subtitles: SubtitleCue[];
  currentMs: number;
}

export function SubtitleOverlay({ subtitles, currentMs }: Props) {
  const active = subtitles.filter(
    (s) => currentMs >= s.start_ms - TOLERANCE_MS && currentMs <= s.end_ms + TOLERANCE_MS
  );

  if (active.length === 0) return null;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {active.map((s, i) => (
        <p
          key={s.id}
          className="absolute text-center font-semibold leading-snug max-w-[80%]"
          style={{
            ...positionStyle[s.style.position],
            fontSize: s.style.font_size,
            color: s.style.color,
            textShadow: '0 1px 6px rgba(0,0,0,0.85)',
            marginBottom: s.style.position === 'bottom' && i > 0
              ? `${i * (s.style.font_size + 8)}px`
              : undefined,
          }}
        >
          {s.text}
        </p>
      ))}
    </div>
  );
}

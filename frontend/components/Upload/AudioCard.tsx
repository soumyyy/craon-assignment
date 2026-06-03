import { Music, X } from 'lucide-react';

interface Props {
  filename: string;
  onRemove: () => void;
}

export function AudioCard({ filename, onRemove }: Props) {
  return (
    <div className="flex items-center gap-3 bg-bg-elevated border border-cream-subtle rounded-lg px-4 py-3">
      <Music size={16} className="text-accent shrink-0" />
      <span className="text-cream text-sm flex-1 truncate">{filename}</span>
      <button
        onClick={onRemove}
        className="text-cream-muted hover:text-cream transition-colors"
        aria-label={`Remove ${filename}`}
      >
        <X size={14} />
      </button>
    </div>
  );
}

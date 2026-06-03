const SUGGESTIONS = [
  "Add a subtitle saying ‘And we’re live!’ from 10s to 13s",
  'Lower the background music volume to 30%',
  'Add a 3 second fade out to the music',
  'Delete the second subtitle',
];

export function SuggestionChips({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <div className="px-4 py-3">
      <p className="text-cream-muted text-xs mb-3">Try one of these to get started:</p>
      <div className="flex flex-col gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSelect(s)}
            className="text-left text-xs text-cream-muted bg-bg-elevated hover:bg-bg-hover border border-cream-subtle rounded-lg px-3 py-2 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

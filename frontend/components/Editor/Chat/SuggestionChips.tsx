const SUGGESTIONS = [
  "Add a subtitle 'And we're live!' from 10s to 13s",
  'Lower the background music volume to 30%',
  'Add a 3 second fade out to the music',
  'Delete the second subtitle',
];

export function SuggestionChips({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <div style={{ padding: '16px 14px 8px' }}>
      <p style={{ fontSize: 11, color: 'var(--cream-muted)', fontFamily: 'DM Mono', marginBottom: 10, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        Try these
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSelect(s)}
            style={{
              textAlign: 'left',
              fontSize: 12,
              fontFamily: 'DM Sans',
              color: 'var(--cream-muted)',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '7px 11px',
              cursor: 'pointer',
              transition: 'color 120ms ease, border-color 120ms ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--cream)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-mid)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--cream-muted)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--status-ok)', opacity: 0.7 }} />
      <div style={{
        display: 'flex',
        gap: 4,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: '3px 10px 10px 10px',
        padding: '10px 14px',
      }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 4,
              height: 4,
              borderRadius: '50%',
              background: 'var(--cream-muted)',
              display: 'block',
              animation: 'pulse 1.2s ease-in-out infinite',
              animationDelay: `${i * 0.18}s`,
            }}
          />
        ))}
      </div>
      <style>{`@keyframes pulse { 0%,80%,100%{opacity:.25;transform:scale(0.85)} 40%{opacity:1;transform:scale(1)} }`}</style>
    </div>
  );
}

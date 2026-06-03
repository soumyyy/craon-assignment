export function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3 bg-bg-elevated rounded-xl rounded-tl-sm w-fit border-l-4 border-cream-subtle">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-cream-muted animate-pulse"
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </div>
  );
}

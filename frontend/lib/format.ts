export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function detectMessageStatus(text: string): 'success' | 'warning' | 'error' {
  const lower = text.toLowerCase();
  if (/can't|cannot|unable|failed|not supported|doesn't exist|does not exist|no .* found/.test(lower))
    return 'error';
  if (/though|however|may|note that|careful|might|warning|brief|short|overlap/.test(lower))
    return 'warning';
  return 'success';
}

export function nanoid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

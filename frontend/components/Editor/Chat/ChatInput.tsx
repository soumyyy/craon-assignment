'use client';
import { useRef, useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

interface Props {
  disabled: boolean;
  onSend: (text: string) => void;
  prefill?: string;
  onPrefillConsumed?: () => void;
}

export function ChatInput({ disabled, onSend, prefill, onPrefillConsumed }: Props) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (prefill) {
      setValue(prefill);
      onPrefillConsumed?.();
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [prefill, onPrefillConsumed]);

  const send = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`;
  };

  return (
    <div className="border-t border-cream-subtle p-3 flex gap-2 items-end shrink-0">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Describe what you want to edit…"
        rows={1}
        aria-label="Chat message input"
        className="flex-1 bg-bg-elevated text-cream text-sm placeholder:text-cream-subtle border border-cream-subtle rounded-lg px-3 py-2 resize-none outline-none focus:border-accent transition-colors disabled:opacity-40 min-h-[44px] max-h-[140px] overflow-y-auto"
      />
      <button
        onClick={send}
        disabled={disabled || !value.trim()}
        aria-label="Send message"
        className="w-9 h-9 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all hover:enabled:scale-105 active:enabled:scale-95 shrink-0"
      >
        <ArrowUp size={16} className="text-bg-primary" />
      </button>
    </div>
  );
}

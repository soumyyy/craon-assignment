'use client';
import { useRef, useState } from 'react';

interface Props {
  disabled: boolean;
  onSend: (text: string) => void;
}

export function ChatInput({ disabled, onSend }: Props) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  const canSend = !disabled && value.trim().length > 0;

  return (
    <div style={{
      borderTop: '1px solid var(--border)',
      padding: '10px 12px',
      display: 'flex',
      gap: 8,
      alignItems: 'flex-end',
      background: 'var(--bg-surface)',
      flexShrink: 0,
    }}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Edit your timeline…"
        rows={1}
        aria-label="Chat message input"
        style={{
          flex: 1,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 7,
          padding: '8px 12px',
          color: 'var(--cream)',
          fontSize: 13,
          fontFamily: 'DM Sans',
          fontWeight: 400,
          lineHeight: 1.5,
          resize: 'none',
          outline: 'none',
          minHeight: 36,
          maxHeight: 120,
          overflowY: 'auto',
          opacity: disabled ? 0.5 : 1,
          transition: 'border-color 120ms ease',
        }}
        onFocus={(e) => { e.target.style.borderColor = 'var(--border-mid)'; }}
        onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; }}
      />
      <button
        onClick={send}
        disabled={!canSend}
        aria-label="Send message"
        style={{
          width: 34,
          height: 34,
          borderRadius: 7,
          border: 'none',
          background: canSend ? 'var(--accent)' : 'var(--bg-elevated)',
          cursor: canSend ? 'pointer' : 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transition: 'background 120ms ease, transform 80ms ease',
        }}
        onMouseDown={(e) => { if (canSend) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.93)'; }}
        onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
      >
        <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
          <path d="M6 10V2M3 5l3-3 3 3" stroke={canSend ? '#080808' : 'var(--cream-muted)'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  );
}

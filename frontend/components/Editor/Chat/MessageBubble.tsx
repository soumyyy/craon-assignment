import type { ChatMessage } from '@/types/timeline';

const statusDot: Record<string, string> = {
  success: 'var(--status-ok)',
  warning: 'var(--status-warn)',
  error:   'var(--status-err)',
};

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div style={{ maxWidth: '78%' }}>
          <div style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-mid)',
            borderRadius: '10px 10px 3px 10px',
            padding: '9px 13px',
            fontSize: 13,
            lineHeight: 1.55,
            color: 'var(--cream)',
            fontFamily: 'DM Sans',
          }}>
            {message.content}
          </div>
          <div style={{ textAlign: 'right', marginTop: 4, fontSize: 10, color: 'var(--cream-muted)', fontFamily: 'DM Mono' }}>
            {message.timestamp}
          </div>
        </div>
      </div>
    );
  }

  const dotColor = statusDot[message.status ?? 'success'];

  return (
    <div className="flex justify-start">
      <div style={{ maxWidth: '85%' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          {/* Status dot */}
          <div style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: dotColor,
            marginTop: 7,
            flexShrink: 0,
            boxShadow: `0 0 6px ${dotColor}`,
          }} />
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: '3px 10px 10px 10px',
            padding: '9px 13px',
            fontSize: 13,
            lineHeight: 1.6,
            color: 'var(--cream)',
            fontFamily: 'DM Sans',
            fontWeight: 400,
          }}>
            {message.content}
          </div>
        </div>
        <div style={{ marginTop: 4, marginLeft: 13, fontSize: 10, color: 'var(--cream-muted)', fontFamily: 'DM Mono' }}>
          {message.timestamp}
        </div>
      </div>
    </div>
  );
}

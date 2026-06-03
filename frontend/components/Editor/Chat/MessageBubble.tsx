import type { ChatMessage } from '@/types/timeline';

const statusBorder: Record<string, string> = {
  success: 'border-l-status-success',
  warning: 'border-l-status-warning',
  error:   'border-l-status-error',
};

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`px-4 py-2.5 rounded-xl text-sm leading-relaxed ${
            isUser
              ? 'bg-bubble-user text-cream rounded-tr-sm'
              : `bg-bg-elevated text-cream rounded-tl-sm border-l-4 ${statusBorder[message.status ?? 'success']}`
          }`}
        >
          {message.content}
        </div>
        <span className="text-cream-muted text-[11px] font-mono px-1">{message.timestamp}</span>
      </div>
    </div>
  );
}

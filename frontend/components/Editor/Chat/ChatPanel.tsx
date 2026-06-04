'use client';
import { useState, useRef } from 'react';
import { sendChat } from '@/lib/api';
import { detectMessageStatus, nanoid } from '@/lib/format';
import type { ChatMessage, Timeline } from '@/types/timeline';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { useToast } from '@/components/Toast/ToastProvider';

interface Props {
  timeline: Timeline;
  onTimelineChange: (tl: Timeline) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ChatPanel({ timeline, onTimelineChange }: Props) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const queueRef = useRef<string[]>([]);
  const messagesRef = useRef<ChatMessage[]>([]);

  const appendMessage = (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const full: ChatMessage = {
      ...msg,
      id: nanoid(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    messagesRef.current = [...messagesRef.current, full];
    setMessages([...messagesRef.current]);
    return full;
  };

  const processMessage = async (text: string) => {
    setIsLoading(true);
    try {
      const apiHistory = messagesRef.current
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await sendChat(text, apiHistory);
      const content = res.response || 'Something went wrong — please try again.';
      appendMessage({ role: 'assistant', content, status: detectMessageStatus(content) });
      onTimelineChange(res.timeline);
    } catch {
      appendMessage({
        role: 'assistant',
        content: "Couldn't reach the server. Check your connection.",
        status: 'error',
      });
      toast('Server error — check your connection', 'error');
    } finally {
      setIsLoading(false);
      if (queueRef.current.length > 0) {
        const next = queueRef.current.shift()!;
        appendMessage({ role: 'user', content: next });
        processMessage(next);
      }
    }
  };

  const sendMessage = (text: string) => {
    if (isLoading) {
      queueRef.current.push(text);
      return;
    }
    appendMessage({ role: 'user', content: text });
    processMessage(text);
  };

  return (
    <div className="flex flex-col h-full bg-bg-surface">
      {queueRef.current.length > 0 && (
        <div className="px-4 py-1.5 border-b border-cream-subtle bg-bg-surface shrink-0">
          <span className="text-cream-muted text-[11px]">{queueRef.current.length} message queued</span>
        </div>
      )}

      <MessageList messages={messages} isLoading={isLoading} />

      <ChatInput disabled={isLoading} onSend={sendMessage} />
    </div>
  );
}

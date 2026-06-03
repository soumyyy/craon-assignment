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
  const [prefill, setPrefill] = useState<string | undefined>();
  const [showSuggestions, setShowSuggestions] = useState(true);
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
    setShowSuggestions(false);
    if (isLoading) {
      queueRef.current.push(text);
      return;
    }
    appendMessage({ role: 'user', content: text });
    processMessage(text);
  };

  return (
    <div className="flex flex-col h-full bg-bg-surface">
      <div className="h-10 border-b border-cream-subtle flex items-center justify-between px-4 shrink-0">
        <span className="text-cream text-xs font-semibold">Chat Lab</span>
        {queueRef.current.length > 0 && (
          <span className="text-cream-muted text-[11px] bg-bg-elevated px-2 py-0.5 rounded-full">
            {queueRef.current.length} queued
          </span>
        )}
      </div>

      <MessageList
        messages={messages}
        isLoading={isLoading}
        showSuggestions={showSuggestions}
        onSuggestionSelect={(t) => setPrefill(t)}
      />

      <ChatInput
        disabled={isLoading}
        onSend={sendMessage}
        prefill={prefill}
        onPrefillConsumed={() => setPrefill(undefined)}
      />
    </div>
  );
}

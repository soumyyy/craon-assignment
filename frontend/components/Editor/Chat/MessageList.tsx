'use client';
import { useEffect, useRef } from 'react';
import type { ChatMessage } from '@/types/timeline';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';

interface Props {
  messages: ChatMessage[];
  isLoading: boolean;
}

export function MessageList({ messages, isLoading }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 min-h-0">
      {messages.map((m) => <MessageBubble key={m.id} message={m} />)}
      {isLoading && (
        <div className="flex justify-start">
          <TypingIndicator />
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

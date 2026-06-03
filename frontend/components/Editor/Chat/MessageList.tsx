'use client';
import { useEffect, useRef } from 'react';
import type { ChatMessage } from '@/types/timeline';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { SuggestionChips } from './SuggestionChips';

interface Props {
  messages: ChatMessage[];
  isLoading: boolean;
  showSuggestions: boolean;
  onSuggestionSelect: (text: string) => void;
}

export function MessageList({ messages, isLoading, showSuggestions, onSuggestionSelect }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 min-h-0">
      {showSuggestions && messages.length === 0 && (
        <SuggestionChips onSelect={onSuggestionSelect} />
      )}
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

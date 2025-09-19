'use client';

import { useChat } from '@ai-sdk/react';
import { useEffect, useMemo, useRef } from 'react';
import type { MyUIMessage } from '@/util/chat-schema';
import { transport } from '@/util/transport';
import ChatInput from './chat-input';
import Message from './message';

export default function ChatComponent() {
  const inputRef = useRef<HTMLInputElement>(null);

  const activeWorkflowRunId = useMemo(() => {
    if (typeof window === 'undefined') return;
    return localStorage.getItem('active-workflow-run-id') ?? undefined;
  }, []);

  const chat = useChat<MyUIMessage>({
    resume: !!activeWorkflowRunId,
    onError(error) {
      console.error('onError', error);
    },
    onFinish(data) {
      console.log('onFinish', data);

      console.log('Saving chat history to localStorage', data.messages);
      localStorage.setItem('chat-history', JSON.stringify(data.messages));

      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    },

    transport,
  });

  // Load chat history from `localStorage`. In a real-world application,
  // this would likely be done on the server side and loaded from a database,
  // but for the purposes of this demo, we'll load it from `localStorage`.
  useEffect(() => {
    const chatHistory = localStorage.getItem('chat-history');
    if (!chatHistory) return;
    chat.setMessages(JSON.parse(chatHistory) as MyUIMessage[]);
  }, [chat.setMessages]);

  // Activate the input field
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col w-full max-w-2xl pt-12 pb-24 mx-auto stretch">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">✈️ Flight Booking Agent</h1>
        <p className="text-gray-600">Book a flight using workflows</p>
      </div>

      {chat.messages.length === 0 && (
        <div className="mb-8 p-6 bg-blue-50 rounded-lg">
          <h2 className="text-lg font-semibold mb-3">
            How can I help you today?
          </h2>
          <p className="text-gray-700 mb-4">I can assist you with:</p>
          <ul className="space-y-2 text-gray-600">
            <li>🔍 Search for flights between cities</li>
            <li>📊 Check real-time flight status</li>
            <li>🛫 Get airport information</li>
            <li>🎫 Book flights for you</li>
            <li>🧳 Check baggage allowances</li>
          </ul>
          <p className="mt-4 text-sm text-gray-500">
            Try asking: "Find me flights from San Francisco to Los Angeles" or
            "What's the status of flight UA123?"
          </p>
        </div>
      )}

      {chat.messages.map((message) => (
        <Message
          key={message.id}
          message={message}
          regenerate={chat.regenerate}
          sendMessage={chat.sendMessage}
          addToolResult={chat.addToolResult}
          status={chat.status}
        />
      ))}
      <ChatInput
        status={chat.status}
        onSubmit={(text: string) => {
          chat.sendMessage({ text, metadata: { createdAt: Date.now() } });
        }}
        onNewChat={async () => {
          await chat.stop();
          localStorage.removeItem('active-workflow-run-id');
          localStorage.removeItem('chat-history');
          chat.setMessages([]);
        }}
        inputRef={inputRef}
      />
    </div>
  );
}

'use client';

import { useChat } from '@ai-sdk/react';
import { useEffect, useRef } from 'react';
import type { MyUIMessage } from '@/util/chat-schema';
import ChatInput from './chat-input';
import Message from './message';

export default function ChatComponent() {
  const inputRef = useRef<HTMLInputElement>(null);

  const { status, sendMessage, messages, regenerate, addToolResult } =
    useChat<MyUIMessage>({
      onFinish() {
        requestAnimationFrame(() => {
          inputRef.current?.focus();
        });
      },
    });

  // activate the input field
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col w-full max-w-2xl pt-12 pb-24 mx-auto stretch">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">✈️ Flight Booking Agent</h1>
        <p className="text-gray-600">Book a flight using workflows</p>
      </div>

      {messages.length === 0 && (
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

      {messages.map((message) => (
        <Message
          key={message.id}
          message={message}
          regenerate={regenerate}
          sendMessage={sendMessage}
          addToolResult={addToolResult}
          status={status}
        />
      ))}
      <ChatInput
        status={status}
        onSubmit={(text: string) => {
          // sendMessage({ text });
          sendMessage({ text, metadata: { createdAt: Date.now() } });

          // if (isNewChat) {
          //   window.history.pushState(null, '', `/chat/${chatData.id}`);
          // }
        }}
        inputRef={inputRef}
      />
    </div>
  );
}

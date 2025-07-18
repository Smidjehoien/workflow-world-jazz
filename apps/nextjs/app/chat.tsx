'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useEffect, useRef } from 'react';
// import { invalidateRouterCache } from '@/app/actions';
import type { MyUIMessage } from '@/util/chat-schema';
import ChatInput from './chat-input';
import Message from './message';

export default function ChatComponent() {
  const inputRef = useRef<HTMLInputElement>(null);

  const { status, sendMessage, messages, regenerate, addToolResult } =
    useChat<MyUIMessage>({
      // id: chatData.id,
      // messages: chatData.messages,
      // resume,
      // transport: new DefaultChatTransport({
      //   prepareSendMessagesRequest: ({ id, messages, trigger, messageId }) => {
      //     switch (trigger) {
      //       case 'regenerate-assistant-message':
      //         // omit messages data transfer, only send the messageId:
      //         return {
      //           body: {
      //             trigger: 'regenerate-assistant-message',
      //             id,
      //             messageId,
      //           },
      //         };
      //       case 'submit-user-message':
      //         // only send the last message to the server to limit the request size:
      //         return {
      //           body: {
      //             trigger: 'submit-user-message',
      //             id,
      //             message: messages[messages.length - 1],
      //             messageId,
      //           },
      //         };
      //       case 'submit-tool-result':
      //         throw new Error(`submit-tool-result is not supported`);
      //     }
      //   },
      // }),
      onFinish() {
        // for new chats, the router cache needs to be invalidated so
        // navigation to the previous page triggers SSR correctly
        // if (isNewChat) {
        //   invalidateRouterCache();
        // }
        // focus the input field again after the response is finished
        requestAnimationFrame(() => {
          inputRef.current?.focus();
        });
      },
      // maxSteps: 5,
      // run client-side tools that are automatically executed:
      // async onToolCall({ toolCall }) {
      //   if (toolCall.toolName === 'getLocation') {
      //     const cities = ['New York', 'Los Angeles', 'Chicago', 'San Francisco'];
      //     return cities[Math.floor(Math.random() * cities.length)];
      //   }
      // },
    });

  // activate the input field
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col w-full max-w-2xl pt-12 pb-24 mx-auto stretch">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">✈️ Flight Booking Assistant</h1>
        <p className="text-gray-600">Your AI-powered travel companion</p>
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

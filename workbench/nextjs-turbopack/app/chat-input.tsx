import { useState } from 'react';

export default function ChatInput({
  status,
  onSubmit,
  onNewChat,
  inputRef,
}: {
  status: string;
  onSubmit: (text: string) => void;
  onNewChat: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [text, setText] = useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim() === '') return;
        onSubmit(text);
        setText('');
      }}
    >
      <div className="flex flex-row fixed bottom-0 w-full max-w-2xl mb-8 gap-2">
        <input
          ref={inputRef}
          className="p-3 border border-gray-300 rounded-lg shadow-xl w-full bg-[#fff]"
          placeholder="Ask me about flights, airports, or bookings..."
          disabled={status !== 'ready'}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          className="px-3 py-1 text-sm transition-colors bg-gray-200 rounded-md hover:bg-gray-300"
          type="button"
          onClick={() => {
            onNewChat();
          }}
        >
          New Chat
        </button>
      </div>
    </form>
  );
}

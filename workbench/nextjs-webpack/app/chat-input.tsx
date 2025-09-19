import { useState } from 'react';

export default function ChatInput({
  status,
  onSubmit,
  inputRef,
}: {
  status: string;
  onSubmit: (text: string) => void;
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
      <input
        ref={inputRef}
        className="fixed bottom-0 w-full max-w-2xl p-3 mb-8 border border-gray-300 rounded-lg shadow-xl"
        placeholder="Ask me about flights, airports, or bookings..."
        disabled={status !== 'ready'}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
    </form>
  );
}

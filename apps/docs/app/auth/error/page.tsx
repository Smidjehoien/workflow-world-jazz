import Link from 'next/link';

export default function AuthError() {
  return (
    <main className="flex flex-col items-center justify-center h-screen relative">
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <h1 className="text-3xl font-semibold">Error</h1>
        <div className="mt-4 text-gray-400">
          <p>An error occurred while trying to authenticate you.</p>
          Try again by going{' '}
          <Link className="underline" href="/api/auth/authorize">
            here
          </Link>
          .
        </div>
      </div>
    </main>
  );
}

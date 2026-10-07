'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-4 text-center">
        <div className="max-w-md space-y-4">
          <h2 className="text-2xl font-bold">Something went wrong</h2>
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-white text-neutral-900 rounded-xl text-xs font-semibold"
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}

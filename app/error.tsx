'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex flex-col items-center justify-center p-4 text-center text-neutral-900 dark:text-neutral-100">
      <div className="max-w-md space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">System Error</h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          An unexpected error occurred. Please try resetting or return home.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="px-4 py-2 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-semibold"
          >
            Try Again
          </button>
          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-semibold"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

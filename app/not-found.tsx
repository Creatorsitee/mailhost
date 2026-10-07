import Link from 'next/link';
import { Mail, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex flex-col items-center justify-center p-4 text-neutral-900 dark:text-neutral-100 text-center">
      <div className="max-w-md space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center mx-auto shadow-sm">
          <Mail size={22} />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">404 - Page Not Found</h1>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          The requested route does not exist or has been relocated.
        </p>
        <div className="pt-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

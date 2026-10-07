'use client';

import { useState, useEffect } from 'react';
import { Mail, ArrowRight, Lock, User, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { setAuthToken, setStoredUser, authFetch } from '@/lib/client-auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // If already logged in, redirect directly to dashboard
  useEffect(() => {
    authFetch('/api/auth')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated && data.user) {
          router.replace('/dashboard');
        }
      })
      .catch(() => {});
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);
    
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        if (data.token) setAuthToken(data.token);
        if (data.user) setStoredUser(data.user);
        router.push('/dashboard');
      } else {
        setErrorMsg(data.error || 'Invalid credentials. Check your email and password.');
      }
    } catch {
      setErrorMsg('Failed to connect to authentication service.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 text-neutral-900 dark:text-neutral-100 antialiased">
      <div className="sm:mx-auto sm:w-full sm:max-w-sm text-center space-y-2">
        <Link href="/" className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 mb-1">
          <Mail size={20} />
        </Link>
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Sign in to CMNTY Mail
        </h1>
        <p className="text-xs text-neutral-500">
          Independent email infrastructure management
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-sm">
        <div className="bg-white dark:bg-neutral-900 py-6 px-5 sm:px-6 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 text-xs font-medium rounded-lg flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleLogin}>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Email Address
              </label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-mono text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400"
                  placeholder="admin@domain.com"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                Password
              </label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-mono text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:border-neutral-400"
                  placeholder="••••••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center gap-1.5 py-2 px-4 rounded-lg text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200 transition-colors disabled:opacity-50"
            >
              <span>{isLoading ? 'Verifying...' : 'Sign in'}</span>
              <ArrowRight size={13} />
            </button>
          </form>

          <div className="pt-2 text-center text-xs text-neutral-500 border-t border-neutral-100 dark:border-neutral-800">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-medium text-neutral-900 dark:text-neutral-100 hover:underline">
              Register here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

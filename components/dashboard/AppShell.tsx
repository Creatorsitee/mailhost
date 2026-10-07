'use client';

import { useState, useEffect } from 'react';
import { 
  Mail, 
  Globe, 
  Users, 
  LayoutDashboard, 
  Inbox, 
  LogOut,
  Moon,
  Sun,
  Monitor,
  Menu,
  X,
  ShieldCheck,
  Settings
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authFetch, clearAuthSession, getStoredUser, setStoredUser } from '@/lib/client-auth';

export default function AppShell({ 
  children, 
  activeTab 
}: { 
  children: React.ReactNode; 
  activeTab: string;
}) {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('cmnty_theme') as any) || 'system';
    }
    return 'system';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Initialize with safe static values, loaded from local storage on mount
  const [userEmail, setUserEmail] = useState<string>('admin@yourdomain.com');
  const [userRole, setUserRole] = useState<string>('admin');
  
  const router = useRouter();

  useEffect(() => {
    // Load stored values on mount to prevent hydration mismatch
    const stored = getStoredUser();
    if (stored) {
      setTimeout(() => {
        setUserEmail(stored.email);
        setUserRole(stored.role);
      }, 0);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    // Perform check but don't redirect immediately if we have a stored user
    // This gives the fetch time to complete without a flash of redirect
    const performCheck = async () => {
      try {
        const res = await authFetch('/api/auth');
        if (!isMounted) return;

        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            setUserEmail(data.user.email);
            setUserRole(data.user.role);
            setStoredUser(data.user);
          }
        } else if (res.status === 401) {
          // Double check if we still have a token, if not, definitely redirect
          // If we do, maybe it just expired or was invalidated
          clearAuthSession();
          router.push('/login');
        }
      } catch (err) {
        // Network error - stay on current page if we have a stored user
      }
    };

    performCheck();

    return () => {
      isMounted = false;
    };
  }, [router]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('cmnty_theme', theme);
  }, [theme]);

  const handleSignOut = async () => {
    try {
      await authFetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' })
      });
    } catch {}
    clearAuthSession();
    router.push('/login');
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
    { id: 'domains', label: 'Domains', icon: Globe, href: '/dashboard/domains' },
    { id: 'mailboxes', label: 'Mailboxes', icon: Users, href: '/dashboard/mailboxes' },
    { id: 'settings', label: 'System Status', icon: Settings, href: '/dashboard/settings' },
    { id: 'webmail', label: 'Webmail', icon: Inbox, href: '/webmail' },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col md:flex-row max-w-full overflow-x-hidden">
      {/* Mobile Header Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3.5 bg-white dark:bg-neutral-900 border-b border-neutral-100 dark:border-neutral-800 sticky top-0 z-40">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg text-neutral-900 dark:text-neutral-100">
          <div className="w-8 h-8 bg-neutral-900 dark:bg-white rounded-lg flex items-center justify-center text-white dark:text-neutral-900 shrink-0 shadow-sm">
            <Mail size={16} />
          </div>
          <span className="tracking-tight">CMNTY Mail</span>
        </Link>
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-xl text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          aria-label="Toggle navigation"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50 w-72 max-w-[85vw] md:w-64 border-r border-neutral-100 dark:border-neutral-800 
        bg-neutral-50/50 dark:bg-neutral-900/50 backdrop-blur-md flex flex-col transition-transform duration-200 ease-in-out
        ${mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Brand */}
        <div className="p-6 hidden md:block border-b border-neutral-100 dark:border-neutral-800">
          <Link href="/dashboard" className="flex items-center gap-2.5 font-bold text-lg tracking-tight text-neutral-900 dark:text-neutral-100">
            <div className="w-7 h-7 bg-neutral-900 dark:bg-white rounded-lg flex items-center justify-center text-white dark:text-neutral-900 shadow-xs">
              <Mail size={15} />
            </div>
            CMNTY Mail
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3.5 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <Link 
                key={item.id} 
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg font-medium text-xs transition-all ${
                  isActive 
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm' 
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                <item.icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer Settings & User Info */}
        <div className="p-4 border-t border-neutral-100 dark:border-neutral-800 space-y-3 bg-white/40 dark:bg-neutral-900/40">
          {/* Theme Selector */}
          <div className="flex items-center justify-between p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
            <button 
              onClick={() => setTheme('light')} 
              className={`flex-1 py-1.5 flex items-center justify-center rounded-lg text-xs transition-all ${
                theme === 'light' ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-xs' : 'text-neutral-500'
              }`}
            >
              <Sun size={14} />
            </button>
            <button 
              onClick={() => setTheme('system')} 
              className={`flex-1 py-1.5 flex items-center justify-center rounded-lg text-xs transition-all ${
                theme === 'system' ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-xs' : 'text-neutral-500'
              }`}
            >
              <Monitor size={14} />
            </button>
            <button 
              onClick={() => setTheme('dark')} 
              className={`flex-1 py-1.5 flex items-center justify-center rounded-lg text-xs transition-all ${
                theme === 'dark' ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-xs' : 'text-neutral-500'
              }`}
            >
              <Moon size={14} />
            </button>
          </div>

          {/* User Profile & Sign Out */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-neutral-900 dark:bg-white flex items-center justify-center font-bold text-[10px] text-white dark:text-neutral-900 uppercase shrink-0">
                {userEmail[0] || 'U'}
              </div>
              <div className="overflow-hidden">
                <div className="text-[11px] font-black text-neutral-900 dark:text-neutral-100 truncate">{userEmail}</div>
                <div className="text-[9px] font-bold text-neutral-400 uppercase tracking-tighter">{userRole}</div>
              </div>
            </div>
            <button 
              onClick={handleSignOut}
              className="p-2 rounded-xl text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Backdrop for Mobile Drawer */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 md:hidden"
        />
      )}

      {/* Main Content Container */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white dark:bg-neutral-950">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}


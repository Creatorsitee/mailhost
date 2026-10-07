'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/dashboard/AppShell';
import { 
  Globe, 
  Users, 
  HardDrive, 
  Mail, 
  RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { authFetch } from '@/lib/client-auth';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalDomains: 0,
    activeDomains: 0,
    pendingDomains: 0,
    totalMailboxes: 0,
    storage: {
      usedMB: '0.0',
      usedGB: '0.00',
      limitGB: '5',
      percent: 1,
      availablePercent: 99
    },
    emails: {
      sent: 0,
      received: 0,
      total: 0
    },
    recentLogs: [] as Array<{ id: string; action: string; details: string; timestamp: string }>
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const res = await authFetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.totalDomains === 'number') {
          setStats(data);
          setLastSyncTime(new Date());
        }
      }
    } catch {}
    setIsRefreshing(false);
  };

  useEffect(() => {
    let isMounted = true;
    authFetch('/api/stats')
      .then(res => res.json())
      .then(data => {
        if (isMounted && data && typeof data.totalDomains === 'number') {
          setStats(data);
          setLastSyncTime(new Date());
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoading(false);
      });

    // Real-time automatic polling every 4 seconds to reflect actual database state
    const interval = setInterval(() => {
      authFetch('/api/stats')
        .then(res => res.json())
        .then(data => {
          if (isMounted && data && typeof data.totalDomains === 'number') {
            setStats(data);
            setLastSyncTime(new Date());
          }
        })
        .catch(() => {});
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const statCards = [
    { 
      label: 'Connected Domains', 
      value: (stats?.totalDomains ?? 0).toString(), 
      sub: `${stats?.activeDomains ?? 0} active, ${stats?.pendingDomains ?? 0} pending`,
      icon: Globe
    },
    { 
      label: 'Mailbox Accounts', 
      value: (stats?.totalMailboxes ?? 0).toString(), 
      sub: 'Email accounts',
      icon: Users
    },
    { 
      label: 'Storage Quota', 
      value: `${stats?.storage?.usedMB ?? '0.0'} MB`, 
      sub: `dari ${stats?.storage?.limitGB ?? '5'} GB kapasitas`,
      icon: HardDrive
    },
    { 
      label: 'Total Messages', 
      value: (stats?.emails?.total ?? 0).toString(), 
      sub: `${stats?.emails?.sent ?? 0} terkirim, ${stats?.emails?.received ?? 0} diterima`,
      icon: Mail
    },
  ];

  return (
    <AppShell activeTab="dashboard">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Header Card */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xs">
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              Overview Sistem
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Manajemen server mail, hosting domain, dan akun mailbox.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 transition-colors"
              title="Refresh Data"
            >
              <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            </button>
            <Link 
              href="/dashboard/domains?view=new"
              className="bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-100 dark:text-neutral-900 px-4 py-2 rounded-lg text-xs font-semibold transition-all shadow-xs"
            >
              + Tambah Domain
            </Link>
            <Link 
              href="/dashboard/mailboxes?view=create"
              className="bg-neutral-100 hover:bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-neutral-100 px-4 py-2 rounded-lg text-xs font-semibold transition-all"
            >
              + Buat Mailbox
            </Link>
            <Link 
              href="/webmail"
              className="px-4 py-2 rounded-lg text-xs font-semibold border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all flex items-center gap-1.5"
            >
              <Mail size={14} /> Webmail
            </Link>
          </div>
        </div>

        {/* 4 Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <div 
              key={card.label} 
              className="p-5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-3 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  {card.label}
                </span>
                <card.icon size={16} className="text-neutral-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
                  {isLoading ? '...' : card.value}
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {card.sub}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

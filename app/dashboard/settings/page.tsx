'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/dashboard/AppShell';
import { 
  Settings, 
  Server, 
  Key, 
  Send, 
  Activity, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw 
} from 'lucide-react';
import { authFetch } from '@/lib/client-auth';

interface SystemSettings {
  serverIp: string;
  mailHostname: string;
  masterKey: string;
  smtpHost: string;
  smtpPort: number;
  imapHost: string;
  imapPort: number;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>({
    serverIp: '',
    mailHostname: '',
    masterKey: '',
    smtpHost: '',
    smtpPort: 587,
    imapHost: '',
    imapPort: 993,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    let isMounted = true;
    authFetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data) {
          setSettings({
            serverIp: data.serverIp || '',
            mailHostname: data.mailHostname || '',
            masterKey: data.masterKey || '',
            smtpHost: data.smtpHost || '',
            smtpPort: Number(data.smtpPort) || 587,
            imapHost: data.imapHost || '',
            imapPort: Number(data.imapPort) || 993,
          });
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load settings:', err);
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <AppShell activeTab="settings">
        <div className="max-w-4xl mx-auto py-12 text-center text-xs text-neutral-400">
          <RefreshCw size={18} className="animate-spin mx-auto mb-3 text-neutral-500" />
          Memuat status sistem...
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell activeTab="settings">
      <div className="max-w-4xl mx-auto space-y-6 py-4 px-4 sm:px-0">
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 p-4 rounded-xl flex items-start gap-3">
          <CheckCircle className="text-emerald-500 shrink-0 mt-0.5" size={18} />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-300">Sistem Berjalan Otomatis</h3>
            <p className="text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed">
              Anda tidak perlu melakukan konfigurasi SMTP manual. Sistem ini secara otomatis menggunakan mode **Direct MX Delivery (MTA)** untuk mengirim email langsung ke server tujuan secara gratis dan real-time.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 space-y-4 shadow-xs">
            <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
              <Server size={16} className="text-neutral-400" /> Informasi Server
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">IP Publik Server</label>
                <div className="font-mono text-xs p-2 bg-neutral-50 dark:bg-neutral-950 rounded border border-neutral-100 dark:border-neutral-800">{settings.serverIp || 'Detecting...'}</div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">Hostname Utama</label>
                <div className="font-mono text-xs p-2 bg-neutral-50 dark:bg-neutral-950 rounded border border-neutral-100 dark:border-neutral-800">{settings.mailHostname || 'mail.cmnty.io'}</div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-6 space-y-4 shadow-xs">
            <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
              <Activity size={16} className="text-neutral-400" /> Status Layanan
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs p-2 bg-emerald-50/50 dark:bg-emerald-950/10 rounded-lg">
                <span className="text-neutral-500">SMTP Receiver (Port 2525)</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">ONLINE</span>
              </div>
              <div className="flex items-center justify-between text-xs p-2 bg-emerald-50/50 dark:bg-emerald-950/10 rounded-lg">
                <span className="text-neutral-500">Direct MX Delivery</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">READY</span>
              </div>
              <div className="flex items-center justify-between text-xs p-2 bg-emerald-50/50 dark:bg-emerald-950/10 rounded-lg">
                <span className="text-neutral-500">DKIM Signing Service</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">ACTIVE</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { Mail, Globe, Shield, Zap, ArrowRight, Server, Check } from 'lucide-react';
import Link from 'next/link';
import { authFetch, getStoredUser } from '@/lib/client-auth';

export default function LandingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    if (getStoredUser()) {
      setTimeout(() => {
        if (isMounted) {
          setIsLoggedIn(true);
        }
      }, 0);
    }

    authFetch('/api/auth')
      .then(res => res.json())
      .then(data => {
        if (isMounted) {
          if (data.authenticated) {
            setIsLoggedIn(true);
          } else {
            setIsLoggedIn(false);
          }
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  const features = [
    { 
      title: 'Domain Kustom', 
      desc: 'Gunakan domain sendiri untuk alamat email profesional tanpa batas.', 
      icon: Globe 
    },
    { 
      title: 'DNS Otomatis', 
      desc: 'Generate otomatis konfigurasi MX, SPF, DKIM RSA 2048-bit, DMARC, dan A Record.', 
      icon: Zap 
    },
    { 
      title: 'Penyimpanan Mandiri', 
      desc: 'Database JSON persisten untuk manajemen user, mailbox, pesan, dan log audit.', 
      icon: Shield 
    },
    { 
      title: 'Webmail Lengkap', 
      desc: 'Klien webmail modern, cepat, dan responsif dengan dukungan Nodemailer.', 
      icon: Mail 
    },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col justify-between">
      {/* Navbar */}
      <header className="border-b border-neutral-100 dark:border-neutral-800 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-bold text-base tracking-tight">
            <div className="w-8 h-8 bg-neutral-900 dark:bg-white rounded-lg flex items-center justify-center text-white dark:text-neutral-900 shadow-xs">
              <Mail size={16} />
            </div>
            <span>CMNTY Mail</span>
          </Link>
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <Link 
                href="/dashboard" 
                className="bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-100 dark:text-neutral-900 px-4 py-2 rounded-lg text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5"
              >
                Dashboard <ArrowRight size={13} />
              </Link>
            ) : (
              <>
                <Link 
                  href="/login" 
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-colors"
                >
                  Masuk
                </Link>
                <Link 
                  href="/register" 
                  className="bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-100 dark:text-neutral-900 px-4 py-2 rounded-lg text-xs font-semibold shadow-xs transition-all"
                >
                  Mulai Sekarang
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300">
            <Server size={13} className="text-neutral-500" />
            Platform Email Server Mandiri
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-100 leading-tight">
            Hosting Email Profesional untuk Domain Anda
          </h1>

          <p className="max-w-2xl mx-auto text-sm sm:text-base text-neutral-600 dark:text-neutral-400 leading-relaxed">
            Kelola domain kustom, mailbox tak terbatas, verifikasi DNS real-time, dan akses antarmuka webmail terpadu tanpa ketergantungan pihak ketiga.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link 
              href={isLoggedIn ? "/dashboard" : "/register"} 
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-100 dark:text-neutral-900 text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2"
            >
              Buka Dashboard <ArrowRight size={15} />
            </Link>
            <Link 
              href="/webmail" 
              className="w-full sm:w-auto px-6 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-bold transition-colors"
            >
              Buka Webmail
            </Link>
          </div>
        </section>

        {/* Feature Cards Grid */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 border-t border-neutral-100 dark:border-neutral-800">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f) => (
              <div 
                key={f.title}
                className="p-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-3"
              >
                <div className="w-9 h-9 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-800 dark:text-neutral-200">
                  <f.icon size={18} />
                </div>
                <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  {f.title}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Architecture Specs */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="p-8 bg-neutral-50 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 rounded-2xl space-y-6">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                Fitur Standar Infrastruktur Email
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Memenuhi seluruh spesifikasi RFC pengiriman dan penerimaan surat elektronik.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              {[
                'DKIM RSA 2048-bit Key Pair Generator',
                'SPF Anti-Spoofing Alignment',
                'DMARC Policy Enforcement',
                'Nodemailer Transporter Relay',
                'Real-Time DNS Nameserver Resolver',
                'Persistent JSON Data Layer',
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 p-3 bg-white dark:bg-neutral-800/80 rounded-lg border border-neutral-200 dark:border-neutral-700/60">
                  <Check size={14} className="text-neutral-800 dark:text-neutral-200 shrink-0" />
                  <span className="font-medium text-neutral-700 dark:text-neutral-300">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Clean Footer */}
      <footer className="border-t border-neutral-100 dark:border-neutral-800 py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-400">
          <div>© {new Date().getFullYear()} CMNTY Mail. Professional Email Infrastructure.</div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-neutral-700 dark:hover:text-neutral-200">Masuk</Link>
            <Link href="/register" className="hover:text-neutral-700 dark:hover:text-neutral-200">Daftar</Link>
            <Link href="/webmail" className="hover:text-neutral-700 dark:hover:text-neutral-200">Webmail</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

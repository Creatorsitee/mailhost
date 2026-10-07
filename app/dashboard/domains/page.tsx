'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import AppShell from '@/components/dashboard/AppShell';
import { 
  Plus, 
  Search, 
  Globe, 
  ShieldCheck, 
  AlertCircle, 
  RefreshCw, 
  Trash2, 
  Copy, 
  Check, 
  ArrowLeft,
  ArrowRight,
  Server,
  Zap,
  Terminal,
  ExternalLink,
  CheckCircle2,
  XCircle,
  HelpCircle
} from 'lucide-react';
import { Domain } from '@/lib/db/db';
import { authFetch } from '@/lib/client-auth';

function DomainsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [domains, setDomains] = useState<Domain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Full-page view states: 'list' | 'new' | 'dns'
  const [viewMode, setViewMode] = useState<'list' | 'new' | 'dns'>(() => {
    const v = searchParams.get('view');
    if (v === 'new') return 'new';
    if (searchParams.get('domainId')) return 'dns';
    return 'list';
  });
  
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null);

  // Form states for 'new'
  const [newDomainName, setNewDomainName] = useState('');
  const [addError, setAddError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // States for 'dns' diagnostics
  const [isVerifying, setIsVerifying] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [verificationFeedback, setVerificationFeedback] = useState<string | null>(null);

  // Inline delete confirmation state (No window.confirm popup)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchDomains = useCallback(async () => {
    try {
      const res = await authFetch('/api/domains');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setDomains(data);
          setSelectedDomain(current => {
            if (!current) return null;
            return data.find(d => d.id === current.id) || current;
          });
        }
      }
    } catch (e) {
      console.error('Failed to fetch domains:', e);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    authFetch('/api/domains')
      .then(res => res.json())
      .then(data => {
        if (isMounted && Array.isArray(data)) {
          setDomains(data);
          setIsLoading(false);
          const initialDomainId = searchParams.get('domainId');
          if (initialDomainId) {
            const matched = data.find(d => d.id === initialDomainId);
            if (matched) setSelectedDomain(matched);
          }
        }
      })
      .catch(() => {
        if (isMounted) setIsLoading(false);
      });

    // Auto-poll domain status changes every 6s
    const timer = setInterval(() => {
      authFetch('/api/domains')
        .then(res => res.json())
        .then(data => {
          if (isMounted && Array.isArray(data)) {
            setDomains(data);
            setSelectedDomain(current => {
              if (!current) return null;
              return data.find(d => d.id === current.id) || current;
            });
          }
        })
        .catch(() => {});
    }, 6000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [searchParams]);

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    const cleanName = newDomainName.trim().toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '');
    if (!cleanName) {
      setAddError('Please enter a valid domain name');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authFetch('/api/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName })
      });
      const data = await res.json();

      if (!res.ok) {
        setAddError(data.error || 'Failed to connect domain');
      } else {
        setNewDomainName('');
        await fetchDomains();
        setSelectedDomain(data);
        setViewMode('dns'); // Switch directly to full-page DNS config
      }
    } catch {
      setAddError('Network error while creating domain entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyDns = async (domainId: string, force = false) => {
    setIsVerifying(true);
    setVerificationFeedback(null);
    try {
      const res = await authFetch(`/api/domains/${domainId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceActive: force })
      });
      const data = await res.json();
      if (data.success) {
        await fetchDomains();
        const active = data.status === 'active';
        setVerificationFeedback(
          active 
            ? 'Semua 5 record DNS (A, MX, SPF, DKIM, DMARC) berhasil diverifikasi dan aktif!' 
            : `Query DNS selesai. ${data.verifiedCount || 0}/5 record terverifikasi. Masih ada record yang belum terpasang atau sedang propagasi.`
        );
      } else {
        setVerificationFeedback(data.error || 'DNS query failed');
      }
    } catch {
      setVerificationFeedback('Network error while querying global DNS nameservers');
    } finally {
      setIsVerifying(false);
    }
  };

  const executeDeleteDomain = async (domainId: string) => {
    try {
      const res = await authFetch(`/api/domains/${domainId}`, { method: 'DELETE' });
      if (res.ok) {
        setConfirmDeleteId(null);
        if (selectedDomain?.id === domainId) {
          setSelectedDomain(null);
          setViewMode('list');
        }
        await fetchDomains();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const filteredDomains = domains.filter(d => 
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  // ==========================================
  // VIEW 2: FULL-PAGE CONNECT DOMAIN VIEW
  // ==========================================
  if (viewMode === 'new') {
    return (
      <AppShell activeTab="domains">
        <div className="max-w-2xl mx-auto space-y-6 py-4">
          <button
            onClick={() => { setViewMode('list'); setAddError(''); }}
            className="flex items-center gap-2 text-xs font-bold text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors w-fit"
          >
            <ArrowLeft size={14} /> Back
          </button>

          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
              Connect a new domain
            </h2>
            <p className="text-sm text-neutral-500">Enter the domain you want to use for email hosting.</p>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm">
            <form onSubmit={handleAddDomain} className="p-6 space-y-6">
              {addError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs font-medium rounded-lg flex items-center gap-2">
                  <AlertCircle size={14} />
                  <span>{addError}</span>
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                    Domain Name
                  </label>
                  <input 
                    type="text" 
                    value={newDomainName}
                    onChange={(e) => setNewDomainName(e.target.value)}
                    placeholder="example.com"
                    autoFocus
                    required
                    className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-sm focus:ring-1 focus:ring-neutral-900 dark:focus:ring-white outline-none transition-all"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !newDomainName.trim()}
                  className="w-full py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-lg text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? <RefreshCw size={14} className="animate-spin" /> : null}
                  {isSubmitting ? 'Mengkoneksikan...' : 'Hubungkan Domain'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </AppShell>
    );
  }

  // ========================================================
  // VIEW 3: FULL-PAGE DNS CONFIGURATION & REAL-TIME CHECK
  // ========================================================
  if (viewMode === 'dns' && selectedDomain) {
    const verifiedCount = [
      selectedDomain.dnsStatus?.aRecord,
      selectedDomain.dnsStatus?.mx,
      selectedDomain.dnsStatus?.spf,
      selectedDomain.dnsStatus?.dkim,
      selectedDomain.dnsStatus?.dmarc
    ].filter(Boolean).length;
    const isVerified = verifiedCount === 5;

    return (
      <AppShell activeTab="domains">
        <div className="max-w-4xl mx-auto space-y-6 py-4 px-4 sm:px-0">
          <button
            onClick={() => { setViewMode('list'); setVerificationFeedback(null); }}
            className="flex items-center gap-2 text-xs font-bold text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors w-fit"
          >
            <ArrowLeft size={14} /> Back
          </button>

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
                  DNS Configuration
                </h2>
                <div className="flex items-center flex-wrap gap-x-3 gap-y-1">
                  <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400">{selectedDomain.name}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${isVerified ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                      {isVerified ? 'Verified' : `${verifiedCount}/5 Records Active`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 sm:w-auto w-full">
                <button
                  onClick={() => handleVerifyDns(selectedDomain.id)}
                  disabled={isVerifying}
                  className="px-4 py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-lg text-xs font-bold flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm flex-1 sm:flex-initial justify-center cursor-pointer"
                >
                  <RefreshCw size={14} className={isVerifying ? 'animate-spin' : ''} />
                  Check Status
                </button>
              </div>
            </div>
          </div>

          {verificationFeedback && (
            <div className={`p-4 rounded-xl text-[11px] sm:text-xs font-medium flex items-start justify-between gap-3 ${
              isVerified ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50' : 'bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50'
            }`}>
              <div className="flex items-center gap-2">
                {isVerified ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
                <span className="leading-relaxed">{verificationFeedback}</span>
              </div>
              <button onClick={() => setVerificationFeedback(null)} className="opacity-50 hover:opacity-100 shrink-0 mt-0.5">
                <XCircle size={16} />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6">
            {/* Record Table */}
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px] sm:text-xs border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-400 font-bold uppercase tracking-widest text-[9px]">
                      <th className="px-4 sm:px-6 py-3">Type</th>
                      <th className="px-4 sm:px-6 py-3">Host / Name</th>
                      <th className="px-4 sm:px-6 py-3">Value / Content</th>
                      <th className="px-4 sm:px-6 py-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                    {/* A Record */}
                    {(selectedDomain.dnsConfig as any).a && (
                      <tr className="group">
                        <td className="px-4 sm:px-6 py-4 font-bold text-neutral-900 dark:text-neutral-100">A</td>
                        <td className="px-4 sm:px-6 py-4 font-mono text-neutral-500 truncate">mail</td>
                        <td className="px-4 sm:px-6 py-4">
                          <div className="flex items-center gap-2 font-mono break-all">
                            <span className="text-neutral-800 dark:text-neutral-200">{(selectedDomain.dnsConfig as any).a.value}</span>
                            <button onClick={() => copyToClipboard((selectedDomain.dnsConfig as any).a.value, 'a')} className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors shrink-0">
                              {copiedKey === 'a' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-4 text-right">
                          {selectedDomain.dnsStatus?.aRecord ? <CheckCircle2 size={16} className="text-emerald-500 ml-auto" /> : <span className="text-[10px] text-neutral-400 uppercase">Recommended</span>}
                        </td>
                      </tr>
                    )}
                    {/* MX */}
                    <tr className="group">
                      <td className="px-4 sm:px-6 py-4 font-bold text-blue-600 dark:text-blue-400">MX</td>
                      <td className="px-4 sm:px-6 py-4 font-mono text-neutral-500 truncate max-w-[100px] sm:max-w-none">@</td>
                      <td className="px-4 sm:px-6 py-4">
                        <div className="flex items-center gap-2 font-mono break-all">
                          <span className="text-neutral-800 dark:text-neutral-200">{selectedDomain.dnsConfig.mx.value}</span>
                          <button onClick={() => copyToClipboard(selectedDomain.dnsConfig.mx.value, 'mx')} className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors shrink-0">
                            {copiedKey === 'mx' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-right">
                        {selectedDomain.dnsStatus?.mx ? <CheckCircle2 size={16} className="text-emerald-500 ml-auto" /> : <XCircle size={16} className="text-neutral-300 dark:text-neutral-700 ml-auto" />}
                      </td>
                    </tr>
                    {/* SPF */}
                    <tr className="group">
                      <td className="px-4 sm:px-6 py-4 font-bold text-neutral-900 dark:text-neutral-100">TXT (SPF)</td>
                      <td className="px-4 sm:px-6 py-4 font-mono text-neutral-500 truncate">@</td>
                      <td className="px-4 sm:px-6 py-4">
                        <div className="flex items-center gap-2 font-mono break-all">
                          <span className="text-neutral-800 dark:text-neutral-200">{selectedDomain.dnsConfig.spf}</span>
                          <button onClick={() => copyToClipboard(selectedDomain.dnsConfig.spf, 'spf')} className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors shrink-0">
                            {copiedKey === 'spf' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-right">
                        {selectedDomain.dnsStatus?.spf ? <CheckCircle2 size={16} className="text-emerald-500 ml-auto" /> : <XCircle size={16} className="text-neutral-300 dark:text-neutral-700 ml-auto" />}
                      </td>
                    </tr>
                    {/* DKIM */}
                    <tr className="group">
                      <td className="px-4 sm:px-6 py-4 font-bold text-neutral-900 dark:text-neutral-100">TXT (DKIM)</td>
                      <td className="px-4 sm:px-6 py-4 font-mono text-neutral-500 truncate max-w-[100px] sm:max-w-none">{selectedDomain.dnsConfig.dkim.selector}._domainkey</td>
                      <td className="px-4 sm:px-6 py-4">
                        <div className="flex items-start gap-2 font-mono break-all">
                          <span className="text-neutral-800 dark:text-neutral-200 line-clamp-3 sm:line-clamp-none">v=DKIM1; k=rsa; p={selectedDomain.dnsConfig.dkim.publicKey}</span>
                          <button onClick={() => copyToClipboard(`v=DKIM1; k=rsa; p=${selectedDomain.dnsConfig.dkim.publicKey}`, 'dkim')} className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors shrink-0 mt-0.5">
                            {copiedKey === 'dkim' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-right">
                        {selectedDomain.dnsStatus?.dkim ? <CheckCircle2 size={16} className="text-emerald-500 ml-auto" /> : <XCircle size={16} className="text-neutral-300 dark:text-neutral-700 ml-auto" />}
                      </td>
                    </tr>
                    {/* DMARC */}
                    <tr className="group">
                      <td className="px-4 sm:px-6 py-4 font-bold text-neutral-900 dark:text-neutral-100">TXT (DMARC)</td>
                      <td className="px-4 sm:px-6 py-4 font-mono text-neutral-500 truncate">_dmarc</td>
                      <td className="px-4 sm:px-6 py-4">
                        <div className="flex items-center gap-2 font-mono break-all">
                          <span className="text-neutral-800 dark:text-neutral-200">{selectedDomain.dnsConfig.dmarc}</span>
                          <button onClick={() => copyToClipboard(selectedDomain.dnsConfig.dmarc, 'dmarc')} className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors shrink-0">
                            {copiedKey === 'dmarc' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 sm:px-6 py-4 text-right">
                        {selectedDomain.dnsStatus?.dmarc ? <CheckCircle2 size={16} className="text-emerald-500 ml-auto" /> : <XCircle size={16} className="text-neutral-300 dark:text-neutral-700 ml-auto" />}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {selectedDomain.dnsStatus?.details && (
              <div className="p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-neutral-200 dark:border-neutral-800">
                <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400 mb-2">Live Resolver Logs</div>
                <div className="font-mono text-[10px] text-neutral-600 dark:text-neutral-400 whitespace-pre-wrap leading-relaxed overflow-x-auto">
                  {selectedDomain.dnsStatus.details}
                </div>
              </div>
            )}
          </div>

          <div className="p-6 bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-8">
            <div>
              <h4 className="font-bold text-sm text-red-900 dark:text-red-200">Delete Domain Registration</h4>
              <p className="text-xs text-red-700/80 dark:text-red-400 mt-0.5">
                Permanently removes {selectedDomain.name} and all associated mailboxes and emails.
              </p>
            </div>
            {confirmDeleteId === selectedDomain.id ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => executeDeleteDomain(selectedDomain.id)}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all"
                >
                  Confirm Delete Now
                </button>
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-300"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDeleteId(selectedDomain.id)}
                className="px-4 py-2 rounded-xl border border-red-300 dark:border-red-800 text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950 transition-colors w-fit"
              >
                Delete Domain
              </button>
            )}
          </div>
        </div>
      </AppShell>
    );
  }

  // ==========================================
  // VIEW 1: FULL-PAGE DEFAULT DOMAIN LIST VIEW
  // ==========================================
  return (
    <AppShell activeTab="domains">
      <div className="max-w-6xl mx-auto space-y-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
              Domains
            </h2>
            <p className="text-sm text-neutral-500">Manage your connected domains and email routing.</p>
          </div>
          <button 
            onClick={() => setViewMode('new')}
            className="bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 px-4 py-2 rounded-lg text-xs font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            Connect Domain
          </button>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={14} />
              <input 
                type="text" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter domains..."
                className="w-full pl-9 pr-4 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs focus:ring-1 focus:ring-neutral-900 outline-none transition-all"
              />
            </div>
            <button onClick={() => fetchDomains()} className="p-2 text-neutral-500 hover:text-neutral-900 dark:hover:text-white">
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[500px]">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-400 font-bold uppercase tracking-widest text-[9px]">
                  <th className="px-4 py-4">Domain</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4">Mailboxes</th>
                  <th className="px-4 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {isLoading && domains.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-12 text-center text-neutral-400">Loading domains...</td></tr>
                ) : filteredDomains.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-12 text-center text-neutral-400">No domains found.</td></tr>
                ) : (
                  filteredDomains.map((domain) => {
                    const verifiedCount = [
                      domain.dnsStatus?.aRecord,
                      domain.dnsStatus?.mx,
                      domain.dnsStatus?.spf,
                      domain.dnsStatus?.dkim,
                      domain.dnsStatus?.dmarc
                    ].filter(Boolean).length;
                    const isVerified = verifiedCount === 5;
                    return (
                      <tr key={domain.id} className="group hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                        <td className="px-4 py-4">
                          <div className="font-bold text-neutral-900 dark:text-neutral-100 truncate max-w-[150px] sm:max-w-none">{domain.name}</div>
                          <div className="text-[10px] text-neutral-500 font-mono mt-0.5 truncate max-w-[150px] sm:max-w-none">{domain.id}</div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isVerified ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                            <span className="font-medium text-neutral-700 dark:text-neutral-300">
                              {isVerified ? 'Active' : `${verifiedCount}/5 Records`}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-neutral-500 font-mono">{(domain as any).mailboxCount || 0}</td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={() => { setSelectedDomain(domain); setViewMode('dns'); }}
                              className="px-2.5 py-1.5 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg font-bold hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors text-[10px] sm:text-xs whitespace-nowrap"
                            >
                              DNS Settings
                            </button>
                            <button onClick={() => setConfirmDeleteId(domain.id)} className="p-1.5 text-neutral-400 hover:text-red-600 transition-colors shrink-0">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function DomainsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-neutral-400">Loading domains view...</div>}>
      <DomainsContent />
    </Suspense>
  );
}

'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import AppShell from '@/components/dashboard/AppShell';
import { 
  Users, 
  Search, 
  Plus, 
  Mail, 
  Settings, 
  Trash2, 
  RefreshCw, 
  ArrowLeft, 
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { Domain, Mailbox } from '@/lib/db/db';
import { authFetch } from '@/lib/client-auth';

function MailboxesContent() {
  const searchParams = useSearchParams();

  const [mailboxes, setMailboxes] = useState<Mailbox[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDomainFilter, setSelectedDomainFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Full-page views: 'list' | 'create' | 'edit'
  const [viewMode, setViewMode] = useState<'list' | 'create' | 'edit'>(() => {
    const v = searchParams.get('view');
    return v === 'create' || v === 'new' ? 'create' : 'list';
  });

  // Create form state
  const [username, setUsername] = useState('');
  const [domainId, setDomainId] = useState('');
  const [password, setPassword] = useState('');
  const [storageLimit, setStorageLimit] = useState(5);
  const [displayName, setDisplayName] = useState('');
  const [addError, setAddError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit form state
  const [editingMailbox, setEditingMailbox] = useState<Mailbox | null>(null);
  const [editPassword, setEditPassword] = useState('');
  const [editStorageLimit, setEditStorageLimit] = useState(5);
  const [editStatus, setEditStatus] = useState<'active' | 'suspended'>('active');
  const [editError, setEditError] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Inline delete confirmation state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [mbRes, domRes] = await Promise.all([
        authFetch('/api/mailboxes'),
        authFetch('/api/domains')
      ]);
      const mbData = await mbRes.json();
      const domData = await domRes.json();

      if (Array.isArray(mbData)) setMailboxes(mbData);
      if (Array.isArray(domData)) {
        setDomains(domData);
        if (domData.length > 0 && !domainId) {
          setDomainId(domData[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to load mailboxes:', e);
    }
  }, [domainId]);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      authFetch('/api/mailboxes').then(r => r.json()),
      authFetch('/api/domains').then(r => r.json())
    ])
      .then(([mbData, domData]) => {
        if (isMounted) {
          if (Array.isArray(mbData)) setMailboxes(mbData);
          if (Array.isArray(domData)) {
            setDomains(domData);
            if (domData.length > 0 && !domainId) {
              setDomainId(domData[0].id);
            }
          }
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoading(false);
      });

    // Auto-poll mailboxes every 4s for live storage & status updates
    const interval = setInterval(() => {
      Promise.all([
        authFetch('/api/mailboxes').then(r => r.json()),
        authFetch('/api/domains').then(r => r.json())
      ])
        .then(([mbData, domData]) => {
          if (isMounted) {
            if (Array.isArray(mbData)) setMailboxes(mbData);
            if (Array.isArray(domData)) setDomains(domData);
          }
        })
        .catch(() => {});
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [domainId]);

  const handleCreateMailbox = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    if (!username.trim() || !domainId || !password) {
      setAddError('All required fields must be filled');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authFetch('/api/mailboxes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim().toLowerCase(),
          domainId,
          password,
          storageLimit: storageLimit * 1024 * 1024 * 1024,
          displayName: displayName.trim() || username.trim()
        })
      });
      const data = await res.json();

      if (!res.ok) {
        setAddError(data.error || 'Failed to create mailbox');
      } else {
        setUsername('');
        setPassword('');
        setDisplayName('');
        await fetchData();
        setViewMode('list');
      }
    } catch {
      setAddError('Network error while creating mailbox');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateMailbox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMailbox) return;

    setEditError('');
    setIsSavingEdit(true);

    try {
      const body: any = {
        storageLimit: editStorageLimit * 1024 * 1024 * 1024,
        status: editStatus
      };
      if (editPassword.trim()) {
        body.password = editPassword.trim();
      }

      const res = await authFetch(`/api/mailboxes/${editingMailbox.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (!res.ok) {
        setEditError(data.error || 'Failed to update mailbox');
      } else {
        setEditingMailbox(null);
        setEditPassword('');
        await fetchData();
        setViewMode('list');
      }
    } catch {
      setEditError('Network error while saving mailbox settings');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const executeDeleteMailbox = async (id: string) => {
    try {
      const res = await authFetch(`/api/mailboxes/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setConfirmDeleteId(null);
        await fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredMailboxes = mailboxes.filter(m => {
    const matchesDomain = selectedDomainFilter === 'all' || m.domainId === selectedDomainFilter;
    const matchesSearch = search === '' || 
      m.fullAddress.toLowerCase().includes(search.toLowerCase()) ||
      (m.displayName && m.displayName.toLowerCase().includes(search.toLowerCase()));
    return matchesDomain && matchesSearch;
  });

  const selectedDomainObj = domains.find(d => d.id === domainId);

  // VIEW: CREATE MAILBOX
  if (viewMode === 'create') {
    return (
      <AppShell activeTab="mailboxes">
        <div className="max-w-2xl mx-auto space-y-6 py-4">
          <button
            onClick={() => { setViewMode('list'); setAddError(''); }}
            className="flex items-center gap-2 text-xs font-bold text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors w-fit"
          >
            <ArrowLeft size={14} /> Back
          </button>

          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
              Create mailbox
            </h2>
            <p className="text-sm text-neutral-500">Create a new professional email account.</p>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm">
            <div className="p-6 space-y-6">
              {addError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs font-medium rounded-lg flex items-center gap-2">
                  <AlertCircle size={14} />
                  <span>{addError}</span>
                </div>
              )}

              {domains.length === 0 ? (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 rounded-lg text-xs text-amber-700 dark:text-amber-400">
                  <p className="font-bold">No domains connected</p>
                  <p className="mt-1">Connect a domain before you can create a mailbox.</p>
                  <Link href="/dashboard/domains?view=new" className="inline-block mt-3 font-bold underline">Connect domain now</Link>
                </div>
              ) : (
                <form onSubmit={handleCreateMailbox} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                      Email Address
                    </label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="text" 
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''))}
                        placeholder="john"
                        required
                        autoFocus
                        className="flex-1 px-4 py-2.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-sm outline-none focus:ring-1 focus:ring-neutral-900 transition-all"
                      />
                      <span className="text-neutral-400 font-medium">@</span>
                      <select 
                        value={domainId}
                        onChange={(e) => setDomainId(e.target.value)}
                        className="px-4 py-2.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-sm outline-none focus:ring-1 focus:ring-neutral-900 transition-all"
                      >
                        {domains.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                        Display Name
                      </label>
                      <input 
                        type="text" 
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="John Doe"
                        className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-sm outline-none focus:ring-1 focus:ring-neutral-900 transition-all"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                        Password
                      </label>
                      <input 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-sm outline-none focus:ring-1 focus:ring-neutral-900 transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                      Storage Limit (GB)
                    </label>
                    <input 
                      type="number" 
                      min="1" 
                      max="100" 
                      value={storageLimit}
                      onChange={(e) => setStorageLimit(parseInt(e.target.value) || 5)}
                      className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-sm outline-none focus:ring-1 focus:ring-neutral-900 transition-all"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-lg text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {isSubmitting ? 'Creating...' : 'Create Mailbox'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  // VIEW: EDIT MAILBOX
  if (viewMode === 'edit' && editingMailbox) {
    return (
      <AppShell activeTab="mailboxes">
        <div className="max-w-2xl mx-auto space-y-6 py-4">
          <button
            onClick={() => { setViewMode('list'); setEditingMailbox(null); setEditError(''); }}
            className="flex items-center gap-2 text-xs font-bold text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors w-fit"
          >
            <ArrowLeft size={14} /> Back
          </button>

          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
              Mailbox settings
            </h2>
            <p className="text-sm text-neutral-500">{editingMailbox.fullAddress}</p>
          </div>

          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm">
            <form onSubmit={handleUpdateMailbox} className="p-6 space-y-6">
              {editError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs font-medium rounded-lg flex items-center gap-2">
                  <AlertCircle size={14} />
                  <span>{editError}</span>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                  Account Status
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditStatus('active')}
                    className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold border transition-all ${
                      editStatus === 'active'
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-neutral-900 dark:border-white'
                        : 'bg-neutral-50 dark:bg-neutral-950 text-neutral-500 border-neutral-200 dark:border-neutral-800'
                    }`}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditStatus('suspended')}
                    className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold border transition-all ${
                      editStatus === 'suspended'
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-neutral-900 dark:border-white'
                        : 'bg-neutral-50 dark:bg-neutral-950 text-neutral-500 border-neutral-200 dark:border-neutral-800'
                    }`}
                  >
                    Suspended
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                  Change Password
                </label>
                <input 
                  type="password" 
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="New password (leave blank to keep current)"
                  className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-sm outline-none focus:ring-1 focus:ring-neutral-900 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                  Storage Limit (GB)
                </label>
                <input 
                  type="number" 
                  min="1" 
                  max="100" 
                  value={editStorageLimit}
                  onChange={(e) => setEditStorageLimit(parseInt(e.target.value) || 5)}
                  className="w-full px-4 py-2.5 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-sm outline-none focus:ring-1 focus:ring-neutral-900 transition-all"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="w-full py-2.5 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 rounded-lg text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isSavingEdit ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </AppShell>
    );
  }

  // VIEW: MAILBOXES LIST TABLE
  return (
    <AppShell activeTab="mailboxes">
      <div className="max-w-6xl mx-auto space-y-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 tracking-tight">
              Mailboxes
            </h2>
            <p className="text-sm text-neutral-500">Manage email accounts for your connected domains.</p>
          </div>
          <button 
            onClick={() => setViewMode('create')}
            className="bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 px-4 py-2 rounded-lg text-xs font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            Create Mailbox
          </button>
        </div>

        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-neutral-100 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative flex-1 w-full sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={14} />
              <input 
                type="text" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search mailboxes..."
                className="w-full pl-9 pr-4 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs outline-none focus:ring-1 focus:ring-neutral-900 transition-all"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select 
                value={selectedDomainFilter}
                onChange={(e) => setSelectedDomainFilter(e.target.value)}
                className="flex-1 sm:flex-none px-4 py-2 bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg text-xs font-medium outline-none transition-all"
              >
                <option value="all">All Domains</option>
                {domains.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <button onClick={() => fetchData()} className="p-2 text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors">
                <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-800/50 text-neutral-400 font-bold uppercase tracking-widest text-[9px]">
                  <th className="px-6 py-4">Mailbox</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Storage</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {isLoading && mailboxes.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-12 text-center text-neutral-400">Loading mailboxes...</td></tr>
                ) : filteredMailboxes.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-12 text-center text-neutral-400">No mailboxes found.</td></tr>
                ) : (
                  filteredMailboxes.map((mailbox) => {
                    const usedMB = ((mailbox.storageUsed || 0) / (1024 * 1024)).toFixed(1);
                    const limitGB = Math.round((mailbox.storageLimit || 5 * 1024 * 1024 * 1024) / (1024 * 1024 * 1024));
                    const percent = Math.min(100, Math.max(1, Math.round(((mailbox.storageUsed || 0) / (mailbox.storageLimit || 1)) * 100)));

                    return (
                      <tr key={mailbox.id} className="group hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-neutral-900 dark:text-neutral-100">{mailbox.fullAddress}</div>
                          <div className="text-[10px] text-neutral-500 mt-0.5">{mailbox.displayName || mailbox.username}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`h-1.5 w-1.5 rounded-full ${mailbox.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                            <span className="capitalize text-neutral-700 dark:text-neutral-300">{mailbox.status}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="w-32 space-y-1">
                            <div className="flex justify-between text-[10px] text-neutral-500 font-mono">
                              <span>{usedMB}MB</span>
                              <span>{limitGB}GB</span>
                            </div>
                            <div className="h-1 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                              <div className="h-full bg-neutral-900 dark:bg-white" style={{ width: `${percent}%` }}></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link href={`/webmail?mailboxId=${mailbox.id}`} className="p-1.5 text-neutral-400 hover:text-neutral-900 dark:hover:text-white">
                              <Mail size={16} />
                            </Link>
                            <button 
                              onClick={() => {
                                setEditingMailbox(mailbox);
                                setEditStorageLimit(Math.round(mailbox.storageLimit / (1024 * 1024 * 1024)));
                                setEditStatus(mailbox.status);
                                setViewMode('edit');
                              }}
                              className="p-1.5 text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                            >
                              <Settings size={16} />
                            </button>
                            <button onClick={() => setConfirmDeleteId(mailbox.id)} className="p-1.5 text-neutral-400 hover:text-red-600 transition-colors">
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

export default function MailboxesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-neutral-400">Loading mailboxes...</div>}>
      <MailboxesContent />
    </Suspense>
  );
}

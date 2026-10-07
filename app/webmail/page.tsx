'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  Inbox, 
  Send, 
  FileText, 
  Trash2, 
  Star, 
  Archive, 
  AlertOctagon, 
  Search, 
  Edit3, 
  RefreshCw, 
  Paperclip, 
  Reply, 
  Forward, 
  ArrowLeft, 
  X, 
  Check, 
  Download, 
  Mail, 
  Sun, 
  Moon, 
  Monitor, 
  LayoutDashboard, 
  Menu,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { EmailMessage, EmailFolder } from '@/lib/db/db';
import { authFetch } from '@/lib/client-auth';

function WebmailContent() {
  const searchParams = useSearchParams();

  const [activeFolder, setActiveFolder] = useState<EmailFolder>('inbox');
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  
  // Mailboxes
  const [mailboxes, setMailboxes] = useState<Array<{ id: string; fullAddress: string; username: string; displayName?: string }>>([]);
  const [activeMailboxId, setActiveMailboxId] = useState<string>(() => {
    return searchParams.get('mailboxId') || '';
  });
  
  // Folder counts
  const [folderCounts, setFolderCounts] = useState({
    inbox: 0,
    sent: 0,
    drafts: 0,
    starred: 0,
    archive: 0,
    spam: 0,
    trash: 0
  });

  // Compose View State (Full-page, NO popup!)
  const [isComposing, setIsComposing] = useState(false);
  const [composeFromId, setComposeFromId] = useState('');
  const [composeTo, setComposeTo] = useState('');
  const [composeCc, setComposeCc] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeAttachments, setComposeAttachments] = useState<Array<{ filename: string; contentType: string; content: string }>>([]);
  const [isSending, setIsSending] = useState(false);
  const [composeFeedback, setComposeFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Theme
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('cmnty_theme') as any) || 'system';
    }
    return 'system';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('cmnty_theme', theme);
  }, [theme]);

  // Fetch emails for current folder & mailbox
  const fetchEmails = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeMailboxId) params.set('mailboxId', activeMailboxId);
      params.set('folder', activeFolder);
      if (search) params.set('search', search);

      const res = await authFetch(`/api/mail?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch mail');
      const data = await res.json();

      if (data) {
        setEmails(data.emails || []);
        if (data.mailboxes && data.mailboxes.length > 0) {
          setMailboxes(data.mailboxes);
          if (!activeMailboxId && data.activeMailbox) {
            setActiveMailboxId(data.activeMailbox.id);
            setComposeFromId(data.activeMailbox.id);
          }
        }
        if (data.folderCounts) {
          setFolderCounts(data.folderCounts);
        }
        // Update selectedEmail if viewing
        if (selectedEmail) {
          const freshSelected = (data.emails || []).find((e: EmailMessage) => e.id === selectedEmail.id);
          if (freshSelected) setSelectedEmail(freshSelected);
        }
      }
    } catch (e) {
      console.error('Mail fetch error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [activeMailboxId, activeFolder, search, selectedEmail]);

  useEffect(() => {
    let isMounted = true;

    const timer = setTimeout(() => {
      if (isMounted) fetchEmails();
    }, 0);

    // Real-time automatic polling every 4 seconds to receive incoming emails live
    const interval = setInterval(() => {
      if (isMounted) fetchEmails(true);
    }, 4000);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [fetchEmails]);

  // Read email & mark read
  const handleSelectEmail = async (email: EmailMessage) => {
    setIsComposing(false);
    setSelectedEmail(email);
    if (!email.isRead) {
      try {
        await authFetch(`/api/mail/${email.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isRead: true })
        });
        setEmails(prev => prev.map(e => e.id === email.id ? { ...e, isRead: true } : e));
        setFolderCounts(prev => ({ ...prev, inbox: Math.max(0, prev.inbox - 1) }));
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Toggle Star
  const handleToggleStar = async (email: EmailMessage, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newStarred = !email.isStarred;
    try {
      await authFetch(`/api/mail/${email.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isStarred: newStarred })
      });
      setEmails(prev => prev.map(item => item.id === email.id ? { ...item, isStarred: newStarred } : item));
      if (selectedEmail?.id === email.id) {
        setSelectedEmail(prev => prev ? { ...prev, isStarred: newStarred } : null);
      }
      setFolderCounts(prev => ({ 
        ...prev, 
        starred: newStarred ? prev.starred + 1 : Math.max(0, prev.starred - 1) 
      }));
    } catch (err) {
      console.error(err);
    }
  };

  // Move Folder
  const handleMoveFolder = async (targetFolder: EmailFolder) => {
    if (!selectedEmail) return;
    try {
      await authFetch(`/api/mail/${selectedEmail.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: targetFolder })
      });
      setEmails(prev => prev.filter(e => e.id !== selectedEmail.id));
      setSelectedEmail(null);
      await fetchEmails(true);
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Email
  const handleDeleteEmail = async () => {
    if (!selectedEmail) return;
    if (activeFolder === 'trash') {
      try {
        await authFetch(`/api/mail/${selectedEmail.id}`, { method: 'DELETE' });
        setEmails(prev => prev.filter(e => e.id !== selectedEmail.id));
        setSelectedEmail(null);
        await fetchEmails(true);
      } catch (e) {
        console.error(e);
      }
    } else {
      await handleMoveFolder('trash');
    }
  };

  // Handle Attachments
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      if (file.size > 15 * 1024 * 1024) {
        setComposeFeedback({ type: 'error', message: `File "${file.name}" exceeds the 15MB limit.` });
        return;
      }
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const result = uploadEvent.target?.result as string;
        const base64Data = result.split(',')[1];
        setComposeAttachments(prev => [
          ...prev,
          {
            filename: file.name,
            contentType: file.type || 'application/octet-stream',
            content: base64Data
          }
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  // Send Email Handler
  const handleSendEmail = async (isDraft = false) => {
    setComposeFeedback(null);
    if (!isDraft && !composeTo.trim()) {
      setComposeFeedback({ type: 'error', message: 'Please enter at least one recipient email address.' });
      return;
    }

    setIsSending(true);
    try {
      const fromMailbox = mailboxes.find(m => m.id === (composeFromId || activeMailboxId)) || mailboxes[0];
      if (!fromMailbox) {
        setComposeFeedback({ type: 'error', message: 'No active sender mailbox selected.' });
        setIsSending(false);
        return;
      }

      const toList = composeTo.split(',').map(s => s.trim()).filter(Boolean);
      const ccList = composeCc ? composeCc.split(',').map(s => s.trim()).filter(Boolean) : [];

      const res = await authFetch('/api/mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAddress: fromMailbox.fullAddress,
          fromName: fromMailbox.displayName || fromMailbox.username,
          to: toList,
          cc: ccList,
          subject: composeSubject || '(No Subject)',
          bodyText: composeBody,
          attachments: composeAttachments,
          isDraft
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setComposeFeedback({ type: 'error', message: data.error || 'Failed to dispatch email.' });
      } else {
        setComposeFeedback({ type: 'success', message: isDraft ? 'Draft saved.' : 'Message dispatched successfully!' });
        setTimeout(() => {
          setIsComposing(false);
          setComposeTo('');
          setComposeCc('');
          setComposeSubject('');
          setComposeBody('');
          setComposeAttachments([]);
          setComposeFeedback(null);
          fetchEmails(true);
        }, 1200);
      }
    } catch {
      setComposeFeedback({ type: 'error', message: 'Error connecting to mail dispatch service.' });
    } finally {
      setIsSending(false);
    }
  };

  const folders: Array<{ id: EmailFolder; label: string; icon: any; countKey: keyof typeof folderCounts }> = [
    { id: 'inbox', label: 'Inbox', icon: Inbox, countKey: 'inbox' },
    { id: 'starred', label: 'Starred', icon: Star, countKey: 'starred' },
    { id: 'sent', label: 'Sent', icon: Send, countKey: 'sent' },
    { id: 'drafts', label: 'Drafts', icon: FileText, countKey: 'drafts' },
    { id: 'archive', label: 'Archive', icon: Archive, countKey: 'archive' },
    { id: 'spam', label: 'Spam', icon: AlertOctagon, countKey: 'spam' },
    { id: 'trash', label: 'Trash', icon: Trash2, countKey: 'trash' },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 font-sans">
      {/* 1. Left Sidebar: Folders & Mailboxes */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-40 w-64 border-r border-neutral-200 dark:border-neutral-800 
        bg-neutral-50 dark:bg-neutral-900 flex flex-col transition-transform duration-200 ease-in-out shrink-0
        ${mobileSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Brand header */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-sm text-neutral-900 dark:text-neutral-100">
            <div className="w-7 h-7 bg-neutral-900 dark:bg-white rounded-lg flex items-center justify-center text-white dark:text-neutral-900 shadow-xs">
              <Mail size={14} />
            </div>
            <span>CMNTY Mail</span>
          </Link>
          <Link 
            href="/dashboard" 
            className="p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
            title="Dashboard Overview"
          >
            <LayoutDashboard size={16} />
          </Link>
        </div>

        {/* Mailbox Selector */}
        <div className="p-3 border-b border-neutral-200 dark:border-neutral-800">
          <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
            Active Mailbox
          </label>
          <select 
            value={activeMailboxId}
            onChange={(e) => {
              setActiveMailboxId(e.target.value);
              setComposeFromId(e.target.value);
              setSelectedEmail(null);
            }}
            className="w-full px-2.5 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs font-bold text-neutral-800 dark:text-neutral-200 focus:outline-none"
          >
            {mailboxes.map(m => (
              <option key={m.id} value={m.id}>{m.fullAddress}</option>
            ))}
          </select>
        </div>

        {/* Full-Page Compose Trigger Button */}
        <div className="p-3">
          <button 
            onClick={() => {
              setIsComposing(true);
              setSelectedEmail(null);
              setMobileSidebarOpen(false);
            }}
            className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-100 dark:text-neutral-900 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all"
          >
            <Edit3 size={15} />
            New Message
          </button>
        </div>

        {/* Folder list */}
        <nav className="flex-1 px-2.5 py-2 space-y-0.5 overflow-y-auto">
          {folders.map(f => {
            const isActive = activeFolder === f.id && !isComposing;
            const count = folderCounts[f.countKey];
            return (
              <button
                key={f.id}
                onClick={() => {
                  setActiveFolder(f.id);
                  setSelectedEmail(null);
                  setIsComposing(false);
                  setMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive 
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs' 
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <f.icon size={15} />
                  <span>{f.label}</span>
                </div>
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                    isActive ? 'bg-white/20 text-white dark:bg-black/20 dark:text-neutral-900' : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Theme and footer */}
        <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-1 bg-neutral-200 dark:bg-neutral-800 p-1 rounded-lg">
            <button 
              onClick={() => setTheme('light')} 
              className={`p-1 rounded ${theme === 'light' ? 'bg-white dark:bg-neutral-700 shadow-xs' : 'text-neutral-400'}`}
              title="Light theme"
            >
              <Sun size={12} />
            </button>
            <button 
              onClick={() => setTheme('dark')} 
              className={`p-1 rounded ${theme === 'dark' ? 'bg-white dark:bg-neutral-700 shadow-xs' : 'text-neutral-400'}`}
              title="Dark theme"
            >
              <Moon size={12} />
            </button>
          </div>
          <span className="text-[10px] text-neutral-400">Webmail</span>
        </div>
      </aside>

      {/* Backdrop for Mobile Sidebar */}
      {mobileSidebarOpen && (
        <div 
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
        />
      )}

      {/* 2. Middle Pane: Email List (hidden on mobile if viewing email or composing) */}
      <div className={`
        w-full md:w-80 lg:w-96 border-r border-neutral-200 dark:border-neutral-800 flex flex-col shrink-0 bg-white dark:bg-neutral-950
        ${(selectedEmail || isComposing) ? 'hidden md:flex' : 'flex'}
      `}>
        {/* Top filter bar */}
        <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-2">
          <button 
            onClick={() => setMobileSidebarOpen(true)}
            className="md:hidden p-2 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <Menu size={16} />
          </button>
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" size={13} />
            <input 
              type="text" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search messages..."
              className="w-full pl-8 pr-3 py-1.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none"
            />
          </div>
          <button 
            onClick={() => fetchEmails(false)} 
            className="p-2 rounded-xl border border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
            title="Refresh emails"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Email items stream */}
        <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-900">
          {isLoading && emails.length === 0 ? (
            <div className="p-8 text-center text-xs text-neutral-400">Loading messages...</div>
          ) : emails.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <Mail size={24} className="mx-auto text-neutral-300 dark:text-neutral-700" />
              <p className="text-xs font-bold text-neutral-600 dark:text-neutral-400 capitalize">No messages in {activeFolder}</p>
              <p className="text-[11px] text-neutral-400">Incoming messages will show up in real-time.</p>
            </div>
          ) : (
            emails.map((email) => {
              const isSelected = selectedEmail?.id === email.id;
              return (
                <div
                  key={email.id}
                  onClick={() => handleSelectEmail(email)}
                  className={`p-3.5 cursor-pointer transition-colors space-y-1 ${
                    isSelected 
                      ? 'bg-neutral-100 dark:bg-neutral-900 border-l-2 border-l-neutral-900 dark:border-l-white' 
                      : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/50'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className={`truncate font-bold ${email.isRead ? 'text-neutral-600 dark:text-neutral-400' : 'text-neutral-900 dark:text-white'}`}>
                      {email.from.name || email.from.address}
                    </span>
                    <span className="text-[10px] text-neutral-400 font-mono shrink-0 ml-2">
                      {new Date(email.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <div className={`text-xs truncate ${email.isRead ? 'font-normal text-neutral-700 dark:text-neutral-300' : 'font-bold text-neutral-900 dark:text-white'}`}>
                    {email.subject || '(No Subject)'}
                  </div>
                  <div className="text-[11px] text-neutral-400 truncate leading-relaxed">
                    {email.bodyText.substring(0, 80) || 'Empty message body'}
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {email.attachments && email.attachments.length > 0 ? `📎 ${email.attachments.length}` : ''}
                    </span>
                    <button 
                      onClick={(e) => handleToggleStar(email, e)}
                      className="text-neutral-300 hover:text-amber-400"
                    >
                      <Star size={12} className={email.isStarred ? 'fill-amber-400 text-amber-400' : ''} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 3. Right Pane: Full-Page / Full-Pane Display (Reading or Full Compose) */}
      <div className={`
        flex-1 flex flex-col bg-white dark:bg-neutral-950 overflow-hidden min-w-0
        ${(!selectedEmail && !isComposing) ? 'hidden md:flex' : 'flex'}
      `}>
        {/* SCENARIO A: FULL-PAGE COMPOSE VIEW (NO POPUP!) */}
        {isComposing ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Compose Top Bar */}
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 shrink-0 bg-neutral-50 dark:bg-neutral-900 space-y-4">
              <button
                onClick={() => setIsComposing(false)}
                className="flex items-center gap-2 text-xs font-bold text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors w-fit"
              >
                <ArrowLeft size={14} /> Back to Inbox
              </button>

              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100">
                  New Message
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsComposing(false)}
                    className="px-3 py-1.5 text-xs font-bold text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                  >
                    Discard
                  </button>
                  <button
                    onClick={() => handleSendEmail(false)}
                    disabled={isSending}
                    className="px-5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:hover:bg-neutral-100 dark:text-neutral-900 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all disabled:opacity-50"
                  >
                    <Send size={13} className={isSending ? 'animate-spin' : ''} />
                    {isSending ? 'Send Message' : 'Send Message'}
                  </button>
                </div>
              </div>
            </div>

            {/* Notification / Feedback Banner */}
            {composeFeedback && (
              <div className={`p-3 text-xs font-bold flex items-center justify-between border-b ${
                composeFeedback.type === 'success' 
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-800' 
                  : 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950/80 dark:text-red-200 dark:border-red-800'
              }`}>
                <div className="flex items-center gap-2">
                  {composeFeedback.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                  <span>{composeFeedback.message}</span>
                </div>
                <button onClick={() => setComposeFeedback(null)}>
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Compose Form Fields */}
            <div className="p-6 space-y-4 flex-1 overflow-y-auto">
              {/* From Selector */}
              <div className="flex items-center gap-4 border-b border-neutral-100 dark:border-neutral-800 pb-3">
                <span className="text-xs font-bold text-neutral-400 w-16 shrink-0">From</span>
                <select
                  value={composeFromId}
                  onChange={(e) => setComposeFromId(e.target.value)}
                  className="flex-1 bg-transparent text-xs font-bold text-neutral-900 dark:text-neutral-100 focus:outline-none"
                >
                  {mailboxes.map(mb => (
                    <option key={mb.id} value={mb.id} className="bg-white dark:bg-neutral-900">
                      {mb.displayName ? `${mb.displayName} <${mb.fullAddress}>` : mb.fullAddress}
                    </option>
                  ))}
                </select>
              </div>

              {/* To field */}
              <div className="flex items-center gap-4 border-b border-neutral-100 dark:border-neutral-800 pb-3">
                <span className="text-xs font-bold text-neutral-400 w-16 shrink-0">To</span>
                <input 
                  type="text" 
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  placeholder="recipient@example.com (comma separated)"
                  required
                  className="flex-1 bg-transparent text-xs font-semibold text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none"
                />
                {!showCc && (
                  <button 
                    type="button" 
                    onClick={() => setShowCc(true)}
                    className="text-[10px] font-bold uppercase text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                  >
                    + Cc
                  </button>
                )}
              </div>

              {/* Cc field */}
              {showCc && (
                <div className="flex items-center gap-4 border-b border-neutral-100 dark:border-neutral-800 pb-3">
                  <span className="text-xs font-bold text-neutral-400 w-16 shrink-0">Cc</span>
                  <input 
                    type="text" 
                    value={composeCc}
                    onChange={(e) => setComposeCc(e.target.value)}
                    placeholder="cc@example.com"
                    className="flex-1 bg-transparent text-xs font-semibold text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none"
                  />
                  <button 
                    type="button" 
                    onClick={() => { setShowCc(false); setComposeCc(''); }}
                    className="text-neutral-400 hover:text-neutral-600"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Subject field */}
              <div className="flex items-center gap-4 border-b border-neutral-100 dark:border-neutral-800 pb-3">
                <span className="text-xs font-bold text-neutral-400 w-16 shrink-0">Subject</span>
                <input 
                  type="text" 
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Message subject line"
                  className="flex-1 bg-transparent text-xs font-bold text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none"
                />
              </div>

              {/* Body editor */}
              <textarea 
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                placeholder="Write your email body here..."
                className="w-full h-80 bg-transparent text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none resize-none leading-relaxed"
              ></textarea>

              {/* Attachments Section */}
              <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                    Attachments ({composeAttachments.length})
                  </span>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    multiple 
                    className="hidden" 
                  />
                  <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  >
                    <Paperclip size={13} /> Attach File
                  </button>
                </div>

                {composeAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {composeAttachments.map((att, idx) => (
                      <span 
                        key={idx}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-mono text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-neutral-700"
                      >
                        <Paperclip size={13} />
                        <span className="max-w-[160px] truncate">{att.filename}</span>
                        <button 
                          onClick={() => setComposeAttachments(prev => prev.filter((_, i) => i !== idx))}
                          className="hover:text-red-500 text-neutral-400"
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : selectedEmail ? (
          /* SCENARIO B: EMAIL READING PANE */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Reading header bar */}
            <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setSelectedEmail(null)} 
                  className="md:hidden p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800"
                  title="Back to email list"
                >
                  <ArrowLeft size={16} />
                </button>

                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => handleMoveFolder('archive')}
                    title="Archive" 
                    className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
                  >
                    <Archive size={15} />
                  </button>
                  <button 
                    onClick={() => handleMoveFolder('spam')}
                    title="Report Spam" 
                    className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
                  >
                    <AlertOctagon size={15} />
                  </button>
                  <button 
                    onClick={handleDeleteEmail}
                    title="Delete Message" 
                    className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                  <button 
                    onClick={() => handleToggleStar(selectedEmail)}
                    title={selectedEmail.isStarred ? 'Unstar' : 'Star'}
                    className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
                  >
                    <Star size={15} className={selectedEmail.isStarred ? 'fill-amber-400 text-amber-400' : ''} />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    setComposeTo(selectedEmail.from.address);
                    setComposeSubject(selectedEmail.subject.startsWith('Re:') ? selectedEmail.subject : `Re: ${selectedEmail.subject}`);
                    setComposeBody(`\n\n--- On ${new Date(selectedEmail.date).toLocaleString()}, ${selectedEmail.from.name || selectedEmail.from.address} wrote ---\n> ${selectedEmail.bodyText.replace(/\n/g, '\n> ')}`);
                    setIsComposing(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800"
                >
                  <Reply size={13} /> Reply
                </button>
              </div>
            </div>

            {/* Email Content Detail */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="space-y-3 border-b border-neutral-100 dark:border-neutral-800 pb-5">
                <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 leading-tight tracking-tight">
                  {selectedEmail.subject || '(No Subject)'}
                </h2>
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 flex items-center justify-center font-bold text-xs uppercase">
                      {(selectedEmail.from.name || selectedEmail.from.address)[0] || 'S'}
                    </div>
                    <div>
                      <div className="font-bold text-neutral-900 dark:text-neutral-100">
                        {selectedEmail.from.name || selectedEmail.from.address}
                      </div>
                      <div className="text-[11px] text-neutral-400 font-mono">
                        to {selectedEmail.to.join(', ')}
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] text-neutral-400 font-mono">
                    {new Date(selectedEmail.date).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Message Body */}
              <div className="text-xs sm:text-sm text-neutral-800 dark:text-neutral-200 leading-relaxed font-sans whitespace-pre-wrap">
                {selectedEmail.bodyText || 'No text content.'}
              </div>

              {/* Attachment Download list */}
              {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                <div className="pt-6 border-t border-neutral-100 dark:border-neutral-800 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                    Attachments ({selectedEmail.attachments.length})
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedEmail.attachments.map((att) => (
                      <div 
                        key={att.id}
                        className="p-3 bg-neutral-50 dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Paperclip size={14} className="text-neutral-400 shrink-0" />
                          <span className="truncate font-semibold">{att.filename}</span>
                        </div>
                        {att.dataBase64 && (
                          <a 
                            href={`data:${att.contentType};base64,${att.dataBase64}`}
                            download={att.filename}
                            className="p-1.5 text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                            title="Download"
                          >
                            <Download size={14} />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* SCENARIO C: EMPTY STATE (NO EMAIL SELECTED) */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center text-neutral-300 dark:text-neutral-700">
              <Mail size={24} />
            </div>
            <div className="font-bold text-sm text-neutral-700 dark:text-neutral-300">
              Select an email to read
            </div>
            <p className="text-xs text-neutral-400 max-w-xs">
              Choose a message from the list or click &quot;New Message&quot; to compose an email.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function WebmailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-neutral-400">Loading Webmail...</div>}>
      <WebmailContent />
    </Suspense>
  );
}

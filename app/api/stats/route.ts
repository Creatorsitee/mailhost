import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getDb();
  const currentUser = db.data.users.find(u => u.id === session.userId);

  const userDomains = currentUser?.role === 'admin'
    ? db.data.domains
    : db.data.domains.filter(d => d.userId === session.userId);

  const userMailboxes = currentUser?.role === 'admin'
    ? db.data.mailboxes
    : db.data.mailboxes.filter(m => m.userId === session.userId);

  const mailboxIds = userMailboxes.map(m => m.id);
  const userEmails = db.data.emails.filter(e => mailboxIds.includes(e.mailboxId));

  const totalStorageUsedBytes = userMailboxes.reduce((acc, m) => acc + (m.storageUsed || 0), 0);
  const totalStorageLimitBytes = userMailboxes.reduce((acc, m) => acc + (m.storageLimit || (5 * 1024 * 1024 * 1024)), 0);

  const usedMB = (totalStorageUsedBytes / (1024 * 1024)).toFixed(1);
  const usedGB = (totalStorageUsedBytes / (1024 * 1024 * 1024)).toFixed(2);
  const limitGB = (totalStorageLimitBytes / (1024 * 1024 * 1024)).toFixed(0);

  const storagePercent = totalStorageLimitBytes > 0 
    ? Math.min(100, Math.max(1, Math.round((totalStorageUsedBytes / totalStorageLimitBytes) * 100))) 
    : 1;

  const sentCount = userEmails.filter(e => e.folder === 'sent').length;
  const receivedCount = userEmails.filter(e => e.folder === 'inbox').length;

  const recentLogs = db.data.auditLogs
    .filter(l => currentUser?.role === 'admin' || l.userId === session.userId)
    .slice(0, 5);

  return NextResponse.json({
    totalDomains: userDomains.length,
    activeDomains: userDomains.filter(d => d.status === 'active').length,
    pendingDomains: userDomains.filter(d => d.status === 'pending' || d.status === 'verifying').length,
    totalMailboxes: userMailboxes.length,
    storage: {
      usedMB,
      usedGB,
      limitGB,
      percent: storagePercent,
      availablePercent: 100 - storagePercent
    },
    emails: {
      sent: sentCount,
      received: receivedCount,
      total: userEmails.length
    },
    recentLogs
  });
}

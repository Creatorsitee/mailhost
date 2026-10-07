import { NextRequest, NextResponse } from 'next/server';
import { getDb, saveDb, addAuditLog, EmailMessage } from '@/lib/db/db';
import { getSession } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const domainFilter = searchParams.get('domainId');

  const db = await getDb();
  const currentUser = db.data.users.find(u => u.id === session.userId);

  let userMailboxes = currentUser?.role === 'admin'
    ? db.data.mailboxes
    : db.data.mailboxes.filter(m => m.userId === session.userId);

  if (domainFilter && domainFilter !== 'all') {
    userMailboxes = userMailboxes.filter(m => m.domainId === domainFilter);
  }

  // Augment with domain name & unread count
  const enriched = userMailboxes.map(mb => {
    const domain = db.data.domains.find(d => d.id === mb.domainId);
    const unreadCount = db.data.emails.filter(e => e.mailboxId === mb.id && e.folder === 'inbox' && !e.isRead).length;
    const totalEmails = db.data.emails.filter(e => e.mailboxId === mb.id).length;
    return {
      ...mb,
      domainName: domain?.name || 'unknown',
      unreadCount,
      totalEmails
    };
  });

  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { username, domainId, password, storageLimit = 5, displayName } = body;

  if (!username || !domainId || !password) {
    return NextResponse.json({ error: 'Username, domain, and password are required' }, { status: 400 });
  }

  // Username validation: letters, numbers, dot, dash, underscore
  const cleanUsername = username.trim().toLowerCase();
  if (!/^[a-z0-9._-]+$/.test(cleanUsername)) {
    return NextResponse.json({ error: 'Username may only contain letters, numbers, dots, hyphens, and underscores' }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  }

  const db = await getDb();
  const domain = db.data.domains.find(d => d.id === domainId);
  if (!domain) {
    return NextResponse.json({ error: 'Selected domain does not exist' }, { status: 404 });
  }

  // Check authorization
  if (domain.userId !== session.userId) {
    const user = db.data.users.find(u => u.id === session.userId);
    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized to add mailbox to this domain' }, { status: 403 });
    }
  }

  const fullAddress = `${cleanUsername}@${domain.name}`;
  if (db.data.mailboxes.some(m => m.fullAddress.toLowerCase() === fullAddress)) {
    return NextResponse.json({ error: `Mailbox ${fullAddress} already exists` }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const quotaBytes = Number(storageLimit) * 1024 * 1024 * 1024;

  const newMailbox = {
    id: Math.random().toString(36).substring(7),
    domainId,
    userId: session.userId,
    username: cleanUsername,
    fullAddress,
    passwordHash,
    storageLimit: quotaBytes,
    storageUsed: 0,
    status: 'active' as const,
    displayName: displayName || cleanUsername,
    createdAt: new Date().toISOString(),
    lastLogin: 'Never'
  };

  db.data.mailboxes.push(newMailbox);

  // Send initial welcome message to mailbox
  const welcomeEmail: EmailMessage = {
    id: Math.random().toString(36).substring(7),
    mailboxId: newMailbox.id,
    folder: 'inbox',
    from: {
      name: 'CMNTY Mail Team',
      address: `postmaster@${domain.name}`
    },
    to: [fullAddress],
    subject: `Welcome to your new email: ${fullAddress}`,
    bodyText: `Hello and welcome!\n\nYour mailbox ${fullAddress} has been successfully provisioned on CMNTY Mail.\n\nMail Server Host: mail.${domain.name}\nWebmail Access: Ready\nStorage Quota: ${storageLimit} GB\n\nYou can now send and receive emails directly from CMNTY Webmail.`,
    bodyHtml: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background: #ffffff; color: #111827;">
        <h2 style="margin-top: 0; color: #111827;">Welcome to CMNTY Mail!</h2>
        <p>Your professional mailbox <strong>${fullAddress}</strong> is active and ready to use.</p>
        <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #f3f4f6;">
          <p style="margin: 4px 0;"><strong>Email Address:</strong> ${fullAddress}</p>
          <p style="margin: 4px 0;"><strong>Domain:</strong> ${domain.name}</p>
          <p style="margin: 4px 0;"><strong>Storage Quota:</strong> ${storageLimit} GB</p>
          <p style="margin: 4px 0;"><strong>Status:</strong> Active</p>
        </div>
        <p>Feel free to compose messages, organize folders, and invite contacts.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #6b7280; font-size: 12px; margin-bottom: 0;">CMNTY Mail — Professional Email Hosting for Your Domain.</p>
      </div>
    `,
    isRead: false,
    isStarred: true,
    messageId: `<welcome-${Date.now()}@${domain.name}>`,
    date: new Date().toISOString()
  };

  db.data.emails.push(welcomeEmail);
  newMailbox.storageUsed += 1500;

  await saveDb();
  await addAuditLog('mailbox.created', 'mailbox', `Created mailbox: ${fullAddress}`, session.userId);

  return NextResponse.json(newMailbox);
}

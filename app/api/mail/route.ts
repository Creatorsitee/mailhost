import { NextRequest, NextResponse } from 'next/server';
import { getDb, saveDb, EmailMessage, EmailFolder } from '@/lib/db/db';
import { getSession } from '@/lib/auth';
import { sendEmailWithFallback } from '@/lib/mail/mail-service';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const mailboxId = searchParams.get('mailboxId');
  const folder = (searchParams.get('folder') || 'inbox').toLowerCase() as EmailFolder;
  const search = searchParams.get('search')?.toLowerCase() || '';

  const db = await getDb();
  const currentUser = db.data.users.find(u => u.id === session.userId);

  // Get available mailboxes for this user
  const userMailboxes = currentUser?.role === 'admin'
    ? db.data.mailboxes
    : db.data.mailboxes.filter(m => m.userId === session.userId);

  if (userMailboxes.length === 0) {
    return NextResponse.json({
      emails: [],
      mailboxes: [],
      folderCounts: { inbox: 0, sent: 0, drafts: 0, starred: 0, archive: 0, spam: 0, trash: 0 }
    });
  }

  // Determine active mailbox
  const activeMailbox = mailboxId 
    ? userMailboxes.find(m => m.id === mailboxId) || userMailboxes[0]
    : userMailboxes[0];

  // Calculate folder counts for active mailbox
  const mailboxEmails = db.data.emails.filter(e => e.mailboxId === activeMailbox.id);
  const folderCounts = {
    inbox: mailboxEmails.filter(e => e.folder === 'inbox' && !e.isRead).length,
    sent: mailboxEmails.filter(e => e.folder === 'sent').length,
    drafts: mailboxEmails.filter(e => e.folder === 'drafts').length,
    starred: mailboxEmails.filter(e => e.isStarred && e.folder !== 'trash').length,
    archive: mailboxEmails.filter(e => e.folder === 'archive').length,
    spam: mailboxEmails.filter(e => e.folder === 'spam').length,
    trash: mailboxEmails.filter(e => e.folder === 'trash').length
  };

  // Filter emails for requested folder
  let filtered = mailboxEmails;
  if (folder === 'starred') {
    filtered = filtered.filter(e => e.isStarred && e.folder !== 'trash');
  } else {
    filtered = filtered.filter(e => e.folder === folder);
  }

  // Apply search query
  if (search) {
    filtered = filtered.filter(e => 
      e.subject.toLowerCase().includes(search) ||
      e.from.address.toLowerCase().includes(search) ||
      (e.from.name && e.from.name.toLowerCase().includes(search)) ||
      e.bodyText.toLowerCase().includes(search) ||
      e.to.some(t => t.toLowerCase().includes(search))
    );
  }

  // Sort descending by date
  filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return NextResponse.json({
    emails: filtered,
    activeMailbox: {
      id: activeMailbox.id,
      fullAddress: activeMailbox.fullAddress,
      username: activeMailbox.username,
      displayName: activeMailbox.displayName,
      storageUsed: activeMailbox.storageUsed,
      storageLimit: activeMailbox.storageLimit
    },
    mailboxes: userMailboxes.map(m => ({
      id: m.id,
      fullAddress: m.fullAddress,
      username: m.username,
      displayName: m.displayName
    })),
    folderCounts
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { 
    fromMailboxId, 
    to, 
    cc = [], 
    bcc = [], 
    subject, 
    bodyText, 
    bodyHtml, 
    attachments = [],
    isDraft = false
  } = body;

  const rawFromId = body.fromMailboxId || body.fromId;
  const rawFromAddress = body.fromAddress;

  const db = await getDb();
  const currentUser = db.data.users.find(u => u.id === session.userId);

  let senderMailbox = rawFromId ? db.data.mailboxes.find(m => m.id === rawFromId) : undefined;
  if (!senderMailbox && rawFromAddress) {
    senderMailbox = db.data.mailboxes.find(m => m.fullAddress.toLowerCase() === rawFromAddress.toLowerCase().trim());
  }
  if (!senderMailbox) {
    const userMailboxes = currentUser?.role === 'admin'
      ? db.data.mailboxes
      : db.data.mailboxes.filter(m => m.userId === session.userId);
    if (userMailboxes.length > 0) {
      senderMailbox = userMailboxes[0];
    }
  }

  if (!senderMailbox) {
    return NextResponse.json({ error: 'Sender mailbox required. Please create or select a mailbox first.' }, { status: 400 });
  }

  // Check authorization
  if (senderMailbox.userId !== session.userId) {
    const user = db.data.users.find(u => u.id === session.userId);
    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // If saving draft
  if (isDraft) {
    const draftEmail: EmailMessage = {
      id: body.draftId || Math.random().toString(36).substring(7),
      mailboxId: senderMailbox.id,
      folder: 'drafts',
      from: {
        name: senderMailbox.displayName || senderMailbox.username,
        address: senderMailbox.fullAddress
      },
      to: Array.isArray(to) ? to : (to ? [to] : []),
      cc: Array.isArray(cc) ? cc : [],
      bcc: Array.isArray(bcc) ? bcc : [],
      subject: subject || '(No Subject)',
      bodyText: bodyText || '',
      bodyHtml: bodyHtml || bodyText || '',
      attachments: attachments.map((a: any) => ({
        id: Math.random().toString(36).substring(7),
        filename: a.filename,
        contentType: a.contentType || 'application/octet-stream',
        size: Math.round((a.content?.length || 0) * 0.75),
        dataBase64: a.content
      })),
      isRead: true,
      isStarred: false,
      messageId: `<draft-${Date.now()}@cmnty.mail>`,
      date: new Date().toISOString()
    };

    // If updating existing draft
    if (body.draftId) {
      const idx = db.data.emails.findIndex(e => e.id === body.draftId && e.mailboxId === senderMailbox.id);
      if (idx !== -1) {
        db.data.emails[idx] = draftEmail;
      } else {
        db.data.emails.push(draftEmail);
      }
    } else {
      db.data.emails.push(draftEmail);
    }

    await saveDb();
    return NextResponse.json({ success: true, email: draftEmail });
  }

  // SENDING EMAIL
  const recipientList = Array.isArray(to) ? to : [to];
  const validRecipients = recipientList.map((r: string) => r.trim()).filter(Boolean);

  if (validRecipients.length === 0) {
    return NextResponse.json({ error: 'At least one recipient is required' }, { status: 400 });
  }

  if (!subject && !bodyText) {
    return NextResponse.json({ error: 'Subject or message body is required' }, { status: 400 });
  }

  // Perform delivery with fallback
  const sendResult = await sendEmailWithFallback({
    fromAddress: senderMailbox.fullAddress,
    fromName: senderMailbox.displayName || senderMailbox.username,
    to: validRecipients,
    cc: Array.isArray(cc) ? cc : [],
    bcc: Array.isArray(bcc) ? bcc : [],
    subject: subject || '(No Subject)',
    bodyText: bodyText || '',
    bodyHtml: bodyHtml || bodyText || '',
    attachments: attachments
  });

  // Save to sender's "Sent" folder
  const sentEmail: EmailMessage = {
    id: Math.random().toString(36).substring(7),
    mailboxId: senderMailbox.id,
    folder: 'sent',
    from: {
      name: senderMailbox.displayName || senderMailbox.username,
      address: senderMailbox.fullAddress
    },
    to: validRecipients,
    cc: Array.isArray(cc) ? cc : [],
    bcc: Array.isArray(bcc) ? bcc : [],
    subject: subject || '(No Subject)',
    bodyText: bodyText || '',
    bodyHtml: bodyHtml || bodyText || '',
    attachments: attachments.map((a: any) => ({
      id: Math.random().toString(36).substring(7),
      filename: a.filename,
      contentType: a.contentType || 'application/octet-stream',
      size: Math.round((a.content?.length || 0) * 0.75),
      dataBase64: a.content
    })),
    isRead: true,
    isStarred: false,
    messageId: sendResult.messageId,
    date: new Date().toISOString()
  };

  db.data.emails.push(sentEmail);
  senderMailbox.storageUsed += (bodyText?.length || 0) + 1024;

  // If this was converted from a draft, delete the draft
  if (body.draftId) {
    db.data.emails = db.data.emails.filter(e => e.id !== body.draftId);
  }

  await saveDb();

  return NextResponse.json({
    success: true,
    email: sentEmail,
    note: sendResult.note
  });
}

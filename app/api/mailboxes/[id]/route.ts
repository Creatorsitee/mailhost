import { NextRequest, NextResponse } from 'next/server';
import { getDb, saveDb, addAuditLog } from '@/lib/db/db';
import { getSession } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = await getDb();
  const mailbox = db.data.mailboxes.find(m => m.id === id);

  if (!mailbox) return NextResponse.json({ error: 'Mailbox not found' }, { status: 404 });
  if (mailbox.userId !== session.userId) {
    const user = db.data.users.find(u => u.id === session.userId);
    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // Remove hash from output
  const { passwordHash: _, ...safeMailbox } = mailbox;
  return NextResponse.json(safeMailbox);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = await getDb();
  const mailbox = db.data.mailboxes.find(m => m.id === id);

  if (!mailbox) return NextResponse.json({ error: 'Mailbox not found' }, { status: 404 });
  if (mailbox.userId !== session.userId) {
    const user = db.data.users.find(u => u.id === session.userId);
    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const body = await req.json();

  if (body.password) {
    if (body.password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }
    mailbox.passwordHash = await bcrypt.hash(body.password, 10);
    await addAuditLog('mailbox.password_changed', 'mailbox', `Changed password for ${mailbox.fullAddress}`, session.userId);
  }

  if (body.storageLimit && Number(body.storageLimit) > 0) {
    mailbox.storageLimit = Number(body.storageLimit) * 1024 * 1024 * 1024;
  }

  if (body.status === 'active' || body.status === 'suspended') {
    mailbox.status = body.status;
    await addAuditLog('mailbox.status_changed', 'mailbox', `Status changed to ${body.status} for ${mailbox.fullAddress}`, session.userId);
  }

  if (body.displayName !== undefined) {
    mailbox.displayName = body.displayName;
  }

  await saveDb();
  const { passwordHash: _, ...safeMailbox } = mailbox;
  return NextResponse.json(safeMailbox);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = await getDb();
  const index = db.data.mailboxes.findIndex(m => m.id === id);

  if (index === -1) return NextResponse.json({ error: 'Mailbox not found' }, { status: 404 });
  const mailbox = db.data.mailboxes[index];

  if (mailbox.userId !== session.userId) {
    const user = db.data.users.find(u => u.id === session.userId);
    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // Delete all emails belonging to this mailbox
  db.data.emails = db.data.emails.filter(e => e.mailboxId !== id);
  db.data.mailboxes.splice(index, 1);

  await saveDb();
  await addAuditLog('mailbox.deleted', 'mailbox', `Deleted mailbox: ${mailbox.fullAddress}`, session.userId);

  return NextResponse.json({ success: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { getDb, saveDb, addAuditLog } from '@/lib/db/db';
import { getSession } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = await getDb();
  const domain = db.data.domains.find(d => d.id === id);

  if (!domain) return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
  if (domain.userId !== session.userId) {
    const user = db.data.users.find(u => u.id === session.userId);
    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const mailboxes = db.data.mailboxes.filter(m => m.domainId === id);
  return NextResponse.json({ ...domain, mailboxes });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = await getDb();
  const domainIdx = db.data.domains.findIndex(d => d.id === id);

  if (domainIdx === -1) return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
  const domain = db.data.domains[domainIdx];

  if (domain.userId !== session.userId) {
    const user = db.data.users.find(u => u.id === session.userId);
    if (user?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // Cascade delete mailboxes & emails
  const mailboxIds = db.data.mailboxes.filter(m => m.domainId === id).map(m => m.id);
  db.data.emails = db.data.emails.filter(e => !mailboxIds.includes(e.mailboxId));
  db.data.mailboxes = db.data.mailboxes.filter(m => m.domainId !== id);
  db.data.domains.splice(domainIdx, 1);

  await saveDb();
  await addAuditLog('domain.deleted', 'domain', `Deleted domain ${domain.name} and associated mailboxes`, session.userId);

  return NextResponse.json({ success: true });
}

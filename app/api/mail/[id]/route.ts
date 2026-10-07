import { NextRequest, NextResponse } from 'next/server';
import { getDb, saveDb, EmailFolder } from '@/lib/db/db';
import { getSession } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = await getDb();
  const email = db.data.emails.find(e => e.id === id);

  if (!email) return NextResponse.json({ error: 'Email not found' }, { status: 404 });

  // Mark as read
  if (!email.isRead) {
    email.isRead = true;
    await saveDb();
  }

  return NextResponse.json(email);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = await getDb();
  const email = db.data.emails.find(e => e.id === id);

  if (!email) return NextResponse.json({ error: 'Email not found' }, { status: 404 });

  const body = await req.json();

  if (typeof body.isStarred === 'boolean') {
    email.isStarred = body.isStarred;
  }

  if (typeof body.isRead === 'boolean') {
    email.isRead = body.isRead;
  }

  if (body.folder) {
    const validFolders: EmailFolder[] = ['inbox', 'sent', 'drafts', 'archive', 'spam', 'trash'];
    if (validFolders.includes(body.folder)) {
      email.folder = body.folder;
    }
  }

  await saveDb();
  return NextResponse.json(email);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = await getDb();
  const index = db.data.emails.findIndex(e => e.id === id);

  if (index === -1) return NextResponse.json({ error: 'Email not found' }, { status: 404 });

  const email = db.data.emails[index];

  // If not already in trash, soft delete to trash
  if (email.folder !== 'trash') {
    email.folder = 'trash';
    await saveDb();
    return NextResponse.json({ success: true, movedToTrash: true });
  }

  // If already in trash, delete permanently
  db.data.emails.splice(index, 1);
  await saveDb();
  return NextResponse.json({ success: true, permanentlyDeleted: true });
}

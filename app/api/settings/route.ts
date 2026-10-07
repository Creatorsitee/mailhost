import { NextRequest, NextResponse } from 'next/server';
import { getDb, saveDb } from '@/lib/db/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getDb();
  return NextResponse.json(db.data.settings);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const db = await getDb();
  
  db.data.settings = {
    ...db.data.settings,
    ...body,
    setupCompleted: true
  };
  
  await saveDb();
  return NextResponse.json({ success: true });
}

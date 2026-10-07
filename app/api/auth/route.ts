import { NextRequest, NextResponse } from 'next/server';
import { getDb, saveDb, addAuditLog, initializeSystem } from '@/lib/db/db';
import bcrypt from 'bcryptjs';
import { createSession, getSession, deleteSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const db = await getDb();
  const user = db.data.users.find(u => u.id === session.userId);
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt
    }
  });
}

export async function POST(req: NextRequest) {
  await initializeSystem();
  const body = await req.json();
  const { email, password, action } = body;

  const db = await getDb();

  // 1. LOGOUT
  if (action === 'logout') {
    const session = await getSession();
    if (session) {
      await addAuditLog('auth.logout', 'auth', 'User logged out', session.userId);
    }
    await deleteSession();
    return NextResponse.json({ success: true });
  }

  // 2. REGISTER
  if (action === 'register') {
    if (!email || !password || password.length < 6) {
      return NextResponse.json({ error: 'Valid email and password (min 6 chars) required' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = db.data.users.find(u => u.email.toLowerCase() === cleanEmail);
    if (existing) {
      return NextResponse.json({ error: 'Email address already registered' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const isFirstUser = db.data.users.length === 0;
    const newUser = {
      id: Math.random().toString(36).substring(7),
      email: cleanEmail,
      passwordHash,
      role: (isFirstUser ? 'admin' : 'user') as 'admin' | 'user',
      createdAt: new Date().toISOString()
    };

    db.data.users.push(newUser);
    await saveDb();
    const token = await createSession(newUser.id);
    await addAuditLog('auth.registered', 'auth', `Registered new account (${newUser.role}): ${cleanEmail}`, newUser.id);

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role
      }
    });
  }

  // 3. LOGIN
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  const cleanEmail = email.trim().toLowerCase();
  const user = db.data.users.find(u => u.email.toLowerCase() === cleanEmail);

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  const token = await createSession(user.id);
  await addAuditLog('auth.login', 'auth', `User logged in: ${cleanEmail}`, user.id);

  return NextResponse.json({
    success: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role
    }
  });
}

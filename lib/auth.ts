import jwt from 'jsonwebtoken';
import { cookies, headers } from 'next/headers';

const JWT_SECRET = process.env.SESSION_SECRET || 'cmnty-mail-secret-key-9823471092';

export function signUserToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '365d' });
}

export async function createSession(userId: string): Promise<string> {
  const token = signUserToken(userId);
  try {
    const cookieStore = await cookies();
    cookieStore.set('session', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: 60 * 60 * 24 * 365 // 1 year persistent login
    });
  } catch (e) {
    // If setting cookie fails in certain contexts, token is returned for client-side storage
  }
  return token;
}

export async function getSession(): Promise<{ userId: string } | null> {
  try {
    // 1. Check Authorization header first (most reliable in iframe/cross-site environments)
    const headerStore = await headers();
    const authHeader = headerStore.get('authorization') || headerStore.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const bearerToken = authHeader.substring(7).trim();
      if (bearerToken && bearerToken !== 'null' && bearerToken !== 'undefined') {
        try {
          return jwt.verify(bearerToken, JWT_SECRET) as { userId: string };
        } catch {
          // Token invalid, fallback to cookie
        }
      }
    }

    // 2. Check Cookie store
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    if (token) {
      try {
        return jwt.verify(token, JWT_SECRET) as { userId: string };
      } catch {
        return null;
      }
    }

    return null;
  } catch {
    return null;
  }
}

export async function deleteSession() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('session');
  } catch {}
}

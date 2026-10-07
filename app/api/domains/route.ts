import { NextRequest, NextResponse } from 'next/server';
import { getDb, saveDb, addAuditLog, initializeSystem } from '@/lib/db/db';
import { getSession } from '@/lib/auth';
import { generateDkimKeys, verifyDomainDns } from '@/lib/dns/dns-service';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initializeSystem();
  const db = await getDb();
  
  // Return domains owned by current user (or all if admin)
  const currentUser = db.data.users.find(u => u.id === session.userId);
  const userDomains = currentUser?.role === 'admin'
    ? db.data.domains
    : db.data.domains.filter(d => d.userId === session.userId);

  // Augment with mailbox count
  const withMailboxCount = userDomains.map(d => {
    const mailboxCount = db.data.mailboxes.filter(m => m.domainId === d.id).length;
    return {
      ...d,
      mailboxCount
    };
  });

  return NextResponse.json(withMailboxCount);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await initializeSystem();
  const { name } = await req.json();

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'Domain name is required' }, { status: 400 });
  }

  // Normalize domain: trim, lowercase, strip http://, https://, trailing slashes, www.
  const normalized = name.trim().toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
    .trim();

  // Validate domain format
  const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;
  if (!domainRegex.test(normalized) || normalized.includes('localhost') || /^(\d{1,3}\.){3}\d{1,3}$/.test(normalized)) {
    return NextResponse.json({ error: 'Invalid domain format. Must be a valid domain name like example.com (no localhost or IP).' }, { status: 400 });
  }

  const db = await getDb();
  if (db.data.domains.some(d => d.name === normalized)) {
    return NextResponse.json({ error: 'Domain is already registered in CMNTY Mail' }, { status: 409 });
  }

  // Generate real unique DKIM RSA key pair
  const dkim = generateDkimKeys();
  const mailServerIp = db.data.settings.serverIp || '127.0.0.1';
  const mailHost = `mail.${normalized}`;

  const newDomain = {
    id: Math.random().toString(36).substring(7),
    userId: session.userId,
    name: normalized,
    status: 'pending' as const,
    dnsConfig: {
      mx: {
        host: '@',
        priority: 10,
        value: mailHost
      },
      spf: `v=spf1 ip4:${mailServerIp} ~all`,
      dkim: {
        selector: dkim.selector,
        publicKey: dkim.publicKey,
        privateKey: dkim.privateKey
      },
      dmarc: `v=DMARC1; p=quarantine; rua=mailto:admin@${normalized}`,
      a: {
        host: 'mail',
        value: mailServerIp
      },
      mailServerIp,
      mailHost
    },
    dnsStatus: {
      aRecord: false,
      mx: false,
      spf: false,
      dkim: false,
      dmarc: false,
      details: 'Pending initial verification'
    },
    createdAt: new Date().toISOString()
  };

  db.data.domains.push(newDomain);
  await saveDb();
  await addAuditLog('domain.created', 'domain', `Added domain: ${normalized}`, session.userId);

  // Trigger quick initial verification in background
  verifyDomainDns(normalized).then(async (status) => {
    const freshDb = await getDb();
    const d = freshDb.data.domains.find(item => item.id === newDomain.id);
    if (d) {
      d.dnsStatus = status;
      const verifiedCount = [status.aRecord, status.mx, status.spf, status.dkim, status.dmarc].filter(Boolean).length;
      if (verifiedCount === 5) {
        d.status = 'active';
      } else if (verifiedCount > 0) {
        d.status = 'dns_error';
      } else {
        d.status = 'pending';
      }
      await saveDb();
    }
  }).catch(() => {});

  return NextResponse.json(newDomain);
}

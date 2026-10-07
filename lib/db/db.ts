import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import path from 'path';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'user';
  createdAt: string;
}

export interface DnsCheckStatus {
  mx: boolean;
  spf: boolean;
  dkim: boolean;
  dmarc: boolean;
  aRecord?: boolean;
  lastChecked?: string;
  details?: string;
}

export interface Domain {
  id: string;
  userId: string;
  name: string;
  status: 'pending' | 'verifying' | 'active' | 'dns_error' | 'suspended';
  dnsConfig: {
    mx: { host: string; priority: number; value: string };
    spf: string;
    dkim: { selector: string; publicKey: string; privateKey: string };
    dmarc: string;
    mailServerIp: string;
    mailHost: string;
  };
  dnsStatus?: DnsCheckStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface Mailbox {
  id: string;
  domainId: string;
  userId: string;
  username: string;
  fullAddress: string;
  passwordHash: string;
  storageLimit: number; 
  storageUsed: number; 
  status: 'active' | 'suspended';
  displayName?: string;
  signature?: string;
  autoReply?: {
    enabled: boolean;
    subject: string;
    body: string;
  };
  createdAt: string;
  lastLogin?: string;
}

export interface EmailAttachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  dataBase64?: string;
}

export type EmailFolder = 'inbox' | 'sent' | 'drafts' | 'starred' | 'archive' | 'spam' | 'trash';

export interface EmailMessage {
  id: string;
  mailboxId: string; 
  folder: EmailFolder;
  from: {
    name?: string;
    address: string;
  };
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyText: string;
  bodyHtml: string;
  attachments?: EmailAttachment[];
  isRead: boolean;
  isStarred: boolean;
  messageId: string;
  date: string;
  inReplyTo?: string;
  references?: string;
}

export interface SystemSettings {
  serverIp: string;
  mailHostname: string;
  sessionSecret: string;
  masterKey: string;
  smtpHost: string;
  smtpPort: number;
  imapHost: string;
  imapPort: number;
  setupCompleted: boolean;
}

export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  entity: 'domain' | 'mailbox' | 'email' | 'auth' | 'system';
  details: string;
  timestamp: string;
}

export interface Data {
  users: User[];
  domains: Domain[];
  mailboxes: Mailbox[];
  emails: EmailMessage[];
  settings: SystemSettings;
  auditLogs: AuditLog[];
}

const defaultData: Data = {
  users: [],
  domains: [],
  mailboxes: [],
  emails: [],
  settings: {
    serverIp: '0.0.0.0',
    mailHostname: 'mail.cmnty.io',
    sessionSecret: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
    masterKey: Math.random().toString(36).substring(2, 15),
    smtpHost: '127.0.0.1',
    smtpPort: 587,
    imapHost: '127.0.0.1',
    imapPort: 993,
    setupCompleted: false
  },
  auditLogs: []
};

const file = path.join(process.cwd(), 'db.json');
const adapter = new JSONFile<Data>(file);
const db = new Low<Data>(adapter, defaultData);

let isInitialized = false;

export async function getDb(): Promise<Low<Data>> {
  await db.read();
  if (!db.data) {
    db.data = defaultData;
  }
  if (!db.data.emails) {
    db.data.emails = [];
  }
  if (!db.data.domains) {
    db.data.domains = [];
  }
  if (!db.data.mailboxes) {
    db.data.mailboxes = [];
  }
  if (!db.data.users) {
    db.data.users = [];
  }
  if (!db.data.auditLogs) {
    db.data.auditLogs = [];
  }
  return db;
}

export async function saveDb() {
  await db.write();
}

export async function addAuditLog(action: string, entity: AuditLog['entity'], details: string, userId?: string) {
  try {
    const database = await getDb();
    database.data.auditLogs.unshift({
      id: Math.random().toString(36).substring(7),
      userId,
      action,
      entity,
      details,
      timestamp: new Date().toISOString()
    });
    if (database.data.auditLogs.length > 200) {
      database.data.auditLogs = database.data.auditLogs.slice(0, 200);
    }
    await saveDb();
  } catch (e) {
    console.error('Audit log failed:', e);
  }
}

export async function initializeSystem() {
  if (isInitialized) return;
  isInitialized = true;
  try {
    const database = await getDb();
    
    if (database.data.settings.serverIp === '0.0.0.0' || !database.data.settings.serverIp) {
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
        if (ipRes.ok) {
          const { ip } = await ipRes.json();
          database.data.settings.serverIp = ip;
          if (!database.data.settings.mailHostname || database.data.settings.mailHostname.includes('cmnty.local')) {
            database.data.settings.mailHostname = `mail.${ip.replace(/\./g, '-')}.cmnty.io`;
          }
        } else {
          throw new Error('IP detection failed');
        }
      } catch {
        database.data.settings.serverIp = '127.0.0.1';
        database.data.settings.mailHostname = 'mail.cmnty.local';
      }
    }

    if (!database.data.settings.smtpHost) {
      database.data.settings.smtpHost = '127.0.0.1';
      database.data.settings.smtpPort = 2525; 
    }
    if (!database.data.settings.imapHost) {
      database.data.settings.imapHost = '127.0.0.1';
      database.data.settings.imapPort = 993;
    }
    
    database.data.settings.setupCompleted = true;
    await saveDb();
  } catch (err) {
    console.error('Initialization error:', err);
  }
}

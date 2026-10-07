import nodemailer from 'nodemailer';
import { getDb, saveDb, EmailMessage, addAuditLog } from '@/lib/db/db';
import dns from 'dns/promises';

export interface SendMailParams {
  fromAddress: string;
  fromName?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  attachments?: Array<{
    filename: string;
    contentType: string;
    content: string; 
  }>;
}

export async function sendEmailWithFallback(params: SendMailParams): Promise<{ success: boolean; externalSent: boolean; messageId: string; note?: string }> {
  const db = await getDb();
  const settings = db.data.settings;
  const messageId = `<${Date.now()}.${Math.random().toString(36).substring(7)}@cmnty.mail>`;

  const allRecipients = [...params.to, ...(params.cc || []), ...(params.bcc || [])];
  let internalDeliveredCount = 0;

  for (const rec of allRecipients) {
    const cleanRec = rec.trim().toLowerCase();
    const targetMailbox = db.data.mailboxes.find(m => m.fullAddress.toLowerCase() === cleanRec);
    if (targetMailbox) {
      const incomingEmail: EmailMessage = {
        id: Math.random().toString(36).substring(7),
        mailboxId: targetMailbox.id,
        folder: 'inbox',
        from: {
          name: params.fromName,
          address: params.fromAddress
        },
        to: params.to,
        cc: params.cc,
        bcc: params.bcc,
        subject: params.subject,
        bodyText: params.bodyText,
        bodyHtml: params.bodyHtml || `<div>${params.bodyText.replace(/\n/g, '<br/>')}</div>`,
        attachments: params.attachments?.map(a => ({
          id: Math.random().toString(36).substring(7),
          filename: a.filename,
          contentType: a.contentType,
          size: Math.round((a.content.length * 3) / 4),
          dataBase64: a.content
        })),
        isRead: false,
        isStarred: false,
        messageId,
        date: new Date().toISOString()
      };
      db.data.emails.push(incomingEmail);
      targetMailbox.storageUsed += params.bodyText.length + 1024;
      internalDeliveredCount++;
    }
  }

  const externalRecipients = allRecipients.filter(rec => {
    const domain = rec.split('@')[1]?.toLowerCase();
    return !db.data.domains.some(d => d.name.toLowerCase() === domain);
  });

  if (externalRecipients.length === 0) {
    await saveDb();
    return { success: true, externalSent: false, messageId, note: `Internal delivery to ${internalDeliveredCount} recipients.` };
  }

  const senderDomainName = params.fromAddress.split('@')[1];
  const senderDomain = db.data.domains.find(d => d.name.toLowerCase() === senderDomainName?.toLowerCase());

  let externalSent = false;
  let externalError: string | undefined;

  try {
    const isInternalDefault = settings.smtpHost === '127.0.0.1' || !settings.masterKey;
    
    if (isInternalDefault) {
      const domains = [...new Set(externalRecipients.map(r => r.split('@')[1].toLowerCase()))];
      
      for (const targetDomain of domains) {
        try {
          const mxRecords = await dns.resolveMx(targetDomain);
          if (!mxRecords || mxRecords.length === 0) throw new Error(`No MX records for ${targetDomain}`);
          
          mxRecords.sort((a, b) => a.priority - b.priority);
          const bestMx = mxRecords[0].exchange;

          const transporter = nodemailer.createTransport({
            host: bestMx,
            port: 25,
            secure: false,
            tls: { rejectUnauthorized: false },
            dkim: senderDomain?.dnsConfig?.dkim?.privateKey ? {
              domainName: senderDomain.name,
              keySelector: senderDomain.dnsConfig.dkim.selector || 'mail',
              privateKey: senderDomain.dnsConfig.dkim.privateKey
            } : undefined
          });

          const mailOptions = {
            from: params.fromName ? `"${params.fromName}" <${params.fromAddress}>` : params.fromAddress,
            to: externalRecipients.filter(r => r.endsWith(targetDomain)).join(', '),
            subject: params.subject,
            text: params.bodyText,
            html: params.bodyHtml || `<div>${params.bodyText.replace(/\n/g, '<br/>')}</div>`,
            messageId,
            attachments: params.attachments?.map(a => ({
              filename: a.filename,
              content: Buffer.from(a.content, 'base64'),
              contentType: a.contentType
            }))
          };

          await transporter.sendMail(mailOptions);
          externalSent = true;
        } catch (e: any) {
          console.error(`Direct delivery to ${targetDomain} failed:`, e.message);
          externalError = `Direct delivery failed: ${e.message}`;
        }
      }
    } else {
      const transporter = nodemailer.createTransport({
        host: settings.smtpHost,
        port: settings.smtpPort,
        secure: settings.smtpPort === 465,
        auth: {
          user: params.fromAddress,
          pass: settings.masterKey
        },
        tls: { rejectUnauthorized: false },
        dkim: senderDomain?.dnsConfig?.dkim?.privateKey ? {
          domainName: senderDomain.name,
          keySelector: senderDomain.dnsConfig.dkim.selector || 'mail',
          privateKey: senderDomain.dnsConfig.dkim.privateKey
        } : undefined
      });

      await transporter.sendMail({
        from: params.fromName ? `"${params.fromName}" <${params.fromAddress}>` : params.fromAddress,
        to: params.to.join(', '),
        cc: params.cc?.join(', '),
        bcc: params.bcc?.join(', '),
        subject: params.subject,
        text: params.bodyText,
        html: params.bodyHtml || `<div>${params.bodyText.replace(/\n/g, '<br/>')}</div>`,
        messageId,
        attachments: params.attachments?.map(a => ({
          filename: a.filename,
          content: Buffer.from(a.content, 'base64'),
          contentType: a.contentType
        }))
      });
      externalSent = true;
    }
  } catch (err: any) {
    externalError = err.message || 'SMTP offline';
  }

  await saveDb();
  await addAuditLog('email.sent', 'email', `From: ${params.fromAddress} to ${params.to.join(', ')} (external: ${externalSent ? 'OK' : externalError}, internal: ${internalDeliveredCount})`);

  return {
    success: true,
    externalSent,
    messageId,
    note: externalSent 
      ? 'Email berhasil dikirim secara real-time.' 
      : internalDeliveredCount > 0 
        ? `Terkirim ke ${internalDeliveredCount} mailbox internal.` 
        : `Disimpan di folder Outbox (Pengiriman tertunda: ${externalError}).`
  };
}

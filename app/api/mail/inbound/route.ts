import { NextRequest, NextResponse } from 'next/server';
import { getDb, saveDb, EmailMessage, addAuditLog } from '@/lib/db/db';

export const dynamic = 'force-dynamic';

/**
 * Inbound Email Webhook API
 * Supports incoming emails from Cloudflare Email Routing, SendGrid, Mailgun, Postmark, or custom SMTP forwarders.
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let body: any = {};

    if (contentType.includes('application/json')) {
      body = await req.json();
    } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      body = {
        to: formData.get('to') || formData.get('recipient'),
        from: formData.get('from') || formData.get('sender'),
        fromName: formData.get('fromName'),
        subject: formData.get('subject') || '(No Subject)',
        bodyText: formData.get('bodyText') || formData.get('text') || formData.get('body-plain') || '',
        bodyHtml: formData.get('bodyHtml') || formData.get('html') || formData.get('body-html') || '',
      };
    } else {
      body = await req.json().catch(() => ({}));
    }

    const rawTo = body.to || body.recipient || '';
    const rawFrom = body.from || body.sender || '';
    const subject = body.subject || '(No Subject)';
    const text = body.bodyText || body.text || body['body-plain'] || '';
    const html = body.bodyHtml || body.html || body['body-html'] || `<div>${text.replace(/\n/g, '<br/>')}</div>`;

    if (!rawTo) {
      return NextResponse.json({ error: 'Recipient "to" address is required' }, { status: 400 });
    }

    const recipients = Array.isArray(rawTo) ? rawTo : [rawTo];
    const db = await getDb();
    let deliveredCount = 0;

    for (const recipient of recipients) {
      // Extract clean email address
      const addressMatch = recipient.match(/<([^>]+)>/) || [null, recipient];
      const cleanAddress = (addressMatch[1] || recipient).trim().toLowerCase();

      const targetMailbox = db.data.mailboxes.find(m => m.fullAddress.toLowerCase() === cleanAddress);
      if (targetMailbox) {
        // Extract sender address & name
        const fromMatch = rawFrom.match(/^(.*?)(?:<([^>]+)>)?$/);
        const fromName = body.fromName || (fromMatch ? fromMatch[1]?.trim().replace(/^"|"$/g, '') : undefined);
        const fromAddress = fromMatch && fromMatch[2] ? fromMatch[2].trim() : rawFrom.trim();

        const incomingEmail: EmailMessage = {
          id: Math.random().toString(36).substring(7),
          mailboxId: targetMailbox.id,
          folder: 'inbox',
          from: {
            name: fromName || fromAddress,
            address: fromAddress
          },
          to: [cleanAddress],
          subject: subject,
          bodyText: text,
          bodyHtml: html,
          attachments: Array.isArray(body.attachments) ? body.attachments.map((a: any) => ({
            id: Math.random().toString(36).substring(7),
            filename: a.filename || 'attachment',
            contentType: a.contentType || 'application/octet-stream',
            size: a.size || Math.round((a.content?.length || 0) * 0.75),
            dataBase64: a.content || a.dataBase64
          })) : [],
          isRead: false,
          isStarred: false,
          messageId: body.messageId || `<inbound-${Date.now()}@cmnty.mail>`,
          date: body.date || new Date().toISOString()
        };

        db.data.emails.push(incomingEmail);
        targetMailbox.storageUsed += (text.length || 0) + 1024;
        deliveredCount++;
        await addAuditLog('email.inbound', 'email', `Inbound email delivered to ${cleanAddress} from ${fromAddress}`);
      }
    }

    await saveDb();

    if (deliveredCount === 0) {
      return NextResponse.json({ 
        success: false, 
        message: `No active mailbox found matching address: ${recipients.join(', ')}` 
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      deliveredTo: deliveredCount,
      message: `Delivered to ${deliveredCount} mailbox(es)`
    });
  } catch (error: any) {
    console.error('Inbound webhook error:', error);
    return NextResponse.json({ error: error.message || 'Internal processing error' }, { status: 500 });
  }
}

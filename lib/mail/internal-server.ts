import { SMTPServer } from 'smtp-server';
import { simpleParser } from 'mailparser';
import { getDb, saveDb, EmailMessage, addAuditLog } from '../db/db';

/**
 * THIS IS A LOCAL SMTP RECEIVER
 * It allows the app to receive emails if Port 25 is forwarded to this app's port (via proxy or VPS).
 * Receives incoming SMTP traffic and stores real emails directly into the mailbox inbox in db.json!
 */

export const startInternalSmtpServer = () => {
  try {
    const server = new SMTPServer({
      authOptional: true,
      onData(stream, session, callback) {
        simpleParser(stream, async (err, parsed) => {
          if (err) return callback(err);

          try {
            const db = await getDb();
            const to = parsed.to;
            
            if (to) {
              const recipients = Array.isArray(to) ? to : [to];
              for (const recipient of recipients) {
                const address = recipient.text?.trim().toLowerCase();
                const mailbox = db.data.mailboxes.find(m => m.fullAddress.toLowerCase() === address);
                
                if (mailbox) {
                  const newEmail: EmailMessage = {
                    id: Math.random().toString(36).substring(7),
                    mailboxId: mailbox.id,
                    folder: 'inbox',
                    from: {
                      name: parsed.from?.value[0]?.name,
                      address: parsed.from?.value[0]?.address || 'unknown@sender.com'
                    },
                    to: [address],
                    subject: parsed.subject || '(No Subject)',
                    bodyText: parsed.text || '',
                    bodyHtml: (parsed.html as string) || `<div>${(parsed.text || '').replace(/\n/g, '<br/>')}</div>`,
                    isRead: false,
                    isStarred: false,
                    messageId: parsed.messageId || `<${Date.now()}@incoming.cmnty>`,
                    date: parsed.date ? parsed.date.toISOString() : new Date().toISOString()
                  };

                  db.data.emails.push(newEmail);
                  mailbox.storageUsed += (parsed.text?.length || 0) + 1024;
                  await saveDb();
                  await addAuditLog('email.received', 'email', `Received message for ${address} from ${newEmail.from.address}`);
                }
              }
            }
          } catch (e) {
            console.error('Error storing received email:', e);
          }

          callback();
        });
      },
      disabledCommands: ['AUTH']
    });

    const port = parseInt(process.env.INTERNAL_SMTP_PORT || '2525');
    server.listen(port, '0.0.0.0', () => {
      console.log(`Internal SMTP Receiver listening on port ${port}`);
    });
  } catch (err) {
    console.error('Could not start internal SMTP server:', err);
  }
};

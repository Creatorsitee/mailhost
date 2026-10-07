# CMNTY Mail

Professional Email Hosting for Your Domain.

## Architecture

CMNTY Mail is built as a management layer for a production-grade mail server. It orchestrates domain verification, mailbox creation, and provides a modern webmail interface.

### Tech Stack
- **Frontend**: Next.js 15, Tailwind CSS, Framer Motion
- **Database**: JSON-based (Lowdb) for configuration and metadata
- **Mail Orchestration**: Nodemailer (SMTP), ImapFlow (IMAP)
- **DNS**: Built-in DNS resolver for verification, Cloudflare API for automation

## Zero-Env Quick Start
1. **Deploy**: Deploy this application to your server.
2. **Setup**: Access the web interface and register your first account.
3. **Configure**: Go to **Settings** in the dashboard to set your Server IP and Master Key.
4. **Done**: No `.env` files needed. All settings are stored in the secure JSON database.

### Quick VPS Deployment
1. **Prepare VPS**: Ensure Port 25, 587, and 993 are open.
2. **Install Docker**: `curl -fsSL https://get.docker.com | sh`
3. **Launch**:
   ```bash
   docker-compose up -d
   ```
4. **Login**: Go to your VPS IP on port 3000 to start.

This will spin up both the **CMNTY Mail Dashboard** and a **Production-Grade Mail Server** (Postfix/Dovecot) that work together seamlessly.

### DNS Verification
The Dashboard provides the exact DNS records (MX, SPF, DKIM, DMARC) you need to add to your domain registrar to ensure your emails deliver in real-time without spam issues.


## Security
- Password hashing with Bcrypt.
- JWT-based secure sessions.
- Input validation and sanitization.
- DNS-based domain verification.
- No plaintext passwords in storage.

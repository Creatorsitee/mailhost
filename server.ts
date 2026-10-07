import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { startInternalSmtpServer } from './lib/mail/internal-server';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const port = parseInt(process.env.PORT || '3000', 10);

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  }).listen(port, () => {
    console.log(`> App ready on http://localhost:${port}`);
    
    // START THE SMTP RECEIVER
    // This allows the app to actually receive emails if traffic is routed to the port
    console.log('> Starting SMTP Receiver Service...');
    startInternalSmtpServer();
  });
});

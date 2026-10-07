import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'CMNTY Mail - Professional Email Hosting',
  description: 'Professional Email Hosting for Your Domain. Manage professional mailboxes and webmail with ease.',
  openGraph: {
    title: 'CMNTY Mail - Professional Email Hosting',
    description: 'Professional Email Hosting for Your Domain.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CMNTY Mail',
    description: 'Professional Email Hosting for Your Domain.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}

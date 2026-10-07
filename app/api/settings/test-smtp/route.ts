import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import nodemailer from 'nodemailer';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { smtpHost, smtpPort, pass } = await req.json();

    const host = smtpHost || '127.0.0.1';
    const port = Number(smtpPort) || 587;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: pass ? {
        user: 'test@cmnty.mail',
        pass
      } : undefined,
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 5000,
      greetingTimeout: 5000
    });

    // Test verify connection
    await transporter.verify();

    return NextResponse.json({
      success: true,
      message: `Successfully established SMTP connection handshake with ${host}:${port}.`
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to connect to SMTP server.'
    }, { status: 400 });
  }
}

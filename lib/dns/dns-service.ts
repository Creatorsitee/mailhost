import { Resolver } from 'dns/promises';
import crypto from 'crypto';
import { DnsCheckStatus } from '@/lib/db/db';

export function generateDkimKeys(): { selector: string; publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  // Extract clean public key base64 for DNS TXT record
  const cleanPublicKey = publicKey
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\s+/g, '');

  return {
    selector: 'mail',
    publicKey: cleanPublicKey,
    privateKey
  };
}

export async function verifyDomainDns(domain: string, expectedIp?: string): Promise<DnsCheckStatus> {
  const status: DnsCheckStatus = {
    mx: false,
    spf: false,
    dkim: false,
    dmarc: false,
    lastChecked: new Date().toISOString()
  };

  const detailsList: string[] = [];

  // Use direct public nameservers (Cloudflare 1.1.1.1, Google 8.8.8.8) to bypass stale local cache
  const resolver = new Resolver();
  try {
    resolver.setServers(['1.1.1.1', '8.8.8.8', '1.0.0.1']);
  } catch {
    // fallback to system default resolver
  }

  // 0. Verify A Record (mail.<domain>)
  try {
    const aRecords = await resolver.resolve4(`mail.${domain}`);
    if (aRecords && aRecords.length > 0) {
      status.aRecord = true;
      detailsList.push(`A Record (mail): Terdeteksi pointing ke [${aRecords.join(', ')}]`);
    } else {
      detailsList.push('A Record (mail): Belum terdeteksi di DNS domain');
    }
  } catch (err: any) {
    detailsList.push(`A Lookup (mail): ${err.code === 'ENODATA' || err.code === 'ENOTFOUND' ? 'Belum dikonfigurasi' : (err.code || err.message)}`);
  }

  // 1. Verify MX Record
  try {
    const mxRecords = await resolver.resolveMx(domain);
    if (mxRecords && mxRecords.length > 0) {
      status.mx = true;
      detailsList.push(`MX Record: Terdeteksi [${mxRecords.map(m => `${m.exchange} (prioritas ${m.priority})`).join(', ')}]`);
    } else {
      detailsList.push('MX Record: Belum terdeteksi di DNS domain');
    }
  } catch (err: any) {
    detailsList.push(`MX Lookup: ${err.code === 'ENODATA' || err.code === 'ENOTFOUND' ? 'Belum dikonfigurasi' : (err.code || err.message)}`);
  }

  // 2. Verify SPF (TXT on root)
  try {
    const txtRecords = await resolver.resolveTxt(domain);
    const flat = txtRecords.flat();
    const spfRecord = flat.find(r => r.toLowerCase().startsWith('v=spf1'));
    if (spfRecord) {
      status.spf = true;
      detailsList.push(`SPF Record: Terdeteksi [${spfRecord}]`);
    } else {
      detailsList.push('SPF Record (v=spf1): Belum ada di TXT record root domain');
    }
  } catch (err: any) {
    detailsList.push(`SPF Lookup: ${err.code === 'ENODATA' || err.code === 'ENOTFOUND' ? 'Belum dikonfigurasi' : (err.code || err.message)}`);
  }

  // 3. Verify DKIM (TXT on mail._domainkey.<domain>)
  try {
    const dkimRecords = await resolver.resolveTxt(`mail._domainkey.${domain}`);
    const flat = dkimRecords.flat();
    const dkim = flat.find(r => r.includes('v=DKIM1') || r.includes('p='));
    if (dkim) {
      status.dkim = true;
      detailsList.push('DKIM Record: Terdeteksi valid pada mail._domainkey');
    } else {
      detailsList.push('DKIM Record: Belum terdeteksi pada mail._domainkey');
    }
  } catch (err: any) {
    detailsList.push(`DKIM Lookup: ${err.code === 'ENODATA' || err.code === 'ENOTFOUND' ? 'Belum dikonfigurasi' : (err.code || err.message)}`);
  }

  // 4. Verify DMARC (TXT on _dmarc.<domain>)
  try {
    const dmarcRecords = await resolver.resolveTxt(`_dmarc.${domain}`);
    const flat = dmarcRecords.flat();
    const dmarc = flat.find(r => r.toLowerCase().startsWith('v=dmarc1'));
    if (dmarc) {
      status.dmarc = true;
      detailsList.push(`DMARC Policy: Terdeteksi [${dmarc}]`);
    } else {
      detailsList.push('DMARC Record (_dmarc): Belum dikonfigurasi');
    }
  } catch (err: any) {
    detailsList.push(`DMARC Lookup: ${err.code === 'ENODATA' || err.code === 'ENOTFOUND' ? 'Belum dikonfigurasi' : (err.code || err.message)}`);
  }

  status.details = detailsList.join('\n');
  return status;
}

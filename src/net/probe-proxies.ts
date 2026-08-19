/**
 * Does Home Depot answer through these IPs?
 *
 *   npm run probe:proxies        test 5
 *   npm run probe:proxies 25     test all
 *
 * Two questions, in order:
 *   1. Does the proxy work at all, and what IP does the world see?
 *   2. Does homedepot.com serve a real product page through it, or does
 *      Akamai return a challenge?
 *
 * A 200 with real product markup is the green light for calling Home Depot
 * directly, which drops both the per-lookup fee and the vendor's 20/day quota.
 * Anything else and the vendor path stays primary — it works today.
 */

import 'dotenv/config';
import { ProxyAgent } from 'undici';
import { loadProxies, type Proxy } from './proxies.js';

const PRODUCT_URL =
  'https://www.homedepot.com/p/EcoSmart-16-4-ft-RGBWIC-Dynamic-Color-Changing-Dimmable-Linkable-Plug-In-LED-Outdoor-Strip-Light-with-Remote-Control-LR1321-RGBWIC-U/324308361';

/* A plain browser fingerprint. Not evasion — just not announcing ourselves as
 * a bare fetch() client, which anything in front of a retail site drops. */
const HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
};

async function through(proxy: Proxy, url: string, timeoutMs = 25000) {
  const dispatcher = new ProxyAgent(proxy.url);
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const started = Date.now();
    // `dispatcher` is undici's, not part of the DOM RequestInit, and undici's
    // Dispatcher type collides with the copy Node bundles. Cast through unknown.
    const res = await fetch(url, {
      dispatcher, headers: HEADERS, signal: ac.signal, redirect: 'follow',
    } as unknown as RequestInit);
    const body = await res.text();
    return { status: res.status, ms: Date.now() - started, body };
  } finally {
    clearTimeout(timer);
    await dispatcher.close().catch(() => {});
  }
}

/** Akamai's block pages are recognisable and never contain product markup. */
function verdict(status: number, body: string): string {
  const b = body.toLowerCase();
  if (/access denied|reference #|akamai|bot detection|unusual traffic/.test(b)) return 'BLOCKED (challenge page)';
  if (status === 403) return 'BLOCKED (403)';
  if (status === 429) return 'RATE LIMITED';
  if (status >= 500) return 'SERVER ERROR ' + status;
  if (status !== 200) return 'HTTP ' + status;
  if (b.includes('thd-helmet') || b.includes('__next_data__') || b.includes('itemid') || b.includes('addtocart')) {
    return 'OK - real product page';
  }
  return '200 but unrecognised (' + body.length + ' bytes)';
}

const proxies = loadProxies();

if (proxies.length === 0) {
  console.error('No proxies loaded. Use either:');
  console.error('');
  console.error('  1. .env    ->  PROXY_LIST=host:port:user:pass,host:port:user:pass');
  console.error('  2. a file  ->  proxies.txt, one proxy per line');
  console.error('');
  console.error('Accepted formats:');
  console.error('  host:port:user:pass | user:pass@host:port | http://user:pass@host:port');
  console.error('');
  console.error('Both are gitignored. Do not paste credentials anywhere else.');
  process.exit(1);
}

const limit = Number(process.argv[2] ?? 5);
console.log(proxies.length + ' proxies loaded; testing ' + Math.min(limit, proxies.length) + '\n');

let ok = 0, blocked = 0, failed = 0;

for (const proxy of proxies.slice(0, limit)) {
  // Confirm the proxy itself works, and see the exit IP, before judging HD.
  let egress = '?';
  try {
    const ip = await through(proxy, 'https://api.ipify.org?format=json', 12000);
    egress = (JSON.parse(ip.body).ip as string) ?? '?';
  } catch (e) {
    console.log(proxy.label.padEnd(24) + ' PROXY DEAD - ' + (e as Error).message.slice(0, 60));
    failed++;
    continue;
  }

  try {
    const r = await through(proxy, PRODUCT_URL);
    const v = verdict(r.status, r.body);
    console.log(
      proxy.label.padEnd(24) + ' ip ' + egress.padEnd(16) +
      String(r.ms).padStart(6) + 'ms  ' + v,
    );
    if (v.startsWith('OK')) ok++; else blocked++;
  } catch (e) {
    console.log(proxy.label.padEnd(24) + ' ip ' + egress.padEnd(16) + '  ERROR ' + (e as Error).message.slice(0, 50));
    failed++;
  }
}

console.log('\n' + ok + ' reached Home Depot, ' + blocked + ' blocked, ' + failed + ' proxy failures');
console.log(
  ok > 0
    ? 'Direct calls are viable. Next: map the store-inventory endpoint.'
    : 'Akamai is refusing these IPs. Keep the vendor path as primary.',
);

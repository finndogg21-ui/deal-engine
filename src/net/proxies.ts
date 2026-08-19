/**
 * ISP proxy pool.
 *
 * Home Depot sits behind Akamai, which is why the sweep goes through a vendor
 * today. ISP proxies — static, carrier-assigned residential IPs — are the
 * standard answer to that, and if they hold up, calling Home Depot directly
 * removes both the per-lookup fee and the vendor's 20-a-day quota.
 *
 * Credentials live in a gitignored file, never in .env and never in code, so
 * a rotated proxy list is a file swap rather than a commit.
 *
 *   PROXY_FILE=proxies.txt   (default)
 *
 * One proxy per line. Blank lines and # comments ignored. Accepts:
 *   host:port:user:pass          <- most common export format
 *   user:pass@host:port
 *   http://user:pass@host:port
 */

import { readFileSync, existsSync } from 'node:fs';

export interface Proxy {
  url: string;
  /** host:port, safe to log. Credentials are never included. */
  label: string;
}

/** Parse one line into a proxy URL. Returns null for junk rather than throwing,
 *  because one malformed line should not take out the whole pool. */
export function parseProxyLine(raw: string): Proxy | null {
  const line = raw.trim();
  if (!line || line.startsWith('#')) return null;

  // Already a URL.
  if (/^https?:\/\//i.test(line)) {
    try {
      const u = new URL(line);
      return { url: line, label: `${u.hostname}:${u.port}` };
    } catch { return null; }
  }

  // user:pass@host:port
  if (line.includes('@')) {
    const [creds, hostPort] = line.split('@');
    if (!creds || !hostPort) return null;
    return { url: `http://${creds}@${hostPort}`, label: hostPort };
  }

  const parts = line.split(':');
  // host:port:user:pass — the format most providers export.
  if (parts.length === 4) {
    const [host, port, user, pass] = parts;
    return {
      url: `http://${encodeURIComponent(user!)}:${encodeURIComponent(pass!)}@${host}:${port}`,
      label: `${host}:${port}`,
    };
  }
  // host:port, no auth
  if (parts.length === 2) {
    return { url: `http://${line}`, label: line };
  }
  return null;
}

let pool: Proxy[] | null = null;

/**
 * Two sources, checked in order:
 *   1. PROXY_LIST in .env — comma or newline separated. Convenient, and .env
 *      is already gitignored.
 *   2. proxies.txt — better when the list is long or rotates often, since
 *      swapping the file needs no restart of anything else.
 */
export function loadProxies(): Proxy[] {
  if (pool) return pool;

  const inline = process.env.PROXY_LIST?.trim();
  if (inline) {
    pool = inline
      .split(/[,\n]/)
      .map(parseProxyLine)
      .filter((p): p is Proxy => p !== null);
    if (pool.length > 0) return pool;
  }

  const file = process.env.PROXY_FILE ?? 'proxies.txt';
  if (!existsSync(file)) { pool = []; return pool; }
  pool = readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map(parseProxyLine)
    .filter((p): p is Proxy => p !== null);
  return pool;
}

export const proxiesReady = () => loadProxies().length > 0;

/**
 * Round-robin, so no single IP carries the whole load. Sticky rotation beats
 * random here: an IP that just made a request is the worst next choice.
 */
let cursor = 0;
export function nextProxy(): Proxy | null {
  const list = loadProxies();
  if (list.length === 0) return null;
  const p = list[cursor % list.length]!;
  cursor++;
  return p;
}

/** Pin a ZIP to one IP. Rotating mid-session across a store lookup is exactly
 *  the pattern anti-bot systems score against. */
export function proxyFor(key: string): Proxy | null {
  const list = loadProxies();
  if (list.length === 0) return null;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return list[h % list.length]!;
}

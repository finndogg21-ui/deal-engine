/**
 * Blueprint 1 — public live-scan freshness bar.
 *
 * The single believable differentiator deal-engine has — genuine
 * machine-swept per-store stock counts with fresh timestamps — was
 * invisible to anyone who hadn't signed up. Admin.tsx already computes
 * this; this just reads the same public numbers (no store number, no
 * shelf count, nothing gated) so a skeptical prospect can watch a real
 * scan timestamp update instead of taking "trust us, it's fresh" on faith.
 */

import { useEffect, useState } from 'react';
import { api } from '../lib/auth.js';

interface Freshness {
  last_scan_at: string | null;
  stale: boolean;
  stores_checked: number;
  skus_checked: number;
}

function relative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60_000);
  if (min < 1) return 'moments ago';
  if (min < 60) return `${min} min ago`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

export default function FreshnessBar() {
  const [d, setD] = useState<Freshness | null>(null);

  useEffect(() => {
    let live = true;
    api<Freshness>('/api/scan/freshness')
      .then((data) => { if (live) setD(data); })
      // Silent: a status strip that fails to load should never break the
      // footer it sits in.
      .catch(() => {});
    return () => { live = false; };
  }, []);

  if (!d || !d.last_scan_at) return null;

  return (
    <div className={`fresh-bar${d.stale ? ' fresh-stale' : ''}`}>
      <span className="fresh-dot" aria-hidden="true" />
      <span>
        Last scan: {relative(d.last_scan_at)} · {d.stores_checked} San Antonio
        stores · {d.skus_checked.toLocaleString()} SKUs checked
      </span>
    </div>
  );
}

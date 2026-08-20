/**
 * Blueprint L — admin.
 *
 * Built against one sentence: a broken scan should be visible here before a
 * customer notices. So scan health is the first thing on the page, not a
 * statistic buried under vanity counts.
 */

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/auth.js';
import '../../resell.css';
import '../../admin.css';

interface Overview {
  scan: {
    last_run: Record<string, unknown> | null;
    hours_since: number | null;
    stale: boolean;
    trailing_avg_rows: number | null;
    runs: { run_id: string; source: string; started_at: string; status: string;
            rows_written: number; canary_ok: boolean | null; below_average: boolean }[];
  };
  counts: Record<string, number>;
  hit_rate: {
    total: number; found: number; pct: number | null;
    avg_score_found: number | null; avg_score_missed: number | null;
    by_week: { week: string; total: number; found: number; pct: number | null }[];
  };
  vendors: Record<string, boolean | string>;
  recent_finds: Record<string, unknown>[];
  messages: { message_id: string; name: string | null; email: string; topic: string; body: string; created_at: string }[];
}

export default function Admin() {
  const [d, setD] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setD(await api<Overview>('/api/admin/overview'));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handled(id: string) {
    await api(`/api/admin/messages/${id}/handled`, { method: 'POST' });
    await load();
  }

  if (error) {
    return (
      <div className="rs">
        <h1 className="rs-title">Admin</h1>
        <p className="rs-error">{error}</p>
      </div>
    );
  }
  if (!d) return <div className="rs"><p className="rs-lede">Loading…</p></div>;

  const vendorKeys = Object.keys(d.vendors).filter((k) => typeof d.vendors[k] === 'boolean');

  return (
    <div className="rs">
      <div className="dash-eyebrow">Operator</div>
      <h1 className="rs-title">Admin</h1>

      {/* Scan health first. It is the thing that silently breaks. */}
      <section className={`ad-health${d.scan.stale ? ' bad' : ''}`}>
        <div>
          <span>Last scan</span>
          <strong>
            {d.scan.hours_since === null ? 'never' : `${d.scan.hours_since}h ago`}
          </strong>
        </div>
        <div>
          <span>Rows last run</span>
          <strong>{Number(d.scan.last_run?.rows_written ?? 0)}</strong>
        </div>
        <div>
          <span>Trailing average</span>
          <strong>{d.scan.trailing_avg_rows ?? '—'}</strong>
        </div>
        <p className="ad-verdict">
          {d.scan.stale
            ? 'The scan has not run in over 26 hours. A broken scan looks exactly like a quiet day, and every day it is down is history that cannot be recovered.'
            : 'Scan is running on schedule.'}
        </p>
      </section>

      <div className="rs-stats">
        <div><strong>{d.counts.users}</strong><span>accounts</span></div>
        <div><strong>{d.counts.paying}</strong><span>paying</span></div>
        <div><strong>{d.counts.founding_left}</strong><span>founding seats left</span></div>
        <div><strong>{d.counts.observations}</strong><span>observations</span></div>
        <div><strong>{d.counts.watches}</strong><span>active watches</span></div>
        <div><strong>{d.counts.alerts_7d}</strong><span>alerts, 7d</span></div>
      </div>

      {(d.counts.alerts_undelivered ?? 0) > 0 && (
        <p className="ad-warn">
          {d.counts.alerts_undelivered} alerts written but never delivered. That is a
          mailer failure, not a quiet week — check the delivery log.
        </p>
      )}

      <div className="rs-split">
        <section>
          <h2>Hit rate</h2>
          {d.hit_rate.total === 0 ? (
            <p className="rs-lede">
              No finds recorded yet. Until this number exists, the whole premise is
              an assumption.
            </p>
          ) : (
            <>
              <p className="ad-big">{d.hit_rate.pct}%<small>{d.hit_rate.found} of {d.hit_rate.total} confirmed</small></p>
              <p className="rs-note">
                Average score when found: {d.hit_rate.avg_score_found ?? '—'} ·
                when missed: {d.hit_rate.avg_score_missed ?? '—'}.
                A gap between those two is the scorer doing its job.
              </p>
            </>
          )}
        </section>

        <section>
          <h2>Vendors</h2>
          <ul className="ad-vendors">
            {vendorKeys.map((k) => (
              <li key={k}>
                <span>{k}</span>
                <em className={d.vendors[k] ? 'on' : 'off'}>
                  {d.vendors[k] ? 'wired' : 'not wired'}
                </em>
              </li>
            ))}
          </ul>
          <p className="rs-note">{String(d.vendors.spend_note)}</p>
        </section>
      </div>

      <section>
        <h2>Scan runs</h2>
        <div className="rs-tablewrap">
          <table className="rs-table">
            <thead>
              <tr>
                <th>Started</th><th>Source</th><th>Status</th>
                <th className="rs-num">Rows</th><th>Canary</th>
              </tr>
            </thead>
            <tbody>
              {d.scan.runs.length === 0 && (
                <tr><td colSpan={5} className="rs-dim">No scan has run yet.</td></tr>
              )}
              {d.scan.runs.map((r) => (
                <tr key={r.run_id}>
                  <td className="rs-dim">{new Date(r.started_at).toLocaleString()}</td>
                  <td className="rs-dim">{r.source}</td>
                  <td><span className={`rs-pill ${r.status === 'ok' ? 'sold' : 'returned'}`}>{r.status}</span></td>
                  <td className={`rs-num${r.below_average ? ' rs-net neg' : ''}`}>
                    {r.rows_written}{r.below_average && ' ↓'}
                  </td>
                  <td className="rs-dim">{r.canary_ok === null ? '—' : r.canary_ok ? 'ok' : 'failed'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>Open messages ({d.counts.messages_open})</h2>
        {d.messages.length === 0 ? (
          <p className="rs-lede">Nothing waiting.</p>
        ) : (
          <ul className="ad-messages">
            {d.messages.map((m) => (
              <li key={m.message_id}>
                <div>
                  <strong>{m.name ?? 'Someone'}</strong> <span className="rs-dim">{m.email}</span>
                  <span className="rs-pill">{m.topic}</span>
                </div>
                <p>{m.body}</p>
                <button className="rs-ghost" onClick={() => void handled(m.message_id)}>
                  Mark handled
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

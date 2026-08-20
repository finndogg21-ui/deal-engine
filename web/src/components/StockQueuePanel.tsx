/**
 * Stock checks, shown on the watchlist page.
 *
 * Pressing "Find stock" anywhere queues a check and the answer lands here, so
 * there is exactly one place to look for "things I asked about". A row appears
 * immediately as "Finding stock..." and becomes an answer when the worker is
 * done — nothing blocks and nothing is lost on a page change.
 *
 * The panel hides itself entirely when there is nothing to show, so a user who
 * never presses the button never sees an empty box asking to be understood.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/auth.js';

interface StoreRow {
  storeId: string;
  storeName: string | null;
  distanceMi: number | null;
  quantity: number | null;
}

interface Job {
  lookup_id: string;
  product_id: string;
  title: string | null;
  image_url: string | null;
  zip: string;
  status: 'pending' | 'ok' | 'empty' | 'vendor_error';
  stores: StoreRow[];
  error: string | null;
}

export default function StockQueuePanel() {
  const [jobs, setJobs] = useState<Job[]>([]);

  const load = useCallback(async () => {
    try {
      const d = await api<{ jobs: Job[]; pending: number }>('/api/stock/jobs');
      setJobs(d.jobs);
      return d.pending;
    } catch {
      return 0;
    }
  }, []);

  /**
   * Poll quickly only while something is actually pending. A permanent timer
   * on an idle page is a request every few seconds, forever, for nothing.
   */
  const timer = useRef<number | null>(null);
  useEffect(() => {
    let stopped = false;
    const loop = async () => {
      const pending = await load();
      if (stopped) return;
      timer.current = window.setTimeout(loop, pending > 0 ? 3000 : 30000);
    };
    void loop();
    return () => {
      stopped = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [load]);

  if (jobs.length === 0) return null;

  const pending = jobs.filter((j) => j.status === 'pending');
  const done = jobs.filter((j) => j.status !== 'pending');

  return (
    <section className="qd-sec qd-panel">
      <div className="qd-sec-head">
        <h2>Stock checks</h2>
        {pending.length > 0 && (
          <span className="qd-working">
            <span className="qd-spin" aria-hidden="true" />
            finding stock for {pending.length}...
          </span>
        )}
      </div>

      <ul className="qd-results">
        {[...pending, ...done].map((j) => (
          <li key={j.lookup_id} className={`qd-row ${j.status}`}>
            {j.image_url ? (
              <img className="qd-thumb" src={j.image_url} alt="" loading="lazy" />
            ) : (
              <span className="qd-thumb qd-nothumb" aria-hidden="true" />
            )}

            <div className="qd-row-main">
              <span className="qd-row-title">{j.title ?? j.product_id}</span>
              <span className="qd-row-zip">near {j.zip}</span>
            </div>

            <div className="qd-row-answer">
              {j.status === 'pending' && <span className="qd-dim">Finding stock...</span>}

              {j.status === 'ok' &&
                j.stores.map((s) => (
                  <div key={s.storeId}>
                    <strong className={s.quantity === 0 ? 'qd-none' : 'qd-have'}>
                      {s.quantity === null
                        ? 'quantity unknown'
                        : s.quantity === 0
                          ? 'none on the shelf'
                          : `${s.quantity} on the shelf`}
                    </strong>
                    <span className="qd-dim">
                      {' '}
                      {s.storeName}
                      {s.distanceMi !== null && ` · ${s.distanceMi} mi`}
                    </span>
                  </div>
                ))}

              {j.status === 'empty' && <span className="qd-dim">no store nearby has it</span>}

              {/* A failure is stated as a failure. "None nearby" would be a
                  different and much more damaging claim. */}
              {j.status === 'vendor_error' && (
                <span className="qd-err">could not check{j.error ? ` — ${j.error}` : ''}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

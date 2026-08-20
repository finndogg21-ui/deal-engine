/**
 * Blueprint I — penny watch.
 *
 * "Done when the breakdown explains *why* a number is 98, not just that it
 * is." So the score is never shown as a bare number: every card carries the
 * four components that produced it, and each one says what it measured.
 */

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/auth.js';
import '../../penny.css';

interface Candidate {
  product_id: string;
  store_id: string;
  title: string | null;
  retailer: string;
  image_url: string | null;
  store_name: string | null;
  aisle_bay: string | null;
  distance_mi: number | null;
  stage: string | null;
  penny_score: number;
  confidence: string;
  price: number | null;
  discount_pct: number | null;
  stock_qty: number | null;
  last_seen_at: string | null;
  verified_by: number;
  score_breakdown: { ladder: number; divergence: number; dwell: number; scarcity: number; price_code: number };
}

/** Max points per component, from the scorer. Shown so a bar has a scale. */
const PARTS = [
  { key: 'ladder', max: 35, label: 'Markdown ladder', why: 'Walked 20% → 50% → 90% off' },
  { key: 'divergence', max: 25, label: 'Gone from the site', why: 'Delisted online, units still on the floor' },
  { key: 'price_code', max: 20, label: 'Price ending', why: "Home Depot's own code: .06 second markdown, .03 final, .01 penny" },
  { key: 'dwell', max: 12, label: 'Time in this stage', why: 'Peaks about two weeks after it disappears' },
  { key: 'scarcity', max: 8, label: 'Units left', why: 'Fewer units left makes a penny more likely' },
] as const;

const RADII = [0, 10, 25, 50, 100];

interface Coverage { history_days: number; scores_meaningful: boolean }

export default function PennyWatch() {
  const [rows, setRows] = useState<Candidate[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [minScore, setMinScore] = useState(0);
  const [radius, setRadius] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [cov, setCov] = useState<Coverage | null>(null);

  useEffect(() => {
    void fetch('/api/coverage', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => c && setCov(c))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setRows(null);
    try {
      // penny=1 means a literal $X.01 price or confirmed penny_candidate stage.
      // min_discount 0 because a penny is 100% off anyway and the discount
      // column can be null on a delisted item.
      const q = new URLSearchParams({ penny: '1', min_score: String(minScore), min_discount: '0' });
      if (radius > 0) q.set('radius', String(radius));
      setRows(await api<Candidate[]>(`/api/candidates?${q}`));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setRows([]);
    }
  }, [minScore, radius]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="pw">
      <div className="dash-eyebrow">Find</div>
      <h1 className="pw-title">Penny deals</h1>
      <p className="pw-lede">
        Pennies only. An item is on this page for one of two reasons: it rings up at
        <strong> $0.01</strong>, or it walked the whole markdown ladder, vanished from
        the site, and still has stock on the floor. Nothing else gets in — not a $7.03,
        not a 90% off. Every score shows its working.
      </p>

      <div className="pw-filters">
        <label>
          <span>Score at least</span>
          <select value={minScore} onChange={(e) => setMinScore(Number(e.target.value))}>
            {[0, 40, 60, 80, 90].map((s) => <option key={s} value={s}>{s || 'any'}</option>)}
          </select>
        </label>
        <label>
          <span>Within</span>
          <select value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
            {RADII.map((r) => <option key={r} value={r}>{r === 0 ? 'any distance' : `${r} miles`}</option>)}
          </select>
        </label>
      </div>

      {error && <p className="pw-error">{error}</p>}

      {/* Three of the five components measure change over WEEKS. Until there is
          history they sit near zero, so early scores read low and every find
          gets labelled "Weak" — including good ones. Saying so is better than
          inflating the number, which would make the score mean nothing. */}
      {cov && !cov.scores_meaningful && (
        <p className="pw-young">
          Scores are low right now because we only have {cov.history_days}{' '}
          {cov.history_days === 1 ? 'day' : 'days'} of price history. Three of the five
          signals measure change over weeks and cannot score yet, so treat a 30 today
          the way you would treat a 70 later. The price ending is the one signal that
          already works.
        </p>
      )}

      {rows === null && (
        <div className="pw-grid">
          {Array.from({ length: 4 }, (_, i) => <div className="pw-skel" key={i} />)}
        </div>
      )}

      {rows?.length === 0 && (
        <div className="pw-empty">
          <p>No pennies right now.</p>
          <p className="pw-lede">
            Nothing rings up at a cent and nothing has finished the ladder yet. That is
            the normal state — real pennies are rare, and this page stays empty rather
            than padding itself with deep clearance and calling it something it is not.
            Deep markdowns, including final-markdown <strong>.03</strong> items one step
            away, are on <Link to="/app">All deals</Link>.
          </p>
        </div>
      )}

      <div className="pw-grid">
        {rows?.map((c) => {
          const id = `${c.product_id}|${c.store_id}`;
          const open = openId === id;
          return (
            <article className="pw-card" key={id}>
              {/* Recognising the product is most of the decision, so the
                  photo leads. */}
              <div className="pw-img">
                {c.image_url
                  ? <img src={c.image_url} alt="" loading="lazy" decoding="async" />
                  : <span className="pw-noimg" aria-hidden="true">No photo</span>}
                <span className={`pw-score s${Math.floor(c.penny_score / 20)}`}>
                  <strong>{c.penny_score}</strong>
                  <span>{c.confidence}</span>
                </span>
              </div>

              <div className="pw-head-text">
                <h2>{c.title ?? c.product_id}</h2>
                {/* No store, no shelf count: the sweep saw whichever stores
                    Home Depot volunteered, not this person's store. */}
                <p className="pw-where">Possible deal · check your store</p>
              </div>

              <div className="pw-facts">
                <div>
                  <strong>{c.price === null ? '—' : `$${c.price.toFixed(2)}`}</strong>
                  <span>last seen price</span>
                </div>
                <div>
                  <strong>{c.discount_pct === null ? '—' : `${Math.round(c.discount_pct)}%`}</strong>
                  <span>off</span>
                </div>
                <div>
                  <strong>{c.price !== null && c.discount_pct
                    ? `$${(c.price / (1 - c.discount_pct / 100) - c.price).toFixed(2)}`
                    : '—'}</strong>
                  <span>you save</span>
                </div>
              </div>

              {c.verified_by > 0 && (
                <p className="pw-verified">
                  Confirmed at the register by {c.verified_by}{' '}
                  {c.verified_by === 1 ? 'person' : 'people'} in the last week.
                </p>
              )}

              <button
                className="pw-why"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : id)}
              >
                {open ? 'Hide the maths' : `Why ${c.penny_score}?`}
              </button>

              {open && (
                <div className="pw-break">
                  {PARTS.map((p) => {
                    const v = c.score_breakdown[p.key];
                    return (
                      <div className="pw-part" key={p.key}>
                        <div className="pw-part-top">
                          <span>{p.label}</span>
                          <em>{v} / {p.max}</em>
                        </div>
                        <div className="pw-bar">
                          <div className="pw-bar-fill" style={{ width: `${(v / p.max) * 100}%` }} />
                        </div>
                        <small>{p.why}</small>
                      </div>
                    );
                  })}
                  <p className="pw-caveat">
                    This is a prediction from price history, not a promise. Every find you
                    record grades it.
                  </p>
                </div>
              )}

              <div className="pw-actions">
                <Link className="btn" to={`/app/deal/${encodeURIComponent(c.product_id)}/${encodeURIComponent(c.store_id)}`}>
                  Open
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

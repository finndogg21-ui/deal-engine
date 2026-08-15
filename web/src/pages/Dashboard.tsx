import { useEffect, useState, useCallback } from 'react';
import '../dashboard.css';

interface Candidate {
  product_id: string;
  store_id: string;
  title: string;
  category: string | null;
  retailer: string;
  store_name: string;
  distance_mi: number | null;
  stage: string;
  penny_score: number;
  confidence: string;
  price: number | null;
  discount_pct: number | null;
  stock_qty: number | null;
  last_seen_at: string;
}

interface HistoryPoint {
  observed_at: string;
  price: number | null;
  discount_pct: number | null;
  stock_qty: number | null;
  availability: string | null;
}

interface Detail extends Candidate {
  sku: string;
  stage_entered_at: string;
  store: { name: string; address: string | null; distance_mi: number | null; maps_url: string | null };
  price_history: HistoryPoint[];
  prior_finds: { outcome: string; actual_price: number | null; recorded_at: string }[];
}

interface Health {
  last_run: { status: string; rows_written: number; started_at: string } | null;
  hours_since: number | null;
  stale: boolean;
}

interface HitRate {
  total: number;
  found: number;
  hit_rate: number | null;
}

const money = (n: number | null) => (n === null ? '—' : `$${n.toFixed(2)}`);
const scoreClass = (n: number) => (n >= 70 ? 'hi' : n >= 45 ? 'mid' : 'lo');

/* The database speaks in stage codes. People don't. */
const STAGES = [
  { code: 's20', label: '20% off' },
  { code: 's50', label: 'Half off' },
  { code: 's90', label: '90% off' },
  { code: 'delisted', label: 'Gone from the site' },
  { code: 'penny_candidate', label: 'Might be a penny' },
];
const stageLabel = (code: string) => STAGES.find((s) => s.code === code)?.label ?? code;

/** The markdown ladder, drawn. The one thing no competitor shows. */
function PriceChart({ points }: { points: HistoryPoint[] }) {
  const pts = points.filter((p) => p.price !== null);
  if (pts.length < 2) return <div className="rowmeta">Not enough history yet.</div>;

  const W = 460, H = 120, PAD = 8;
  const times = pts.map((p) => new Date(p.observed_at).getTime());
  const prices = pts.map((p) => p.price!);
  const t0 = Math.min(...times), t1 = Math.max(...times), pMax = Math.max(...prices);

  const x = (t: number) => PAD + ((t - t0) / Math.max(1, t1 - t0)) * (W - PAD * 2);
  const y = (p: number) => H - PAD - (p / Math.max(1, pMax)) * (H - PAD * 2);
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(times[i]!).toFixed(1)},${y(p.price!).toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Price history">
      <path d={`${path} L${x(t1).toFixed(1)},${H - PAD} L${x(t0).toFixed(1)},${H - PAD} Z`} fill="var(--sticker)" opacity="0.22" />
      <path d={path} fill="none" stroke="var(--ink)" strokeWidth="2" />
      {pts.map((p, i) => {
        const gone = p.availability === 'unavailable' || p.availability === 'out_of_stock';
        return (
          <circle key={i} cx={x(times[i]!)} cy={y(p.price!)} r={gone ? 4.5 : 3} fill={gone ? 'var(--drop)' : 'var(--ink)'}>
            <title>
              {new Date(p.observed_at).toLocaleDateString()} — {money(p.price)}
              {p.discount_pct !== null ? ` (${p.discount_pct}% off)` : ''}{gone ? ' — delisted' : ''}
            </title>
          </circle>
        );
      })}
    </svg>
  );
}

export default function Dashboard() {
  const [rows, setRows] = useState<Candidate[]>([]);
  const [sel, setSel] = useState<Detail | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [hit, setHit] = useState<HitRate | null>(null);
  const [minScore, setMinScore] = useState(0);
  const [stage, setStage] = useState('');
  const [loading, setLoading] = useState(true);

  const loadList = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ min_score: String(minScore) });
    if (stage) qs.set('stage', stage);
    const r = await fetch(`/api/candidates?${qs}`);
    setRows(await r.json());
    setLoading(false);
  }, [minScore, stage]);

  const loadStats = useCallback(async () => {
    const [h, hr] = await Promise.all([
      fetch('/api/scan/health').then((r) => r.json()),
      fetch('/api/stats/hit-rate').then((r) => r.json()),
    ]);
    setHealth(h);
    setHit(hr);
  }, []);

  useEffect(() => { void loadList(); }, [loadList]);
  useEffect(() => { void loadStats(); }, [loadStats]);

  async function open(c: Candidate) {
    const r = await fetch(`/api/candidates/${encodeURIComponent(c.product_id)}/${encodeURIComponent(c.store_id)}`);
    setSel(await r.json());
  }

  async function record(outcome: string) {
    if (!sel) return;
    await fetch('/api/finds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: sel.product_id, store_id: sel.store_id, outcome }),
    });
    await Promise.all([loadStats(), open(sel)]);
  }

  return (
    <div className="dash">
      <div className="dash-top">
        <div>
          <div className="sb-sec" style={{ padding: 0 }}>Find</div>
          <h1 style={{ margin: '2px 0 0', fontSize: 22, letterSpacing: '-0.025em' }}>Deals</h1>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          {hit && (
            <div className="hitrate">
              hit rate <b>{hit.hit_rate === null ? '—' : `${hit.hit_rate}%`}</b>
              {hit.total > 0 && ` · ${hit.found}/${hit.total} confirmed`}
            </div>
          )}
          <div className={`health${health?.stale ? ' stale' : ''}`}>
            <span className="dot" />
            {health?.last_run
              ? `scan ${health.last_run.status} · ${health.last_run.rows_written} rows · ${health.hours_since}h ago`
              : 'no scan yet'}
          </div>
        </div>
      </div>

      <div className="filters">
        <label htmlFor="ms">Only show deals scoring at least</label>
        <input id="ms" type="range" min={0} max={90} step={5} value={minScore}
          onChange={(e) => setMinScore(Number(e.target.value))} />
        <span style={{ fontFamily: 'var(--mono)', minWidth: 28, fontWeight: 700 }}>{minScore}</span>

        <label htmlFor="st" style={{ marginLeft: 14 }}>Price stage</label>
        <select id="st" value={stage} onChange={(e) => setStage(e.target.value)}>
          <option value="">Any stage</option>
          {STAGES.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
        </select>

        <span style={{ marginLeft: 'auto', color: 'var(--ink-faint)' }}>
          {loading ? 'Loading…' : `${rows.length} ${rows.length === 1 ? 'deal' : 'deals'}`}
        </span>
      </div>

      <div className="cols">
        <div>
          {rows.length === 0 && !loading && (
            <div className="empty">
              No candidates yet.<br />
              Run the scan to start collecting price history.
            </div>
          )}
          {rows.map((c) => (
            <button
              key={`${c.product_id}|${c.store_id}`}
              className={`row${sel && sel.product_id === c.product_id && sel.store_id === c.store_id ? ' sel' : ''}`}
              onClick={() => void open(c)}
            >
              <div className={`score ${scoreClass(c.penny_score)}`}>{c.penny_score}</div>
              <div>
                <div className="rowtitle">{c.title}</div>
                <div className="rowmeta">
                  {c.store_name} · {c.distance_mi ?? '?'} miles away · {c.stock_qty ?? '?'} left
                  {' · '}{stageLabel(c.stage)}
                </div>
              </div>
              <div className="rowprice">
                <div className="now">{money(c.price)}</div>
                <div className="off">{c.discount_pct ?? '—'}% off</div>
              </div>
            </button>
          ))}
        </div>

        <div>
          {!sel ? (
            <div className="empty">Pick a candidate.<br />This panel is the ten-second decision.</div>
          ) : (
            <div className="detail">
              <h2>{sel.title}</h2>
              <div className="sub">{sel.retailer} · sku {sel.sku} · {sel.confidence}</div>

              <div className="grid">
                <div className="cell"><div className="k">Score</div><div className="v">{sel.penny_score}</div></div>
                <div className="cell"><div className="k">Price</div><div className="v" style={{ color: 'var(--go)' }}>{money(sel.price)}</div></div>
                <div className="cell"><div className="k">Discount</div><div className="v">{sel.discount_pct ?? '—'}%</div></div>
                <div className="cell"><div className="k">Stock</div><div className="v">{sel.stock_qty ?? '?'}</div></div>
                <div className="cell"><div className="k">Distance</div><div className="v">{sel.store.distance_mi ?? '?'} mi</div></div>
              </div>

              <div className="chartwrap">
                <div className="chartlabel">Markdown ladder</div>
                <PriceChart points={sel.price_history} />
              </div>

              <div className="stages">
                {STAGES.map((s) => (
                  <span key={s.code} className={`pill${sel.stage === s.code ? ' on' : ''}`}>{s.label}</span>
                ))}
              </div>

              <div className="rowmeta" style={{ marginBottom: 14 }}>
                {sel.store.name}
                {sel.store.maps_url && (<> · <a href={sel.store.maps_url} target="_blank" rel="noreferrer">directions</a></>)}
              </div>

              <div className="actions">
                <button className="found" onClick={() => void record('found')}>Found it</button>
                <button className="missed" onClick={() => void record('not_found')}>Not there</button>
                <button onClick={() => void record('wrong_price')}>Wrong price</button>
              </div>

              {sel.prior_finds.length > 0 && (
                <div className="priors">
                  {sel.prior_finds.map((f, i) => (
                    <div key={i}>{new Date(f.recorded_at).toLocaleDateString()} — {f.outcome}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="note">
        Every outcome you record grades the score that sent you there — that is what turns
        the scorer from a guess into a measurement.
      </div>
    </div>
  );
}

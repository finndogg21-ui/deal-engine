import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { readSetup } from '../lib/setup.js';
import { RETAILERS } from '../lib/retailers.js';
import FindStock from '../components/FindStock.js';
import { useAuth } from '../lib/auth.js';
import { getLocalZip, onZipChange } from '../lib/zip.js';
import '../dashboard.css';

/**
 * One crowd-reported find from GET /api/community-deals. Hearsay by design —
 * always rendered with its source and "scan in store" framing, never as our
 * own verified data. Pennies only ever come from here: $0.01 is a register-only
 * state no scraper can see.
 */
interface CommunityReport {
  report_id: number;
  source: string;
  kind: string;
  sku: string | null;
  item_id: string | null;
  title: string;
  price: string | number | null;
  list_price: string | number | null;
  state: string | null;
  city: string | null;
  store_number: string | null;
  product_url: string | null;
  source_url: string | null;
  image_url: string | null;
  reported_at: string | null;
}

/** One deal from GET /api/deals/nearby — national catalog + local stock. */
interface NearbyDeal {
  product_id: string;
  store_id: string | null;
  retailer: string;
  title: string | null;
  category: string | null;
  image_url: string | null;
  product_url: string | null;
  price: number | null;
  original_price: number | null;
  discount_pct: number | null;
  in_store_only: boolean;
  stock: {
    qty: number | null;
    store: { name: string | null; city: string | null; state: string | null; distance_mi: number | null } | null;
  };
}

interface Candidate {
  product_id: string;
  store_id: string;
  title: string;
  category: string | null;
  retailer: string;
  image_url: string | null;
  store_name: string;
  store_number: string | null;
  aisle_bay: string | null;
  other_stores: number;
  in_store_only: boolean;
  distance_mi: number | null;
  stage: string;
  penny_score: number;
  confidence: string;
  price: number | null;
  list_price: number | null;
  saves: number | null;
  discount_pct: number | null;
  stock_qty: number | null;
  last_seen_at: string;
  product_url: string | null;
  /** Only on the "Closest to me" feed: this deal's stock at the nearest nearby
   *  store, shown even when 0 or unknown. Absent on the national candidate list. */
  near_stock?: { qty: number | null; store: string | null; distance_mi: number | null } | null;
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
  last_run: { status: string; rows_written: number } | null;
  hours_since: number | null;
  stale: boolean;
}

interface HitRate { total: number; found: number; hit_rate: number | null }

interface Coverage {
  covered: boolean;
  history_days: number;
  scores_meaningful: boolean;
  metro: string | null;
  message: string;
}

const money = (n: number | null) => (n === null ? 'Unknown' : `$${n.toFixed(2)}`);
const pct = (n: number | null) => (n === null ? 'Unknown' : `${Math.round(n)}%`);

/** Stock line for the nearby feed — shown even when 0 or unknown. This is the
 *  local half: the deal is national, the count is where the shopper is. */
function stockText(s: { qty: number | null; store: string | null; distance_mi: number | null }): string {
  if (!s.store) return 'No tracked store near you yet';
  const where = s.distance_mi != null ? `${s.store} · ${s.distance_mi} mi` : s.store;
  if (s.qty === null) return `Stock unknown · ${where}`;
  if (s.qty === 0) return `0 in stock · ${where}`;
  return `${s.qty} in stock · ${where}`;
}

/** "5 hr ago". People judge freshness constantly on this screen. */
function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

const STAGES = [
  { code: 's20', label: '20% off' },
  { code: 's50', label: 'Half off' },
  { code: 's90', label: '90% off' },
  { code: 'delisted', label: 'Gone from the site' },
  { code: 'penny_candidate', label: 'Might be a penny' },
];
const stageLabel = (c: string) => STAGES.find((s) => s.code === c)?.label ?? c;

const retailerName = (slug: string) =>
  RETAILERS.find((r) => r.slug === slug || r.slug.replace(/-/g, '') === slug)?.name ?? slug;

const TABS = [
  { id: 'all', label: 'All deals' },
  { id: 'penny', label: 'Penny track' },
  { id: 'near', label: 'Closest to me' },
] as const;
type TabId = (typeof TABS)[number]['id'];

function Ph() {
  return (
    <svg className="ph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 15l5-4 4 3 3-2 6 4" />
    </svg>
  );
}

function DealCard({ c, selected, onOpen }: { c: Candidate; selected: boolean; onOpen: () => void }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = c.image_url && !imgFailed;

  return (
    <button className={`card-deal${selected ? ' sel' : ''}${c.stock_qty === 0 ? ' gone' : ''}`} onClick={onOpen}>
      <div className="card-img">
        {c.stock_qty === 0 && <span className="badge-gone">Gone</span>}
        {c.discount_pct !== null && <span className="badge-off">{pct(c.discount_pct)} off</span>}
        {c.in_store_only
          ? <span className="badge-instore">In store</span>
          : <span className="badge-score">{c.penny_score}</span>}
        {showImg
          ? <img src={c.image_url!} alt="" loading="lazy" decoding="async" onError={() => setImgFailed(true)} />
          : <Ph />}
      </div>

      <div className="card-body">
        <span className="retailer">{retailerName(c.retailer)}</span>
        <p className="card-title">{c.title}</p>

        <div className="card-price">
          <span className="now">{money(c.price)}</span>
          {c.list_price !== null && (
            <span className="was">Was <b>{money(c.list_price)}</b></span>
          )}
        </div>
        {c.saves !== null && c.saves > 0 && (
          <div className="card-save">Save {money(c.saves)}</div>
        )}

        {c.penny_score >= 70 && (
          <div className="card-predict">May ring up at $0.01, not confirmed</div>
        )}

        {/* No store number, no shelf count.
            The sweep only saw whichever stores Home Depot volunteered for the
            ZIP we happened to scan — that is not "your store", and printing it
            invites a wasted drive. Stock is resolved on the detail page, for
            the ZIP the person actually types. */}
        <div className="card-facts">
          {/* The hedge always leads; when a ZIP is set, the local stock line
              appears right under it, instantly, for every card (no click). */}
          <span className="card-possible">Possible deal · check your store</span>
          {c.near_stock
            ? <span className="card-stock">{stockText(c.near_stock)}</span>
            : <span>seen {ago(c.last_seen_at)}</span>}
        </div>

        <span className="card-cta">
          See this deal
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </div>
    </button>
  );
}

function PriceChart({ points }: { points: HistoryPoint[] }) {
  const pts = points.filter((p) => p.price !== null);
  if (pts.length < 2) return <div className="chartlabel">Not enough history yet.</div>;

  const W = 460, H = 110, PAD = 8;
  const times = pts.map((p) => new Date(p.observed_at).getTime());
  const prices = pts.map((p) => p.price!);
  const t0 = Math.min(...times), t1 = Math.max(...times), pMax = Math.max(...prices);
  const x = (t: number) => PAD + ((t - t0) / Math.max(1, t1 - t0)) * (W - PAD * 2);
  const y = (p: number) => H - PAD - (p / Math.max(1, pMax)) * (H - PAD * 2);
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(times[i]!).toFixed(1)},${y(p.price!).toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Price history">
      <path d={`${path} L${x(t1).toFixed(1)},${H - PAD} L${x(t0).toFixed(1)},${H - PAD} Z`}
        fill="var(--sticker)" opacity="0.18" />
      <path d={path} fill="none" stroke="var(--ink)" strokeWidth="2" />
      {pts.map((p, i) => {
        const gone = p.availability === 'unavailable' || p.availability === 'out_of_stock';
        return (
          <circle key={i} cx={x(times[i]!)} cy={y(p.price!)} r={gone ? 4.5 : 3}
            fill={gone ? 'var(--drop)' : 'var(--ink)'}>
            <title>
              {new Date(p.observed_at).toLocaleDateString()}, {money(p.price)}
              {gone ? ', gone from the site' : ''}
            </title>
          </circle>
        );
      })}
    </svg>
  );
}

export default function AllDeals() {
  const setup = readSetup();
  // Deep-link params. Alerts, penny-watch "Open", and per-retailer "See this
  // deal" all route to /app/deal/:productId/:storeId, which renders this page.
  const { productId, storeId } = useParams();

  const { me } = useAuth();
  // Effective ZIP for the "Closest to me" feed: the signed-in account ZIP if we
  // have one, otherwise the locally-entered ZIP (PUBLIC_PREVIEW has no
  // persistable account). Reactive to same-tab ZIP saves, so the feed loads the
  // moment a visitor sets a ZIP — with or without an account.
  const [appZip, setAppZip] = useState<string | null>(me?.zip ?? getLocalZip());
  useEffect(() => {
    const sync = () => setAppZip(me?.zip ?? getLocalZip());
    sync();
    return onZipChange(sync);
  }, [me?.zip]);

  const [rows, setRows] = useState<Candidate[]>([]);
  const [nearRows, setNearRows] = useState<Candidate[]>([]);
  const [pennyReports, setPennyReports] = useState<CommunityReport[]>([]);
  const [sel, setSel] = useState<Detail | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [hit, setHit] = useState<HitRate | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ kind: 'upgrade' | 'error'; message: string } | null>(null);
  const [coverage, setCoverage] = useState<Coverage | null>(null);

  const [tab, setTab] = useState<TabId>('all');
  const [store, setStore] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('score');

  const [compact, setCompact] = useState(() => {
    const saved = localStorage.getItem('compact');
    if (saved !== null) return saved === '1';
    return setup?.path === 'reseller';
  });
  useEffect(() => { localStorage.setItem('compact', compact ? '1' : '0'); }, [compact]);

  /**
   * Fix F11.
   *
   * This used to be `setRows(await r.json())` with no status check. A 402 from
   * the paywall returns `{error, upgrade:true}` — an object, not an array — so
   * `rows.filter(...)` threw during render and React unmounted the whole tree.
   * The symptom was a completely blank page right after onboarding, which is
   * the first thing a new account sees.
   *
   * Anything that is not a 200 carrying an array is now a state, not a crash.
   */
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const r = await fetch('/api/candidates?min_score=0&limit=500');
      const body = await r.json().catch(() => null);

      if (r.status === 402) {
        setRows([]);
        setLoadError({ kind: 'upgrade', message: body?.error ?? 'This needs a plan.' });
        return;
      }
      if (!r.ok || !Array.isArray(body)) {
        setRows([]);
        setLoadError({
          kind: 'error',
          message: body?.error ?? 'Could not load deals.',
        });
        return;
      }
      setRows(body);
    } catch {
      setRows([]);
      setLoadError({ kind: 'error', message: 'Could not load deals.' });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    // Best effort. These decorate the header, and a failure here must never
    // take the deal list down with it.
    try {
      const [h, hr] = await Promise.all([
        fetch('/api/scan/health').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/stats/hit-rate').then((r) => (r.ok ? r.json() : null)),
      ]);
      if (h) setHealth(h);
      if (hr) setHit(hr);
      // Whether we work where this person lives. Drives the empty state, which
      // otherwise blames our scan for something that is really "not your city yet".
      const cov = await fetch('/api/coverage').then((r) => (r.ok ? r.json() : null));
      if (cov) setCoverage(cov);
    } catch {
      /* header stats are optional */
    }
  }, []);

  // "Closest to me": the national deal catalog with THIS ZIP's local stock
  // overlaid (even 0). Deals are national, so this is populated for every ZIP;
  // only the stock line changes with location. Loaded whenever the app ZIP is
  // set, so the tab is instant and its count is correct before it's opened.
  const loadNear = useCallback(async (zip: string) => {
    try {
      const r = await fetch(`/api/deals/nearby?zip=${encodeURIComponent(zip)}&min_discount=25&limit=200`);
      const body = await r.json().catch(() => null);
      if (!r.ok || !body || !Array.isArray(body.deals)) { setNearRows([]); return; }
      const mapped: Candidate[] = (body.deals as NearbyDeal[]).map((d) => ({
        product_id: String(d.product_id),
        // The max-stock store this deal is showing — clicking opens ITS detail,
        // so the number on the card and the number on the detail are the same.
        store_id: d.store_id ?? '',
        title: d.title ?? '',
        category: d.category ?? null,
        retailer: d.retailer,
        image_url: d.image_url ?? null,
        store_name: d.stock?.store?.name ?? '',
        store_number: null,
        aisle_bay: null,
        other_stores: 0,
        in_store_only: !!d.in_store_only,
        distance_mi: d.stock?.store?.distance_mi ?? null,
        stage: '',
        penny_score: 0,
        confidence: '',
        price: d.price ?? null,
        list_price: d.original_price ?? null,
        saves:
          d.price != null && d.original_price != null
            ? Math.round((d.original_price - d.price) * 100) / 100
            : null,
        discount_pct: d.discount_pct ?? null,
        stock_qty: d.stock?.qty ?? null,
        last_seen_at: new Date().toISOString(),
        product_url: d.product_url ?? null,
        near_stock: {
          qty: d.stock?.qty ?? null,
          store: d.stock?.store?.name ?? null,
          distance_mi: d.stock?.store?.distance_mi ?? null,
        },
      }));
      setNearRows(mapped);
    } catch {
      setNearRows([]);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadStats(); }, [loadStats]);
  useEffect(() => { if (appZip) void loadNear(appZip); }, [appZip, loadNear]);

  // Community penny reports — the crowd's $0.01 finds from public penny lists.
  // Loaded once; the penny tab renders them above the ladder candidates.
  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch('/api/community-deals?kind=penny&limit=100');
        const body = await r.json().catch(() => null);
        if (r.ok && body && Array.isArray(body.reports)) setPennyReports(body.reports as CommunityReport[]);
      } catch { /* section simply doesn't render */ }
    })();
  }, []);

  /**
   * INSTANT STOCK ON EVERY CARD. The moment a ZIP is set, nearRows (already
   * fetched for "Closest to me") carries this ZIP's per-store stock for every
   * catalog deal. Index it by product so ALL tabs can show the stock line
   * under "Possible deal · check your store" with no extra click and no
   * vendor call — the Hidden Clearances behavior.
   */
  const nearStockByProduct = useMemo(() => {
    const m = new Map<string, Candidate['near_stock']>();
    for (const c of nearRows) if (c.near_stock) m.set(c.product_id, c.near_stock);
    return m;
  }, [nearRows]);

  /* Filtering happens here, against data already fetched. No user action ever
   * triggers a vendor call, which is why cost stays flat as users grow. */
  const shown = useMemo(() => {
    // "Closest to me" is the national catalog with local stock (from nearby);
    // the other tabs filter the store-level candidate list — enriched with the
    // same per-ZIP stock line so it shows instantly everywhere.
    let out = tab === 'near'
      ? nearRows
      : rows.map((c) => c.near_stock ? c : { ...c, near_stock: nearStockByProduct.get(c.product_id) });
    // The store chips carry lib slugs like "home-depot", but the API's
    // `retailer` field is the hyphen-less "homedepot". Compare both forms, or
    // the Home Depot chip silently filters to zero deals.
    if (store) out = out.filter((c) => c.retailer === store || c.retailer === store.replace(/-/g, ''));
    if (tab === 'penny') out = out.filter((c) => c.stage === 'penny_candidate' || c.penny_score >= 70);
    const term = q.trim().toLowerCase();
    if (term) {
      out = out.filter((c) =>
        c.title.toLowerCase().includes(term) ||
        (c.category ?? '').toLowerCase().includes(term) ||
        c.store_name.toLowerCase().includes(term));
    }
    const sorted = [...out];
    if (sort === 'score' || tab === 'penny') sorted.sort((a, b) => b.penny_score - a.penny_score);
    else if (sort === 'discount') sorted.sort((a, b) => (b.discount_pct ?? 0) - (a.discount_pct ?? 0));
    else if (sort === 'saves') sorted.sort((a, b) => (b.saves ?? 0) - (a.saves ?? 0));
    else if (sort === 'distance' || tab === 'near') {
      sorted.sort((a, b) => (a.distance_mi ?? 1e9) - (b.distance_mi ?? 1e9));
    } else if (sort === 'newest') {
      sorted.sort((a, b) => +new Date(b.last_seen_at) - +new Date(a.last_seen_at));
    }

    /**
     * Sold out sinks to the bottom, whatever the chosen sort (F11).
     *
     * Real scan data has these: the AURA night light is 69% off at Bitters Rd
     * with ZERO on the shelf, while Windsor Park has 6. Ranking a gone item
     * above an available one by discount alone sends someone on a drive for
     * something that is not there — the single fastest way to lose trust in
     * the alerts.
     *
     * Only a hard 0 counts. `null` means we have no store breakdown, which is
     * not the same claim as "none left".
     */
    const goneLast = (c: Candidate) => (c.stock_qty === 0 ? 1 : 0);
    sorted.sort((a, b) => goneLast(a) - goneLast(b));

    return sorted;
  }, [rows, nearRows, nearStockByProduct, store, tab, q, sort]);

  const counts = useMemo(() => ({
    all: rows.length,
    penny: rows.filter((c) => c.stage === 'penny_candidate' || c.penny_score >= 70).length,
    near: nearRows.length,
  }), [rows, nearRows]);

  const openById = useCallback(async (pid: string, sid: string) => {
    // A failed detail fetch must not set a malformed object as `sel` — the
    // detail panel reads sel.price_history / sel.store and would crash on one.
    const r = await fetch(`/api/candidates/${encodeURIComponent(pid)}/${encodeURIComponent(sid)}`);
    if (!r.ok) return;
    const body = await r.json().catch(() => null);
    if (body && typeof body === 'object') setSel(body as Detail);
  }, []);

  async function open(c: Candidate) {
    await openById(c.product_id, c.store_id);
  }

  // Open the detail panel straight away when the page is reached by a deep link.
  useEffect(() => {
    if (productId && storeId) void openById(productId, storeId);
  }, [productId, storeId, openById]);

  const [saving, setSaving] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState('');

  async function record(outcome: string) {
    if (!sel || saving) return;
    setSaving(outcome);
    setSaveErr('');
    try {
      const res = await fetch('/api/finds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: sel.product_id, store_id: sel.store_id, outcome }),
      });
      if (!res.ok) throw new Error(String(res.status));
      await Promise.all([loadStats(), open(sel)]);
    } catch {
      setSaveErr('That did not save. Check your connection and try again.');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className={`dash${compact ? ' compact' : ''}`}>
      <div className="dash-top">
        <div>
          <p className="dash-eyebrow">Find</p>
          <h1>All deals</h1>
        </div>

        <div className="zipbar">
          {/* The ZIP chip that sat here moved to the shell's top bar, which is
              now the one place the app-level ZIP is shown and edited. */}
          <label className="searchbox">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
            </svg>
            <input type="search" placeholder="Search deals, products, stores"
              value={q} onChange={(e) => setQ(e.target.value)}
              aria-label="Search deals" />
          </label>
        </div>
      </div>

      <div className="storebar">
        <span className="lbl">Shop a store</span>
        <button className={`storechip${store === null ? ' on' : ''}`} onClick={() => setStore(null)}>
          Every store
        </button>
        {RETAILERS.filter((r) => r.coverage !== 'planned').map((r) => (
          <button key={r.slug}
            className={`storechip${store === r.slug ? ' on' : ''}`}
            onClick={() => setStore(store === r.slug ? null : r.slug)}>
            {r.name}
          </button>
        ))}
      </div>

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id}
            className={`tab${tab === t.id ? ' on' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}<span className="count">{counts[t.id]}</span>
          </button>
        ))}
      </div>

      <div className="toolbar">
        <label htmlFor="sort">Sort by</label>
        <select id="sort" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="score">Most likely to be a penny</option>
          <option value="discount">Biggest discount</option>
          <option value="saves">Most saved</option>
          <option value="distance">Closest</option>
          <option value="newest">Most recently seen</option>
        </select>

        <label className="densitybox">
          <input type="checkbox" checked={compact} onChange={(e) => setCompact(e.target.checked)} />
          Fit more on screen
        </label>

        <span style={{ marginLeft: 'auto', display: 'flex', gap: 'var(--s4)', alignItems: 'center', flexWrap: 'wrap' }}>
          {hit && (
            <span className="hitrate">
              Prediction accuracy{' '}
              <b>{hit.hit_rate === null ? 'not measured yet' : `${hit.hit_rate}%`}</b>
              {hit.total > 0 && ` (${hit.found} of ${hit.total})`}
            </span>
          )}
          <span className={`health${health?.stale ? ' stale' : ''}`}>
            <span className="dot" />
            {health?.last_run
              ? `Updated ${health.hours_since}h ago`
              : 'No scan yet'}
            {/* Staleness must not be signalled by red colour alone. */}
            {health?.stale && ' · stale'}
          </span>
        </span>
      </div>

      <div className={`deckwrap${sel ? ' with-detail' : ''}`}>
        <div className="deck">
          {loading && <div className="empty">Loading deals</div>}

          {/* The paywall is the product boundary, so it gets a real screen
              rather than an error. Says what they get and where to go. */}
          {!loading && loadError?.kind === 'upgrade' && (
            <div className="empty gate">
              <h2>Pick a plan to see today&rsquo;s deals</h2>
              <p>
                The deal data is the product, so it sits behind the plan. Your setup is
                saved — choosing a plan turns the list on.
              </p>
              <Link className="btn" to="/pricing">See the plans</Link>
            </div>
          )}

          {!loading && loadError?.kind === 'error' && (
            <div className="empty">
              <h2>Could not load deals</h2>
              <p>{loadError.message}</p>
              <button className="btn" onClick={() => void load()}>Try again</button>
            </div>
          )}

          {tab === 'penny' && pennyReports.length > 0 && (
            <>
              <div className="community-head">
                <h3>Community penny reports</h3>
                <p>
                  Crowd-reported $0.01 finds from public penny lists. Penny status is
                  store-specific and never guaranteed — scan the SKU in store.
                </p>
              </div>
              {pennyReports.map((r) => (
                <button
                  key={r.report_id}
                  className="card-deal"
                  onClick={() => { const u = r.product_url ?? r.source_url; if (u) window.open(u, '_blank', 'noopener'); }}
                >
                  <div className="card-img">
                    <span className="badge-off">PENNY</span>
                    {r.image_url ? <img src={r.image_url} alt="" loading="lazy" decoding="async" /> : <Ph />}
                  </div>
                  <div className="card-body">
                    <span className="retailer">Home Depot</span>
                    <p className="card-title">{r.title}</p>
                    <div className="card-price">
                      <span className="now">$0.01</span>
                      {r.list_price !== null && <span className="was">Was <b>{money(Number(r.list_price))}</b></span>}
                    </div>
                    <div className="card-facts">
                      <span className="card-possible">
                        Reported {r.state ? `in ${r.state}` : 'by the community'}
                        {r.store_number ? ` · Store #${r.store_number}` : ''}
                      </span>
                      <span>
                        via {r.source}{r.reported_at ? ` · ${ago(r.reported_at)}` : ''}
                        {r.sku ? ` · SKU ${r.sku}` : ''}
                      </span>
                    </div>
                    <span className="card-cta">Check on Home Depot</span>
                  </div>
                </button>
              ))}
            </>
          )}

          {!loading && !loadError && shown.length === 0 && !(tab === 'penny' && pennyReports.length > 0) && (
            <div className="empty">
              {rows.length > 0 ? (
                'Nothing matches those filters. Try a different store or clear the search.'
              ) : coverage && !coverage.covered ? (
                /* Not a failure of ours to explain away — a place we do not
                   cover yet. Saying "the scan collected nothing" would blame
                   the wrong thing and read as broken. */
                <>
                  <h2>Not in your area yet</h2>
                  <p>{coverage.message}</p>
                </>
              ) : (
                <>
                  <h2>No deals collected yet</h2>
                  <p>The daily scan has not recorded anything for your stores yet.</p>
                </>
              )}
            </div>
          )}

          {shown.map((c) => (
            <DealCard key={`${c.product_id}|${c.store_id}`} c={c}
              selected={!!sel && sel.product_id === c.product_id && sel.store_id === c.store_id}
              onOpen={() => void open(c)} />
          ))}
        </div>

        {sel && (
          <div className="detail">
            <h2>{sel.title}</h2>
            <p className="sub">{retailerName(sel.retailer)} · SKU {sel.sku} · {sel.confidence}</p>

            <div className="grid">
              <div className="cell"><div className="k">Score</div><div className="v">{sel.penny_score}</div></div>
              <div className="cell"><div className="k">Price</div><div className="v" style={{ color: 'var(--go)' }}>{money(sel.price)}</div></div>
              <div className="cell"><div className="k">Discount</div><div className="v">{pct(sel.discount_pct)}</div></div>
              <div className="cell"><div className="k">In stock</div><div className="v">{sel.stock_qty ?? '?'}</div></div>
              <div className="cell"><div className="k">Distance</div><div className="v">{sel.store.distance_mi ?? '?'} mi</div></div>
            </div>

            <div className="chartwrap">
              <div className="chartlabel">How the price moved</div>
              <PriceChart points={sel.price_history} />
            </div>

            <div className="stages">
              {STAGES.map((s) => (
                <span key={s.code} className={`pill${sel.stage === s.code ? ' on' : ''}`}>{s.label}</span>
              ))}
            </div>

            <p className="chartlabel" style={{ marginBottom: 'var(--s3)' }}>
              {sel.store.name}
              {sel.store.maps_url && <> · <a href={sel.store.maps_url} target="_blank" rel="noreferrer">Directions</a></>}
              {/* The retailer's own listing. Confirms the item is real and
                  carries the photos and specs we deliberately do not mirror. */}
              {sel.product_url && <> · <a href={sel.product_url} target="_blank" rel="noreferrer">View on {retailerName(sel.retailer)}</a></>}
            </p>

            {/* Answers "is it near ME", which the sweep cannot: it only knows
                the stores it happened to see. Uses the app-level ZIP from the
                top bar, so there is nothing to type here. */}
            <FindStock productId={sel.product_id} />

            <div className="actions">
              <button className="found" disabled={!!saving} onClick={() => void record('found')}>
                {saving === 'found' && <span className="spin" aria-hidden="true" />}
                {saving === 'found' ? 'Saving' : 'Found it'}
              </button>
              <button className="missed" disabled={!!saving} onClick={() => void record('not_found')}>
                {saving === 'not_found' && <span className="spin" aria-hidden="true" />}
                {saving === 'not_found' ? 'Saving' : 'Not there'}
              </button>
              <button disabled={!!saving} onClick={() => void record('wrong_price')}>
                {saving === 'wrong_price' && <span className="spin" aria-hidden="true" />}
                {saving === 'wrong_price' ? 'Saving' : 'Wrong price'}
              </button>
            </div>

            {saveErr && <p role="alert" style={{ color: 'var(--drop)', fontSize: 15, marginTop: 'var(--s3)' }}>{saveErr}</p>}

            {sel.prior_finds.length > 0 && (
              <div className="priors">
                {sel.prior_finds.map((f, i) => (
                  <div key={i}>{new Date(f.recorded_at).toLocaleDateString()}: {f.outcome.replace('_', ' ')}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <p className="note">
        Prices and stock are from the last time we looked, not a live feed. Every outcome you
        record grades the score that sent you there, which is what turns the number from a
        guess into a measurement.
      </p>
    </div>
  );
}

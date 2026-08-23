import { useEffect, useState, useCallback, useMemo, type CSSProperties } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { money, ago, hdStoreUrl, displayTitle, statesLine } from '../lib/deal-ui.js';
import { readSetup } from '../lib/setup.js';
import { RETAILERS } from '../lib/retailers.js';
import FindStock from '../components/FindStock.js';
import StoreLedger from '../components/StoreLedger.js';
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
  discount_pct: string | number | null;
  state: string | null;
  city: string | null;
  store_number: string | null;
  product_url: string | null;
  source_url: string | null;
  image_url: string | null;
  reported_at: string | null;
  /** Reported shelf count at the reported store (clearance rows). */
  stock_reported: number | null;
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
  /** HD flags an in-store clearance price it will not print online. */
  hidden_clearance?: boolean;
  /** The ACTUAL in-store clearance price, when the retailer gave us one.
   *  Null means we know a clearance exists but not its number — say exactly
   *  that, never guess a figure. */
  clearance_price?: number | null;
  clearance_pct?: number | null;
  /** The store that price belongs to, and how wide the sample was. Clearance
   *  is per store, so "as low as" needs both to be honest. */
  clearance_store?: string | null;
  clearance_stores_checked?: number | null;
  /** Exact units per store — the ledger. Empty when we have never counted. */
  stores?: Array<{ store: string; qty: number | null; distance_mi: number | null }>;
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

const pct = (n: number | null) => (n === null ? 'Unknown' : `${Math.round(n)}%`);

/**
 * What a card ACTUALLY shows, for sorting.
 *
 * A clearance row carries its real markdown in clearance_pct and its real
 * price in clearance_price, while discount_pct is 0 — so sorting on
 * discount_pct alone would rank a 90%-off floor below a 28% air purifier.
 * These read the same values the card prints.
 */
const hasRealClearance = (c: Candidate): boolean =>
  typeof c.clearance_price === 'number' &&
  typeof c.price === 'number' &&
  c.clearance_price < c.price;

const effOff = (c: Candidate): number =>
  hasRealClearance(c) ? (c.clearance_pct ?? 0) : (c.discount_pct ?? 0);

const effPrice = (c: Candidate): number | null =>
  hasRealClearance(c) ? (c.clearance_price as number) : c.price;

const effSaves = (c: Candidate): number =>
  hasRealClearance(c)
    ? Math.round(((c.price as number) - (c.clearance_price as number)) * 100) / 100
    : (c.saves ?? 0);

/** Stock line for the nearby feed — shown even when 0 or unknown. This is the
 *  local half: the deal is national, the count is where the shopper is. */
function stockText(s: { qty: number | null; store: string | null; distance_mi: number | null }): string {
  if (!s.store) return 'No tracked store near you yet';
  const where = s.distance_mi != null ? `${s.store} · ${s.distance_mi} mi` : s.store;
  if (s.qty === null) return `Stock unknown · ${where}`;
  if (s.qty === 0) return `0 in stock · ${where}`;
  return `${s.qty} in stock · ${where}`;
}

/* money / ago / hdStoreUrl / displayTitle / statesLine live in lib/deal-ui.ts,
   shared with the penny detail page. */

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

function DealCard({ c, selected, onOpen, idx = 0 }: { c: Candidate; selected: boolean; onOpen: () => void; idx?: number }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = c.image_url && !imgFailed;

  /**
   * A clearance price only counts when it is actually BELOW the shelf price.
   * HD returns some items with clearance.value equal to the shelf price and
   * percentageOff 0 — flagged, but not marked down. Printing that as a
   * clearance price would invent a saving that does not exist.
   */
  const clearedPrice =
    c.hidden_clearance &&
    typeof c.clearance_price === 'number' &&
    typeof c.price === 'number' &&
    c.clearance_price < c.price
      ? c.clearance_price
      : null;

  /**
   * INK DENSITY ENCODES DEPTH.
   *
   * Every card used to shout equally — a 25%-off faucet carried the same
   * visual weight as a 90%-off floor — so a grid of six had no ranking to
   * scan. A thermal printer burns darker the more it prints, so the discount
   * is set in more ink the deeper it goes. The tier is real information, not
   * decoration: it is the order a reseller would work the list in.
   */
  const off = clearedPrice !== null ? (c.clearance_pct ?? null) : c.discount_pct;

  /**
   * FOUR TIERS, AND THE TOP ONE IS RARE ON PURPOSE.
   *
   * grail 80%+   the find you drive across town for
   * deep  60-79  a real haul
   * mid   40-59  worth the stop
   * light  <40   honest, and visibly the shallowest cut
   *
   * If everything were a grail, nothing would be. On the current feed this is
   * 2 of 18 — which is what makes the treatment mean something when it shows.
   */
  const tier =
    off === null ? null : off >= 80 ? 'grail' : off >= 60 ? 'deep' : off >= 40 ? 'mid' : 'light';

  const saved =
    clearedPrice !== null && typeof c.price === 'number'
      ? Math.round((c.price - clearedPrice) * 100) / 100
      : c.saves;


  return (
    <button
      /* NEVER "GONE".
         A zero count is one store's shelf, not the chain's. Marking the whole
         card gone — and greying it out — told a customer the deal was dead
         when it may be sitting on a shelf two towns over. Stock belongs in the
         per-store ledger, where it is attributed to the store it came from. */
      className={`card-deal${selected ? ' sel' : ''}${tier ? ` is-${tier}` : ''}`}
      style={{ '--i': Math.min(idx, 16) } as CSSProperties} onClick={onOpen}>
      <div className="card-img">
        {/* The percentage moved out of this corner and into the body, where it
            is the hero. Repeating it here would be the same fact twice. */}
        {c.hidden_clearance && <span className="badge-off">CLEARANCE</span>}
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

        {/* THE HOOK. In a grid of six at ~190px wide, the number that makes
            someone stop is the depth of the cut, not the price — the price is
            what they read second, once the card has earned the look. */}
        {off !== null && off > 0 && (
          <div className={`card-off tier-${tier}`}>
            <span className="off-n">{Math.round(off)}</span>
            <span className="off-u">% off</span>
            {/* The grail stamp. Earned at 80%+, so it stays rare enough to
                mean something when it appears. */}
            {tier === 'grail' && <span className="grail-mark">◆ Grail</span>}
          </div>
        )}

        {/* BOTH PRICES, ALWAYS. A card must never advertise a deal without
            naming a number. */}
        <div className="card-price">
          {/* NO CLICK TO SEE THE PRICE.
              The reveal existed only because these cards once had no number to
              show — Home Depot hides it, and we had not fetched it yet. The
              multi-store check gets the real price, so hiding it behind a tap
              was friction in front of information we already had. */}
          {c.hidden_clearance && clearedPrice !== null ? (
            /* "AS LOW AS" — clearance is per store, so this is the cheapest
               real price we found, not a price every store honors. Saying
               just "$7.03" would promise something Home Depot does not. */
            <>
              <span className="as-low">As low as</span>
              <span className="now">{money(clearedPrice)}</span>
              <span className="was">was <s>{money(c.price)}</s> in store</span>
            </>
          ) : (
            <>
              <span className="now">{money(c.price)}</span>
              {c.list_price !== null && (
                <span className="was">was <s>{money(c.list_price)}</s></span>
              )}
            </>
          )}
        </div>

        {/* The dollar magnitude, which the percentage cannot carry: 90% off a
            $12 hook and 90% off a $134 floor are not the same errand. Set
            quietly — the percentage is already doing the shouting, and two
            loud things beside each other are neither. */}
        {saved !== null && saved > 0 && (
          <div className="card-save">You save {money(saved)}</div>
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
          <span className="card-possible">
            {c.hidden_clearance && clearedPrice !== null
              ? `Cheapest at ${c.clearance_store ?? 'a nearby store'} · scan yours to confirm`
              : 'Possible deal · check your store'}
          </span>
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
  const [clearanceReports, setClearanceReports] = useState<CommunityReport[]>([]);
  // Penny cards navigate to their own PAGE (/app/p/:id) — founder-mandated;
  // it also makes every penny a shareable URL.
  const nav = useNavigate();
  // The nearest store's number for THIS ZIP — used only inside Home Depot
  // links (?store=NNN) so HD opens in the customer's store mode. Never shown.
  const [nearestStoreNum, setNearestStoreNum] = useState<string | null>(null);
  const [sel, setSel] = useState<Detail | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [hit, setHit] = useState<HitRate | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ kind: 'upgrade' | 'error'; message: string } | null>(null);
  const [coverage, setCoverage] = useState<Coverage | null>(null);

  // Home Depot is pennies-first (founder decision 2026-08-22): the app opens
  // on the Penny track; ?tab=all / ?tab=near deep-link the other views.
  const [tab, setTab] = useState<TabId>(() => {
    const q = new URLSearchParams(window.location.search).get('tab');
    return q === 'all' || q === 'near' || q === 'penny' ? q : 'penny';
  });
  /**
   * ?store=<slug> scopes the feed to one retailer — this is what the sidebar's
   * Home Depot / Target entries link to.
   *
   * It has to be a QUERY PARAM, not a route: THE TAPE redesign culled
   * /app/deals/:retailer and /app/stock/:retailer, so those paths now redirect
   * to /app and the old sidebar links quietly did nothing.
   */
  const [store, setStore] = useState<string | null>(() =>
    new URLSearchParams(window.location.search).get('store'),
  );
  const [q, setQ] = useState('');
  /* Default to the deepest cut. 'score' ranked by penny_score, which is 0 for
     every verified deal, so the feed opened in arbitrary order. */
  const [sort, setSort] = useState('discount');

  /**
   * Keep the retailer scope in step with the URL.
   *
   * Home Depot and Target are the same route with a different query, so React
   * Router does not remount this page when you move between them — without
   * this, the second click would change the address bar and nothing else.
   */
  const { search } = useLocation();
  useEffect(() => {
    const p = new URLSearchParams(search);
    setStore(p.get('store'));
    const t = p.get('tab');
    if (t === 'all' || t === 'near' || t === 'penny') setTab(t);
  }, [search]);

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
      /**
       * The feed reads the VERIFIED pool, not the raw sweep. Every row here
       * was checked against Home Depot's own store-level data: a real
       * markdown clearing the price-tiered floor, or hidden clearance HD
       * flagged but would not price online. The old /api/candidates feed
       * published whatever the scraper claimed - it was 97% wrong.
       */
      const r = await fetch('/api/deals/published?limit=200');
      const body = await r.json().catch(() => null);

      if (r.status === 402) {
        setRows([]);
        setLoadError({ kind: 'upgrade', message: body?.error ?? 'This needs a plan.' });
        return;
      }
      if (!r.ok || !body || !Array.isArray(body.deals)) {
        setRows([]);
        setLoadError({
          kind: 'error',
          message: body?.error ?? 'Could not load deals.',
        });
        return;
      }
      // Map the verified pool onto the card shape the deck already renders.
      const mapped: Candidate[] = (body.deals as Array<Record<string, unknown>>).map((d) => {
        const price = d.hd_price === null || d.hd_price === undefined ? null : Number(d.hd_price);
        const disc = d.hd_discount === null || d.hd_discount === undefined ? null : Number(d.hd_discount);
        const hidden = d.deal_kind === 'hidden_clearance';
        // The "was" price is READ, never derived. Back-computing it from a
        // rounded discount (price / (1 - disc/100)) printed "was $45.92" on the
        // Stanley 30 oz while the feed's own hd_list said $45.49 — a figure the
        // shopper can check against the shelf tag, and we were 43 cents wrong.
        // No hd_list means no "was" line: an absent number beats an invented one.
        const list = !hidden && d.hd_list !== null && d.hd_list !== undefined
          ? Number(d.hd_list)
          : null;
        // The pool is multi-retailer. Take the retailer from the ROW — hardcoding
        // it here made every Target row render as Home Depot.
        const slug = String(d.retailer ?? 'homedepot');
        const clr = d.clearance_price === null || d.clearance_price === undefined
          ? null : Number(d.clearance_price);
        const clrPct = d.clearance_pct === null || d.clearance_pct === undefined
          ? null : Number(d.clearance_pct);
        return {
          product_id: `${slug}:${String(d.item_id)}`,
          store_id: String(d.hd_store_id ?? ''),
          title: String(d.title ?? ''),
          category: null,
          retailer: slug,
          image_url: (d.image_url as string) ?? null,
          store_name: '',
          store_number: null,
          aisle_bay: null,
          other_stores: 0,
          // Hidden clearance is an in-store-only price by definition.
          in_store_only: hidden,
          distance_mi: null,
          stage: '',
          penny_score: 0,
          confidence: '',
          price,
          list_price: list,
          saves: list !== null && price !== null ? Math.round((list - price) * 100) / 100 : null,
          discount_pct: hidden ? null : disc,
          stock_qty: d.hd_quantity === null || d.hd_quantity === undefined ? null : Number(d.hd_quantity),
          last_seen_at: (d.checked_at as string) ?? new Date().toISOString(),
          product_url: (d.product_url as string) ?? null,
          hidden_clearance: hidden,
          clearance_price: clr,
          clearance_pct: clrPct,
          clearance_store: (d.clearance_store as string) ?? null,
          clearance_stores_checked:
            d.clearance_stores_checked === null || d.clearance_stores_checked === undefined
              ? null
              : Number(d.clearance_stores_checked),
          stores: Array.isArray(d.stores)
            ? (d.stores as Candidate['stores'])
            : [],
        } as Candidate;
      });
      setRows(mapped);
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
      setNearestStoreNum(typeof body.nearest_store_number === 'string' ? body.nearest_store_number : null);
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
      try {
        const r = await fetch('/api/community-deals?kind=clearance&limit=60');
        const body = await r.json().catch(() => null);
        if (r.ok && body && Array.isArray(body.reports)) setClearanceReports(body.reports as CommunityReport[]);
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
    // The penny spool keeps its own ranking; it is scored, not discounted.
    if (tab === 'penny') sorted.sort((a, b) => b.penny_score - a.penny_score);
    else if (tab === 'near') sorted.sort((a, b) => (a.distance_mi ?? 1e9) - (b.distance_mi ?? 1e9));
    else if (sort === 'saves') sorted.sort((a, b) => effSaves(b) - effSaves(a));
    else if (sort === 'price-low') {
      // Unpriced rows sink rather than pretending to be free.
      sorted.sort((a, b) => (effPrice(a) ?? 1e9) - (effPrice(b) ?? 1e9));
    } else if (sort === 'price-high') {
      sorted.sort((a, b) => (effPrice(b) ?? -1) - (effPrice(a) ?? -1));
    } else if (sort === 'newest') {
      sorted.sort((a, b) => +new Date(b.last_seen_at) - +new Date(a.last_seen_at));
    } else {
      // 'discount' — the default, and the one the tier ladder is built on.
      sorted.sort((a, b) => effOff(b) - effOff(a));
    }

    /**
     * NO SOLD-OUT DEMOTION.
     *
     * This used to sink any deal whose checked store read 0, to avoid sending
     * someone on a wasted drive. Its own example gave the game away: the AURA
     * night light is 69% off with ZERO at Bitters Rd and SIX at Windsor Park.
     * Sinking it buried a deal that was in stock two towns over.
     *
     * The catalog is national and stock is a per-store overlay, so one store's
     * empty shelf ranks nothing. Availability is shown in the ledger, attributed
     * to the store it came from, where the reader can act on it.
     */
    return sorted;
  }, [rows, nearRows, nearStockByProduct, store, tab, q, sort]);

  const counts = useMemo(() => ({
    all: rows.length,
    // The penny spool = community reports + our ladder candidates. The badge
    // must count what the tab actually shows (the "Penny track 0" bug).
    penny: pennyReports.length + rows.filter((c) => c.stage === 'penny_candidate' || c.penny_score >= 70).length,
    near: nearRows.length,
  }), [rows, nearRows, pennyReports]);

  const openById = useCallback(async (pid: string, sid: string) => {
    // A failed detail fetch must not set a malformed object as `sel` — the
    // detail panel reads sel.price_history / sel.store and would crash on one.
    const r = await fetch(`/api/candidates/${encodeURIComponent(pid)}/${encodeURIComponent(sid)}`);
    if (!r.ok) return;
    const body = await r.json().catch(() => null);
    if (body && typeof body === 'object') setSel(body as Detail);
  }, []);

  /**
   * Build a Detail from a row we already hold.
   *
   * Verified-pool deals (Home Depot and Target alike) do not exist in the
   * `candidates` table, so /api/candidates/:pid/:sid 404s for them and the
   * panel silently never opened — the fetch failure is swallowed by design so
   * a malformed object can't crash the panel. The row itself already carries
   * everything the panel shows, so fall back to it instead of showing nothing.
   */
  function detailFromRow(c: Candidate): Detail {
    return {
      ...c,
      sku: c.product_id.split(':')[1] ?? c.product_id,
      stage_entered_at: c.last_seen_at,
      store: {
        name: c.store_name || 'Your store',
        address: null,
        distance_mi: c.distance_mi,
        maps_url: null,
      },
      // No history for a pool row: we have one reading, not a series. An empty
      // array renders an empty chart, which is honest; a fabricated line is not.
      price_history: [],
      prior_finds: [],
    };
  }

  async function open(c: Candidate) {
    const isPoolRow = !c.stage && c.penny_score === 0;
    if (isPoolRow) {
      /* Verified deals get a real PAGE, not a side panel — the founder's call,
         and the only form that can be shared or opened in a second tab. The
         product_id is "<retailer>:<itemId>". */
      const [slug, itemId] = c.product_id.split(':');
      if (slug && itemId) {
        nav(`/app/d/${encodeURIComponent(slug)}/${encodeURIComponent(itemId)}`);
        return;
      }
    }
    if (!isPoolRow) {
      await openById(c.product_id, c.store_id);
      return;
    }
    // Try the rich endpoint anyway, but never leave the click doing nothing.
    try {
      const r = await fetch(
        `/api/candidates/${encodeURIComponent(c.product_id)}/${encodeURIComponent(c.store_id)}`,
      );
      if (r.ok) {
        const body = await r.json().catch(() => null);
        if (body && typeof body === 'object') {
          // Keep the ledger from the row: the detail endpoint has no stores.
          setSel({ ...(body as Detail), stores: c.stores ?? [] });
          return;
        }
      }
    } catch {
      /* fall through to the local row */
    }
    setSel(detailFromRow(c));
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
    <div className="dash">
      {/* The activation moment must not be silent: a passive nudge (never a
          modal) that focuses the header ZIP input. */}
      {!appZip && (
        <button
          className="zip-nudge"
          onClick={() => {
            const el = document.querySelector<HTMLInputElement>('input[aria-label="ZIP code used for every stock check"]');
            el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el?.focus();
          }}
        >
          Set your ZIP to see stock near you →
        </button>
      )}

      {/* THE TAPE: one Find page, two spools. The header row is the toggle
          plus search; chips/sort/density controls are culled — the feed's
          default order IS the product's opinion. */}
      <div className="spools" role="tablist">
        <button role="tab" aria-selected={tab !== 'penny'}
          className={`spool${tab !== 'penny' ? ' on' : ''}`}
          onClick={() => setTab('all')}>
          All deals <span className="count">{counts.all}</span>
        </button>
        <button role="tab" aria-selected={tab === 'penny'}
          className={`spool${tab === 'penny' ? ' on' : ''}`}
          onClick={() => setTab('penny')}>
          Penny deals <span className="count">{counts.penny}</span>
        </button>

        <label className="searchbox">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
          </svg>
          <input type="search" placeholder="Search deals"
            value={q} onChange={(e) => setQ(e.target.value)}
            aria-label="Search deals" />
        </label>

        {/* SORT. The logic for this existed but nothing ever set it, so the
            feed was stuck on penny_score — which is 0 for every verified deal,
            making the order arbitrary. */}
        <label className="sortbox">
          <span className="sortbox-label">Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort deals">
            <option value="discount">Biggest discount</option>
            <option value="saves">Biggest saving</option>
            <option value="price-low">Lowest price</option>
            <option value="price-high">Highest price</option>
            <option value="newest">Newest</option>
          </select>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M5 8l5 5 5-5" />
          </svg>
        </label>

        <span className={`health${health?.stale ? ' stale' : ''}`}>
          {health?.last_run ? `Updated ${health.hours_since}h ago` : 'No scan yet'}
          {/* Staleness must not be signalled by colour alone. */}
          {health?.stale && ' · stale'}
        </span>
      </div>

      <div className={`deckwrap${sel ? ' with-detail' : ''}`}>
        {/* Keyed by tab: switching spools tears the old tape off and prints
            the new one (CSS: .deck animation). */}
        <div className="deck" key={tab}>
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
              {pennyReports.map((r, i) => (
                <button
                  key={r.report_id}
                  className="card-deal invert"
                  style={{ '--i': Math.min(i, 16) } as CSSProperties}
                  onClick={() => nav(`/app/p/${r.report_id}`)}
                >
                  <div className="card-img">
                    <span className="badge-off">PENNY</span>
                    {r.image_url ? <img src={r.image_url} alt="" loading="lazy" decoding="async" /> : <Ph />}
                  </div>
                  <div className="card-body">
                    <span className="retailer">Home Depot</span>
                    <p className="card-title">{displayTitle(r.title)}</p>
                    <div className="card-price">
                      <span className="now">$0.01</span>
                      {r.list_price !== null && <span className="was">Was <b>{money(Number(r.list_price))}</b></span>}
                    </div>
                    <div className="card-facts">
                      <span className="card-possible">
                        Reported {r.state ? `in ${statesLine(r.state)}` : 'by the community'}
                        {r.store_number ? ` · Store #${r.store_number}` : ''}
                      </span>
                      <span>
                        via {r.source}{r.reported_at ? ` · ${ago(r.reported_at)}` : ''}
                        {r.sku ? ` · SKU ${r.sku}` : ''}
                      </span>
                    </div>
                    <span className="card-cta">See all the details</span>
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

          {shown.map((c, i) => (
            <DealCard key={`${c.product_id}|${c.store_id}`} c={c} idx={i}
              selected={!!sel && sel.product_id === c.product_id && sel.store_id === c.store_id}
              onOpen={() => void open(c)} />
          ))}

          {/* Community deep-clearance reports — other crowds' store-specific
              finds (via rebelsavings). Labeled hearsay: the store, shelf count
              and discount are THEIR report, not our sweep. The link opens HD
              already in the REPORTED store's mode. */}
          {tab === 'all' && clearanceReports.length > 0 && (
            <>
              <div className="community-head">
                <h3>Community clearance reports</h3>
                <p>
                  Store-specific deep clearance reported around the country. Not our scan —
                  confirm in store; the link opens Home Depot in the reported store's view.
                </p>
              </div>
              {clearanceReports.map((r, i) => (
                <button
                  key={r.report_id}
                  className="card-deal"
                  style={{ '--i': Math.min(i, 16) } as CSSProperties}
                  onClick={() => { const u = r.product_url ?? r.source_url; if (u) window.open(u, '_blank', 'noopener'); }}
                >
                  <div className="card-img">
                    {r.discount_pct !== null && <span className="badge-off">{Math.round(Number(r.discount_pct))}% off</span>}
                    {r.image_url ? <img src={r.image_url} alt="" loading="lazy" decoding="async" /> : <Ph />}
                  </div>
                  <div className="card-body">
                    <span className="retailer">Home Depot</span>
                    <p className="card-title">{r.title}</p>
                    <div className="card-price">
                      <span className="now">{money(r.price !== null ? Number(r.price) : null)}</span>
                      {r.list_price !== null && <span className="was">Was <b>{money(Number(r.list_price))}</b></span>}
                    </div>
                    <div className="card-facts">
                      <span className="card-possible">
                        {r.stock_reported !== null ? `${r.stock_reported} reported on the shelf` : 'Reported'}
                        {r.city && r.state ? ` · ${r.city}, ${r.state}` : r.state ? ` · ${r.state}` : ''}
                      </span>
                      <span>via {r.source}{r.reported_at ? ` · ${ago(r.reported_at)}` : ''}</span>
                    </div>
                    <span className="card-cta">Check on Home Depot</span>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>

        {sel && (
          <div className="detail">
            <h2>{sel.title}</h2>
            <p className="sub">{retailerName(sel.retailer)} · SKU {sel.sku} · {sel.confidence}</p>

            <div className="grid">
              <div className="cell"><div className="k">Score</div><div className="v">{sel.penny_score}</div></div>
              <div className="cell"><div className="k">Price</div><div className="v" style={{ color: 'var(--go)' }}>{money(sel.price)}</div></div>
              {/* Hidden-clearance rows carry no online discount by design, so
                  this cell read "Unknown" while the row's own clearance_pct
                  said 75-90% off. Show the markdown we actually measured. */}
              <div className="cell"><div className="k">Discount</div><div className="v">
                {pct(sel.discount_pct ?? sel.clearance_pct ?? null)}
              </div></div>
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
              {sel.product_url && <> · <a
                href={hdStoreUrl(sel.product_url, sel.store_id?.split(':')[1] ?? nearestStoreNum) ?? sel.product_url}
                target="_blank" rel="noreferrer">View on {retailerName(sel.retailer)}</a></>}
            </p>

            {/* THE LEDGER — exact units per store, zeros printed.
                Only rendered when we actually counted; an empty ledger shows
                nothing rather than an empty frame implying we looked. */}
            {sel.stores && sel.stores.length > 0 && (
              <>
                <div className="chartlabel" style={{ marginBottom: 'var(--s2)' }}>
                  Units by store
                </div>
                <StoreLedger rows={sel.stores} readAt={sel.last_seen_at} />
              </>
            )}

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

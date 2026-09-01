/**
 * Report a clearance find — the spotter's submission form (v1).
 *
 * Register/in-store-only markdowns are the whole product: DG's penny in the
 * register, TSC's red-tag remnants, and the big-box in-store clearances Akamai
 * walls us out of scraping at scale. The crowd is the only sensor, so this is
 * the form a member fills after confirming a find on a shelf. It writes a
 * community_report (labelled hearsay) and credits the reporter's reputation.
 *
 * v1 adds RESALE MARGIN: a spotter can say what it flips for, and the feed then
 * ranks finds by estimated profit, not just discount %. The resale number is
 * the spotter's own estimate (we have no live comp) and is always labelled one.
 *
 * Sourcing rule (company/routines/*-reports.md): report YOUR OWN in-store find.
 * This is not a place to paste someone's leaked or copied list.
 */

import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, useAuth } from '../../lib/auth.js';
import '../../resell.css';

type Kind = 'penny' | 'clearance';

interface RetailerCfg {
  slug: string;         // dashless, sent to the API (matches REPORT_SOURCES)
  name: string;
  allowPenny: boolean;  // DG has a penny mechanic; the rest are clearance-only
  lede: string;
  placeholder: string;  // an on-brand example product
}

const RETAILERS: Record<string, RetailerCfg> = {
  // --- Big-box in-store clearance (v1): the store-specific markdowns behind
  //     Akamai. The spotter standing in the aisle is the verification. ---
  'home-depot': {
    slug: 'homedepot', name: 'Home Depot', allowPenny: false,
    lede: 'You found a yellow-tag in-store clearance on the shelf. Tell the rest of us where. The markdown is store by store, so the store number matters.',
    placeholder: 'e.g. Husky 52 in. Tool Chest',
  },
  lowes: {
    slug: 'lowes', name: "Lowe's", allowPenny: false,
    lede: 'You found a manager markdown on the shelf. Tell the rest of us where. Clearance stock is one store at a time.',
    placeholder: 'e.g. Kobalt 24V Blower',
  },
  target: {
    slug: 'target', name: 'Target', allowPenny: false,
    lede: 'You found a salvage/clearance endcap deal. Tell the rest of us where. The red sticker is per store, never online.',
    placeholder: 'e.g. Dyson V8 Vacuum',
  },
  walmart: {
    slug: 'walmart', name: 'Walmart', allowPenny: false,
    lede: 'You found a rollback/clearance the site never shows. Tell the rest of us where. The shelf price beats walmart.com.',
    placeholder: 'e.g. Ninja Air Fryer',
  },
  'best-buy': {
    slug: 'bestbuy', name: 'Best Buy', allowPenny: false,
    lede: 'You found an open-box or clearance tag in the store. Tell the rest of us where. These live on the shelf, not the site.',
    placeholder: 'e.g. Sony WH-1000XM5',
  },
  // --- Community penny / warehouse markdown retailers (pre-v1) ---
  'dollar-general': {
    slug: 'dollargeneral', name: 'Dollar General', allowPenny: true,
    lede: 'You scanned it in the aisle and it rang up a penny. Tell the rest of us where.',
    placeholder: 'e.g. Holiday 20oz Tumbler',
  },
  'tractor-supply': {
    slug: 'tractorsupply', name: 'Tractor Supply', allowPenny: false,
    lede: 'You found a red-tag clearance deal on the shelf. Tell the rest of us where. The price is national, but the stock never is.',
    placeholder: 'e.g. DeWalt 20V Drill Kit',
  },
  costco: {
    slug: 'costco', name: 'Costco', allowPenny: false,
    lede: 'You spotted a .97 or asterisk markdown in the warehouse. Tell the rest of us where. These never show up on costco.com.',
    placeholder: 'e.g. Anker Power Station',
  },
};

const MARKETPLACES = [
  { id: 'ebay', label: 'eBay' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'mercari', label: 'Mercari' },
  { id: 'other', label: 'Other' },
] as const;

export default function ReportFind() {
  const nav = useNavigate();
  const { me } = useAuth();
  const [params] = useSearchParams();

  const cfg = RETAILERS[params.get('retailer') ?? 'dollar-general'] ?? RETAILERS['dollar-general']!;

  const [kind, setKind] = useState<Kind>(cfg.allowPenny ? 'penny' : 'clearance');
  const [title, setTitle] = useState('');
  const [sku, setSku] = useState('');
  const [storeNumber, setStoreNumber] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [price, setPrice] = useState('');
  const [listPrice, setListPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  // v1 resale-margin inputs.
  const [resale, setResale] = useState('');
  const [marketplace, setMarketplace] = useState<(typeof MARKETPLACES)[number]['id']>('ebay');
  const [aisleBay, setAisleBay] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live profit preview: what you'd pocket over the clearance cost, BEFORE
  // marketplace fees (the server computes the exact fee-accurate margin the feed
  // ranks on). Honest and needs no fee table on the client.
  const grossFlip = useMemo(() => {
    const cost = kind === 'penny' ? 0.01 : Number(price.replace(/[^0-9.]/g, ''));
    const sell = Number(resale.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(cost) || !Number.isFinite(sell) || sell <= 0) return null;
    return Math.round((sell - cost) * 100) / 100;
  }, [price, resale, kind]);

  const canSubmit =
    title.trim().length >= 3 &&
    (storeNumber.trim().length > 0 || state.trim().length === 2) &&
    (kind === 'penny' || (price.trim() !== '' && listPrice.trim() !== ''));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await api<{ report_id: string }>('/api/community-deals/report', {
        method: 'POST',
        body: JSON.stringify({
          retailer: cfg.slug,
          kind,
          title: title.trim(),
          sku: sku.trim() || null,
          store_number: storeNumber.trim() || null,
          city: city.trim() || null,
          state: state.trim() || null,
          price: kind === 'clearance' ? price : null,
          list_price: listPrice || null,
          image_url: imageUrl.trim() || null,
          // v1 resale-margin fields (all optional).
          resale_estimate: resale.trim() || null,
          marketplace,
          aisle_bay: aisleBay.trim() || null,
        }),
      });
      // Straight to the retailer's track, where the new report now lives.
      const tab = kind === 'penny' ? 'penny' : 'all';
      nav(`/app?store=${params.get('retailer') ?? 'dollar-general'}&tab=${tab}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rs">
      <div className="dash-eyebrow">{cfg.name}</div>
      <h1 className="rs-title">Report a find</h1>
      <p className="rs-lede">
        {cfg.lede} This is a member report, one person&rsquo;s find, not verified stock,
        and it posts under your name. Report your own find, never a copied list.
      </p>

      <form className="rs-add" onSubmit={submit} style={{ flexWrap: 'wrap', gap: 'var(--s4)' }}>
        {cfg.allowPenny && (
          <div className="rs-seg" role="tablist" aria-label="Kind" style={{ display: 'flex', gap: 'var(--s2)', width: '100%' }}>
            <button type="button" role="tab" aria-selected={kind === 'penny'}
              className={`btn${kind === 'penny' ? '' : ' btn-quiet'}`} onClick={() => setKind('penny')}>
              Penny ($0.01)
            </button>
            <button type="button" role="tab" aria-selected={kind === 'clearance'}
              className={`btn${kind === 'clearance' ? '' : ' btn-quiet'}`} onClick={() => setKind('clearance')}>
              Deep clearance
            </button>
          </div>
        )}

        <label className="rs-field rs-grow" style={{ minWidth: 240 }}>
          <span>What is it?</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder={cfg.placeholder} maxLength={200} />
        </label>

        <label className="rs-field">
          <span>SKU / UPC <em style={{ color: 'var(--ink-faint)' }}>(optional)</em></span>
          <input value={sku} onChange={(e) => setSku(e.target.value.replace(/\D/g, ''))}
            placeholder="digits from the shelf tag" inputMode="numeric" maxLength={20} />
        </label>

        {kind === 'clearance' && (
          <>
            <label className="rs-field">
              <span>Price</span>
              <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="4.00" inputMode="decimal" />
            </label>
            <label className="rs-field">
              <span>Was</span>
              <input value={listPrice} onChange={(e) => setListPrice(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="39.97" inputMode="decimal" />
            </label>
          </>
        )}

        {kind === 'penny' && (
          <label className="rs-field">
            <span>Shelf price <em style={{ color: 'var(--ink-faint)' }}>(optional)</em></span>
            <input value={listPrice} onChange={(e) => setListPrice(e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="was 12.00" inputMode="decimal" />
          </label>
        )}

        <label className="rs-field">
          <span>Store #</span>
          <input value={storeNumber} onChange={(e) => setStoreNumber(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="12345" inputMode="numeric" />
        </label>
        <label className="rs-field">
          <span>City <em style={{ color: 'var(--ink-faint)' }}>(optional)</em></span>
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="San Antonio" maxLength={80} />
        </label>
        <label className="rs-field">
          <span>State</span>
          <input value={state} onChange={(e) => setState(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 2))}
            placeholder="TX" maxLength={2} style={{ width: 72 }} />
        </label>

        <label className="rs-field">
          <span>Aisle / bay <em style={{ color: 'var(--ink-faint)' }}>(optional)</em></span>
          <input value={aisleBay} onChange={(e) => setAisleBay(e.target.value)}
            placeholder="Aisle 38, Bay EC3" maxLength={40} />
        </label>

        {/* v1 RESALE MARGIN. What it flips for — your estimate — so the feed can
            rank finds by profit. Optional, but it's what turns a discount into a
            reason to drive. */}
        <label className="rs-field">
          <span>Resells for <em style={{ color: 'var(--ink-faint)' }}>(your estimate)</em></span>
          <input value={resale} onChange={(e) => setResale(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="40.00" inputMode="decimal" />
        </label>
        <label className="rs-field">
          <span>Flip on</span>
          <select value={marketplace} onChange={(e) => setMarketplace(e.target.value as typeof marketplace)}>
            {MARKETPLACES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>

        {grossFlip !== null && (
          <p className="rs-note" style={{ width: '100%', color: grossFlip > 0 ? 'var(--ok, #128a4b)' : 'var(--alert)' }}>
            {grossFlip > 0
              ? <>Est. flip: <strong>+${grossFlip.toFixed(2)}</strong> over cost, before {MARKETPLACES.find((m) => m.id === marketplace)?.label} fees. The feed ranks by profit after fees.</>
              : <>That resells for less than it costs, not a flip.</>}
          </p>
        )}

        <label className="rs-field rs-grow" style={{ minWidth: 240 }}>
          <span>Photo URL <em style={{ color: 'var(--ink-faint)' }}>(optional, https)</em></span>
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" maxLength={500} />
        </label>

        <p className="rs-note" style={{ width: '100%' }}>
          A store number or at least the state is required. Clearance stock is store by
          store, so a find has to say where.
        </p>

        {error && <p className="rs-note" style={{ color: 'var(--alert)', width: '100%' }}>{error}</p>}

        <button className="btn" type="submit" disabled={busy || !canSubmit} style={{ width: '100%' }}>
          {busy ? 'Posting…' : me ? 'Post this find' : 'Sign in to post'}
        </button>
      </form>
    </div>
  );
}

/**
 * Report a Dollar General penny find.
 *
 * DG's penny price is register-only — it exists on no feed, so the crowd is the
 * only sensor. This is the form a member fills after confirming a $0.01 (or deep
 * clearance) scan on a shelf. It writes a community_report, labelled hearsay,
 * and credits the reporter's reputation.
 *
 * Sourcing rule (company/routines/dollar-general-reports.md): this is for YOUR
 * OWN in-store find. It is not a place to paste someone's leaked penny list.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, useAuth } from '../../lib/auth.js';
import '../../resell.css';

type Kind = 'penny' | 'clearance';

export default function ReportFind() {
  const nav = useNavigate();
  const { me } = useAuth();

  const [kind, setKind] = useState<Kind>('penny');
  const [title, setTitle] = useState('');
  const [sku, setSku] = useState('');
  const [storeNumber, setStoreNumber] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [price, setPrice] = useState('');
  const [listPrice, setListPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [productUrl, setProductUrl] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          kind,
          title: title.trim(),
          sku: sku.trim() || null,
          store_number: storeNumber.trim() || null,
          city: city.trim() || null,
          state: state.trim() || null,
          price: kind === 'clearance' ? price : null,
          list_price: listPrice || null,
          image_url: imageUrl.trim() || null,
          product_url: productUrl.trim() || null,
        }),
      });
      // Straight to the DG penny track, where the new report now lives.
      nav('/app?store=dollar-general&tab=penny');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rs">
      <div className="dash-eyebrow">Dollar General</div>
      <h1 className="rs-title">Report a penny find</h1>
      <p className="rs-lede">
        You scanned it in the aisle and it rang up a penny. Tell the rest of us where.
        This is a member report — one person&rsquo;s find, not verified stock — and it
        posts under your name. Report your own find, never a copied list.
      </p>

      <form className="rs-add" onSubmit={submit} style={{ flexWrap: 'wrap', gap: 'var(--s4)' }}>
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

        <label className="rs-field rs-grow" style={{ minWidth: 240 }}>
          <span>What is it?</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Holiday 20oz Tumbler" maxLength={200} />
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
                placeholder="12.00" inputMode="decimal" />
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

        <label className="rs-field rs-grow" style={{ minWidth: 240 }}>
          <span>Photo URL <em style={{ color: 'var(--ink-faint)' }}>(optional, https)</em></span>
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" maxLength={500} />
        </label>

        <p className="rs-note" style={{ width: '100%' }}>
          A store number or at least the state is required — a penny at one DG is full
          price at the next, so a find has to say where.
        </p>

        {error && <p className="rs-note" style={{ color: 'var(--alert)', width: '100%' }}>{error}</p>}

        <button className="btn" type="submit" disabled={busy || !canSubmit} style={{ width: '100%' }}>
          {busy ? 'Posting…' : me ? 'Post this find' : 'Sign in to post'}
        </button>
      </form>
    </div>
  );
}

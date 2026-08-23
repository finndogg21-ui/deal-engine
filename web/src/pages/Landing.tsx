import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getLocalZip } from '../lib/zip.js';
import { ago } from '../lib/deal-ui.js';
import '../landing.css';

interface Spotlight {
  found: boolean;
  title?: string;
  price?: number;
  list_price?: number | null;
  discount_pct?: number | null;
  distance?: string | null;
  recorded_at?: string;
}

/** Static fallback, shown (and labeled) only when there's no real find yet. */
const EXAMPLE: Spotlight = {
  found: false,
  title: 'a 100 ft contractor garden hose',
  price: 0.01,
  list_price: 24.98,
  discount_pct: 100,
};

export default function Landing() {
  const [spot, setSpot] = useState<Spotlight | null>(null);

  useEffect(() => {
    const zip = getLocalZip();
    const qs = zip ? `?zip=${encodeURIComponent(zip)}` : '';
    void (async () => {
      try {
        const res = await fetch(`/api/public/penny-spotlight${qs}`);
        const body = await res.json().catch(() => null);
        setSpot(res.ok && body?.found ? body : EXAMPLE);
      } catch {
        setSpot(EXAMPLE);
      }
    })();
  }, []);

  const live = spot?.found === true;
  const shown = spot ?? EXAMPLE;

  return (
    <>
      {/* The thesis: the gap between the shelf tag and the register. */}
      <header className="wrap hero">
        <p className="eyebrow"><span className="live" /> San Antonio, watching 5 stores</p>

        {/* The headline really is this sentence, so it is the h1. Screen
            readers and search engines get the same thing a reader gets. */}
        <h1 className="hero-h1">
          <span className="hero-lede">Someone paid</span>
          <span className="prices">
            <span className="now"><mark>${(shown.price ?? 0.01).toFixed(2)}</mark></span>
            {shown.list_price != null && (
              <span className="was">Was <b>${shown.list_price.toFixed(2)}</b></span>
            )}
          </span>
          <span className="hero-detail">
            for {shown.title}.{' '}
            <b>
              {live ? ago(shown.recorded_at!) : 'This morning'}
              {shown.distance ? `, ${shown.distance}` : ''}
            </b>
          </span>
        </h1>
        <p className="hero-meta">
          {live ? 'A real spotter report, verified by our scan.' : 'Example — not a live report yet.'}
        </p>

        <div className="hero-cta">
          <Link className="btn" to="/app">Start hunting</Link>
          <Link className="btn btn-quiet" to="/how-it-works">See how it works</Link>
        </div>
      </header>

      <hr className="rule" />

      <section className="wrap section">
        <p className="sec-label">How it works</p>
        <h2>Clearance only moves one direction. We watch every step.</h2>

        <div className="steps">
          <div className="step">
            <div className="step-n">1</div>
            <div>
              <h3>We record every clearance price, every day</h3>
              <p>
                Home Depot and Lowe’s, store by store. Items walk down a ladder, twenty
                percent off, then half, then ninety, and we keep every rung. Nobody can go
                back and collect yesterday’s prices, which is why we started early.
              </p>
            </div>
          </div>

          <div className="step">
            <div className="step-n">2</div>
            <div>
              <h3>We catch the drop the shelf tag never shows</h3>
              <p>
                When an item disappears from the website but units are still on the floor, it
                is usually sitting at a penny in the register. We score how likely that is,
                and the score sharpens every time a member tells us what they actually found.
              </p>
            </div>
          </div>

          <div className="step">
            <div className="step-n">3</div>
            <div>
              <h3>Your phone buzzes before anyone drives over</h3>
              <p>
                Which store, how far, how many are left, and what it is worth reselling.
                Enough to decide in ten seconds, from bed.
              </p>
            </div>
          </div>
        </div>

        <p style={{ marginTop: 'var(--s6)' }}>
          <Link className="btn btn-quiet" to="/how-it-works">The longer version</Link>
        </p>
      </section>

      <hr className="rule" />

      <section className="wrap section">
        <p className="sec-label">Who it is for</p>
        <div className="who">
          <div className="who-card">
            <span className="who-tag">Resellers</span>
            <h3>Find it, flip it, know what you made</h3>
            <p>Penny finds and deep clearance near you, plus the part nobody else builds.</p>
            <ul>
              <li>Penny predictions scored by store</li>
              <li>Verified finds from people who were just there</li>
              <li>Inventory and order tracking</li>
              <li>Real profit, after fees</li>
            </ul>
          </div>

          <div className="who-card">
            <span className="who-tag">Everyone else</span>
            <h3>Type what you want. Wait. Buy it cheap.</h3>
            <p>No Discord, no channels to scroll, no learning a hobby to save money.</p>
            <ul>
              <li>Watch any product, “blender”, not a model number</li>
              <li>Alerts when it actually drops</li>
              <li>Amazon Warehouse and clearance included</li>
              <li>A running total of what you have saved</li>
            </ul>
          </div>
        </div>
      </section>

      <hr className="rule" />

      <section className="wrap section close">
        <h2>The deals are already happening.</h2>
        <p>
          Every day, clearance items quietly drop to a penny and get thrown away because
          nobody knew. We are keeping the receipts.
        </p>
        <Link className="btn" to="/pricing">See pricing</Link>
      </section>
    </>
  );
}

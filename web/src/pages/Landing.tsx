import { Link } from 'react-router-dom';
import Receipt from '../components/Receipt.js';
import '../landing.css';

export default function Landing() {
  return (
    <>
      {/* The thesis: the clearance price the shelf tag hides — plus every online deal worth chasing. */}
      <header className="wrap hero">
        <p className="eyebrow">The price the shelf tag hides</p>

        {/* The headline is the proof, in real numbers — the shelf price struck
            to the register-only price. That contrast IS the product. */}
        <h1 className="hero-h1">
          <span className="hero-lede">$89 on the shelf. <b>$12 at the register.</b></span>
          <span className="hero-detail">We found the price.</span>
        </h1>
        <p className="hero-meta">
          Register-only Home Depot clearance — the markdown your store never prints
          online. Verified in-store, sorted by what a reseller can actually flip.
        </p>

        <div className="hero-cta">
          <Link className="btn" to="/app">See a deal near you — free</Link>
          <Link className="btn btn-quiet" to="/how-it-works">How it works</Link>
        </div>

        {/* THE PROOF. A real deal from the feed, printed as the register receipt
            — the signature that shows this is verifiable, not a guess. Real
            numbers only (this is an actual published Home Depot markdown). */}
        <div className="hero-proof">
          <span className="hero-proof-label">One we found this week</span>
          <Receipt
            store="Home Depot #6574"
            location="San Antonio, TX 78232"
            item="American Originals Natural Red Oak 3/4 in. Solid Hardwood Flooring"
            sku="304-871-208"
            shelf="$133.85"
            register="$14.00"
            offPct={90}
            when="verified in-store · 2 days ago"
          />
        </div>
      </header>

      <hr className="rule" />

      <section className="wrap section">
        <p className="sec-label">How it works</p>
        <h2>The price the register knows and the website doesn&rsquo;t.</h2>

        <div className="steps">
          <div className="step">
            <div className="step-n">1</div>
            <div>
              <h3>We read the register price</h3>
              <p>
                Home Depot cuts prices at the register that never hit the shelf tag or the
                website. We read that register-only price store by store — the markdown you
                can&rsquo;t find by walking in or opening their app. That&rsquo;s the moat.
              </p>
            </div>
          </div>

          <div className="step">
            <div className="step-n">2</div>
            <div>
              <h3>A spotter verifies it in-store</h3>
              <p>
                Before a deal reaches you it&rsquo;s confirmed on a real shelf, with a real
                timestamp — the spotter-verified stamp on the receipt. No fake stock, no
                back-computed discounts. If we haven&rsquo;t verified it, you don&rsquo;t see it.
              </p>
            </div>
          </div>

          <div className="step">
            <div className="step-n">3</div>
            <div>
              <h3>You drive, buy, and flip</h3>
              <p>
                The register price, which stores near you have it, and what it&rsquo;s worth to
                resell after fees — enough to decide in ten seconds. Plus every online clearance
                worth chasing (Woot, Best Buy Outlet, Target, Ollie&rsquo;s) in the same feed.
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
            <p>Deep clearance across ten retailers, plus the in-store part nobody else builds.</p>
            <ul>
              <li>Every deal ranked by real profit, after fees</li>
              <li>In-store clearance prices, store by store</li>
              <li>Inventory and order tracking</li>
              <li>Penny predictions, scored and labeled as predictions</li>
            </ul>
          </div>

          <div className="who-card">
            <span className="who-tag">Everyone else</span>
            <h3>Type what you want. Wait. Buy it cheap.</h3>
            <p>No Discord, no channels to scroll, no learning a hobby to save money.</p>
            <ul>
              <li>Watch any product, “blender”, not a model number</li>
              <li>Alerts when it actually drops</li>
              <li>Outlet and clearance across ten retailers</li>
              <li>A running total of what you have saved</li>
            </ul>
          </div>
        </div>
      </section>

      <hr className="rule" />

      <section className="wrap section close">
        <h2>The deals are already happening.</h2>
        <p>
          Every day, clearance items quietly drop and get bought by whoever knew first. We keep the
          receipts, online and in-store, and put them where you can act on them.
        </p>
        <Link className="btn" to="/pricing">See pricing</Link>
      </section>
    </>
  );
}

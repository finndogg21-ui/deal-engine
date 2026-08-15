import { Link } from 'react-router-dom';
import { BRAND } from '../App.js';
import '../landing.css';

export default function Landing() {
  return (
    <div className="lp">
      <nav className="lp-nav">
        <Link to="/" className="wordmark">{BRAND}</Link>
        <div className="lp-nav-right">
          <a href="#how">How it works</a>
          <a href="#who">Who it's for</a>
          <a href="#pricing">Pricing</a>
          <Link to="/app" className="btn btn-quiet">Open the app</Link>
        </div>
      </nav>

      <hr className="tear" />

      {/* The thesis: the gap between the shelf tag and the register. */}
      <header className="hero">
        <p className="eyebrow"><span className="live" /> San Antonio · watching 5 stores</p>

        <p className="hero-lede">Someone paid</p>
        <div className="prices">
          <span className="was">$24.98</span>
          <span className="now"><mark>$0.01</mark></span>
        </div>

        <p className="hero-detail">
          for a 100 ft contractor garden hose. <b>This morning, 1.4 miles away.</b>
        </p>
        <p className="hero-meta">62 still on the shelf · aisle 50, bay 001</p>

        <div className="hero-cta">
          <a className="btn" href="#pricing">Start hunting</a>
          <a className="btn btn-quiet" href="#how">See how it works</a>
        </div>
      </header>

      <hr className="tear" />

      <section className="sec" id="how">
        <p className="sec-label">How it works</p>
        <h2 className="sec-head">Clearance only moves one direction. We watch every step.</h2>

        <div className="steps">
          <div className="step">
            <div className="step-n">01</div>
            <div>
              <h3>We record every clearance price, every day</h3>
              <p>
                Home Depot and Lowe's, store by store. Items walk down a ladder — 20% off,
                then 50%, then 90% — and we keep every rung. Nobody can go back and collect
                yesterday's prices, which is why we started early.
              </p>
            </div>
          </div>

          <div className="step">
            <div className="step-n">02</div>
            <div>
              <h3>We catch the drop the shelf tag never shows</h3>
              <p>
                When an item disappears from the website but units are still on the floor,
                it's usually sitting at a penny in the register. We score how likely that is,
                from 0 to 100, and the score gets sharper every time someone tells us what
                they actually found.
              </p>
            </div>
          </div>

          <div className="step">
            <div className="step-n">03</div>
            <div>
              <h3>Your phone buzzes before anyone drives over</h3>
              <p>
                Which store, how far, how many are left, and what it's worth reselling.
                Enough to decide in ten seconds, from bed.
              </p>
            </div>
          </div>
        </div>
      </section>

      <hr className="tear" />

      <section className="sec" id="who">
        <p className="sec-label">Who it's for</p>
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
              <li>Watch any product — "blender," not a model number</li>
              <li>Alerts when it actually drops</li>
              <li>Amazon Warehouse and clearance included</li>
              <li>A running total of what you've saved</li>
            </ul>
          </div>
        </div>
      </section>

      <hr className="tear" />

      <section className="sec" id="pricing">
        <p className="sec-label">Pricing</p>
        <h2 className="sec-head">Two plans. Cancel in one tap.</h2>

        <div className="tiers">
          <div className="tier">
            <div className="tier-name">
              Founding reseller
              <span className="tier-flag">30 seats</span>
            </div>
            <div className="tier-price">$19/mo</div>
            <p className="tier-desc">
              Locked at this price for as long as you stay. In exchange you report what you
              find, which is what makes the alerts worth trusting for everyone else.
            </p>
          </div>

          <div className="tier">
            <div className="tier-name">Consumer</div>
            <div className="tier-price">$9.99/mo</div>
            <p className="tier-desc">
              Unlimited product watches, alerts, and savings tracking. No store hunting
              required.
            </p>
          </div>
        </div>
      </section>

      <hr className="tear" />

      <section className="close">
        <h2>The deals are already happening.</h2>
        <p>
          Every day, clearance items quietly drop to a penny and get thrown away because
          nobody knew. We're keeping the receipts.
        </p>
        <a className="btn" href="#pricing">Claim a founding seat</a>
      </section>

      <hr className="tear" />

      <footer className="lp-foot">
        <span>{BRAND} · San Antonio, TX</span>
        <span>
          <Link to="/app">Open the app</Link>
        </span>
      </footer>
    </div>
  );
}

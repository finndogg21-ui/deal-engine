import { Link } from 'react-router-dom';
import '../landing.css';

export default function Landing() {
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
            <span className="now"><mark>$0.01</mark></span>
            <span className="was">Was <b>$24.98</b></span>
          </span>
          <span className="hero-detail">
            for a 100 ft contractor garden hose. <b>This morning, 1.4 miles away.</b>
          </span>
        </h1>
        <p className="hero-meta">62 still on the shelf, aisle 50, bay 001</p>

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

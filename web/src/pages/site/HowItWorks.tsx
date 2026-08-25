import { Link } from 'react-router-dom';
import { LIVE_RETAILERS, joinNames } from '../../lib/retailers.js';

const liveRetailerList = joinNames(LIVE_RETAILERS.map((r) => r.name));

const STEPS = [
  {
    n: '1',
    h: 'We record every clearance price, every day',
    p: [
      `${liveRetailerList}, store by store. Prices on clearance only move one direction, and we keep every step.`,
      'This is the part that cannot be rushed. Nobody can go back and collect last month’s prices, which is why the recording started before the app did.',
    ],
  },
  {
    n: '2',
    h: 'We watch for the drop the shelf tag never shows',
    p: [
      'An item walks down the ladder: twenty percent off, then half, then ninety. Then one day it disappears from the website while units are still sitting on the floor.',
      'That gap is the signal. It usually means the item has been marked to a penny in the register, where no website will ever show it.',
    ],
  },
  {
    n: '3',
    h: 'We score it, honestly',
    p: [
      'Every candidate gets a number from 0 to 100 based on how much of the ladder it walked, how long it has been sitting, and whether stock remains.',
      'A score is a prediction, not a promise. We say so on the alert, and we would rather under-sell a find than send you across town on a guess.',
    ],
  },
  {
    n: '4',
    h: 'Members confirm what they actually found',
    p: [
      'After buying, one tap tells us whether the item was there. That turns a guess into a measurement.',
      'Reporting happens after checkout, never before, so telling us never costs you the find.',
    ],
  },
  {
    n: '5',
    h: 'The score gets better because of step 4',
    p: [
      'Confirmed finds are the answer key. Every week the scoring is checked against what people really found and adjusted.',
      'A scanner that cannot tell you its own accuracy is asking you to take its word for it. Ours can.',
    ],
  },
];

export default function HowItWorks() {
  return (
    <>
      <div className="wrap page-head">
        <h1>Clearance only moves one direction. We watch every step.</h1>
        <p className="lede">
          The whole product is one idea: if you record the entire markdown history, you can
          tell what is about to happen next.
        </p>
      </div>

      <hr className="rule" />

      <section className="wrap section">
        {STEPS.map((s) => (
          <div key={s.n} style={{
            display: 'grid', gridTemplateColumns: '40px 1fr', gap: 'var(--s5)',
            paddingBottom: 'var(--s7)',
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'var(--sticker)', color: 'var(--on-accent)',
              display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 17,
            }}>{s.n}</div>
            <div>
              <h3 style={{ marginTop: 0 }}>{s.h}</h3>
              {s.p.map((t) => <p key={t}>{t}</p>)}
            </div>
          </div>
        ))}
      </section>

      <hr className="rule" />

      <section className="wrap section">
        <h2>What a penny item actually is</h2>
        <p>
          Retailers mark unsold clearance down to one cent in their own system as a signal to
          pull it from the floor. Staff are supposed to remove it. Often nobody does, so the
          item sits on a shelf with an old tag, and it rings up at a penny when scanned.
        </p>
        <p>
          The price is never published. Not on the website, not in the app, not on the tag. It
          exists only in the register. That is why prediction is the only approach available,
          and why a confirmed find from someone who was standing there is worth so much more
          than any algorithm.
        </p>

        <h3>Why we say the score out loud</h3>
        <p>
          It would be easy to display a penny price in big green type and let you assume it is
          confirmed. Plenty of tools do. We show the price we last verified, and the
          prediction separately, labelled as a prediction.
        </p>

        <div style={{ marginTop: 'var(--s6)' }}>
          <Link className="btn" to="/pricing">See pricing</Link>
        </div>
      </section>
    </>
  );
}

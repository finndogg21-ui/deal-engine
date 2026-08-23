import { Link } from 'react-router-dom';

const QA: { q: string; a: React.ReactNode }[] = [
  {
    q: 'Will I definitely get the item?',
    a: <>No, and anyone who tells you otherwise is selling something. Deep clearance stock is
      usually one or two units, and a stock count is a snapshot from the last time we looked.
      We show you how many were there and when we checked, and you decide whether it is worth
      the drive.</>,
  },
  {
    q: 'What does the score mean?',
    a: <>How much of the markdown ladder an item has walked, how long it has been sitting, and
      whether stock remains after it vanished from the website. A high score means the pattern
      matches items that have rung up at a penny before. It is a prediction, and we label it
      as one.</>,
  },
  {
    q: 'Do you show the penny price?',
    a: <>We show the last price we actually verified, plus a separate line saying an item may
      ring up at one cent. Retailers never publish penny prices, so anyone displaying
      $0.01 as fact is predicting it too. We would rather say so.</>,
  },
  {
    q: 'Which stores are covered?',
    a: <>Home Depot and Lowe&rsquo;s are live with per-store stock. Walmart and Target are
      planned but not live, because we cannot yet get reliable per-store quantities for them.
      See <Link to="/stores/home-depot">the store pages</Link> for what we can and cannot see
      at each one.</>,
  },
  {
    q: 'Do I have to report what I find?',
    a: <>Only on the reseller plan, and only if you want the verified feed. Reporting happens
      after you check out, never before, so it cannot cost you a find. Members who report get
      to see what other members confirmed in the last few hours.</>,
  },
  {
    q: 'How is this different from the free tools?',
    a: <>Free scanners tell you where a deal might be. None of them track what you paid, what
      you sold it for, what the fees were, or what you actually made. They also cannot tell
      you how often their own predictions are right. We can, because members confirm finds.</>,
  },
  {
    q: 'What does it cost right now?',
    a: <>Nothing. <Link to="/signup">Making an account</Link> asks for an email and a
      password, never a card, and paid plans are not open for purchase yet. So there is no
      trial clock to run out, because there is nothing to run out of. The honest version is
      that the product is early and the founding rate exists to reflect that.</>,
  },
  {
    q: 'How do I cancel?',
    a: <>One tap inside the app, or from your account page on the web. No phone call, no
      retention offer, no form. If you want the account and data gone entirely,
      use <Link to="/delete-account">delete your account</Link>.</>,
  },
  {
    q: 'Are you affiliated with Home Depot or Lowe’s?',
    a: <>No. We are not affiliated with, endorsed by, or connected to any retailer. Store
      names and trademarks belong to their owners and are used only to say which store a deal
      is at.</>,
  },
];

export default function Faq() {
  return (
    <>
      <div className="wrap page-head">
        <h1>Questions</h1>
        <p className="lede">
          Including the ones with answers you might not want to hear.
        </p>
      </div>

      <hr className="rule" />

      <section className="wrap section">
        {QA.map(({ q, a }) => (
          <div key={q} style={{ paddingBottom: 'var(--s6)' }}>
            <h3 style={{ marginTop: 0, marginBottom: 'var(--s2)' }}>{q}</h3>
            <p style={{ color: 'var(--ink-soft)' }}>{a}</p>
          </div>
        ))}

        <p>
          Something not answered here? <Link to="/contact">Send us a message</Link>.
        </p>
      </section>
    </>
  );
}

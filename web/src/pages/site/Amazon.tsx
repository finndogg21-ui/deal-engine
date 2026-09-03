import { Link } from 'react-router-dom';

// Amazon teaser / "coming soon" landing page. DESIGN ONLY — no Amazon data,
// no integration is wired here (owner directive 2026-09-02: get the page ready,
// do not add Amazon yet). Not linked in the nav; reachable at /amazon for review.
export default function Amazon() {
  return (
    <>
      <div className="wrap page-head">
        <h1>Amazon is coming to Summit Clearance</h1>
        <p className="lede">
          Amazon resale comps and deals are next on the build list. This page is a preview, not a
          live feed. Here is what is coming, and why it changes how you flip a clearance find.
        </p>
      </div>

      <hr className="rule" />

      <section className="wrap section">
        <h2>What is coming</h2>
        <p>
          Today Summit Clearance finds in-store markdowns and hidden clearance across Home Depot,
          Target, Walmart and more. Amazon adds the other half of a flip: what the item actually
          sells for once you resell it.
        </p>
        <ul>
          <li>An Amazon resale comp on a deal, so a markdown becomes a known margin, not a guess</li>
          <li>Price history, so you can tell a real low from a number on a shelf tag</li>
          <li>Ranking by profit, not just by discount percent</li>
        </ul>

        <h3>Why it matters for reselling</h3>
        <p>
          A 60 percent markdown is only a deal if it sells for more than you paid. Amazon is where
          most of that resale happens, so pairing a clearance price with the Amazon comp is the
          difference between a hunch and a flip you can count on before you drive.
        </p>

        <h3>Honest status</h3>
        <p>
          Not live yet. We are getting the page and the plumbing ready first, and we would rather
          ship it right than promise a date we have not earned. Nothing on this page is pulling
          Amazon data today.
        </p>

        <div style={{ marginTop: 'var(--s6)', display: 'flex', gap: 'var(--s3)', flexWrap: 'wrap' }}>
          <Link className="btn" to="/signup">Create a free account</Link>
          <Link className="btn btn-quiet" to="/app">See current deals</Link>
        </div>
      </section>
    </>
  );
}

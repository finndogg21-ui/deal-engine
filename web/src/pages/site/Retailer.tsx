import { useParams, Link, Navigate } from 'react-router-dom';
import { getRetailer, RETAILERS, COVERAGE_LABEL } from '../../lib/retailers.js';

export default function RetailerPage() {
  const { slug } = useParams();
  const r = getRetailer(slug);
  if (!r) return <Navigate to="/stores/home-depot" replace />;

  const live = r.coverage !== 'planned';

  return (
    <>
      <div className="wrap page-head">
        <p style={{ color: 'var(--ink-faint)', margin: '0 0 var(--s2)', fontSize: 16 }}>
          {COVERAGE_LABEL[r.coverage]}
        </p>
        <h1>{r.name} clearance and penny deals</h1>
        <p className="lede">{r.lede}</p>

        <div style={{ display: 'flex', gap: 'var(--s3)', marginTop: 'var(--s5)', flexWrap: 'wrap' }}>
          {live
            ? <Link className="btn" to="/app">See {r.name} deals near you</Link>
            : <Link className="btn btn-quiet" to="/contact">Tell us you want this store</Link>}
          <Link className="btn btn-quiet" to="/how-it-works">How the scoring works</Link>
        </div>
      </div>

      <hr className="rule" />

      <section className="wrap section">
        <h2>How markdowns work at {r.name}</h2>
        {r.howItWorks.map((p) => <p key={p}>{p}</p>)}
      </section>

      <section className="wrap section">
        <h2>What we can see</h2>
        <ul>{r.weSee.map((p) => <li key={p}>{p}</li>)}</ul>

        <h3>What we cannot</h3>
        <ul>{r.weCannot.map((p) => <li key={p}>{p}</li>)}</ul>
        <p style={{ color: 'var(--ink-faint)' }}>
          We would rather tell you this up front than have you drive somewhere on a promise
          we never made.
        </p>
      </section>

      <hr className="rule" />

      <section className="wrap section">
        <h2>Other stores</h2>
        <div className="cards">
          {RETAILERS.filter((x) => x.slug !== r.slug).map((x) => (
            <Link key={x.slug} to={`/stores/${x.slug}`} className="card" style={{ textDecoration: 'none' }}>
              <h3>{x.name}</h3>
              <p>{COVERAGE_LABEL[x.coverage]}</p>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

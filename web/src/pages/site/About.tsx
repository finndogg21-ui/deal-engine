import { Link } from 'react-router-dom';

export default function About() {
  return (
    <>
      <div className="wrap page-head">
        <h1>Built by people who actually hunt</h1>
        <p className="lede">
          This started because we were driving to stores on guesses and wanted to know which
          guesses were worth the gas.
        </p>
      </div>

      <hr className="rule" />

      <section className="wrap section">
        <h2>Where it came from</h2>
        <p>
          Penny hunting has been around for years. The tools have not kept up. Most of them
          live inside Discord servers with sixty channels, which works fine if you are already
          a reseller and is completely impenetrable if you just want a cheaper vacuum.
        </p>
        <p>
          The other problem is that none of them will tell you how often they are right. They
          show a prediction in confident green type and leave you to find out in the parking
          lot. We thought a tool should be able to report its own accuracy.
        </p>

        <h3>What we are trying to be good at</h3>
        <ul>
          <li>Recording price history nobody else bothered to keep</li>
          <li>Being honest about the difference between a prediction and a fact</li>
          <li>Getting better every week because members tell us what they found</li>
          <li>Tracking what you actually made, not just what you might save</li>
        </ul>

        <h3>What we are not</h3>
        <p>
          We are not affiliated with any retailer. We do not have inside access to anyone’s
          inventory system. We cannot get you a penny item, hold one for you, or make a store
          honor a price. Everything here is public data, recorded carefully over time, plus
          reports from members who were standing in the aisle.
        </p>

        <h3>Where we operate</h3>
        <p>
          San Antonio first. Penny hunting is local, and a tool that is excellent in one city
          beats one that is mediocre everywhere. New metros open when the data holds up.
        </p>

        <div style={{ marginTop: 'var(--s6)', display: 'flex', gap: 'var(--s3)', flexWrap: 'wrap' }}>
          <Link className="btn" to="/pricing">See pricing</Link>
          <Link className="btn btn-quiet" to="/contact">Get in touch</Link>
        </div>
      </section>
    </>
  );
}

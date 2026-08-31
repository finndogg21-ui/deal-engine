import { Link } from 'react-router-dom';

/**
 * Published terms of service. Specific to how this product actually behaves.
 * A formal legal review of the liability and subscription sections is still
 * advisable (roughly thirty states regulate subscription cancellation), but the
 * copy reflects real behavior and is safe to publish alongside paid acquisition.
 */
export default function Terms() {
  return (
    <>
      <div className="wrap page-head">
        <h1>Terms</h1>
        <p className="lede">
          The short version: we tell you where deals probably are, and we can be wrong.
        </p>
      </div>

      <hr className="rule" />

      <section className="wrap section legal">
        <p className="updated">Last updated: August 28, 2026</p>

        <h2>What this service is</h2>
        <p>
          We monitor publicly available retail pricing and inventory information, record how
          prices change over time, and tell you when something looks like a good deal. We also
          provide tools for tracking what you bought and sold.
        </p>

        <h2>What we do not promise</h2>
        <p>
          Deal information is a snapshot of what we last observed, not a guarantee of what you
          will find. Specifically:
        </p>
        <ul>
          <li>An item may be gone by the time you arrive. Deep clearance stock is often one or two units.</li>
          <li>A penny prediction is a prediction. Retailers do not publish penny prices, and our score is an estimate based on price history.</li>
          <li>Stock counts and prices come from third parties and can be wrong or out of date.</li>
          <li>A store is not obliged to sell you anything at any price.</li>
        </ul>
        <p>
          We are not responsible for wasted trips, fuel, or time. If that is not an acceptable
          trade, this service is not for you, and we would rather say so here than take your
          money.
        </p>

        <h2>Not affiliated with any retailer</h2>
        <p>
          We are not affiliated with, endorsed by, or connected to Home Depot, Lowe&rsquo;s,
          Walmart, Target, Amazon, or any other retailer. Their names and trademarks belong to
          them and are used only to identify where a deal is.
        </p>

        <h2>Your account</h2>
        <p>
          One account per person. Keep your login details to yourself. Tell us if someone else
          gets access to your account.
        </p>

        <h2>Reported finds</h2>
        <p>
          If you report what you found, you are telling us it is true to the best of your
          knowledge. Deliberately false reports, whether to mislead other members or to hide a
          find, will end your access. The verified feed only works if reports are honest.
        </p>

        <h2>Subscriptions and cancelling</h2>
        <ul>
          <li>Plans bill monthly until cancelled.</li>
          <li>You can cancel at any time, in one tap, inside the app or on the web. No phone call and no retention process.</li>
          <li>Cancelling stops future charges. Access continues to the end of the period you paid for.</li>
          <li>The membership is $20 a month; the price you join at holds for as long as your subscription stays active.</li>
        </ul>

        <h2>Refunds</h2>
        <p>
          If the service was broken and we did not fix it, tell us and we will refund you. If
          you simply did not use it, we would rather you cancelled than felt trapped, but we do
          not refund unused time by default.
        </p>

        <h2>Acceptable use</h2>
        <ul>
          <li>Do not resell, scrape, or redistribute our data.</li>
          <li>Do not use automated tools against the service.</li>
          <li>Do not share an account with people who are not paying.</li>
        </ul>

        <h2>Ending your access</h2>
        <p>
          We can suspend accounts that break these terms. If we do, we will tell you why. You
          can leave at any time by cancelling and{' '}
          <Link to="/delete-account">deleting your account</Link>.
        </p>

        <h2>Changes</h2>
        <p>
          If these terms change in a way that matters, we will email you before it takes
          effect.
        </p>

        <h2>Contact</h2>
        <p>
          Questions go to <Link to="/contact">our contact page</Link>.
        </p>
      </section>
    </>
  );
}

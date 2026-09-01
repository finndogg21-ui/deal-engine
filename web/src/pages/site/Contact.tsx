import { Link } from 'react-router-dom';

/**
 * Interim contact page. There is no support inbox yet (a real address arrives
 * with the domain, see the launch checklist), so this page does NOT collect a
 * message it cannot deliver or name an address that would bounce. It routes to
 * the things that actually work today, and says plainly what is coming.
 */
export default function Contact() {
  return (
    <>
      <div className="wrap page-head">
        <h1>Contact</h1>
        <p className="lede">
          Most of what you might need is self-serve and faster than a ticket. Here is where
          each thing goes today.
        </p>
      </div>

      <hr className="rule" />

      <section className="wrap section">
        <h3>An alert sent you to an empty shelf</h3>
        <p>
          The fastest route is the app itself. Open the deal and tap “Not there”. That records
          it against the prediction and improves the score for everyone, which an email cannot
          do. If you can, note the store and the item so the next person is not sent there.
        </p>

        <h3>Billing, cancelling, or deleting your account</h3>
        <p>
          These are all self-serve, no message required. Manage or cancel your membership from
          the <Link to="/app">app</Link> (the Membership button in the header), and account
          deletion lives at <Link to="/delete-account">Delete account</Link>. Cancelling stops
          future charges and keeps your access until the end of the period you paid for.
        </p>

        <h3>Everything else</h3>
        <p>
          A support inbox opens with our full launch, together with our own domain. Until then
          there is no monitored address, so rather than name one that would bounce, we would
          rather tell you straight: the routes above cover almost everything, and direct
          support is a short way off.
        </p>
      </section>
    </>
  );
}

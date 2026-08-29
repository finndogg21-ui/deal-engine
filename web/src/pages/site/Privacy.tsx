import { Link } from 'react-router-dom';

/**
 * Published privacy policy. Specific and honest about what this product actually
 * does with user data — accurate as written. A formal legal review is still
 * advisable before scaling paid acquisition, but the copy reflects real handling
 * and is safe to publish (ad networks require a live, accurate policy URL).
 */
export default function Privacy() {
  return (
    <>
      <div className="wrap page-head">
        <h1>Privacy</h1>
        <p className="lede">
          What we collect, why, and how to get rid of it.
        </p>
      </div>

      <hr className="rule" />

      <section className="wrap section legal">
        <p className="updated">Last updated: August 28, 2026</p>

        <h2>What we collect</h2>
        <p>Only what the product needs to work:</p>
        <ul>
          <li><strong>Your email address</strong>, to sign you in and send alerts.</li>
          <li><strong>Your ZIP code and travel radius</strong>, to work out which stores are near you.</li>
          <li><strong>The products and categories you watch</strong>, to match deals against.</li>
          <li><strong>Your alert settings</strong>, so we send the number you asked for.</li>
          <li><strong>Finds you report</strong>, meaning whether an item was there. Used to measure how accurate our predictions are.</li>
          <li><strong>Inventory and order records you enter</strong>, if you use the reseller tools.</li>
          <li><strong>Basic usage data</strong>, such as which alerts you opened, to work out whether alerts are useful.</li>
        </ul>

        <h2>What we do not collect</h2>
        <ul>
          <li>Precise or background location. We use the ZIP you type, nothing more.</li>
          <li>Contacts, photos, or anything else on your device.</li>
          <li>Payment card numbers. Our payment processor handles those and we never see them.</li>
          <li>Your email inbox. If email order import is ever added, it will be opt in and described here first.</li>
        </ul>

        <h2>Why we collect it</h2>
        <p>
          To run the service you signed up for: matching deals to what you watch, telling you
          about them, and measuring whether our predictions were right. Reported finds are
          also used in aggregate to improve scoring for everyone.
        </p>

        <h2>Who we share it with</h2>
        <p>
          We do not sell your data. We share the minimum necessary with the companies that run
          parts of the service, such as hosting, payment processing, and notification
          delivery. Each is bound by its own agreement with us.
        </p>
        <p>
          Verified finds you report appear to other members as a confirmation at a store and a
          time. Your name and email are never attached.
        </p>

        <h2>How long we keep it</h2>
        <p>
          Account data is kept while your account exists. Price and deal records are kept
          indefinitely, because the history of what a product cost over time is the service
          itself. Those records are about products and stores, not about you.
        </p>

        <h2>Deleting your account</h2>
        <p>
          You can delete your account and its data from inside the app, or from{' '}
          <Link to="/delete-account">this page</Link>, without reinstalling anything. Deletion
          removes your email, settings, watches, reported finds, and reseller records.
          Aggregate accuracy statistics that no longer identify you may remain.
        </p>
        <p>
          If you have an active subscription, cancel it first. The deletion page explains how
          and links straight to it.
        </p>

        <h2>Your rights</h2>
        <p>
          Depending on where you live you may have the right to see, correct, export, or
          delete your data, and to object to certain processing. Ask us and we will do it. We
          do not charge for this and we will not make it difficult.
        </p>

        <h2>Children</h2>
        <p>
          This service is not intended for anyone under 13, and we do not knowingly collect
          data from them.
        </p>

        <h2>Changes</h2>
        <p>
          If this policy changes in a way that affects what we collect or who we share it
          with, we will tell you by email before it takes effect, not by quietly updating a
          date at the top of the page.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about any of this go to <Link to="/contact">our contact page</Link>.
        </p>
      </section>
    </>
  );
}

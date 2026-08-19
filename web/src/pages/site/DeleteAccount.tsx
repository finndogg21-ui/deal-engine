import { useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * Required by both app stores: account deletion has to be reachable on the web,
 * without reinstalling the app, and the link goes in Google's Data safety form.
 * If a subscription must be cancelled first, that has to be spelled out here.
 */
export default function DeleteAccount() {
  const [email, setEmail] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setSending(true);
    try {
      await new Promise((r) => setTimeout(r, 600));
      throw new Error('not-wired');
    } catch {
      setErr('Account deletion is not connected yet. There are no accounts to delete while the app is in setup.');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="wrap page-head">
        <h1>Delete your account</h1>
        <p className="lede">
          No form to fill in twice, no phone call, no offer to change your mind.
        </p>
      </div>

      <hr className="rule" />

      <section className="wrap-narrow section legal">
        <h2>Before you delete</h2>
        <p>
          <strong>Cancel your subscription first.</strong> Deleting the account does not stop
          billing on its own, because the payment is held by our payment processor rather than
          by us. Cancel from the app, or from your account page, then come back here.
        </p>

        <h2>What gets deleted</h2>
        <ul>
          <li>Your email address and login</li>
          <li>Your ZIP code, radius, and alert settings</li>
          <li>Every product and category you were watching</li>
          <li>Finds you reported, and their link to you</li>
          <li>Your inventory, orders, and profit records</li>
        </ul>

        <h2>What stays</h2>
        <ul>
          <li>
            Price and deal history for products and stores. That data is about retail
            inventory, not about you, and it is the service itself.
          </li>
          <li>
            Accuracy statistics in aggregate, with nothing that identifies you attached.
          </li>
        </ul>
        <p>
          Deletion is permanent. There is no restore, and we cannot bring an account back
          afterwards.
        </p>

        <h2>Request deletion</h2>
        <form className="form" onSubmit={submit}>
          <div>
            <label htmlFor="email">The email on the account</label>
            <input id="email" type="email" autoComplete="email" required
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <label style={{ display: 'flex', gap: 'var(--s3)', alignItems: 'flex-start', fontWeight: 400 }}>
            <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)}
              style={{ width: 20, height: 20, minHeight: 20, flex: 'none', marginTop: 3 }} />
            <span>
              I understand this is permanent, and that I need to cancel my subscription
              separately.
            </span>
          </label>

          {err && <p role="alert" style={{ color: 'var(--drop)', margin: 0 }}>{err}</p>}

          <div>
            <button className="btn" type="submit" disabled={!confirm || !email || sending}>
              {sending && <span className="spin" aria-hidden="true" />}
              {sending ? 'Submitting' : 'Delete my account'}
            </button>
          </div>
        </form>

        <p style={{ marginTop: 'var(--s6)' }}>
          Trouble with any of this? <Link to="/contact">Contact us</Link> and we will handle it
          manually.
        </p>
      </section>
    </>
  );
}

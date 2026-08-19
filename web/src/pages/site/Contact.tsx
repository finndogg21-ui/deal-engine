import { useState } from 'react';

const SUPPORT_EMAIL = 'support@example.com'; // TODO: real address once the domain is bought

export default function Contact() {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setSending(true);
    try {
      // No backend for this yet. Rather than silently pretend, this fails
      // honestly and points at the email address.
      await new Promise((r) => setTimeout(r, 600));
      throw new Error('not-wired');
    } catch {
      setErr(`The contact form is not connected yet. Email ${SUPPORT_EMAIL} and we will get it.`);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="wrap page-head">
        <h1>Contact</h1>
        <p className="lede">
          A person reads these. Expect a reply within a day, usually sooner.
        </p>
      </div>

      <hr className="rule" />

      <section className="wrap section">
        {sent ? (
          <div className="notice">
            Message sent. We will reply to the address you gave us.
          </div>
        ) : (
          <form className="form" onSubmit={submit}>
            <div>
              <label htmlFor="name">Your name</label>
              <input id="name" name="name" type="text" autoComplete="name" required />
            </div>

            <div>
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" autoComplete="email" required />
              <p className="hint">Used only to reply to you.</p>
            </div>

            <div>
              <label htmlFor="topic">What is this about?</label>
              <select id="topic" name="topic" defaultValue="question">
                <option value="question">A question</option>
                <option value="bad-alert">An alert that was wrong</option>
                <option value="store">Asking for a store or city</option>
                <option value="billing">Billing</option>
                <option value="account">Deleting my account</option>
                <option value="other">Something else</option>
              </select>
            </div>

            <div>
              <label htmlFor="message">Message</label>
              <textarea id="message" name="message" required />
              <p className="hint">
                If an alert sent you somewhere and the item was not there, tell us the store
                and the item. That feedback is how the scoring improves.
              </p>
            </div>

            {err && <p role="alert" style={{ color: 'var(--drop)', margin: 0 }}>{err}</p>}

            <div>
              <button className="btn" type="submit" disabled={sending}>
                {sending && <span className="spin" aria-hidden="true" />}
                {sending ? 'Sending' : 'Send message'}
              </button>
            </div>
          </form>
        )}

        <h3>Other ways to reach us</h3>
        <ul>
          <li>Email: {SUPPORT_EMAIL}</li>
          <li>Discord: members get a support channel inside the server</li>
        </ul>

        <h3>Reporting a bad alert</h3>
        <p>
          The fastest route is the app itself. Open the deal and tap “Not there”. That records
          it against the prediction and improves the score for everyone, which a support email
          cannot do.
        </p>
      </section>
    </>
  );
}

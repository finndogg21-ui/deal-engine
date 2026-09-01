import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, api } from '../../lib/auth.js';

/** Sign in, sign up, forgot, and reset. One file, four small forms. */

/** Only follow an internal, single-slash path from ?next= (never an open redirect). */
function safeNext(n: string | null): string | null {
  return n && n.startsWith('/') && !n.startsWith('//') ? n : null;
}

function Shell({ title, lede, children, foot }: {
  title: string; lede: string; children: React.ReactNode; foot?: React.ReactNode;
}) {
  return (
    <>
      <div className="wrap-narrow page-head">
        <h1>{title}</h1>
        <p className="lede">{lede}</p>
      </div>
      <hr className="rule" />
      <section className="wrap-narrow section">
        {children}
        {foot && <p style={{ marginTop: 'var(--s6)' }}>{foot}</p>}
      </section>
    </>
  );
}

function Field({ id, label, type, value, onChange, hint, autoComplete }: {
  id: string; label: string; type: string; value: string;
  onChange: (v: string) => void; hint?: string; autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <input id={id} type={type} value={value} autoComplete={autoComplete} required
        onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function SignIn() {
  const { signIn } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try { await signIn(email, password); nav(safeNext(params.get('next')) ?? '/app'); }
    catch (x) { setErr((x as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <Shell title="Sign in" lede="Welcome back."
      foot={<>No account? <Link to="/signup">Create one</Link>. Forgot your password?{' '}
        <Link to="/forgot">Reset it</Link>.</>}>
      <form className="form" onSubmit={submit}>
        <Field id="email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
        <Field id="password" label="Password" type="password" value={password} onChange={setPassword} autoComplete="current-password" />
        {err && <p role="alert" style={{ color: 'var(--drop)', margin: 0 }}>{err}</p>}
        <div>
          <button className="btn" type="submit" disabled={busy}>
            {busy && <span className="spin" aria-hidden="true" />}{busy ? 'Signing in' : 'Sign in'}
          </button>
        </div>
      </form>
    </Shell>
  );
}

export function SignUp() {
  const { signUp } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const me = await signUp(email, password);
      if (!me) {
        // No real session => the email is already registered (server hides which).
        setErr('That email may already have an account — try signing in instead.');
        setBusy(false);
        return;
      }
      nav(safeNext(params.get('next')) ?? '/welcome');
    } catch (x) { setErr((x as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <Shell title="Create an account" lede="Takes about a minute, then you pick what to watch."
      foot={<>Already have one? <Link to="/signin">Sign in</Link>.</>}>
      <form className="form" onSubmit={submit}>
        <Field id="email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email"
          hint="Used to sign in and to send your alerts. Nothing else." />
        <Field id="password" label="Password" type="password" value={password} onChange={setPassword}
          autoComplete="new-password" hint="At least 10 characters. Length beats symbols." />
        {err && <p role="alert" style={{ color: 'var(--drop)', margin: 0 }}>{err}</p>}
        <div>
          <button className="btn" type="submit" disabled={busy}>
            {busy && <span className="spin" aria-hidden="true" />}{busy ? 'Creating' : 'Create account'}
          </button>
        </div>
      </form>
    </Shell>
  );
}

export function Forgot() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try { await api('/api/auth/forgot', { method: 'POST', body: JSON.stringify({ email }) }); }
    catch { /* response is identical either way, by design */ }
    setSent(true); setBusy(false);
  }

  return (
    <Shell title="Reset your password" lede="We will email you a link that works once.">
      {sent ? (
        <div className="notice">
          If that address has an account, the link is on its way. It expires in two hours.
        </div>
      ) : (
        <form className="form" onSubmit={submit}>
          <Field id="email" label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" />
          <div>
            <button className="btn" type="submit" disabled={busy}>
              {busy && <span className="spin" aria-hidden="true" />}{busy ? 'Sending' : 'Send the link'}
            </button>
          </div>
        </form>
      )}
    </Shell>
  );
}

export function Reset() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const { refresh } = useAuth();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const token = params.get('token') ?? '';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      await api('/api/auth/reset', { method: 'POST', body: JSON.stringify({ token, password }) });
      await refresh();
      nav(safeNext(params.get('next')) ?? '/app');
    } catch (x) { setErr((x as Error).message); }
    finally { setBusy(false); }
  }

  if (!token) {
    return (
      <Shell title="That link is incomplete" lede="Request a new one and it will work.">
        <Link className="btn" to="/forgot">Send a new link</Link>
      </Shell>
    );
  }

  return (
    <Shell title="Choose a new password" lede="Signing you in straight after, and every other session ends.">
      <form className="form" onSubmit={submit}>
        <Field id="password" label="New password" type="password" value={password} onChange={setPassword}
          autoComplete="new-password" hint="At least 10 characters." />
        {err && <p role="alert" style={{ color: 'var(--drop)', margin: 0 }}>{err}</p>}
        <div>
          <button className="btn" type="submit" disabled={busy}>
            {busy && <span className="spin" aria-hidden="true" />}{busy ? 'Saving' : 'Save and sign in'}
          </button>
        </div>
      </form>
    </Shell>
  );
}

export function ConfirmDelete() {
  const [params] = useSearchParams();
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [err, setErr] = useState('');
  const token = params.get('token') ?? '';

  async function go() {
    setState('busy');
    try {
      await api('/api/auth/account/delete/confirm', { method: 'POST', body: JSON.stringify({ token }) });
      setState('done');
    } catch (x) { setErr((x as Error).message); setState('error'); }
  }

  if (state === 'done') {
    return (
      <Shell title="Your account is gone" lede="Email, settings, watches, inventory and orders are deleted. This cannot be undone.">
        <p>Price history for products and stores stays. That data is about retail inventory, not about you.</p>
        <Link className="btn" to="/">Back to the front page</Link>
      </Shell>
    );
  }

  return (
    <Shell title="Delete your account" lede="Last chance. This is permanent.">
      <p>This removes your email, settings, watches, reported finds, inventory and orders.</p>
      <p style={{ color: 'var(--ink-faint)' }}>
        If you have an active subscription, cancel it first or billing continues.
      </p>
      {err && <p role="alert" style={{ color: 'var(--drop)' }}>{err}</p>}
      <button className="btn" onClick={() => void go()} disabled={state === 'busy' || !token}>
        {state === 'busy' && <span className="spin" aria-hidden="true" />}
        {state === 'busy' ? 'Deleting' : 'Delete my account permanently'}
      </button>
    </Shell>
  );
}

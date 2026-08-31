import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, useAuth } from '../../lib/auth.js';

interface PlanInfo {
  id: string;
  label: string;
  price: number;
  founding: boolean;
  seats_total?: number;
  seats_left?: number;
}

interface PlansResponse {
  wired: boolean;
  dev_activation: boolean;
  plans: PlanInfo[];
}

const MEMBERSHIP = {
  id: 'member',
  name: 'Membership',
  price: '$20',
  per: 'a month',
  who: 'One plan. Everything unlocked.',
  features: [
    'Every deal ranked by real profit, after fees',
    'In-store clearance prices, store by store — starting with Home Depot',
    'Outlet and clearance across ten retailers',
    'Watch any product by name — alerts only when it actually drops',
    'Inventory and order tracking',
    'Penny predictions, scored and labeled as predictions',
    'Cancel in one tap, from inside the app',
  ],
};

export default function Pricing() {
  const nav = useNavigate();
  const { me, refresh } = useAuth();
  const [info, setInfo] = useState<PlansResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void api<PlansResponse>('/api/billing/plans').then(setInfo).catch(() => setInfo(null));
  }, []);

  /** Actually starts checkout — a plan-less account is sent to sign up first. */
  async function choose() {
    setNotice(null);
    if (!me) {
      nav(`/signup?next=${encodeURIComponent('/pricing')}`);
      return;
    }
    setBusy(true);
    try {
      const r = await api<{ url: string }>('/api/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ plan: MEMBERSHIP.id }),
      });
      window.location.href = r.url;
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 503 && info?.dev_activation) {
        // Local only. The server refuses this outright in production.
        try {
          await api('/api/billing/dev-activate', {
            method: 'POST',
            body: JSON.stringify({ plan: MEMBERSHIP.id }),
          });
          await refresh();
          nav('/app');
          return;
        } catch {
          setNotice('Could not activate the membership locally.');
        }
      } else if (e.status === 503) {
        setNotice(
          'Checkout is not connected yet, so the membership cannot be bought here. ' +
          'Stripe keys have not been added to this build.',
        );
      } else {
        setNotice(e.message || 'Something went wrong starting checkout.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="wrap page-head">
        <h1>One membership. Cancel in one tap.</h1>
        <p className="lede">
          No annual contract, no cancellation phone call, no discount offer when you try to
          leave.
        </p>
      </div>

      <hr className="rule" />

      {notice && (
        <div className="wrap" role="alert">
          <p className="pricing-notice">{notice}</p>
        </div>
      )}

      <section className="wrap section">
        <div className="cards">
          <div className="card">
            <h3>{MEMBERSHIP.name}</h3>
            <p style={{ marginBottom: 'var(--s4)' }}>{MEMBERSHIP.who}</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--s2)', marginBottom: 'var(--s4)' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 32, fontWeight: 700 }}>{MEMBERSHIP.price}</span>
              <span style={{ color: 'var(--ink-faint)' }}>{MEMBERSHIP.per}</span>
            </div>
            <ul style={{ paddingLeft: 'var(--s5)', margin: '0 0 var(--s5)' }}>
              {MEMBERSHIP.features.map((f) => (
                <li key={f} style={{ marginBottom: 'var(--s2)' }}>{f}</li>
              ))}
            </ul>
            <button className="btn" onClick={() => void choose()} disabled={busy}>
              {busy ? 'One moment…' : me ? 'Join' : 'Create an account'}
            </button>
          </div>
        </div>
      </section>

      <section className="wrap section">
        <h3>What happens if you cancel</h3>
        <p>
          Your account stays until you delete it, your saved products and history are kept, and
          alerts stop. Come back later and everything is where you left it. If you delete the
          account instead, it is gone for good, which is the point.
        </p>
      </section>
    </>
  );
}

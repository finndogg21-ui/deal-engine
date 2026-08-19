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

const TIERS = [
  {
    id: 'consumer',
    name: 'Saving money',
    price: '$9.99',
    per: 'a month',
    who: 'For everyday shopping.',
    features: [
      'Watch any product by name, not by model number',
      'Amazon Warehouse and clearance deals',
      'Alerts only when the price actually drops',
      'A running total of what you have saved',
      'Cancel in one tap, from inside the app',
    ],
  },
  {
    id: 'reseller',
    name: 'Making money',
    price: '$19',
    per: 'a month',
    flag: 'Founding rate, 30 seats',
    who: 'For flipping and penny hunting.',
    features: [
      'Penny predictions scored store by store',
      'Verified finds from members who were just there',
      'Inventory and order tracking',
      'Real profit after fees, not guesses',
      'Everything in the saving plan',
      'Locked at this price for as long as you stay',
    ],
  },
];

export default function Pricing() {
  const nav = useNavigate();
  const { me, refresh } = useAuth();
  const [info, setInfo] = useState<PlansResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    void api<PlansResponse>('/api/billing/plans').then(setInfo).catch(() => setInfo(null));
  }, []);

  /**
   * The CTA used to be `<Link to="/app">`, which sent a plan-less account
   * straight back into the paywall it had just clicked out of — an inescapable
   * loop with no purchase step anywhere in it. It now actually tries to buy.
   */
  async function choose(planId: string) {
    setNotice(null);

    if (!me) {
      nav(`/signup?next=${encodeURIComponent('/pricing')}`);
      return;
    }

    setBusy(planId);
    try {
      const r = await api<{ url: string }>('/api/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ plan: planId }),
      });
      window.location.href = r.url;
    } catch (err) {
      const e = err as Error & { status?: number };

      if (e.status === 503 && info?.dev_activation) {
        // Local only. The server refuses this outright in production.
        try {
          await api('/api/billing/dev-activate', {
            method: 'POST',
            body: JSON.stringify({ plan: planId }),
          });
          await refresh();
          nav('/app');
          return;
        } catch {
          setNotice('Could not activate the plan locally.');
        }
      } else if (e.status === 503) {
        setNotice(
          'Checkout is not connected yet, so plans cannot be bought here. ' +
          'Stripe keys have not been added to this build.',
        );
      } else if (e.status === 409) {
        setNotice('All 30 founding seats are taken. The reseller plan is closed for now.');
      } else {
        setNotice(e.message || 'Something went wrong starting checkout.');
      }
    } finally {
      setBusy(null);
    }
  }

  const seatsLeft = info?.plans.find((p) => p.id === 'reseller')?.seats_left;

  return (
    <>
      <div className="wrap page-head">
        <h1>Two plans. Cancel in one tap.</h1>
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
          {TIERS.map((t) => (
            <div key={t.name} className="card">
              <h3>{t.name}</h3>
              <p style={{ marginBottom: 'var(--s4)' }}>{t.who}</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--s2)', marginBottom: 'var(--s2)' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 32, fontWeight: 700 }}>{t.price}</span>
                <span style={{ color: 'var(--ink-faint)' }}>{t.per}</span>
              </div>
              {t.flag && (
                <p style={{ color: 'var(--accent-text)', fontWeight: 600, marginBottom: 'var(--s4)' }}>
                  {/* Real remaining count, not the marketing number. */}
                  {t.id === 'reseller' && seatsLeft !== undefined
                    ? `Founding rate, ${seatsLeft} of 30 seats left`
                    : t.flag}
                </p>
              )}
              <ul style={{ paddingLeft: 'var(--s5)', margin: '0 0 var(--s5)' }}>
                {t.features.map((f) => <li key={f} style={{ marginBottom: 'var(--s2)' }}>{f}</li>)}
              </ul>
              <button
                className="btn"
                onClick={() => void choose(t.id)}
                disabled={busy !== null || (t.id === 'reseller' && seatsLeft === 0)}
              >
                {busy === t.id
                  ? 'One moment…'
                  : t.id === 'reseller' && seatsLeft === 0
                    ? 'Seats full'
                    : me ? 'Choose this plan' : 'Create an account'}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="wrap section">
        <h2>Why the reseller plan costs more</h2>
        <p>
          Deep clearance stock is usually one or two units. Every extra member hunting the
          same metro makes the alerts worth slightly less to everyone already there. So
          reseller seats are capped per city rather than sold to whoever shows up.
        </p>
        <p>
          The founding rate exists for the same reason. Early members are reporting what they
          find, which is what makes the scores mean anything. That work is worth a permanent
          discount.
        </p>

        <h3>What happens if you cancel</h3>
        <p>
          Your account stays until you delete it, your saved products and history are kept,
          and alerts stop. Come back later and everything is where you left it. If you delete
          the account instead, it is gone for good, which is the point.
        </p>
      </section>
    </>
  );
}

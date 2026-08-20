import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BRAND } from '../../App.js';
import {
  saveSetup, clearSetup, SUGGESTED_CONSUMER, SUGGESTED_RESELLER,
  type Setup, type Path,
} from '../../lib/setup.js';
import { api, useAuth } from '../../lib/auth.js';
import '../../welcome.css';

/**
 * Two audiences, two setups.
 *
 * Consumers are asked what they want first, because that is the part they care
 * about. Resellers are asked where they hunt first, because for them distance
 * decides whether an alert is worth anything at all.
 */

/* ------------------------------------------------------------------ picker */

function PathPicker({ onPick }: { onPick: (p: Path) => void }) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => { first.current?.focus(); }, []);

  return (
    <div className="pick-backdrop">
      <div className="pick" role="dialog" aria-modal="true" aria-labelledby="pick-title">
        <h1 id="pick-title">Which one sounds like you?</h1>
        <p className="lede">
          Same deals underneath, but we'll set the app up differently depending on what
          you're here for. You can switch later.
        </p>

        <div className="pick-grid">
          <button ref={first} className="pick-card" onClick={() => onPick('consumer')}>
            <h2>I want to save money</h2>
            <p className="who">For everyday shopping.</p>
            <ul>
              <li>Watch any product, type "blender", we cover every brand</li>
              <li>Amazon Warehouse and clearance deals</li>
              <li>Alerts only when the price actually drops</li>
              <li>A running total of what you've saved</li>
            </ul>
            <div className="pick-price">
              $9.99 a month
              <small>Cancel any time, in one tap</small>
            </div>
            <span className="pick-go">Set this up</span>
          </button>

          <button className="pick-card" onClick={() => onPick('reseller')}>
            <h2>I want to make money</h2>
            <p className="who">For flipping and penny hunting.</p>
            <ul>
              <li>Penny finds scored store by store, near you</li>
              <li>Verified finds from people who were just there</li>
              <li>Inventory, orders, and real profit after fees</li>
              <li>Everything in the saving plan too</li>
            </ul>
            <div className="pick-price">
              $19 a month
              <small>Founding rate, 30 seats, locked for as long as you stay</small>
            </div>
            <span className="pick-go">Set this up</span>
          </button>
        </div>

        <p className="pick-foot">Not sure? Pick saving money. Switching takes one click.</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- wizard */

export default function Welcome() {
  const nav = useNavigate();
  const { me, refresh } = useAuth();
  const [path, setPath] = useState<Path | null>(null);
  const [step, setStep] = useState(0);
  const [zip, setZip] = useState('');
  const [radius, setRadius] = useState(25);
  const [watches, setWatches] = useState<string[]>([]);
  const [typed, setTyped] = useState('');
  const [perDay, setPerDay] = useState(5);
  const [quiet, setQuiet] = useState(true);
  const [willReport, setWillReport] = useState(true);
  const [err, setErr] = useState('');

  if (!path) {
    return (
      <PathPicker
        onPick={(p) => {
          setPath(p);
          // Resellers hunt harder and expect more traffic.
          setPerDay(p === 'reseller' ? 15 : 5);
        }}
      />
    );
  }

  const reseller = path === 'reseller';
  const suggestions = reseller ? SUGGESTED_RESELLER : SUGGESTED_CONSUMER;
  const steps: string[] = reseller
    ? ['where', 'what', 'report', 'alerts']
    : ['what', 'where', 'alerts'];
  const total = steps.length;
  const current = steps[step];

  function addWatch(term: string) {
    const t = term.trim();
    if (!t) return;
    if (watches.some((w) => w.toLowerCase() === t.toLowerCase())) return;
    setWatches([...watches, t]);
    setTyped('');
  }

  function next() {
    setErr('');
    if (current === 'where' && !/^\d{5}$/.test(zip)) {
      setErr('Enter a 5-digit ZIP code so we know which stores are near you.');
      return;
    }
    if (current === 'what' && watches.length === 0) {
      setErr(reseller
        ? 'Pick at least one category you actually flip.'
        : 'Add at least one product. You can change these any time.');
      return;
    }
    if (step === total - 1) {
      const s: Setup = {
        // Unreachable until PathPicker has set it; the early return above guards.
        path: path!,
        zip, radiusMi: radius, watches,
        alertsPerDay: perDay, quietHours: quiet,
        ...(reseller ? { willReport } : {}),
        completedAt: new Date().toISOString(),
      };
      saveSetup(s);

      /**
       * If they are already signed in, the answers have to reach the server
       * NOW, not at the next sign-in.
       *
       * `AppShell` gates on `users.setup_done_at`, so saving only to
       * localStorage left a signed-in user bouncing /app -> /welcome forever:
       * finish the survey, press "See today's deals", land back on the survey.
       * The localStorage write stays for people who onboard before signing up
       * — `migrateSetup` pushes theirs up at sign-in.
       */
      if (me) {
        void (async () => {
          try {
            await api('/api/auth/me/setup', { method: 'PATCH', body: JSON.stringify(s) });
            clearSetup();
            await refresh();
          } catch (e) {
            // Do not strand them on a finished survey they cannot leave.
            setErr(
              'Your answers are saved on this device, but we could not sync them. ' +
              ((e as Error).message ?? ''),
            );
          }
        })();
      }

      setStep(total);
      return;
    }
    setStep(step + 1);
  }

  const done = step === total;

  return (
    <div className="wz">
      {!done && (
        <div className="wz-progress" role="progressbar"
          aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={total}>
          {Array.from({ length: total }, (_, i) => <span key={i} className={i <= step ? 'done' : ''} />)}
        </div>
      )}

      {/* ---- Where ---- */}
      {current === 'where' && !done && (
        <>
          <p className="wz-step">Step {step + 1} of {total}</p>
          <h1>{reseller ? 'Where do you hunt?' : 'Which stores are near you?'}</h1>
          <p className="lede">
            {reseller
              ? 'Penny items live at one store, not everywhere. We only alert you on stores you would actually drive to.'
              : 'Some deals are in-store only. We only tell you about things you could go pick up.'}
          </p>

          <div className="field">
            <label htmlFor="zip">Your ZIP code</label>
            <input id="zip" type="text" inputMode="numeric" maxLength={5} value={zip}
              placeholder="78232" onChange={(e) => setZip(e.target.value.replace(/\D/g, ''))} />
          </div>

          <div className="field">
            <label htmlFor="rad">How far will you drive?</label>
            <p className="hint">
              {reseller ? 'Most penny finds are gone within a day, so closer is better.' : ''}
            </p>
            <select id="rad" value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
              <option value={10}>Up to 10 miles</option>
              <option value={25}>Up to 25 miles</option>
              <option value={50}>Up to 50 miles</option>
              <option value={100}>Up to 100 miles</option>
            </select>
          </div>
        </>
      )}

      {/* ---- What ---- */}
      {current === 'what' && !done && (
        <>
          <p className="wz-step">Step {step + 1} of {total}</p>
          <h1>{reseller ? 'What do you flip?' : 'What do you want to save money on?'}</h1>
          <p className="lede">
            {reseller
              ? 'Pick the categories you actually resell. You will still see everything, these just come first.'
              : 'Type anything, "blender" works, you don\'t need a model number. We watch every brand of it.'}
          </p>

          <div className="field">
            <label htmlFor="watch">{reseller ? 'Add a category' : 'Add a product'}</label>
            <input id="watch" type="text" value={typed}
              placeholder={reseller ? 'Power tools' : 'Blender'}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addWatch(typed); } }} />
            <div className="chips">
              {suggestions.filter((s) => !watches.includes(s)).map((s) => (
                <button key={s} type="button" className="chip" onClick={() => addWatch(s)}>+ {s}</button>
              ))}
            </div>
          </div>

          <div className="picked">
            {watches.map((w) => (
              <span key={w} className="picked-item">
                {w}
                <button type="button" aria-label={`Remove ${w}`}
                  onClick={() => setWatches(watches.filter((x) => x !== w))}>×</button>
              </span>
            ))}
          </div>
        </>
      )}

      {/* ---- Reciprocity ---- */}
      {current === 'report' && !done && (
        <>
          <p className="wz-step">Step {step + 1} of {total}</p>
          <h1>Tell us what you find, see what others found</h1>
          <p className="lede">
            Predictions are guesses. A confirmed find is not. Members who report back get the
            verified feed, items someone physically held in the last few hours.
          </p>

          <div className="field">
            <label className={`radio${willReport ? ' on' : ''}`}>
              <input type="checkbox" checked={willReport}
                onChange={(e) => setWillReport(e.target.checked)} />
              <span>
                <span className="rl">I'll report what I find</span><br />
                <span className="rh">
                  One tap after you check out, found it, or it wasn't there. Report after you
                  buy, so it never costs you the find.
                </span>
              </span>
            </label>
          </div>

          <p className="hint">
            You can still use everything else without this. You just won't see the verified feed.
          </p>
        </>
      )}

      {/* ---- Alerts ---- */}
      {current === 'alerts' && !done && (
        <>
          <p className="wz-step">Step {step + 1} of {total}</p>
          <h1>How often should we bother you?</h1>
          <p className="lede">
            {reseller
              ? 'You want volume, but not so much that you stop reading them.'
              : 'Too many alerts and you\'ll stop reading them. Pick a limit, you can change it later.'}
          </p>

          <div className="field">
            <div className="radio-group">
              {(reseller
                ? [
                    { n: 10, l: 'Only strong finds', h: 'Up to 10 alerts a day' },
                    { n: 15, l: 'Steady flow', h: 'Up to 15 alerts a day' },
                    { n: 40, l: 'Everything', h: 'Up to 40 alerts a day' },
                  ]
                : [
                    { n: 3, l: 'Only the best ones', h: 'Up to 3 alerts a day' },
                    { n: 5, l: 'A few a day', h: 'Up to 5 alerts a day' },
                    { n: 15, l: 'Show me everything', h: 'Up to 15 alerts a day' },
                  ]
              ).map((o) => (
                <label key={o.n} className={`radio${perDay === o.n ? ' on' : ''}`}>
                  <input type="radio" name="perDay" checked={perDay === o.n}
                    onChange={() => setPerDay(o.n)} />
                  <span>
                    <span className="rl">{o.l}</span><br />
                    <span className="rh">{o.h}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="field">
            <label className={`radio${quiet ? ' on' : ''}`}>
              <input type="checkbox" checked={quiet} onChange={(e) => setQuiet(e.target.checked)} />
              <span>
                <span className="rl">No alerts overnight</span><br />
                <span className="rh">Nothing between 10pm and 7am</span>
              </span>
            </label>
          </div>
        </>
      )}

      {/* ---- Done ---- */}
      {done && (
        <div className="wz-done">
          <div className="wz-check" aria-hidden="true">✓</div>
          <h1>You're set up.</h1>
          <p className="lede">
            {reseller
              ? "We'll watch your stores and score anything heading for a penny. Nothing to check, we'll come to you."
              : "We'll watch for these and let you know when something drops. Nothing to check, we'll come to you."}
          </p>

          <div className="summary">
            <div className="summary-row">
              <span className="k">You're here to</span>
              <span className="v">{reseller ? 'Make money' : 'Save money'}</span>
            </div>
            <div className="summary-row">
              <span className="k">Watching near</span>
              <span className="v">{zip} · {radius} miles</span>
            </div>
            <div className="summary-row">
              <span className="k">{reseller ? 'Categories' : 'Products'}</span>
              <span className="v">{watches.join(', ')}</span>
            </div>
            {reseller && (
              <div className="summary-row">
                <span className="k">Verified feed</span>
                <span className="v">{willReport ? 'On, you report back' : 'Off'}</span>
              </div>
            )}
            <div className="summary-row">
              <span className="k">Alerts</span>
              <span className="v">Up to {perDay} a day{quiet ? ', none overnight' : ''}</span>
            </div>
          </div>

          <div className="wz-nav">
            <button className="btn" onClick={() => nav('/app')}>See today's deals</button>
            <button className="wz-skip" onClick={() => { setPath(null); setStep(0); }}>
              Start over
            </button>
          </div>

          <p className="wz-step" style={{ marginTop: 28 }}>
            Saved on this device. Once accounts are added, this follows you everywhere.
          </p>
        </div>
      )}

      {!done && (
        <>
          {err && <p className="wz-err" role="alert">{err}</p>}
          <div className="wz-nav">
            <button className="btn btn-quiet"
              onClick={() => { setErr(''); if (step === 0) setPath(null); else setStep(step - 1); }}>
              Back
            </button>
            <span className="grow" />
            <button className="btn" onClick={next}>
              {step === total - 1 ? 'Finish' : 'Continue'}
            </button>
          </div>
          <p className="wz-step" style={{ marginTop: 24 }}>
            Setting up {BRAND} · takes about a minute
          </p>
        </>
      )}
    </div>
  );
}

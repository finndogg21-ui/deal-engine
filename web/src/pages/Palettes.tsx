/**
 * Temporary. A real deal row and detail card rendered in each candidate
 * palette, so the choice gets made by looking rather than by adjective.
 * Delete once a direction is picked.
 */

const PALETTES = [
  {
    id: 'moss',
    name: 'Deep green',
    note: 'Money and calm. Reads trustworthy, slightly premium. Risk: every finance app is green.',
    light: { accent: '#1f5c3d', accentText: '#1f5c3d', paper: '#f7f6f2', sunk: '#eceae3', ink: '#161a17', soft: '#3f4642', faint: '#5d635e', rule: '#d5d3c9', good: '#1f5c3d', bad: '#a53a22' },
    dark: { accent: '#5fbe8b', accentText: '#5fbe8b', paper: '#0f1310', sunk: '#171d19', ink: '#e9ece9', soft: '#b6beb8', faint: '#8c948e', rule: '#2a322d', good: '#5fbe8b', bad: '#e8785c' },
  },
  {
    id: 'ink',
    name: 'Navy',
    note: 'Dependable, tool-like, serious. The safe pick. Risk: forgettable.',
    light: { accent: '#1d3a6b', accentText: '#1d3a6b', paper: '#f7f8fa', sunk: '#eaedf2', ink: '#12161f', soft: '#3c4453', faint: '#5a6273', rule: '#d3d8e0', good: '#1c6b47', bad: '#a53a22' },
    dark: { accent: '#7aa7f0', accentText: '#7aa7f0', paper: '#0e1116', sunk: '#161b23', ink: '#e8ebf1', soft: '#b3bac7', faint: '#8a92a1', rule: '#272e39', good: '#63bd8f', bad: '#e8785c' },
  },
  {
    id: 'clay',
    name: 'Rust',
    note: 'Warm and human, unusual in this category. Risk: close to competitors’ orange.',
    light: { accent: '#a84426', accentText: '#a84426', paper: '#faf7f4', sunk: '#f0eae5', ink: '#1a1512', soft: '#443b35', faint: '#665a52', rule: '#ddd3cb', good: '#1f5c3d', bad: '#a8442 6' },
    dark: { accent: '#e08a63', accentText: '#e08a63', paper: '#131010', sunk: '#1c1817', ink: '#efe9e5', soft: '#bdb2ab', faint: '#948880', rule: '#302925', good: '#6fb98a', bad: '#e8785c' },
  },
  {
    id: 'slate',
    name: 'Teal',
    note: 'Distinctive, calm, unclaimed here. Risk: can read cold.',
    light: { accent: '#11605e', accentText: '#11605e', paper: '#f6f8f8', sunk: '#e8eeed', ink: '#121a1a', soft: '#394544', faint: '#576362', rule: '#cfd9d8', good: '#11605e', bad: '#a53a22' },
    dark: { accent: '#57c2bd', accentText: '#57c2bd', paper: '#0d1211', sunk: '#151d1c', ink: '#e6eceb', soft: '#b0bbba', faint: '#889392', rule: '#243130', good: '#57c2bd', bad: '#e8785c' },
  },
];

function Sample({ p, mode }: { p: (typeof PALETTES)[number]; mode: 'light' | 'dark' }) {
  const c = p[mode];
  const s = {
    background: c.paper, color: c.ink,
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    padding: 20, borderRadius: 6, border: `1px solid ${c.rule}`,
  } as const;

  return (
    <div style={s}>
      <div style={{ fontSize: 13, color: c.faint, marginBottom: 12 }}>{mode}</div>

      {/* Deal row */}
      <div style={{ display: 'grid', gridTemplateColumns: '56px 58px 1fr auto', gap: 12, alignItems: 'center',
        padding: 13, border: `1px solid ${c.rule}`, borderRadius: 5, background: c.paper, marginBottom: 9 }}>
        <div style={{ width: 56, height: 56, background: c.sunk, borderRadius: 4, display: 'grid',
          placeItems: 'center', fontSize: 11, color: c.faint }}>photo</div>
        <div style={{ background: c.accent, color: c.paper, fontWeight: 700, fontSize: 20,
          textAlign: 'center', padding: '6px 0', borderRadius: 4, fontVariantNumeric: 'tabular-nums' }}>98</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 3 }}>Milwaukee M18 Impact Driver</div>
          <div style={{ fontSize: 14, color: c.faint }}>Bitters Rd · 1.4 miles · 2 left · Might be a penny</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: c.good, fontVariantNumeric: 'tabular-nums' }}>$0.01</div>
          <div style={{ fontSize: 13, color: c.faint, textDecoration: 'line-through' }}>$199.00</div>
        </div>
      </div>

      {/* Lower-score row, for contrast */}
      <div style={{ display: 'grid', gridTemplateColumns: '56px 58px 1fr auto', gap: 12, alignItems: 'center',
        padding: 13, border: `1px solid ${c.rule}`, borderRadius: 5, marginBottom: 16 }}>
        <div style={{ width: 56, height: 56, background: c.sunk, borderRadius: 4 }} />
        <div style={{ background: c.sunk, color: c.soft, fontWeight: 700, fontSize: 20,
          textAlign: 'center', padding: '6px 0', borderRadius: 4 }}>64</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 3 }}>Ryobi 40V Brushless Mower</div>
          <div style={{ fontSize: 14, color: c.faint }}>San Pedro · 5.8 miles · 5 left · 90% off</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: c.good }}>$80.82</div>
          <div style={{ fontSize: 13, color: c.faint }}>82% off</div>
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={{ flex: 1, padding: '12px 14px', fontSize: 15, fontWeight: 600, borderRadius: 4,
          background: c.accent, color: c.paper, border: `1px solid ${c.accent}` }}>Found it</button>
        <button style={{ flex: 1, padding: '12px 14px', fontSize: 15, fontWeight: 600, borderRadius: 4,
          background: 'transparent', color: c.bad, border: `1px solid ${c.bad}` }}>Not there</button>
      </div>
    </div>
  );
}

export default function Palettes() {
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px 90px',
      fontFamily: 'ui-sans-serif, system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 30, letterSpacing: '-0.02em', margin: '0 0 8px' }}>Pick a direction</h1>
      <p style={{ fontSize: 17, opacity: 0.75, margin: '0 0 34px', maxWidth: '60ch' }}>
        The same deal row in each palette, light and dark. Ignore the layout — judge the colour.
      </p>

      {PALETTES.map((p) => (
        <section key={p.id} style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 21, margin: '0 0 4px' }}>{p.name}</h2>
          <p style={{ fontSize: 15, opacity: 0.7, margin: '0 0 14px', maxWidth: '70ch' }}>{p.note}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
            <Sample p={p} mode="light" />
            <Sample p={p} mode="dark" />
          </div>
        </section>
      ))}
    </div>
  );
}

/**
 * Placeholder for routes that exist in the nav but aren't built.
 *
 * States plainly what the page will do and what it's waiting on. An empty
 * screen should tell you what happens next, not apologize.
 */
export default function Stub({
  section,
  title,
  summary,
  points,
  blockedBy,
}: {
  section: string;
  title: string;
  summary: string;
  points: string[];
  blockedBy?: string;
}) {
  return (
    <div className="stub">
      <div className="sb-sec">{section}</div>
      <span className="tag">Not built yet</span>
      <h1>{title}</h1>
      <p>{summary}</p>
      <ul>
        {points.map((p) => <li key={p}>{p}</li>)}
      </ul>
      {blockedBy && <p style={{ color: 'var(--ink-faint)', fontFamily: 'var(--mono)', fontSize: 12.5 }}>
        Waiting on: {blockedBy}
      </p>}
    </div>
  );
}

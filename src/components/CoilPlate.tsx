/** A coil drawn as a single line: the mark that stands in for art until the
 *  mascot lands in the second version. It uses the accent colour so the
 *  ochre token is exercised by the very first screen. */
export function CoilPlate({ title, description }: { title: string; description: string }) {
  const coils = 7;
  const step = 22;
  const start = 42;
  const points: string[] = [];
  for (let index = 0; index <= coils * 2; index += 1) {
    const y = start + index * (step / 2);
    const x = 78 + (index % 2 === 0 ? -34 : 34);
    points.push(`${x},${y.toFixed(1)}`);
  }
  return (
    <figure className="coil-plate">
      <svg viewBox="0 0 160 220" role="img" aria-label={title}>
        <title>{title}</title>
        <desc>{description}</desc>
        <line x1="80" y1="18" x2="80" y2="40" stroke="var(--line)" strokeWidth="1" />
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line x1="80" y1="196" x2="80" y2="206" stroke="var(--line)" strokeWidth="1" />
        <text x="80" y="218" textAnchor="middle" className="coil-plate-glyph">Թ</text>
      </svg>
    </figure>
  );
}

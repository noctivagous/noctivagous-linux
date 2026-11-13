// demo-de React shell — the starting point for the grid-systems foundation
// (proportions, forming grids, column grids, baseline grid).
//
// Libraries on hand as vendored copies (siblings of this file's directory):
//   ../NCTGraphite            — grid geometry (src/grid), NCTGraphiteGrid,
//                               NCTGraphiteColumnGuides, NCTGraphiteBaseline
//   ../paramorphic-components — paramorphic framework (src/framework)
//
// The starter below renders the three guide layers from NCTGraphite's
// print-page recipe — content grid, column guides, baseline rules — in
// plain CSS so the proportions can be tuned before anything is wired to
// the vendored components.

const COLUMNS = 6;
const GAP_PX = 24;
const BASELINE_PX = 16;

export default function App() {
  return (
    <main style={{ fontFamily: 'Tahoma, sans-serif', margin: 24 }}>
      <h1 style={{ fontSize: 20 }}>demo-de — grid foundation</h1>
      <p style={{ maxWidth: 560, lineHeight: `${BASELINE_PX * 1.5}px` }}>
        React shell for the desktop-environment demo. The area below is a
        six-column grid with its column guides and baseline rules showing —
        the layering NCTGraphite's print-page recipe prescribes.
      </p>
      <section
        style={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: `repeat(${COLUMNS}, 1fr)`,
          gap: GAP_PX,
          minHeight: 240,
          padding: BASELINE_PX,
          border: '1px solid #999',
          backgroundImage:
            `repeating-linear-gradient(to bottom, rgba(0,0,255,.18) 0, rgba(0,0,255,.18) 1px, transparent 1px, transparent ${BASELINE_PX}px)`,
        }}
      >
        {Array.from({ length: COLUMNS }, (_, i) => (
          <div
            key={i}
            style={{ background: 'rgba(220,0,0,.08)', minHeight: 200, padding: 8 }}
          >
            Column {i + 1}
          </div>
        ))}
      </section>
    </main>
  );
}

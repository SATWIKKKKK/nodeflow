/**
 * Arrowheads for diagram edges. Two copies because a marker cannot inherit the
 * colour of the path that uses it in every browser.
 */
export function ArrowMarkers() {
  return (
    <defs>
      <marker
        id="nf-arrow-strong"
        viewBox="0 0 10 10"
        refX="7"
        refY="5"
        markerWidth="7"
        markerHeight="7"
        orient="auto-start-reverse"
        className="text-[var(--graphics-node)]"
      >
        <path d="M 0 1 L 8 5 L 0 9" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </marker>
      <marker
        id="nf-arrow-soft"
        viewBox="0 0 10 10"
        refX="7"
        refY="5"
        markerWidth="7"
        markerHeight="7"
        orient="auto-start-reverse"
        className="text-[var(--graphics-inactive)]"
      >
        <path d="M 0 1 L 8 5 L 0 9" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </marker>
    </defs>
  );
}

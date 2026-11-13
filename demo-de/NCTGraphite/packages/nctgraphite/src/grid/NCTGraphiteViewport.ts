/** A uniform document-to-viewport transform in CSS pixels. */
export interface NCTGraphiteViewportTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface NCTGraphiteViewportSize { width: number; height: number }
export interface NCTGraphiteViewportPoint { x: number; y: number }

/** Fit the complete document in the viewport, centered, without distortion. */
export function fitDocumentToViewport(document: NCTGraphiteViewportSize, viewport: NCTGraphiteViewportSize): NCTGraphiteViewportTransform {
  if (![document.width, document.height, viewport.width, viewport.height].every((n) => Number.isFinite(n) && n > 0)) {
    throw new RangeError('Document and viewport dimensions must be finite and positive');
  }
  const scale = Math.min(viewport.width / document.width, viewport.height / document.height);
  return { scale, offsetX: (viewport.width - document.width * scale) / 2, offsetY: (viewport.height - document.height * scale) / 2 };
}

export function documentToViewport(point: NCTGraphiteViewportPoint, transform: NCTGraphiteViewportTransform): NCTGraphiteViewportPoint {
  return { x: point.x * transform.scale + transform.offsetX, y: point.y * transform.scale + transform.offsetY };
}

export function viewportToDocument(point: NCTGraphiteViewportPoint, transform: NCTGraphiteViewportTransform): NCTGraphiteViewportPoint {
  if (!Number.isFinite(transform.scale) || transform.scale <= 0) throw new RangeError('Viewport scale must be finite and positive');
  return { x: (point.x - transform.offsetX) / transform.scale, y: (point.y - transform.offsetY) / transform.scale };
}

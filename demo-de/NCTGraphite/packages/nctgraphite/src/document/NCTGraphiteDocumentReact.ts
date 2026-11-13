import { useState } from 'react';
import type { NCTGraphiteLayerRecord } from './NCTGraphiteDocument.js';
import { NCTGraphiteDocument } from './NCTGraphiteDocument.js';

/** Bind one NSDocument-style instance to React state. */
export function useNCTGraphiteDocument<Layer extends NCTGraphiteLayerRecord>(
  create: () => NCTGraphiteDocument<Layer>,
) {
  return useState(create);
}

/**
 * UI Space — the media library and the clipboard (pure data).
 *
 * The environment's first app, from KeyPilot: M opens the saved
 * media library, O there browses a page's media, and copy puts an
 * image on the clipboard. Here the library is a cabinet on the XY
 * datum wall holding seeded item records; the clipboard holds ONE
 * card at a time — a media item, or a text card copied from one of
 * the twelve objects — and the newest copy replaces the last.
 *
 * Card art is generated in the scene from these records (a coloured
 * panel by hue, initials, a pattern); there are no external images.
 *
 * Labels: in label mode the cards are addresses too. They take the
 * label sequence CONTINUING past the citizens (labelForIndex at
 * OBJECTS.length, +1, +2, …) with one skip — M is the library's own
 * operator, so the card that would have been M takes the next
 * label instead. With twelve citizens the cards start at O, so
 * their labels are: O P Q R S T U V (the M skip now guards any
 * future count where a card would land on M again).
 */

import { labelForIndex, OBJECTS } from "./space-state.js";

/** Eight seeded captures, as if saved from pages the user visited. */
export const MEDIA_ITEMS = [
  { id: "media-1", title: "Neon Dunes at Dusk", kind: "image", hue: 24,
    sourcePage: "https://example-press.test/photos/neon-dunes", sourceDomain: "example-press.test",
    width: 1600, height: 900, hash: "a3f9c21e" },
  { id: "media-2", title: "Harbour Cranes, Grey Morning", kind: "image", hue: 205,
    sourcePage: "https://harbourlog.test/gallery/cranes", sourceDomain: "harbourlog.test",
    width: 2048, height: 1365, hash: "77b04d9a" },
  { id: "media-3", title: "Circuit Garden Macro", kind: "image", hue: 140,
    sourcePage: "https://bench-notes.test/macro/circuit-garden", sourceDomain: "bench-notes.test",
    width: 1200, height: 1200, hash: "c51e88f0" },
  { id: "media-4", title: "Night Tram, Long Exposure", kind: "image", hue: 262,
    sourcePage: "https://citylight.test/streets/night-tram", sourceDomain: "citylight.test",
    width: 1920, height: 1080, hash: "09dd31bc" },
  { id: "media-5", title: "Paper Architecture No. 4", kind: "image", hue: 45,
    sourcePage: "https://studio-fold.test/works/paper-architecture-4", sourceDomain: "studio-fold.test",
    width: 1400, height: 1750, hash: "e6a2077d" },
  { id: "media-6", title: "Glacier Survey, Sector 7", kind: "image", hue: 188,
    sourcePage: "https://field-journal.test/survey/sector-7", sourceDomain: "field-journal.test",
    width: 2200, height: 1467, hash: "3bc65e19" },
  { id: "media-7", title: "Orchid Conservatory", kind: "image", hue: 318,
    sourcePage: "https://glasshouse.test/collections/orchids", sourceDomain: "glasshouse.test",
    width: 1500, height: 1000, hash: "8f02ab44" },
  { id: "media-8", title: "Desert Radio Station", kind: "image", hue: 8,
    sourcePage: "https://signal-drift.test/posts/desert-radio", sourceDomain: "signal-drift.test",
    width: 1800, height: 1200, hash: "d490c6b3" },
];

export const MEDIA_IDS = MEDIA_ITEMS.map((m) => m.id);

export function mediaById(id) {
  return MEDIA_ITEMS.find((m) => m.id === id) || null;
}

export const isMediaId = (id) => Boolean(id && mediaById(id));

/* ---------------- labels for the cards (label mode) ---------------- */

/** Letters that may not be handed out again — M runs the library. */
const RESERVED_LABELS = new Set(["M"]);

function cardLabels() {
  const out = [];
  let i = OBJECTS.length; // the sequence continues past the citizens
  while (out.length < MEDIA_ITEMS.length) {
    const label = labelForIndex(i);
    i += 1;
    if (label.length === 1 && RESERVED_LABELS.has(label)) continue;
    out.push(label);
  }
  return out;
}

const CARD_LABELS = cardLabels();

export function labelForMedia(itemOrId) {
  const idx = MEDIA_ITEMS.findIndex((m) => m.id === (itemOrId?.id || itemOrId));
  return idx >= 0 ? CARD_LABELS[idx] : null;
}

export function mediaForLabel(label) {
  const idx = CARD_LABELS.indexOf(String(label || "").toUpperCase());
  return idx >= 0 ? MEDIA_ITEMS[idx] : null;
}

/** [{ item, label }] for the overlay chips and the print index. */
export function labeledMedia() {
  return MEDIA_ITEMS.map((item, i) => ({ item, label: CARD_LABELS[i] }));
}

/* ---------------- the clipboard ---------------- */

/**
 * The clipboard holds a single card: a media item record, or a text
 * card copied from an object ({ kind:"text", title, body, hash }).
 * `held` is the card or null.
 */
export function createClipboard() {
  return { held: null };
}

/** A text card copied from one of the twelve objects (C on an object). */
export function textCardForObject(object) {
  return {
    id: `text-${object.id}`,
    kind: "text",
    title: object.name,
    body: object.blurb,
    hue: 210,
    hash: `txt-${object.id}`,
  };
}

/**
 * Put a card on the clipboard. Copying what is already held — same
 * hash — is a no-op and returns the state untouched (dedupe by
 * hash); anything else replaces the held card (newest wins).
 */
export function copyToClipboard(clip, card) {
  if (!card) return clip;
  if (clip.held && clip.held.hash === card.hash) return clip;
  return { held: card };
}

export const clipboardTitle = (clip) => (clip.held ? clip.held.title : null);

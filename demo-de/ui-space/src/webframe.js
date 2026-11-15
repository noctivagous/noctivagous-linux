/**
 * UI Space — THE CAPTURED WEB FRAME (slice 15): one page,
 * detached.
 *
 * The web converter's strategy is Carry → Detach → Native, and
 * this slice is the DETACH proof. tools/snapshot-web.mjs
 * captured ONE public page ahead of time — Wikipedia's "Snow
 * globe" article, its text CC BY-SA, the attribution carried in
 * the capture itself — and wrote its STRUCTURE: title, sections
 * (heading + first paragraphs), and the links those paragraphs
 * carry. This module is the capture's pure face:
 *
 *   - the DOCUMENT LAYOUT (layoutWebFrame): the capture laid
 *     out as a document in canvas pixels — title block, then
 *     per section a heading, its paragraphs wrapped to the
 *     measure, and its links as a row of named spans. The View
 *     paints exactly this layout onto the sheet's texture and
 *     places its hover zones from exactly these spans, so what
 *     you read, what lights, and what F follows are one layout,
 *     computed once, here;
 *   - LINK RESOLUTION (resolveWebLink): a link whose fragment
 *     names one of the captured sections moves the sheet's
 *     reading position to that section; every other link is
 *     EXTERNAL to the proof — one page only was captured, and
 *     the App's echo says so rather than pretending otherwise;
 *   - the reading position's NAV stack (pushWebNav / popWebNav),
 *     the waveform nav's plain-data discipline with section
 *     entries: moving to a section pushes where you were, and
 *     the back events pop it.
 *
 * What this is NOT: a live page. No browser renders inside the
 * deployed space; the sheet is a captured structure, captured
 * ahead of time. The live version — a local bridge driving the
 * user's own browser, the Mission Desk pattern — is a later
 * slice, and the guide copy says so.
 */

import frame from "./webframe.json" with { type: "json" };

/** The captured page, as generated: { source, captured, attribution, title, sections }. */
export const WEBFRAME = frame;

/* ---------------- wrapping ---------------- */

/**
 * Wrap a paragraph to a measure of `maxChars` characters, by
 * words. The layout counts these lines; the sheet's painter
 * draws these lines; both read this one function, so the
 * painted document and the laid-out document cannot drift.
 */
export function wrapText(text, maxChars) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    if (line && line.length + 1 + w.length > maxChars) {
      lines.push(line);
      line = w;
    } else {
      line = line ? `${line} ${w}` : w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const wordCount = (text) => String(text || "").split(/\s+/).filter(Boolean).length;

/* ---------------- the document layout ---------------- */

/**
 * The sheet's measure, in canvas pixels. The View scales the
 * whole layout onto the sheet (SHEET_W units wide), so these
 * numbers are the document's own: a 1024-wide page, margins of
 * 56, body text wrapped at 52 characters.
 */
export const WEB_MEASURE = {
  width: 1024,
  padX: 56,
  titleY: 46,
  titleSize: 62,
  titleGap: 30,
  headingSize: 40,
  headingGap: 16,
  bodySize: 29,
  lineHeight: 41,
  charsPerLine: 52,
  paraGap: 22,
  sectionGap: 46,
  linkSize: 25,
  linkRowHeight: 44,
  linkGapX: 30,
  linkPadX: 13,
  footerGap: 40,
  footerSize: 24,
};

/**
 * Lay the capture out as a document. Returns
 * { width, height, title: { y0, y1 }, sections: [...] } where
 * each section is { index, heading, words, y0, y1, paras:
 * [{ lines, y0, y1 }], links: [{ text, href, x0, x1, y0, y1 }] }
 * — y measured from the document's top, x from its left edge.
 * Deterministic: the same capture always lays out the same.
 */
export function layoutWebFrame(fr = WEBFRAME) {
  const M = WEB_MEASURE;
  const contentW = M.width - M.padX * 2;
  let y = M.titleY;
  const titleLines = wrapText(fr.title, 30);
  const title = { y0: y, y1: y + titleLines.length * (M.titleSize + 14) + M.titleGap };
  y = title.y1;
  const sections = (fr.sections || []).map((s, index) => {
    const y0 = y;
    y += M.headingSize + M.headingGap;
    const paras = (s.paragraphs || []).map((p) => {
      const lines = wrapText(p, M.charsPerLine);
      const py0 = y;
      y += lines.length * M.lineHeight + M.paraGap;
      return { lines, y0: py0, y1: y };
    });
    const links = [];
    if ((s.links || []).length) {
      let lx = M.padX;
      let ly = y;
      for (const link of s.links) {
        const w = link.text.length * (M.linkSize * 0.58) + M.linkPadX * 2;
        if (lx + w > M.padX + contentW && lx > M.padX) {
          lx = M.padX;
          ly += M.linkRowHeight;
        }
        links.push({ text: link.text, href: link.href, x0: lx, x1: lx + w, y0: ly, y1: ly + M.linkRowHeight - 8 });
        lx += w + M.linkGapX;
      }
      y = ly + M.linkRowHeight;
    }
    const words = (s.paragraphs || []).reduce((n, p) => n + wordCount(p), 0);
    const out = { index, heading: s.heading, words, y0, y1: y, paras, links };
    y += M.sectionGap;
    return out;
  });
  const height = y + M.footerGap + M.footerSize * 2;
  return { width: M.width, height, title, sections };
}

/** The laid-out capture, computed once (the View and the App both read it). */
export const WEB_LAYOUT = layoutWebFrame(WEBFRAME);

/* ---------------- the sheet: one section, beside the contents ---------------- */

/**
 * THE SHEET'S PAGE: the stage's sheet shows ONE section at a
 * time — the section at the reading position — beside a
 * CONTENTS rail that lists every section (the book's spread
 * discipline applied to a page: a document is read a spread at
 * a time, and the contents stay in view). The layout is a
 * fixed 1024 × 1024 canvas: a header (the page's title and its
 * capture line), the contents rail at the left (one band per
 * section — the View's hover zones and the highlight live on
 * these bands), the section's body at the right (heading,
 * wrapped paragraphs, and its links as named spans at their
 * own positions), and the attribution at the foot. The View
 * paints exactly this and zones exactly this.
 */
export const WEB_PAGE = {
  width: 1024,
  height: 1024,
  padX: 56,
  headerY: 44,
  titleSize: 44,
  headerGap: 26,
  tocX: 56,
  tocW: 252,
  tocEntryH: 68,
  tocGap: 10,
  tocSize: 23,
  bodyX: 348,
  bodyW: 620,
  headingSize: 40,
  headingGap: 18,
  bodySize: 27,
  lineHeight: 39,
  charsPerLine: 42,
  paraGap: 20,
  linkSize: 24,
  linkRowHeight: 42,
  linkGapX: 26,
  linkPadX: 12,
};

/**
 * Lay out the sheet's page for the section at `index`:
 * { width, height, toc: [{ index, heading, words, y0, y1,
 * current }], body: { index, heading, words, y0, y1, paras:
 * [{ lines, y0, y1 }], links: [{ text, href, x0, x1, y0, y1 }] } }.
 */
export function layoutWebSection(index, fr = WEBFRAME) {
  const P = WEB_PAGE;
  const whole = layoutWebFrame(fr);
  const cur = Math.max(0, Math.min(whole.sections.length - 1, Math.floor(index) || 0));
  let ty = P.headerY + P.titleSize + P.headerGap + 30;
  const toc = whole.sections.map((s, i) => {
    const entry = { index: i, heading: s.heading, words: s.words, y0: ty, y1: ty + P.tocEntryH, current: i === cur };
    ty += P.tocEntryH + P.tocGap;
    return entry;
  });
  const src = whole.sections[cur] || { heading: "", words: 0, paras: [], links: [] };
  let y = toc.length ? toc[0].y0 : ty;
  const bodyY0 = y;
  y += P.headingSize + P.headingGap;
  const rawParas = fr.sections[cur]?.paragraphs || [];
  const paras = src.paras.map((p, pi) => {
    // The whole-document layout wraps at its own measure; the
    // sheet's body is narrower, so re-wrap the paragraph's
    // text at the sheet's measure from the source paragraphs.
    const wrapped = wrapText(rawParas[pi] || p.lines.join(" "), P.charsPerLine);
    const py0 = y;
    y += wrapped.length * P.lineHeight + P.paraGap;
    return { lines: wrapped, y0: py0, y1: y };
  });
  const links = [];
  if (src.links.length) {
    let lx = P.bodyX;
    let ly = y;
    for (const link of src.links) {
      const w = link.text.length * (P.linkSize * 0.58) + P.linkPadX * 2;
      if (lx + w > P.bodyX + P.bodyW && lx > P.bodyX) {
        lx = P.bodyX;
        ly += P.linkRowHeight;
      }
      links.push({ text: link.text, href: link.href, x0: lx, x1: lx + w, y0: ly, y1: ly + P.linkRowHeight - 8 });
      lx += w + P.linkGapX;
    }
    y = ly + P.linkRowHeight;
  }
  return {
    width: P.width,
    height: P.height,
    toc,
    body: { index: cur, heading: src.heading, words: src.words, y0: bodyY0, y1: y, paras, links },
  };
}

/** The capture's headline counts, for cards and panels. */
export const WEB_TOTALS = {
  sections: WEB_LAYOUT.sections.length,
  words: WEB_LAYOUT.sections.reduce((n, s) => n + s.words, 0),
  links: WEB_LAYOUT.sections.reduce((n, s) => n + s.links.length, 0),
};

/* ---------------- link resolution ---------------- */

/**
 * Where a link leads, within the proof: a link whose fragment
 * names one of the captured sections is INTERNAL — following
 * it moves the reading position to that section. Anything else
 * (another article, another site, an anchor to a section the
 * capture did not keep) is EXTERNAL: not captured, one page
 * only in this proof, and the follow echoes exactly that.
 */
export function resolveWebLink(link, fr = WEBFRAME) {
  const href = String((link && link.href) || "");
  const at = href.indexOf("#");
  if (at >= 0 && href.length > at + 1) {
    let frag = href.slice(at + 1);
    try { frag = decodeURIComponent(frag); } catch { /* keep the raw fragment */ }
    frag = frag.replace(/_/g, " ").trim().toLowerCase();
    const index = (fr.sections || []).findIndex(
      (s) => s.heading.trim().toLowerCase() === frag,
    );
    if (index >= 0) return { type: "section", index };
  }
  return { type: "external", href };
}

/* ---------------- the reading position's nav ---------------- */

/**
 * The Web app's nav stack: moving the reading position pushes
 * where it was ({ section }); the back events pop it back.
 * Plain data, replaced not mutated — the waveform nav's
 * discipline, with section entries.
 */
export function pushWebNav(stack, section) {
  const s = Array.isArray(stack) ? stack : [];
  return [...s.slice(-49), { section }];
}

/** Pop → { stack, entry }; on an empty stack the entry is null. */
export function popWebNav(stack) {
  const s = Array.isArray(stack) ? stack : [];
  if (!s.length) return { stack: s, entry: null };
  return { stack: s.slice(0, -1), entry: s[s.length - 1] };
}

#!/usr/bin/env node
/**
 * UI Space — snapshot the WEB (slice 15): the DETACH proof's
 * capture step.
 *
 * The web converter's strategy is Carry → Detach → Native.
 * This tool performs the capture a Detach stands on: it fetches
 * ONE public page and writes its STRUCTURE — title, sections
 * (heading + first paragraphs), and the links those paragraphs
 * carry — to src/webframe.json. No screenshot, no DOM dump: the
 * page's own skeleton, which the space then lays out as a
 * document on the centre stage (webframe.js does the layout).
 *
 * The page is Wikipedia's SNOW GLOBE article — the master view
 * of this space is a snow globe, a miniature world under glass
 * — and Wikipedia's text is CC BY-SA, so the capture carries
 * its attribution with it, in the JSON itself. The parse is a
 * light hand parser over the HTML (node's fetch, no new
 * dependencies): scripts, styles, tables and reference markers
 * are stripped; sections split on <h2>; the first two
 * substantial paragraphs of each section are kept, trimmed;
 * links are read out of those paragraphs only.
 *
 * If the fetch or the parse fails, the tool falls back to
 * https://example.com (whose single heading and paragraph are
 * genuinely captured the same way) and says so on stdout — it
 * never invents page content and calls it captured.
 *
 * Run:  node ui-space/tools/snapshot-web.mjs
 * Out:  demo-de/ui-space/src/webframe.json  (≤ ~30 KB)
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const PRIMARY = {
  url: "https://en.wikipedia.org/wiki/Snow_globe",
  attribution:
    "“Snow globe” — Wikipedia, the free encyclopedia. Text available under the Creative Commons Attribution-ShareAlike 4.0 License (CC BY-SA 4.0).",
};
const FALLBACK = {
  url: "https://example.com",
  attribution:
    "Example Domain — example.com, the IANA-reserved illustration page, captured as-is.",
};
const SKIP_HEADINGS = new Set([
  "see also", "references", "external links", "notes",
  "further reading", "bibliography", "sources",
]);
const MAX_SECTIONS = 8;
const MAX_BYTES = 30 * 1024;

const decodeEntities = (s) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, "\"")
  .replace(/&apos;/g, "'")
  .replace(/&#39;/g, "'")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&nbsp;/g, " ")
  .replace(/&amp;/g, "&");

const stripTags = (html) => decodeEntities(
  html
    .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, "")
    .replace(/<[^>]+>/g, " "),
).replace(/\s+/g, " ")
  .replace(/\s+([,.;:!?])/g, "$1")
  .replace(/\(\s+/g, "(")
  .replace(/\s+\)/g, ")")
  .trim();

const trimTo = (text, cap) => {
  if (text.length <= cap) return text;
  const cut = text.slice(0, cap);
  const at = cut.lastIndexOf(" ");
  return `${cut.slice(0, at > 40 ? at : cap).trim()}…`;
};

function parseWiki(html, source) {
  const contentAt = html.indexOf('id="mw-content-text"');
  const body = contentAt >= 0 ? html.slice(contentAt) : html;
  const titleMatch = html.match(/<h1[^>]*id="firstHeading"[^>]*>([\s\S]*?)<\/h1>/i)
    || html.match(/<title>([^<]+)<\/title>/i);
  const title = titleMatch
    ? stripTags(titleMatch[1]).replace(/\s+—\s+Wikipedia.*$/i, "").trim()
    : "Untitled";
  // Split into lead + one chunk per <h2>.
  const chunks = body.split(/<h2\b[^>]*>/i);
  const rawSections = [];
  chunks.forEach((chunk, i) => {
    let heading = "Introduction";
    let rest = chunk;
    if (i > 0) {
      const close = chunk.indexOf("</h2>");
      if (close < 0) return;
      heading = stripTags(chunk.slice(0, close));
      rest = chunk.slice(close + 5);
    }
    if (SKIP_HEADINGS.has(heading.toLowerCase())) return;
    const paras = [];
    const links = [];
    const seenLinks = new Set();
    const pRe = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
    let m;
    while ((m = pRe.exec(rest)) !== null && paras.length < 2) {
      const text = stripTags(m[1]);
      if (text.length < 60) continue;
      paras.push(text);
      const aRe = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      let a;
      while ((a = aRe.exec(m[1])) !== null && links.length < 4) {
        const label = stripTags(a[2]);
        let href = decodeEntities(a[1]);
        if (!label || label.length > 60) continue;
        // Citation markers and edit links are apparatus, not
        // the page's links: "[ 1 ]" → #cite_note-1, red links
        // with ?action=edit, and the section edit anchors.
        if (/^\[\s*\d+\s*\]$/.test(label)) continue;
        if (/^citation needed$/i.test(label)) continue;
        if (/cite_note|action=edit|#edit|section=\d/.test(href)) continue;
        if (href.startsWith("/")) href = new URL(href, source.url).href;
        if (!/^https?:|^#/.test(href)) continue;
        const key = `${href}|${label}`;
        if (seenLinks.has(key)) continue;
        seenLinks.add(key);
        links.push({ text: label, href });
      }
    }
    if (paras.length) rawSections.push({ heading, paragraphs: paras, links });
  });
  return { title, sections: rawSections.slice(0, MAX_SECTIONS) };
}

function parseGeneric(html, source) {
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
    || html.match(/<title>([^<]+)<\/title>/i);
  const title = titleMatch ? stripTags(titleMatch[1]) : "Untitled";
  const paras = [];
  const links = [];
  const pRe = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = pRe.exec(html)) !== null && paras.length < 2) {
    const text = stripTags(m[1]);
    if (text.length < 30) continue;
    paras.push(text);
    const aRe = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let a;
    while ((a = aRe.exec(m[1])) !== null && links.length < 4) {
      const label = stripTags(a[2]);
      let href = decodeEntities(a[1]);
      if (!label) continue;
      if (href.startsWith("/")) href = new URL(href, source.url).href;
      links.push({ text: label, href });
    }
  }
  return { title, sections: [{ heading: title, paragraphs: paras, links }] };
}

async function capture(source) {
  const res = await fetch(source.url, {
    headers: { "User-Agent": "demo-de-ui-space-capture/1.0 (structure snapshot for a spatial desktop lab)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const clean = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<table\b[^>]*>[\s\S]*?<\/table>/gi, " ");
  return source.url.includes("wikipedia.org") ? parseWiki(clean, source) : parseGeneric(clean, source);
}

async function main() {
  let source = PRIMARY;
  let page = null;
  try {
    page = await capture(PRIMARY);
    if (!page.sections.length) throw new Error("no sections parsed");
  } catch (err) {
    console.warn(`primary capture failed (${err.message}) — falling back to ${FALLBACK.url}`);
    source = FALLBACK;
    page = await capture(FALLBACK);
  }
  // Trim to the size cap: shorten paragraphs until the JSON fits.
  let paraCap = 340;
  let frame = null;
  for (;;) {
    frame = {
      source: source.url,
      captured: new Date().toISOString().slice(0, 10),
      attribution: source.attribution,
      title: page.title,
      sections: page.sections.map((s) => ({
        heading: s.heading,
        paragraphs: s.paragraphs.map((p) => trimTo(p, paraCap)),
        links: s.links,
      })),
    };
    const bytes = Buffer.byteLength(JSON.stringify(frame, null, 1), "utf8");
    if (bytes <= MAX_BYTES || paraCap <= 140) {
      console.log(`captured ${source.url} → ${frame.sections.length} sections, ${bytes} bytes (paragraph cap ${paraCap})`);
      break;
    }
    paraCap -= 60;
  }
  const out = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "webframe.json");
  writeFileSync(out, `${JSON.stringify(frame, null, 1)}\n`, "utf8");
  console.log(`wrote ${out}`);
}

main().catch((err) => {
  console.error(`snapshot-web failed: ${err.message}`);
  process.exit(1);
});

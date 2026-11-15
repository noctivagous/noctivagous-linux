/**
 * UI Space — the SAMPLE BOOK (slice 13-2): a small real book,
 * written for the space, whose citizen form stands its leaves
 * around a cylinder.
 *
 * The book is a TREE in tiers — book → chapters → sections →
 * pages — because that is how it is accessed: the drum's upper
 * band carries the chapters, the lower band the sections, and
 * the pages stand as radial leaves at the rim. This module is
 * the book as DATA, pure like every other dataset here: the
 * text, the tier table (ids are name paths — "book/<chapter>/
 * <section>/<page>" — the sub-node precedent of slice 12), the
 * word-count values (a page's value is its word count; chapters,
 * sections and the book sum), the ARC LAYOUT (each tier splits
 * its parent's arc in proportion to its value — a sunburst
 * partition, unwrapped by the View around the drum), the
 * reading order, and the SPREAD PAIRING for the two-page
 * presentation.
 *
 * THE PAIRING RULE: the first page — the title page — stands
 * alone as the first spread's RECTO with a blank verso, as a
 * title page does; the remaining pages then pair in reading
 * order, (2,3), (4,5), …, and a final odd page leaves its
 * spread's recto blank.
 */

export const BOOK = {
  title: "A Sample Book of the Space",
  chapters: [
    {
      slug: "the-room", name: "The Room", color: "#e76f51",
      sections: [
        {
          slug: "the-platter", name: "The Platter",
          pages: [
            { slug: "title-page", title: "A Sample Book of the Space",
              lines: [
                "by the space, for its visitors",
                "twenty pages around a drum",
                "turn the cylinder; the book comes to you",
              ] },
            { slug: "everything-stands", title: "The Platter",
              lines: [
                "Everything stands on one platter.",
                "It turns slowly when the space is left alone,",
                "and stops the moment a key is pressed.",
              ] },
          ],
        },
        {
          slug: "the-ring", name: "The Ring",
          pages: [
            { slug: "the-ring", title: "The Ring",
              lines: [
                "Around the platter runs a glass ring.",
                "It carries things that open rather than stand:",
                "the first of them is the Waveform, for sound.",
              ] },
            { slug: "centre-stage", title: "Centre Stage",
              lines: [
                "An app opens two ways in this room.",
                "F sets it on the centre stage, small and near;",
                "E gives it the whole platter, and the citizens hide.",
              ] },
          ],
        },
        {
          slug: "the-walls", name: "The Walls",
          pages: [
            { slug: "the-back-wall", title: "The Back Wall",
              lines: [
                "The XY wall stands at the back of the room.",
                "The media library lives on it, behind glass:",
                "cards for everything the space has saved.",
              ] },
            { slug: "the-side-wall", title: "The Side Wall",
              lines: [
                "The YZ wall stands at the side, mostly empty.",
                "A room keeps a spare wall the way a desk",
                "keeps a spare drawer: for what comes next.",
              ] },
          ],
        },
      ],
    },
    {
      slug: "the-hands", name: "The Hands", color: "#2a9d8f",
      sections: [
        {
          slug: "keys", name: "Keys",
          pages: [
            { slug: "the-click", title: "The Click",
              lines: [
                "The mouse only points here; the keys do the work.",
                "The thing under the cursor is the addressee,",
                "and F is the click that opens it.",
              ] },
            { slug: "labels", title: "Labels",
              lines: [
                "Letters are operators until you ask for addresses.",
                "Alt+L raises the letter chips,",
                "and every citizen can be called by its letter.",
              ] },
            { slug: "events", title: "Events",
              lines: [
                "Leaving is an event with a name.",
                "S and Esc step back one level; D steps two;",
                "A finishes what your hands have started.",
              ] },
          ],
        },
        {
          slug: "turning", name: "Turning",
          pages: [
            { slug: "in-the-hand", title: "In the Hand",
              lines: [
                "Q and W pitch a thing, E and R yaw it,",
                "T and Y roll it, B and N turn it in its plane.",
                "Every turn pivots at the centre of its bounds.",
              ] },
            { slug: "the-platter-turns", title: "The Platter Turns",
              lines: [
                "Address nothing, and the keys turn the room.",
                "The platter answers in the camera's own terms —",
                "yaw about its up, pitch about its right.",
              ] },
          ],
        },
        {
          slug: "two-ways-closer", name: "Two Ways Closer",
          pages: [
            { slug: "magnify", title: "Magnify",
              lines: [
                "Z and X magnify: one thing grows",
                "while the rest of the space stays in place.",
                "It is the way to examine without travelling.",
              ] },
            { slug: "dolly", title: "Dolly",
              lines: [
                "C and V dolly: the camera itself moves.",
                "Pressed over a citizen, it travels toward it;",
                "over an open one, it walks you inside.",
              ] },
          ],
        },
      ],
    },
    {
      slug: "going-in", name: "Going In", color: "#7b6fd0",
      sections: [
        {
          slug: "descent", name: "Descent",
          pages: [
            { slug: "re-rooting", title: "Re-Rooting",
              lines: [
                "A sunburst can be re-rooted at any wedge.",
                "F on a branch makes it the whole world;",
                "the backs climb out, one root at a time.",
              ] },
            { slug: "what-descent-keeps", title: "What Descent Keeps",
              lines: [
                "Descent is a display state, never a transform.",
                "A thing you turned or magnified stays",
                "turned and magnified, down and back up.",
              ] },
          ],
        },
        {
          slug: "sub-nodes", name: "Sub-Nodes",
          pages: [
            { slug: "parts-of-things", title: "Parts of Things",
              lines: [
                "Citizens have parts, and parts are addresses.",
                "A knot's arcs, a tree's branches, a tray's plates —",
                "hover one and it lights; F flies you in.",
              ] },
            { slug: "shares", title: "Shares",
              lines: [
                "Every part carries its share of the whole.",
                "The card at the node names it plainly:",
                "its value, its share, its depth, its path.",
              ] },
          ],
        },
        {
          slug: "the-book-itself", name: "The Book Itself",
          pages: [
            { slug: "tiers", title: "Tiers",
              lines: [
                "This book is built in tiers, like the rest.",
                "Chapters on the upper band, sections below,",
                "pages standing as leaves at the rim.",
              ] },
            { slug: "pages-out-or-a-spread", title: "Pages Out, or a Spread",
              lines: [
                "A page can slide out of the drum to be read,",
                "or the book can stand open, two pages at a time,",
                "and B and N flip the spread.",
              ] },
            { slug: "colophon", title: "Colophon",
              lines: [
                "Set in the space's own letters —",
                "Barlow for the legends, Plex Mono for the values —",
                "and bound around a cylinder, as you see.",
              ] },
          ],
        },
      ],
    },
  ],
};

export const BOOK_ROOT_ID = "book";

const wordsOf = (text) => String(text).split(/\s+/).filter(Boolean).length;

/* ---------------- the tier table ---------------- */

function buildBookTable() {
  const byId = new Map();
  const all = [];
  const pages = [];
  const root = {
    id: BOOK_ROOT_ID, name: BOOK.title, depth: 0, parentId: null,
    path: [BOOK.title], kind: "root", value: 0, pageCount: 0,
    isLeaf: false, color: null, chapterId: null, sectionId: null,
    children: [],
  };
  byId.set(root.id, root);
  all.push(root);
  for (const ch of BOOK.chapters) {
    const chapter = {
      id: `${BOOK_ROOT_ID}/${ch.slug}`, name: ch.name, depth: 1,
      parentId: root.id, path: [BOOK.title, ch.name], kind: "chapter",
      value: 0, pageCount: 0, isLeaf: false, color: ch.color,
      chapterId: `${BOOK_ROOT_ID}/${ch.slug}`, sectionId: null, children: [],
    };
    byId.set(chapter.id, chapter);
    all.push(chapter);
    root.children.push(chapter);
    for (const sec of ch.sections) {
      const section = {
        id: `${chapter.id}/${sec.slug}`, name: sec.name, depth: 2,
        parentId: chapter.id, path: [...chapter.path, sec.name], kind: "section",
        value: 0, pageCount: 0, isLeaf: false, color: ch.color,
        chapterId: chapter.id, sectionId: `${chapter.id}/${sec.slug}`, children: [],
      };
      byId.set(section.id, section);
      all.push(section);
      chapter.children.push(section);
      for (const pg of sec.pages) {
        const words = wordsOf(pg.title) + pg.lines.reduce((n, ln) => n + wordsOf(ln), 0);
        const page = {
          id: `${section.id}/${pg.slug}`, name: pg.title, depth: 3,
          parentId: section.id, path: [...section.path, pg.title], kind: "page",
          value: words, pageCount: 1, isLeaf: true, color: ch.color,
          chapterId: chapter.id, sectionId: section.id, children: [],
          // The page's own detail, for cards and the spread.
          title: pg.title, lines: [...pg.lines], words,
          number: pages.length + 1,
          chapterName: ch.name, sectionName: sec.name,
        };
        byId.set(page.id, page);
        all.push(page);
        pages.push(page);
        section.children.push(page);
        section.value += words;
        section.pageCount += 1;
      }
      chapter.value += section.value;
      chapter.pageCount += section.pageCount;
    }
    root.value += chapter.value;
    root.pageCount += chapter.pageCount;
  }
  // THE ARC LAYOUT: a sunburst partition over the tiers — the
  // root spans the whole circle, and each node splits its arc
  // among its children in proportion to their values, in data
  // order. The View unwraps these arcs around the drum: bands
  // for chapters and sections, a leaf at each page's midpoint.
  const partition = (node, a0, a1) => {
    node.a0 = a0;
    node.a1 = a1;
    node.mid = (a0 + a1) / 2;
    let at = a0;
    for (const child of node.children) {
      const span = node.value > 0 ? ((a1 - a0) * child.value) / node.value : 0;
      partition(child, at, at + span);
      at += span;
    }
  };
  partition(root, 0, Math.PI * 2);
  return { root, byId, all, pages };
}

const TABLE = buildBookTable();

/** The book's tier table: { root, byId, all, pages } — nodes carry
 *  { id, name, depth, parentId, path, kind, value, pageCount,
 *  isLeaf, color, chapterId, sectionId, a0, a1, mid }, and pages
 *  additionally { title, lines, words, number, chapterName,
 *  sectionName }. */
export function bookTable() {
  return TABLE;
}

/** One tier node by its path id, or null. */
export function bookNodeById(id) {
  return TABLE.byId.get(id) || null;
}

/** The pages in reading order (the flattened tree), numbered from 1. */
export function bookPages() {
  return TABLE.pages;
}

/** One page's detail by its path id, or null when the id is no page. */
export function bookPageById(id) {
  const n = TABLE.byId.get(id);
  return n && n.kind === "page" ? n : null;
}

export const BOOK_TOTALS = {
  chapters: BOOK.chapters.length,
  sections: BOOK.chapters.reduce((n, c) => n + c.sections.length, 0),
  pages: TABLE.pages.length,
  words: TABLE.root.value,
};

/* ---------------- the spreads ---------------- */

/**
 * The two-page presentation's spreads, in order: [{ verso,
 * recto }] of page nodes, either side null for a blank. The
 * pairing rule is the one stated at the head of this module:
 * the title page stands alone as the first spread's recto;
 * pages then pair (2,3), (4,5), … in reading order.
 */
export function bookSpreads() {
  const pages = TABLE.pages;
  const spreads = [];
  if (!pages.length) return spreads;
  spreads.push({ verso: null, recto: pages[0] });
  for (let i = 1; i < pages.length; i += 2) {
    spreads.push({ verso: pages[i], recto: pages[i + 1] || null });
  }
  return spreads;
}

export const SPREAD_COUNT = bookSpreads().length;

/** The spread a page stands in (its index), or -1 for no page. */
export function spreadIndexForPage(pageId) {
  const spreads = bookSpreads();
  for (let i = 0; i < spreads.length; i++) {
    if (spreads[i].verso?.id === pageId || spreads[i].recto?.id === pageId) return i;
  }
  return -1;
}

/**
 * flat-web.js — the WEB frame's captured pages.
 *
 * The web enters this environment the DETACH way (the Carry → Detach →
 * Native ladder from the UI Space slice-15 design): a page is taken
 * apart and rebuilt as the environment's own furniture — its text as
 * reading matter, its LINKS AS SUBNODES that wear labels and are
 * followed with F, exactly like every other addressable thing here.
 * These three pages are captured ahead of time as data (a deployed
 * static site cannot load the live web); the live version rides the
 * local bridge driving the user's own browser, as Mission Desk does.
 *
 * A page: { id, url, title, blocks: [{ t: "h"|"p", text }],
 *           links: [{ to, text }] } — `to` is another page's id.
 */

export const WEB_PAGES = [
  {
    id: "start",
    url: "flat://start",
    title: "Start — the captured web",
    blocks: [
      { t: "h", text: "The web, detached" },
      { t: "p", text: "This page was taken apart and rebuilt as furniture of the environment. Its links wear labels like everything else here: type a link's letters to target it, F follows it, D comes back — the browser's back button is the frame's own back, because in this paradigm there was never a second navigation system to bolt on." },
      { t: "p", text: "Three pages are captured in this build: this start page, a Tech Weekly article, and the key-click reference. The address bar above takes their addresses (try flat://news). The live web itself arrives through the local bridge in a later slice — the same pattern Mission Desk uses to drive the user's own browser." },
    ],
    links: [
      { to: "news", text: "Tech Weekly — Why the click was always two jobs" },
      { to: "docs", text: "Key-click reference — the operators and the alphabet" },
    ],
  },
  {
    id: "news",
    url: "flat://news",
    title: "Tech Weekly — Why the click was always two jobs",
    blocks: [
      { t: "h", text: "Why the click was always two jobs" },
      { t: "p", text: "Every mouse click secretly does two things: it says WHERE (steering the pointer onto a target) and then it says DO IT (the button press). Bimodal control pulls the two apart — the pointer, or a typed label, does the addressing continuously, and a single discrete key does the activating. The result is an interface where nothing needs to be aimed at twice." },
      { t: "p", text: "The environments being built on this idea go further: when addressing is cheap and explicit, the things on screen can be denser, smaller, and more numerous — a desktop of labelled nodes rather than a lawn of icons — because the cost of reaching any one of them no longer scales with how carefully you can steer." },
      { t: "p", text: "Sceptics ask what happens to the web in such an environment. The answer demonstrated here: a page is detached into the environment's own furniture, its links become subnodes, and its back button turns out to have been the D key all along." },
    ],
    links: [
      { to: "start", text: "Back to Start" },
      { to: "docs", text: "Key-click reference" },
    ],
  },
  {
    id: "docs",
    url: "flat://docs/key-clicks",
    title: "Key-click reference",
    blocks: [
      { t: "h", text: "The operators" },
      { t: "p", text: "F clicks the addressee — whatever is hovered, else whatever is targeted. D goes back within the frame's own scope: up a hierarchy, out of a message, back a page. Esc releases in a big way, out of the frame entirely. V and C dolly the view into and out of whatever is being looked at. Space is each frame's own verb. None of these letters is ever an address." },
      { t: "h", text: "The alphabet" },
      { t: "p", text: "Addresses are spelled from the remaining twenty-two letters, spreadsheet-style past Z. Because the operators are not addresses, a label can be typed without mode or modifier, and a pending label can never be mistaken for a command." },
    ],
    links: [
      { to: "start", text: "Back to Start" },
      { to: "news", text: "Tech Weekly — Why the click was always two jobs" },
    ],
  },
];

export const webPageById = (id) => WEB_PAGES.find((p) => p.id === id) || WEB_PAGES[0];

/** Resolve typed address text to a captured page, or null. */
export function resolveWebAddress(text) {
  const q = String(text || "").trim().toLowerCase();
  if (!q) return null;
  return (
    WEB_PAGES.find((p) => p.url.toLowerCase() === q) ||
    WEB_PAGES.find((p) => p.id === q) ||
    WEB_PAGES.find((p) => p.title.toLowerCase().includes(q)) ||
    null
  );
}

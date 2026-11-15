/**
 * UI Space — THE MAIL (slice 15): the sample mailbox, as data.
 *
 * The last of the environment's data kinds arrives the way the
 * devices did: a snapshot, honestly flagged. mail.json is a
 * SAMPLE mailbox (sample: true) — a folder tree (Inbox, Sent,
 * Archive, and Projects with two subfolders) with message and
 * unread counts, and a shelf of RECENT messages with their full
 * text. The correspondence is sample writing about the space
 * and its building, on example domains; no real mailbox is read
 * anywhere in this slice, and everything that shows the mail
 * says SAMPLE where it shows it.
 *
 * This module is the pure face of the mailbox, built the way
 * book.js builds the book's tiers: one table of nodes whose ids
 * are name paths under the root "mail" —
 *
 *   mail/<folder>            a folder (Projects' children nest:
 *   mail/<folder>/<child>      mail/projects/atlas)
 *   mail/msg/<id>            a recent message, wherever it lives
 *
 * A folder's VALUE is its message count, its own plus its
 * subfolders' (the hierarchy rule: a branch weighs what it
 * holds); a message's value is 1 — it is one letter. Shares
 * read against the whole mailbox (subnodes.js). The FOLDER
 * CELLS below lay the folders out in the mail citizen's
 * pigeonhole cabinet with areas proportional to those counts.
 */

import mailbox from "./mail.json" with { type: "json" };

/** The sample mailbox, as authored: { sample, folders, messages }. */
export const MAILBOX = mailbox;

/** True: the committed mailbox is the SAMPLE one. */
export const isSampleMailbox = (box) => Boolean(box && box.sample);

/** Folder hues, in the house register (the book's chapters carry theirs likewise). */
const FOLDER_COLORS = {
  inbox: 0x2e7d74,
  sent: 0x5b8fd6,
  archive: 0x8e6cc8,
  projects: 0xe0a458,
};

/* ---------------- the node table ---------------- */

function buildMailTable() {
  const byId = new Map();
  const all = [];
  const messages = [];
  const root = {
    id: "mail", name: "Mail", depth: 0, parentId: null,
    path: ["Mail"], kind: "root", value: 0, unread: 0,
    isLeaf: false, color: null, children: [],
  };
  byId.set(root.id, root);
  all.push(root);
  const addFolder = (data, parent) => {
    const node = {
      id: `${parent.id}/${data.id}`, name: data.name,
      depth: parent.depth + 1, parentId: parent.id,
      path: [...parent.path, data.name], kind: "folder",
      value: 0, unread: 0, isLeaf: false,
      color: FOLDER_COLORS[data.id] ?? FOLDER_COLORS[parent.id.split("/").pop()] ?? 0x5f737c,
      children: [],
    };
    byId.set(node.id, node);
    all.push(node);
    parent.children.push(node);
    let value = data.messages || 0;
    let unread = data.unread || 0;
    for (const child of data.children || []) {
      const c = addFolder(child, node);
      value += c.value;
      unread += c.unread;
    }
    node.value = value;
    node.unread = unread;
    node.isLeaf = node.children.length === 0;
    return node;
  };
  for (const f of MAILBOX.folders || []) addFolder(f, root);
  root.value = root.children.reduce((n, c) => n + c.value, 0);
  root.unread = root.children.reduce((n, c) => n + c.unread, 0);
  // The recent messages hang off the root as their own kind:
  // wherever their folder is, their ADDRESS is the post shelf's
  // (mail/msg/<id>) — the shelf stands on the wall, not inside
  // the cabinet, so the messages are the cabinet's siblings in
  // the table, with their folder named in their detail.
  for (const m of MAILBOX.messages || []) {
    const node = {
      id: `mail/msg/${m.id}`, name: m.subject, depth: 1,
      parentId: root.id, path: ["Mail", m.subject], kind: "message",
      value: 1, unread: 0, isLeaf: true, color: null, children: [],
      // The message's own detail, for cards and the reading sheet.
      messageId: m.id, folder: m.folder, from: m.from,
      subject: m.subject, date: m.date, snippet: m.snippet, body: [...m.body],
    };
    byId.set(node.id, node);
    all.push(node);
    messages.push(node);
    root.children.push(node);
  }
  return { root, byId, all, messages };
}

const TABLE = buildMailTable();

/** The mailbox's node table: { root, byId, all, messages }. */
export function mailTable() {
  return TABLE;
}

/** One node by its path id, or null. */
export function mailNodeById(id) {
  return TABLE.byId.get(id) || null;
}

/** A recent message's detail by its bare id ("mesa-reads"), or null. */
export function messageById(id) {
  if (!id) return null;
  const n = TABLE.byId.get(id.startsWith("mail/") ? id : `mail/msg/${id}`);
  return n && n.kind === "message" ? n : null;
}

/** The recent messages, in mailbox order (newest first, as authored). */
export function recentMessages() {
  return TABLE.messages;
}

/** The folder nodes, flattened in tree order (parents before children). */
export function folderNodes() {
  return TABLE.all.filter((n) => n.kind === "folder");
}

/** The mailbox's headline counts, for cards and panels. */
export const MAIL_TOTALS = {
  sample: isSampleMailbox(MAILBOX),
  folders: folderNodes().length,
  messages: TABLE.root.value,
  unread: TABLE.root.unread,
  recent: TABLE.messages.length,
};

/* ---------------- the cabinet's cells ---------------- */

/**
 * THE PIGEONHOLE LAYOUT: the folders as compartments in a
 * cabinet of `width` × `height`, areas proportional to their
 * message counts. The scheme is a strip treemap, stated
 * plainly: the LARGEST top-level folder takes a full-width
 * strip across the top, its height its share of the whole; the
 * remaining top-level folders share the strip beneath in data
 * order, widths proportional to their counts; a folder with
 * subfolders splits its own cell vertically among them in the
 * same proportion. Coordinates are cabinet-local: x from the
 * left edge, y from the BOTTOM, so the view places a cell by
 * its centre directly. Returns leaf cells only —
 * [{ id, x, y, w, h }] — a parent's cell is its children's
 * union (Projects' frame is drawn around them by the view).
 */
export function folderCells(width = 32, height = 17) {
  const top = TABLE.root.children.filter((n) => n.kind === "folder");
  const total = top.reduce((n, c) => n + c.value, 0) || 1;
  const cells = [];
  const emit = (node, x, y, w, h) => {
    const kids = node.children.filter((c) => c.kind === "folder");
    if (!kids.length) {
      cells.push({ id: node.id, x, y, w, h });
      return;
    }
    let cy = y;
    for (const kid of kids) {
      const kh = (h * kid.value) / (node.value || 1);
      emit(kid, x, cy, w, kh);
      cy += kh;
    }
  };
  if (!top.length) return cells;
  const largest = top.reduce((a, b) => (b.value > a.value ? b : a), top[0]);
  const topH = (height * largest.value) / total;
  emit(largest, 0, height - topH, width, topH);
  const rest = top.filter((n) => n !== largest);
  const restTotal = rest.reduce((n, c) => n + c.value, 0) || 1;
  let x = 0;
  for (const node of rest) {
    const w = ((width - 0) * node.value) / restTotal;
    emit(node, x, 0, w, height - topH);
    x += w;
  }
  return cells;
}

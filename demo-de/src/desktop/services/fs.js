/* The demo file system — one live tree, several readers.
 *
 * fsData.js holds the tree as data (a JSON-shaped literal);
 * this module clones it into the session's mutable tree and
 * owns every operation on it: resolution, listing, and the
 * mutations the shell performs (mkdir / touch / rm). Readers
 * (Files, NavGraph) subscribe with fsSubscribe and re-read;
 * nothing else keeps a private copy of the file system.
 */

import { FS_DATA } from "./fsData.js";

const root = structuredClone(FS_DATA);
export const HOME_PATH = "/home/noctivagous";

let rev = 0;
const listeners = new Set();
export function fsSubscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function changed() {
  rev++;
  for (const fn of [...listeners]) fn(rev);
}

/* Absolute path arithmetic: resolves ".", "..", "~" (home)
 * and duplicate slashes against an absolute cwd. */
export function normalizePath(p, cwd) {
  let path = String(p || "");
  if (path === "~" || path.startsWith("~/")) path = HOME_PATH + path.slice(1);
  if (!path.startsWith("/")) path = (cwd || HOME_PATH) + "/" + path;
  const parts = [];
  for (const seg of path.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") parts.pop();
    else parts.push(seg);
  }
  return "/" + parts.join("/");
}

export function fsNode(absPath) {
  const path = normalizePath(absPath, HOME_PATH);
  if (path === "/") return root;
  let node = root;
  for (const seg of path.slice(1).split("/")) {
    if (!node || node.kind !== "folder") return null;
    node = (node.children || []).find((c) => c.name === seg) || null;
  }
  return node;
}

export function fsParent(absPath) {
  const path = normalizePath(absPath, HOME_PATH);
  const cut = path.lastIndexOf("/");
  return { parentPath: path.slice(0, cut) || "/", name: path.slice(cut + 1) };
}

export function fsList(absPath) {
  const node = fsNode(absPath);
  return node && node.kind === "folder" ? node.children || [] : null;
}

/* Every folder in the home tree, flat, with depth — the Files
 * window's tree pane and the legacy name lookup both read it. */
export function fsFolders() {
  const out = [];
  const walk = (node, path, depth) => {
    out.push({ path, name: node.name || "Home", depth });
    for (const c of node.children || []) {
      if (c.kind === "folder") walk(c, path + "/" + c.name, depth + 1);
    }
  };
  walk(fsNode(HOME_PATH), HOME_PATH, 0);
  return out;
}

export function fsFindFolderByName(name) {
  const hit = fsFolders().find((f) => f.name === name);
  return hit ? hit.path : null;
}

const BAD_NAME = /[/\\]/;
function nameError(name) {
  if (!name) return "no name given";
  if (BAD_NAME.test(name) || name === "." || name === "..") return "invalid name: " + name;
  return null;
}

/* Mutations return an error string, or null on success. */
export function fsMkdir(dirAbsPath, name) {
  const bad = nameError(name);
  if (bad) return bad;
  const dir = fsNode(dirAbsPath);
  if (!dir || dir.kind !== "folder") return "not a directory: " + dirAbsPath;
  if ((dir.children || []).some((c) => c.name === name)) return "already exists: " + name;
  dir.children = dir.children || [];
  dir.children.push({ name, kind: "folder", children: [] });
  changed();
  return null;
}

export function fsTouch(dirAbsPath, name) {
  const bad = nameError(name);
  if (bad) return bad;
  const dir = fsNode(dirAbsPath);
  if (!dir || dir.kind !== "folder") return "not a directory: " + dirAbsPath;
  if ((dir.children || []).some((c) => c.name === name)) return null; // touch: exists = fine
  dir.children = dir.children || [];
  dir.children.push({ name, kind: "file", type: "Text", size: "0 KB", content: "" });
  changed();
  return null;
}

/* Write a file's text content, creating the file if needed
 * (the GUI builder saves its mocks this way). Returns an
 * error string, or null on success. */
export function fsWrite(absPath, content) {
  const path = normalizePath(absPath, HOME_PATH);
  const { parentPath, name } = fsParent(path);
  const bad = nameError(name);
  if (bad) return bad;
  const dir = fsNode(parentPath);
  if (!dir || dir.kind !== "folder") return "not a directory: " + parentPath;
  dir.children = dir.children || [];
  const node = dir.children.find((c) => c.name === name);
  const size = Math.max(1, Math.round(String(content).length / 102) / 10) + " KB";
  if (node) {
    if (node.kind !== "file") return "not a file: " + name;
    node.content = String(content);
    node.size = size;
  } else {
    dir.children.push({ name, kind: "file", type: "Text", size, content: String(content) });
  }
  changed();
  return null;
}

export function fsRemove(absPath) {
  const path = normalizePath(absPath, HOME_PATH);
  if (path === "/" || path === HOME_PATH) return "refusing to remove " + path;
  const { parentPath, name } = fsParent(path);
  const parent = fsNode(parentPath);
  const node = parent && (parent.children || []).find((c) => c.name === name);
  if (!node) return "no such file or directory: " + name;
  if (node.kind === "folder" && (node.children || []).length > 0) {
    return "directory not empty: " + name;
  }
  parent.children = parent.children.filter((c) => c.name !== name);
  changed();
  return null;
}

/* The nested tree NavGraph renders, derived fresh from the
 * live tree on every call — shell mutations show up in it. */
export function fsTree() {
  const build = (node, path) => {
    const out = { name: node.name, kind: node.kind, path, size: node.size, type: node.type };
    if (node.kind === "folder") {
      out.children = (node.children || []).map((c) =>
        build(c, path + "/" + c.name));
    }
    return out;
  };
  const home = fsNode(HOME_PATH);
  const tree = build(home, HOME_PATH);
  tree.name = "Home";
  return tree;
}

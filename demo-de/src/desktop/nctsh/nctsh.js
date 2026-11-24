/* nctsh — the NCT shell.
 *
 * A small command interpreter over the demo file system
 * (services/fs.js), built to live inside other apps' frames —
 * its first home is the strip under the Files window's footer,
 * where the GUI and the command line drive the same folder.
 * It is kept as its own module because it will outgrow that
 * home: commands are plain functions of (args, env), and the
 * extra command set (pw, open) bridges to whatever surface
 * hosts the shell through env callbacks.
 *
 * env: {
 *   user,                       // for the prompt / whoami
 *   cwd(),                      // current absolute path
 *   cd(absPath),                // change the host's folder
 *   selected(),                 // the host's selected name, or null
 *   preview(absPath),           // open the host's preview surface
 * }
 * runCommand(line, env) -> { out: [{ text, err? }], clear? }
 */

import {
  HOME_PATH, normalizePath, fsNode, fsList,
  fsMkdir, fsTouch, fsRemove,
} from "../services/fs.js";

/* Whitespace split with single/double quote grouping. */
export function tokenize(line) {
  const out = [];
  let cur = "";
  let quote = null;
  let has = false;
  for (const ch of String(line)) {
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      has = true;
    } else if (ch === " " || ch === "\t") {
      if (cur || has) { out.push(cur); cur = ""; has = false; }
    } else cur += ch;
  }
  if (cur || has) out.push(cur);
  return out;
}

const HELP = [
  "nctsh — commands:",
  "  pwd            print the current folder",
  "  ls [-l] [path] list a folder",
  "  cd <path>      change folder (.. and ~ work)",
  "  mkdir <name>   make a folder here",
  "  touch <name>   make an empty file here",
  "  rm <name>      remove a file (or an empty folder)",
  "  cat <file>     print a text file",
  "  pw [file]      preview a file in the drawer",
  "  open <name>    enter a folder / preview a file",
  "  whoami         who you are",
  "  clear          clear the output",
  "  help           this list",
];

function resolve(env, arg) {
  return normalizePath(arg || ".", env.cwd());
}

function notFound(cmd, arg) {
  return { text: `nctsh: ${cmd}: no such file or directory: ${arg}`, err: true };
}

const COMMANDS = {
  help: () => ({ out: HELP.map((text) => ({ text })) }),

  pwd: (args, env) => ({ out: [{ text: env.cwd() }] }),

  whoami: (args, env) => ({ out: [{ text: env.user }] }),

  clear: () => ({ out: [], clear: true }),

  echo: (args) => ({ out: [{ text: args.join(" ") }] }),

  ls: (args, env) => {
    const long = args.includes("-l");
    const arg = args.find((a) => a !== "-l");
    const path = resolve(env, arg);
    const node = fsNode(path);
    if (!node) return { out: [notFound("ls", arg || path)] };
    if (node.kind !== "folder") return { out: [{ text: node.name }] };
    const kids = fsList(path) || [];
    if (!long) {
      return { out: [{ text: kids.map((k) => k.name + (k.kind === "folder" ? "/" : "")).join("   ") || "(empty)" }] };
    }
    return {
      out: kids.map((k) => ({
        text: `${(k.name + (k.kind === "folder" ? "/" : "")).padEnd(24)} ${(k.size || "—").padStart(7)}  ${k.type || (k.kind === "folder" ? "Folder" : "File")}`,
      })),
    };
  },

  cd: (args, env) => {
    const path = resolve(env, args[0] || "~");
    const node = fsNode(path);
    if (!node) return { out: [notFound("cd", args[0] || path)] };
    if (node.kind !== "folder") {
      return { out: [{ text: `nctsh: cd: not a directory: ${args[0]}`, err: true }] };
    }
    env.cd(path);
    return { out: [] };
  },

  mkdir: (args, env) => {
    if (!args[0]) return { out: [{ text: "nctsh: mkdir: missing name", err: true }] };
    const err = fsMkdir(env.cwd(), args[0]);
    return { out: err ? [{ text: "nctsh: mkdir: " + err, err: true }] : [] };
  },

  touch: (args, env) => {
    if (!args[0]) return { out: [{ text: "nctsh: touch: missing name", err: true }] };
    const err = fsTouch(env.cwd(), args[0]);
    return { out: err ? [{ text: "nctsh: touch: " + err, err: true }] : [] };
  },

  rm: (args, env) => {
    if (!args[0]) return { out: [{ text: "nctsh: rm: missing name", err: true }] };
    const err = fsRemove(resolve(env, args[0]));
    return { out: err ? [{ text: "nctsh: rm: " + err, err: true }] : [] };
  },

  cat: (args, env) => {
    if (!args[0]) return { out: [{ text: "nctsh: cat: missing file", err: true }] };
    const node = fsNode(resolve(env, args[0]));
    if (!node) return { out: [notFound("cat", args[0])] };
    if (node.kind === "folder") {
      return { out: [{ text: `nctsh: cat: ${args[0]}: is a directory`, err: true }] };
    }
    if (node.content == null) {
      return { out: [{ text: `nctsh: cat: ${args[0]}: no readable content (binary)`, err: true }] };
    }
    return { out: node.content.split("\n").map((text) => ({ text })) };
  },

  pw: (args, env) => {
    const arg = args[0] || env.selected();
    if (!arg) return { out: [{ text: "nctsh: pw: no file named and nothing selected", err: true }] };
    const path = resolve(env, arg);
    const node = fsNode(path);
    if (!node) return { out: [notFound("pw", arg)] };
    if (node.kind === "folder") {
      return { out: [{ text: `nctsh: pw: ${arg}: is a directory (use cd or open)`, err: true }] };
    }
    env.preview(path);
    return { out: [{ text: "previewing " + node.name }] };
  },

  open: (args, env) => {
    if (!args[0]) return { out: [{ text: "nctsh: open: missing name", err: true }] };
    const path = resolve(env, args[0]);
    const node = fsNode(path);
    if (!node) return { out: [notFound("open", args[0])] };
    if (node.kind === "folder") { env.cd(path); return { out: [] }; }
    env.preview(path);
    return { out: [{ text: "previewing " + node.name }] };
  },
};

export function runCommand(line, env) {
  const tokens = tokenize(line);
  if (tokens.length === 0) return { out: [] };
  const [cmd, ...args] = tokens;
  const fn = COMMANDS[cmd];
  if (!fn) return { out: [{ text: `nctsh: command not found: ${cmd}`, err: true }] };
  return fn(args, env);
}

export function shortPath(path) {
  return path === HOME_PATH ? "~" : path.startsWith(HOME_PATH + "/") ? "~" + path.slice(HOME_PATH.length) : path;
}

import { useEffect, useState } from "react";
import { publish, onDeliver } from "../core/patchbay.js";
import { useSlice } from "../core/react.js";
import { Icon } from "../core/registry.jsx";
import { StatusBar } from "./shared.jsx";
import {
  HOME_PATH, fsList, fsNode, fsFolders, fsFindFolderByName, fsSubscribe,
} from "../services/fs.js";
import NctshStrip from "../nctsh/NctshStrip.jsx";

/* Files: the folder list and the shell strip drive the SAME
 * folder state — clicking through the tree and typing cd in
 * nctsh are two doors onto one view (the mixed UI). The pw
 * command (or a double-click on a file) opens the preview
 * drawer to the right of the list. */

export default function FilesApp() {
  const session = useSlice("session");
  const [path, setPath] = useState(HOME_PATH);
  const [selRow, setSelRow] = useState(0);
  const [cliOpen, setCliOpen] = useState(false);
  const [previewPath, setPreviewPath] = useState(null);
  const [, setFsRev] = useState(0);

  // The file system is shared and mutable (the shell's mkdir
  // lands here too): re-read when it changes.
  useEffect(() => fsSubscribe((r) => setFsRev(r)), []);

  useEffect(() => onDeliver("files", "folder-in", (v) => {
    const s = String(v);
    const target = s.startsWith("/") ? s : fsFindFolderByName(s);
    if (target && fsNode(target)) { setPath(target); setSelRow(0); }
  }), []);

  const rows = fsList(path) || [];
  const folders = fsFolders();
  const folderName = path === HOME_PATH ? "Home" : path.slice(path.lastIndexOf("/") + 1);
  const previewNode = previewPath ? fsNode(previewPath) : null;

  const goTo = (p) => {
    setPath(p);
    setSelRow(0);
    publish("files", "folder", p);
  };

  const openRow = (r) => {
    if (r.kind === "folder") goTo(path + "/" + r.name);
    else setPreviewPath(path + "/" + r.name);
  };

  return (
    <div className="files-app">
      <div className="toolbar">
        <button className="btn sm">New</button>
        <button className="btn sm">Open</button>
        <button className="btn sm">Save</button>
        <span className="sp"></span>
        <span className="mono" style={{ fontSize: 11, color: "#888" }}>{path}</span>
      </div>
      <div className="files-grid">
        <div className="tree" id="fileTree">
          {folders.map((f) => (
            <button key={f.path} className={f.path === path ? "sel" : ""} data-folder={f.path}
              style={{ paddingLeft: 8 + f.depth * 12 }}
              onClick={() => goTo(f.path)}>
              <Icon name="folder" /> {f.name}
            </button>
          ))}
        </div>
        <div className="listbox">
          <div className="listhead"><span>Name</span><span>Size</span><span>Type</span></div>
          <div id="fileList">
            {rows.map((r, i) => (
              <div key={r.name} className={"lrow" + (i === selRow ? " sel" : "")}
                onClick={() => { setSelRow(i); publish("files", "selected", r.name); }}
                onDoubleClick={() => openRow(r)}>
                <span>{r.kind === "folder" ? "▸ " : "· "}{r.name}</span>
                <span className="sz">{r.size || "—"}</span>
                <span className="tp">{r.type || "Folder"}</span>
              </div>
            ))}
          </div>
        </div>
        {previewNode && (
          <div className="preview-drawer">
            <div className="preview-head">
              <span className="preview-name">{previewNode.name}</span>
              <button className="btn sm" onClick={() => setPreviewPath(null)}>Close</button>
            </div>
            <div className="preview-meta mono">
              {previewNode.type || "File"} · {previewNode.size || "—"} · {previewPath}
            </div>
            {previewNode.content != null ? (
              <pre className="preview-body">{previewNode.content}</pre>
            ) : previewNode.type === "Image" ? (
              <div className="preview-image">
                <span>{previewNode.name}</span>
                <span className="preview-image-sub">image preview — no raster in the demo data</span>
              </div>
            ) : (
              <div className="preview-body preview-none">No preview content for this file.</div>
            )}
          </div>
        )}
      </div>
      <StatusBar
        left={(
          <span style={{ border: "none", padding: 0, display: "inline-flex", gap: 8, alignItems: "center" }}>
            <button className={"btn sm files-cli-toggle" + (cliOpen ? " primary" : "")}
              onClick={() => setCliOpen((o) => !o)} title="Toggle the nctsh command line">
              &gt;_ CLI
            </button>
            <span>{folderName} — {rows.length} items</span>
          </span>
        )}
        right="100%"
      />
      {cliOpen && (
        <NctshStrip
          user={session.user}
          cwd={path}
          onCd={goTo}
          selectedName={rows[selRow] ? rows[selRow].name : null}
          onPreview={setPreviewPath}
        />
      )}
    </div>
  );
}

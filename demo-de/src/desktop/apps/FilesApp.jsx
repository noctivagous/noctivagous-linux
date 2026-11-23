import { useEffect, useState } from "react";
import { publish, onDeliver } from "../core/patchbay.js";
import { useSlice } from "../core/react.js";
import { Icon } from "../core/registry.jsx";
import { StatusBar } from "./shared.jsx";
import { FILEDATA } from "../services/fs.js";

export { FILEDATA };

export default function FilesApp() {
  const session = useSlice("session");
  const [folder, setFolder] = useState("Home");
  const [selRow, setSelRow] = useState(0);
  useEffect(() => onDeliver("files", "folder-in", (v) => {
    const name = String(v);
    if (FILEDATA[name]) { setFolder(name); setSelRow(0); }
  }), []);
  const rows = FILEDATA[folder];
  return (
    <div className="files-app">
      <div className="toolbar">
        <button className="btn sm">New</button>
        <button className="btn sm">Open</button>
        <button className="btn sm">Save</button>
        <span className="sp"></span>
        <span className="mono" style={{ fontSize: 11, color: "#888" }}>
          /home/{session.user}{folder === "Home" ? "" : "/" + folder.toLowerCase()}
        </span>
      </div>
      <div className="files-grid">
        <div className="tree" id="fileTree">
          {Object.keys(FILEDATA).map((k) => (
            <button key={k} className={k === folder ? "sel" : ""} data-folder={k}
              onClick={() => { setFolder(k); setSelRow(0); publish("files", "folder", k); }}>
              <Icon name="folder" /> {k}
            </button>
          ))}
        </div>
        <div className="listbox">
          <div className="listhead"><span>Name</span><span>Size</span><span>Type</span></div>
          <div id="fileList">
            {rows.map((r, i) => (
              <div key={r[0]} className={"lrow" + (i === selRow ? " sel" : "")} onClick={() => { setSelRow(i); publish("files", "selected", r[0]); }}>
                <span>{r[2] === "Folder" ? "▸ " : "· "}{r[0]}</span>
                <span className="sz">{r[1]}</span>
                <span className="tp">{r[2]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <StatusBar
        left={<span style={{ border: "none", padding: 0 }}>{folder} — {rows.length} items</span>}
        right="100%"
      />
    </div>
  );
}

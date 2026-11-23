import { useEffect, useRef, useState } from "react";
import { toast } from "../core/bus.js";
import { publish, onDeliver } from "../core/patchbay.js";
import { StatusBar } from "./shared.jsx";

export default function NotesApp() {
  const [status, setStatus] = useState("0 words · 0 chars");
  const [saved, setSaved] = useState(false);
  const taRef = useRef(null);

  useEffect(() => onDeliver("notes", "text-in", (v) => {
    if (taRef.current && taRef.current.value !== String(v)) {
      taRef.current.value = String(v);
      upd();
    }
  }), []);
  function upd() {
    const v = taRef.current ? taRef.current.value : "";
    publish("notes", "text", v);
    const w = v.trim() ? v.trim().split(/\s+/).length : 0;
    setSaved(false);
    setStatus(w + " words · " + v.length + " chars");
  }
  return (
    <>
      <div className="toolbar">
        <button className="btn sm primary" id="notesSave"
          onClick={() => { setSaved(true); setStatus("Saved · " + new Date().toLocaleTimeString()); toast("Notes saved (this session only)"); }}>
          Save
        </button>
        <button className="btn sm" id="notesClear"
          onClick={() => { if (taRef.current) { taRef.current.value = ""; upd(); taRef.current.focus(); } }}>
          Clear
        </button>
        <span className="sp"></span>
        <span className="mono" style={{ fontSize: 11, color: "#888" }}>untitled.txt</span>
      </div>
      <textarea className="tinput notes" id="notesArea" ref={taRef} placeholder="Type here…"
        defaultValue={"Session notes\n\n- \n"} onInput={upd} />
      <StatusBar left={<span style={{ border: "none", padding: 0 }}>{saved ? status : status}</span>} right="UTF-8" />
    </>
  );
}

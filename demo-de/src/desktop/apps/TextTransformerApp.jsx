import { useRef, useState } from "react";
import { toast } from "../core/bus.js";
import { useSlice } from "../core/react.js";
import { StatusBar } from "./shared.jsx";

/* TextTransformer — case conversion, starting with the function
 * set of caseconvert.net: UPPER CASE, lower case, Sentence
 * case, Title Case, Capital Case and Hyphenated. A transform
 * reads the input and writes the output pane; Use Output feeds
 * it back for chaining. */

const SMALL_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "nor", "of", "in", "on",
  "at", "to", "for", "with", "by", "from", "as", "into", "over",
  "per", "via",
]);

const capWord = (w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w);

export const TRANSFORMS = [
  {
    id: "upper",
    name: "UPPER CASE",
    run: (t) => t.toUpperCase(),
  },
  {
    id: "lower",
    name: "lower case",
    run: (t) => t.toLowerCase(),
  },
  {
    id: "sentence",
    name: "Sentence case",
    run: (t, opts) => {
      const base = opts.sentenceLowerRest === false ? t : t.toLowerCase();
      return base.replace(/(^\s*[a-z])|([.!?]\s*[a-z])/g, (m) => m.toUpperCase());
    },
  },
  {
    id: "title",
    name: "Title Case",
    run: (t) =>
      t.toLowerCase().split(/(\s+)/).map((w, i, arr) => {
        if (!w.trim()) return w;
        if (i > 0 && i < arr.length - 1 && SMALL_WORDS.has(w)) return w;
        return capWord(w);
      }).join(""),
  },
  {
    id: "capital",
    name: "Capital Case",
    run: (t) => t.toLowerCase().replace(/(^|\s)(\S)/g, (m, p, c) => p + c.toUpperCase()),
  },
  {
    id: "hyphen",
    name: "Hyphenated",
    run: (t) =>
      t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
  },
];

export default function TextTransformerApp() {
  const settings = useSlice("settings");
  const opts = (settings.appSettings && settings.appSettings.texttransformer) || {};
  const [out, setOut] = useState("");
  const [lastFn, setLastFn] = useState(null);
  const inRef = useRef(null);
  const outRef = useRef(null);

  const counts = (t) =>
    (t.trim() ? t.trim().split(/\s+/).length : 0) + " words · " + t.length + " chars";

  function apply(fn) {
    const v = inRef.current ? inRef.current.value : "";
    setOut(fn.run(v, opts));
    setLastFn(fn.name);
  }

  return (
    <div className="ttx">
      <div className="toolbar">
        <span className="mono" style={{ fontSize: 11, color: "#888" }}>Input</span>
        <span className="sp"></span>
        <button className="btn sm" onClick={() => { if (inRef.current) { inRef.current.value = ""; setOut(""); setLastFn(null); } }}>Clear</button>
      </div>
      <textarea className="tinput tt-in" ref={inRef} placeholder="Type or paste text here…"
        defaultValue={"the quick brown fox jumps over the lazy dog. case matters here."} />
      <div className="tt-fns">
        {TRANSFORMS.map((fn) => (
          <button key={fn.id} className={"btn sm" + (lastFn === fn.name ? " primary" : "")} onClick={() => apply(fn)}>
            {fn.name}
          </button>
        ))}
      </div>
      <div className="toolbar">
        <span className="mono" style={{ fontSize: 11, color: "#888" }}>Output{lastFn ? " — " + lastFn : ""}</span>
        <span className="sp"></span>
        <button className="btn sm" onClick={() => {
          if (inRef.current && outRef.current) { inRef.current.value = outRef.current.value; }
        }}>Use Output as Input</button>
        <button className="btn sm" onClick={() => {
          const v = outRef.current ? outRef.current.value : "";
          if (navigator.clipboard) navigator.clipboard.writeText(v).then(() => toast("Copied to clipboard"), () => toast("Copy failed"));
        }}>Copy</button>
      </div>
      <textarea className="tinput tt-out" ref={outRef} readOnly value={out} placeholder="The converted text appears here…" />
      <StatusBar left={counts(out)} right="UTF-8" />
    </div>
  );
}

/* The app's settings, declared as a property list for the
 * stock settings kit (apps/settingsKit.jsx). */
export const SettingsSpec = [
  {
    key: "sentenceLowerRest", type: "checkbox",
    label: "Sentence case lowercases the rest of each sentence",
    default: true,
  },
];

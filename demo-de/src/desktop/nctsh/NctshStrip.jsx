/* The nctsh strip: the shell's surface inside a host frame.
 *
 * A single text field segment that opens under the host's
 * footer and expands its content frame. The field takes the
 * commands (see nctsh.js); output collects in a small log
 * above it. The host owns the folder state — the strip drives
 * it through callbacks, so typing cd and clicking folders in
 * the list move the same view.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { runCommand, shortPath } from "./nctsh.js";

export default function NctshStrip({ user, cwd, onCd, selectedName, onPreview }) {
  const [log, setLog] = useState([
    { text: "nctsh — the NCT shell. Type `help` for commands.", dim: true },
  ]);
  const [value, setValue] = useState("");
  const [history, setHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);
  const inputRef = useRef(null);
  const logRef = useRef(null);

  // The env reads the latest host state on every command.
  const envRef = useRef({});
  envRef.current = { user, cwd, selectedName };
  const env = useMemo(() => ({
    get user() { return envRef.current.user; },
    cwd: () => envRef.current.cwd,
    cd: (p) => onCd(p),
    selected: () => envRef.current.selectedName,
    preview: (p) => onPreview(p),
  }), [onCd, onPreview]);

  useEffect(() => { inputRef.current && inputRef.current.focus(); }, []);
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  const prompt = `${user}@nct:${shortPath(cwd)}$`;

  const submit = () => {
    const line = value;
    setValue("");
    setHistIdx(-1);
    if (line.trim()) setHistory((h) => [line, ...h].slice(0, 50));
    const echo = { text: prompt + " " + line, in: true };
    const res = runCommand(line, env);
    if (res.clear) { setLog([]); return; }
    setLog((l) => [...l, echo, ...(res.out || [])].slice(-60));
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length) {
        const idx = Math.min(histIdx + 1, history.length - 1);
        setHistIdx(idx);
        setValue(history[idx]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const idx = histIdx - 1;
      setHistIdx(Math.max(idx, -1));
      setValue(idx >= 0 ? history[idx] : "");
    }
  };

  return (
    <div className="nctsh">
      <div className="nctsh-log" ref={logRef}>
        {log.map((l, i) => (
          <div key={i} className={"nctsh-line" + (l.err ? " err" : "") + (l.in ? " in" : "") + (l.dim ? " dim" : "")}>
            {l.text}
          </div>
        ))}
      </div>
      <div className="nctsh-row">
        <span className="nctsh-prompt">{prompt}</span>
        <input
          ref={inputRef}
          className="nctsh-input"
          type="text"
          value={value}
          spellCheck={false}
          autoComplete="off"
          placeholder="cd, mkdir, ls, cat, pw…"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
        />
      </div>
    </div>
  );
}

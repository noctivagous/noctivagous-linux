import { useEffect, useRef, useState } from "react";
import { useSlice } from "../core/react.js";
import { closeWindow } from "../core/windows.js";
import { publish, onDeliver } from "../core/patchbay.js";

export default function TerminalApp() {
  const session = useSlice("session");
  const [out, setOut] = useState([]);
  const histRef = useRef([]);
  const hiRef = useRef(0);
  const inputRef = useRef(null);
  const bodyRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 1e7;
  }, [out]);
  useEffect(() => onDeliver("terminal", "run", (v) => {
    const inp = inputRef.current;
    if (!inp) return;
    // The cord types the command in: focus for the keystroke,
    // then hand focus back — a delivery must not steal the
    // keyboard from whatever the user was doing.
    const prev = document.activeElement;
    inp.focus();
    inp.value = String(v);
    inp.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    if (prev && prev !== inp && prev !== document.body && prev.focus) prev.focus();
    else inp.blur();
  }), []);

  function run(e) {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (hiRef.current > 0) {
        hiRef.current--;
        e.target.value = histRef.current[hiRef.current] || "";
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      hiRef.current = Math.min(histRef.current.length, hiRef.current + 1);
      e.target.value = histRef.current[hiRef.current] || "";
      return;
    }
    if (e.key !== "Enter") return;
    const raw = e.target.value;
    const cmd = raw.trim();
    e.target.value = "";
    const lines = [{ html: `<span>${session.user}@nct:~$</span> ${escapeHtml(raw)}`, plain: true }];
    if (cmd) {
      histRef.current.push(cmd);
      hiRef.current = histRef.current.length;
      publish("terminal", "command", cmd);
    }
    if (!cmd) {
      setOut((o) => [...o, ...lines]);
      return;
    }
    const parts = cmd.split(/\s+/);
    const c = parts[0].toLowerCase();
    const rest = cmd.slice(parts[0].length).trim();
    const d = new Date();
    if (c === "help") lines.push({ html: '<span class="dim">help  ls  pwd  date  echo &lt;text&gt;  clear  whoami  neofetch  about  exit</span>' });
    else if (c === "ls") lines.push({ text: "Documents  Projects  Pictures  notes.txt" });
    else if (c === "pwd") lines.push({ text: "/home/" + session.user });
    else if (c === "date") lines.push({ text: d.toString() });
    else if (c === "echo") lines.push({ text: rest });
    else if (c === "clear") {
      setOut([]);
      return;
    } else if (c === "whoami") lines.push({ text: session.user });
    else if (c === "neofetch" || c === "about")
      lines.push({ html: `<span class="usr">NOCTIVAGOUS 4.2</span>\n<span class="dim">Kernel 6.8-NCT · Session ${session.sessionType} · Shell nctsh 1.4 · Uptime live</span>` });
    else if (c === "exit") {
      closeWindow("terminal");
      return;
    } else
      lines.push({ html: `<span style="color:#ff8a80">nctsh: command not found: ${escapeHtml(c)}</span> <span class="dim">— try help</span>` });
    setOut((o) => [...o, ...lines]);
  }

  return (
    <div className="term" ref={bodyRef} onClick={() => inputRef.current && inputRef.current.focus()}>
      <div>
        <span className="usr">NOCTIVAGOUS terminal</span> <span className="dim">— type </span>help
        <span className="dim"> for commands</span>
      </div>
      <div id="termOut">
        {out.map((l, i) =>
          l.html ? (
            <div key={i} dangerouslySetInnerHTML={{ __html: l.html }} />
          ) : (
            <div key={i}>{l.text}</div>
          ),
        )}
      </div>
      <div className="termline">
        <span>{session.user}@nct:~$</span>
        <input id="termInput" ref={inputRef} autoComplete="off" spellCheck="false" aria-label="Terminal input" onKeyDown={run} />
      </div>
    </div>
  );
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

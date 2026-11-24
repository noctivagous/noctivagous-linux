import { useState } from "react";
import { useSlice } from "../core/react.js";
import { StatusBar } from "./shared.jsx";

/* Calculator — a plain four-function calculator with percent
 * and sign. Driven by its buttons (which the key-click system
 * clicks like any other control). */

const OPS = {
  "+": (a, b) => a + b,
  "−": (a, b) => a - b,
  "×": (a, b) => a * b,
  "÷": (a, b) => (b === 0 ? NaN : a / b),
};

let roundSetting = null; // decimal places, from the app's settings
function fmt(n) {
  if (typeof n !== "number" || Number.isNaN(n)) return "Error";
  if (!Number.isFinite(n)) return "Error";
  if (roundSetting !== null && Math.abs(n) < 1e15) {
    return String(parseFloat(n.toFixed(roundSetting)));
  }
  return String(parseFloat(n.toPrecision(12)));
}

export default function CalculatorApp() {
  const settings = useSlice("settings");
  const mine = (settings.appSettings && settings.appSettings.calculator) || {};
  roundSetting = typeof mine.round === "number" ? mine.round : null;
  const [disp, setDisp] = useState("0"); // the entry / result line
  const [acc, setAcc] = useState(null); // accumulated value
  const [op, setOp] = useState(null); // pending operator
  const [fresh, setFresh] = useState(true); // next digit starts a new entry

  const entry = () => parseFloat(disp);

  function digit(d) {
    if (disp === "Error" || fresh) {
      setDisp(d === "." ? "0." : d);
      setFresh(false);
    } else if (d === ".") {
      if (!disp.includes(".")) setDisp(disp + ".");
    } else {
      setDisp(disp === "0" ? d : disp.length < 16 ? disp + d : disp);
    }
  }

  function applyOp(next) {
    const v = entry();
    if (acc !== null && op && !fresh) {
      const r = OPS[op](acc, v);
      setAcc(r);
      setDisp(fmt(r));
    } else {
      setAcc(v);
    }
    setOp(next);
    setFresh(true);
  }

  function equals() {
    if (acc === null || !op) return;
    const r = OPS[op](acc, entry());
    setDisp(fmt(r));
    setAcc(null);
    setOp(null);
    setFresh(true);
  }

  function clear() {
    setDisp("0");
    setAcc(null);
    setOp(null);
    setFresh(true);
  }

  const expr = acc !== null && op ? fmt(acc) + " " + op : "";

  const key = (label, fn, cls) => (
    <button key={label} className={"calc-key" + (cls ? " " + cls : "")} onClick={fn}>
      {label}
    </button>
  );

  return (
    <div className="calc">
      <div className="calc-screen">
        <div className="calc-expr">{expr || " "}</div>
        <div className="calc-disp">{disp}</div>
      </div>
      <div className="calc-grid">
        {key("C", clear, "util")}
        {key("±", () => { if (disp !== "Error") setDisp(disp.startsWith("-") ? disp.slice(1) : disp === "0" ? "0" : "-" + disp); }, "util")}
        {key("%", () => { if (disp !== "Error") { setDisp(fmt(entry() / 100)); setFresh(true); } }, "util")}
        {key("÷", () => applyOp("÷"), "op" + (op === "÷" ? " on" : ""))}
        {["7", "8", "9"].map((d) => key(d, () => digit(d)))}
        {key("×", () => applyOp("×"), "op" + (op === "×" ? " on" : ""))}
        {["4", "5", "6"].map((d) => key(d, () => digit(d)))}
        {key("−", () => applyOp("−"), "op" + (op === "−" ? " on" : ""))}
        {["1", "2", "3"].map((d) => key(d, () => digit(d)))}
        {key("+", () => applyOp("+"), "op" + (op === "+" ? " on" : ""))}
        {key("0", () => digit("0"), "wide")}
        {key(".", () => digit("."))}
        {key("=", equals, "eq")}
      </div>
      <StatusBar left="Calculator" right={expr ? expr + " …" : "Ready"} />
    </div>
  );
}

/* The app's settings, declared as a property list for the
 * stock settings kit (apps/settingsKit.jsx): the Settings app
 * renders these stock controls bound to the system settings;
 * the app reads its values back from settings.appSettings. */
export const SettingsSpec = [
  {
    key: "round", label: "Round results to", type: "select",
    options: [
      { value: null, label: "Full precision" },
      { value: 8, label: "8 decimal places" },
      { value: 4, label: "4 decimal places" },
      { value: 2, label: "2 decimal places" },
    ],
    default: null,
  },
];

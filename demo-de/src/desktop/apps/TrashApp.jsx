import { StatusBar } from "./shared.jsx";

export default function TrashApp() {
  return (
    <>
      <div className="cap" style={{ marginBottom: 8 }}>Trash · 02</div>
      <div className="listbox">
        <div className="listhead"><span>Name</span><span>Size</span><span>Type</span></div>
        <div style={{ padding: 22, textAlign: "center", color: "#777", fontFamily: "var(--font-m)", fontSize: 11.5 }}>
          TRASH IS EMPTY
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <button className="btn sm" disabled style={{ opacity: 0.45 }}>Empty Trash</button>
      </div>
      <StatusBar left="0 ITEMS" right="—" />
    </>
  );
}

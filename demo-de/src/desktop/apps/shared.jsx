/* Small pieces shared by app windows. */

export function pad(n) {
  return (n < 10 ? "0" : "") + n;
}

export function pad3(n) {
  return (n < 10 ? "00" : n < 100 ? "0" : "") + n;
}

export function StatusBar({ left, right }) {
  return (
    <div className="wstatus" style={{ margin: "12px -12px -12px", borderTop: "1px solid #000" }}>
      <span>{left}</span>
      <span className="grow">{right}</span>
    </div>
  );
}

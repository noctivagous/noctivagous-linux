import { useEffect, useRef, useState, lazy, Suspense } from "react";
import { store, useSlice } from "../core/react.js";
import { toast } from "../core/bus.js";
import { enterDesktop, finishUnlock } from "./sessionActions.js";
import { useNow, hm, hm12, hms, fullDate, MONS } from "./useNow.js";
import GreeterDashboard from "../greeter/GreeterDashboard.jsx";
import GreeterKnot, { CinquefoilBackdrop } from "../greeter/GreeterKnot.jsx";
const CinquefoilWebGL = lazy(() => import("../greeter/GreeterKnotGL.jsx"));
import { HOSTNAME, LAUNCH_NAMES } from "../greeter/greeterData.js";

const PROFILES = [
  { id: "personal", label: "PERSONAL" },
  { id: "household", label: "HOUSEHOLD" },
  { id: "public", label: "PUBLIC" },
];

const SESSIONS = ["Flat Space", "ZUI Plane", "ZUI Spatial"];
const USERS = [
  { user: "noctivagous", init: "N", name: "Noctivagous", role: "Administrator · Local account" },
  { user: "guest", init: "G", name: "Guest", role: "Guest · Limited session" },
  { user: "", init: "+", name: "Other…", role: "Other account" },
];
const BOOT_LINES = (user, sess) => [
  "[ ok ] session accepted — user " + user,
  "[ .. ] mounting /home/" + user,
  "[ .. ] loading profile · " + sess.toLowerCase(),
  " [ ok ] starting window manager",
  "[ ok ] restoring panels and dock",
];

export default function Login({ onPower, onRestart }) {
  const session = useSlice("session");
  const settings = useSlice("settings");
  const ui = useSlice("ui");
  const now = useNow();
  // Greeter Dashboard profile: greeter-local state (pre-login,
  // no session exists yet), defaulting to the personal
  // workstation configuration.
  const [profile, setProfile] = useState("personal");
  const [chip, setChip] = useState(0);
  const [showPw, setShowPw] = useState(false);
  const [caps, setCaps] = useState(false);
  const [err, setErr] = useState("");
  const [shaking, setShaking] = useState(false);
  const [booting, setBooting] = useState(false);
  const [bootLines, setBootLines] = useState([]);
  const [status, setStatus] = useState(session.lockMode ? "LOCKED" : "READY");
  const userRef = useRef(null);
  const passRef = useRef(null);

  // Lock mode arrives from the shell (Ctrl+L / menu): reset the form.
  useEffect(() => {
    if (session.lockMode) {
      setBooting(false);
      setBootLines([]);
      setStatus("LOCKED");
      if (userRef.current) userRef.current.value = session.user;
      if (passRef.current) {
        passRef.current.value = "";
        passRef.current.focus();
      }
    }
  }, [session.lockMode]);

  function shakeErr(msg) {
    setErr(msg);
    setShaking(false);
    requestAnimationFrame(() => setShaking(true));
    setStatus("AUTH · INPUT REQUIRED");
    if (passRef.current) passRef.current.focus();
  }

  function pickUser(i) {
    setChip(i);
    const u = USERS[i];
    if (userRef.current) userRef.current.value = u.user;
    setErr("");
    // The Guest chip is a door, not a form choice: it logs the
    // guest session in directly. (Never in lock mode — a locked
    // screen belongs to its own user.)
    if (u.user === "guest" && !session.lockMode) {
      startLogin("guest");
      return;
    }
    if (passRef.current) {
      if (u.user === "guest") passRef.current.value = "guest";
      passRef.current.focus();
    }
  }

  function startLogin(u) {
    store.set("session", { user: u });
    setErr("");
    setStatus("AUTH · OK");
    setBooting(true);
    const lines = BOOT_LINES(u, session.sessionType);
    setBootLines([]);
    let i = 0;
    const iv = setInterval(() => {
      if (i < lines.length) {
        const line = lines[i];
        setBootLines((b) => [...b, line]);
        i++;
      } else {
        clearInterval(iv);
        setTimeout(() => {
          setBooting(false);
          enterDesktop();
        }, 260);
      }
    }, 300);
  }

  function doLogin(e) {
    e.preventDefault();
    const u = userRef.current.value.trim();
    const p = passRef.current.value;
    if (session.lockMode) {
      if (!p) {
        shakeErr("Enter your password to unlock.");
        return;
      }
      if (passRef.current) passRef.current.value = "";
      finishUnlock();
      return;
    }
    if (!u) {
      shakeErr("Enter a username.");
      userRef.current.focus();
      return;
    }
    if (!p) {
      shakeErr("Password is empty — enter any password to continue.");
      return;
    }
    startLogin(u);
  }

  const who = USERS[chip];
  return (
    <section className="screen on" id="loginScreen">
      <div className={"wall" + (settings.backdrop.mode === "parametric" ? " para" : "")} id="loginWall" data-w={settings.wallpaper}>
        <div className="wall-mark">N</div>
        <div className="reg tl"></div><div className="reg tr"></div><div className="reg bl"></div><div className="reg br"></div>
        <div className="wall-coords">SYS / SESSION MANAGER<br />LAT 00.0000 · LON 00.0000<br />DISPLAY :0 · VT7</div>
      </div>
      <div id="brightVeilLogin" style={{ position: "absolute", inset: 0, background: "#000", opacity: ((100 - settings.brightness) / 100) * 0.55, pointerEvents: "none", zIndex: 40 }}></div>
      <header className="topbar">
        <div className="wordmark"><span className="sq"></span>NOCTIVAGOUS <small>OS 4.2 · KERNEL 6.8-NCT</small></div>
        <div className="gd-topdate">{fullDate(now)}</div>
        <div className="top-right">
          <span className="stat hidem"><span className="led"></span><span>ETH0 · LINK</span></span>
          <span className="stat hidem">HOST · {HOSTNAME}</span>
          <span className="stat hidem">UPS {ui.battery}%</span>
          <span className="stat hidem">VOL {settings.volume}%</span>
          <span className="stat"><span>{now.getDate()} {MONS[now.getMonth()].slice(0, 3).toUpperCase()} {now.getFullYear()}</span></span>
          <span className="stat" style={{ fontWeight: 700, color: "#eee" }}>{hms(now)}</span>
          <span className="seg gd-prof" role="group" aria-label="Dashboard profile">
            {PROFILES.map((p) => (
              <button type="button" key={p.id} className={profile === p.id ? "sel" : ""} data-profile={p.id}
                onClick={() => setProfile(p.id)}>
                {p.label}
              </button>
            ))}
          </span>
          <button className="iconbtn" aria-label="Power options" title="Power" onClick={onPower}>
            <svg className="ic" viewBox="0 0 24 24"><path d="M12 3v8M6.3 6.5a8 8 0 1 0 11.4 0" /></svg>
          </button>
        </div>
      </header>

      <GreeterDashboard profile={profile}>
        <div className="login-clock">
          {((settings.greeter || {}).clockKnotView || "webgl") === "webgl" ? (
            <Suspense fallback={<CinquefoilBackdrop />}>
              <CinquefoilWebGL />
            </Suspense>
          ) : (
            <CinquefoilBackdrop />
          )}
          {(settings.greeter || {}).clockAmpm !== false ? (
            <div className="time">{hm12(now).time}<span className="ampm">{hm12(now).ampm}</span></div>
          ) : (
            <div className="time">{hm(now)}</div>
          )}
          <div className="date">{fullDate(now)}</div>
          <div className="sessline">SESSION · {session.sessionType.toUpperCase()} &nbsp;/&nbsp; DISPLAY :0</div>
        </div>

        <div className={"nwin login-win" + (shaking ? " shake" : "")} id="loginWin">
          <div className="titlebar" style={{ cursor: "default" }}>
            <span className="tid">WIN · 001</span>
            <span className="tt">{session.lockMode ? "Locked — " + session.user : "Login — Session Manager"}</span>
            <span className="wctl">
              <button className="wbtn close" aria-label="Close" onClick={onPower}>✕</button>
            </span>
          </div>
          <div className="wbody">
            <div className="avatar-row">
              <div className="avatar">
                <span className="avatar-init">{who.init}</span>
                <GreeterKnot form={(settings.greeter || {}).knot} speed={(settings.greeter || {}).knotSpeed} />
              </div>
              <div className="who">{session.lockMode ? session.user : who.name}</div>
              <div className="role">{who.role}</div>
            </div>
            {err && <div className="err show" role="alert">{err}</div>}
            {!booting ? (
              <form autoComplete="off" onSubmit={doLogin}>
                <div className="frow">
                  <label htmlFor="userField">Username</label>
                  <input className="tinput" id="userField" ref={userRef} defaultValue="noctivagous" spellCheck="false"
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); passRef.current.focus(); } }} />
                </div>
                <div className="frow">
                  <label htmlFor="passField">Password</label>
                  <div className="pwwrap">
                    <input className="tinput" id="passField" ref={passRef} type={showPw ? "text" : "password"} placeholder="Password" autoComplete="current-password"
                      onKeyUp={(e) => setCaps(!!(e.getModifierState && e.getModifierState("CapsLock")))} />
                    <button type="button" className="iconbtn eye" aria-label="Show password" title="Show / hide password" onClick={() => { setShowPw((s) => !s); passRef.current.focus(); }}>
                      <svg className="ic" viewBox="0 0 24 24"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.6" /></svg>
                    </button>
                  </div>
                </div>
                {!session.lockMode && (
                  <div className="frow">
                    <label>Session</label>
                    <div className="seg" role="group" aria-label="Session">
                      {SESSIONS.map((s) => (
                        <button type="button" key={s} className={session.sessionType === s ? "sel" : ""} data-sess={s}
                          onClick={() => store.set("session", { sessionType: s })}>
                          {s.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="frow">
                  <label htmlFor="langSel">Language</label>
                  <div className="selwrap">
                    <select className="tinput" id="langSel">
                      <option>English (US)</option><option>English (UK)</option><option>Deutsch</option>
                      <option>Français</option><option>日本語</option><option>中文 (简体)</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", margin: "2px 0 10px" }}>
                  <label className="chk" style={{ padding: 2 }}><input type="checkbox" /> Remember me</label>
                  <span style={{ flex: 1 }}></span>
                  <span className="indicators">
                    <span className={"ind" + (caps ? " on" : "")}>CAPS</span>
                    <span className="ind on">NUM</span>
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button type="button" className="btn" id="cancelBtn"
                    onClick={() => { userRef.current.value = ""; passRef.current.value = ""; setErr(""); setStatus("READY"); userRef.current.focus(); }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn primary" id="loginBtn" style={{ minWidth: 118 }}>
                    {session.lockMode ? "Unlock →" : "Log In →"}
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <div className="cap" style={{ marginBottom: 7 }}>Loading session…</div>
                <div className="indet"><i></i></div>
                <div className="bootlog show">
                  {bootLines.map((l, i) => (
                    <span key={i}>{l}<br /></span>
                  ))}
                </div>
              </div>
            )}
            <p className="hint">
              {session.lockMode
                ? "Screen locked. Enter your password to unlock."
                : "Any password works in this demo — or take the Guest chip and walk straight in."}
            </p>
          </div>
          <div className="wstatus"><span>{status}</span><span className="grow">{(session.launchQueue && session.launchQueue.length)
            ? "QUEUED · " + session.launchQueue.map((id) => (LAUNCH_NAMES[id] || id).toUpperCase()).join(" + ") + " → LAUNCH AT LOGIN"
            : "GREETER 2.4 · X11"}</span></div>
        </div>

        <div className="userrow" aria-label="Switch user" style={{ visibility: booting ? "hidden" : "visible" }}>
          {USERS.map((u, i) => (
            <button key={u.name} className={"userchip" + (chip === i ? " sel" : "")} data-user={u.user} data-init={u.init} data-role={u.role}
              onClick={() => pickUser(i)}>
              <span className="av2">{u.init}</span><span>{u.name}</span>
            </button>
          ))}
        </div>
      </GreeterDashboard>

      <footer className="login-bottom">
        <button className="btn sm" onClick={() => toast("Accessibility: large text off · screen reader off · high contrast off")}>
          <svg className="ic" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.6" /><path d="M4 9.5c5.3 1.2 10.7 1.2 16 0M12 11v4l-3 6M12 15l3 6" /></svg> Accessibility
        </button>
        <span className="kbd hidem">KB · US &nbsp;·&nbsp; ⌨ EN-US</span>
        <span className="kbd hidem">BT · OFF &nbsp;·&nbsp; AUDIO · HDMI &nbsp;·&nbsp; DASH · {profile.toUpperCase()}</span>
        <span className="sp"></span>
        <button className="btn sm" onClick={() => { setStatus("SLEEP · REQUESTED"); toast("Sleep requested — suspend is disabled in this demo"); }}>☾ Sleep</button>
        <button className="btn sm" onClick={onRestart}>↻ Restart</button>
        <button className="btn sm danger" onClick={onPower}>
          <svg className="ic" viewBox="0 0 24 24"><path d="M12 3v8M6.3 6.5a8 8 0 1 0 11.4 0" /></svg> Shut Down
        </button>
      </footer>
    </section>
  );
}

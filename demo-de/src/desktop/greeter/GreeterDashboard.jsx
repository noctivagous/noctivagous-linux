/* NCT-WL-COMPOSITOR — the Greeter Dashboard is shell furniture around the
 * greeter: in the real stack it models layer-shell surfaces owned by the
 * session manager, arranged from surface-level facts only (viewport size,
 * the chosen dashboard profile) and never from any app contract.
 * See WAYLAND-MAP.md.
 *
 * GreeterDashboard — the widget surround of the login screen.
 *
 * It renders the content row of the greeter as a three-column
 * grid: a left widget column, the login centre (clock + login
 * window + user chips, passed as children from Login), and a
 * right widget column. The greeter itself is a flex column —
 * top strip / this row (flex:1, min-height:0) / bottom strip —
 * so the strips reserve their space structurally and can never
 * paint over the login panel.
 *
 * Profiles (greeter-local state, held by Login): "personal"
 * shows every widget with details; "household" masks personal
 * details (mail subjects, calendar titles) down to counts;
 * "public" hides the personal panels outright.
 *
 * Click-to-queue: a panel whose data entry carries an `app`
 * field (greeterData.js) is clickable; clicking toggles the app
 * in session.launchQueue, and the queue launches after login
 * (shell/sessionActions.js drains it). Queued panels wear the
 * gold gd-queued state and a QUEUED tag; the login window's
 * status bar reads the queue back.
 *
 * Responsive shedding is pure CSS (styles/nct-desktop.css):
 * panels carry their shed group as a class (gd-s1 … gd-s4,
 * gd-core) and media queries on width OR height compact, then
 * hide, group by group, until only the login modal remains.
 */

import { useEffect, useState } from "react";
import { useSlice, store } from "../core/react.js";
import { GREETER_DATA as D } from "./greeterData.js";
import { WeatherAnim, SunburstProcesses, VehicleMap, CamGrid, NetChart } from "../widgets/greeterWidgets.jsx";

const MASK = "• • • • • • • •";

function Panel({ title, shed, personal, profile, children, testId, app, queued, onToggle }) {
  if (personal && profile === "public") return null;
  const cls = "gd-panel " + (shed === "core" ? "gd-core" : "gd-s" + shed)
    + (app ? " gd-click" : "") + (queued ? " gd-queued" : "");
  const handlers = app ? {
    onClick: () => onToggle(app),
    role: "button",
    tabIndex: 0,
    onKeyDown: (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(app); }
    },
  } : {};
  return (
    <div className={cls} data-gd={testId} data-app={app || undefined} {...handlers}>
      <div className="gd-ptitle"><span className="led"></span>{title}
        {app ? <span className="gd-qtag">{queued ? "QUEUED ✓" : "+ QUEUE"}</span> : null}
      </div>
      {children}
    </div>
  );
}

function Row({ k, v }) {
  return (
    <div className="gd-row"><span className="gd-k">{k}</span><span className="gd-v">{v}</span></div>
  );
}

function Bar({ pct }) {
  return (
    <div className="gd-bar"><i style={{ width: pct + "%" }}></i></div>
  );
}

export default function GreeterDashboard({ profile, children }) {
  const ui = useSlice("ui");
  const session = useSlice("session");
  const queue = session.launchQueue || [];
  const toggleQueue = (app) => {
    store.set("session", {
      launchQueue: queue.includes(app) ? queue.filter((a) => a !== app) : [...queue, app],
    });
  };
  const qp = (data) => data.app
    ? { app: data.app, queued: queue.includes(data.app), onToggle: toggleQueue }
    : {};
  const masked = profile === "household";
  const w = D.weather, em = D.email, cal = D.calendar, nt = D.notifications,
    st = D.storage, sy = D.system, ne = D.network, po = D.power,
    up = D.updates, se = D.security, np = D.nowPlaying, ve = D.vehicle;
  const unread = em.accounts.reduce((a, x) => a + x.unread, 0);
  /* Now Playing transport state (greeter-local, like the profile):
   * playing advances the progress bar once a second; prev/next
   * restart the track's progress. The track itself is the data
   * table's single entry. */
  const [playing, setPlaying] = useState(true);
  const [npPct, setNpPct] = useState(np.pct);
  useEffect(() => {
    if (!playing) return undefined;
    const id = setInterval(() => setNpPct((p) => (p + 0.4 >= 100 ? 0 : p + 0.4)), 1000);
    return () => clearInterval(id);
  }, [playing]);
  const npLabel = (() => {
    const total = 309; // 5:09, the data table's label denominator
    const cur = Math.round((npPct / 100) * total);
    const f = (s) => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
    return f(cur) + " / " + f(total);
  })();

  return (
    <div className="login-wrap gdash">
      <div className="gd-col gd-left">
        <Panel title="Weather" shed={w.shed} testId="weather">
          <div className="gd-big">{w.temp}<span className="gd-cond"> {w.cond}</span></div>
          <Row k={w.place} v={w.range} />
          <WeatherAnim loop={w.loop} />
        </Panel>

        <Panel title={"Email · " + unread + " unread"} shed={em.shed} personal testId="email" profile={profile}>
          <div className="gd-big">{unread}<span className="gd-cond"> unread</span></div>
          <div className="gd-buckets">
            <div className="gd-bucket"><b>{em.unreadBuckets.day}</b><span>Day</span></div>
            <div className="gd-bucket"><b>{em.unreadBuckets.week}</b><span>Week</span></div>
            <div className="gd-bucket"><b>{em.unreadBuckets.month}</b><span>Month</span></div>
          </div>
          <div className="gd-msgs">
            {em.messages.map((m, i) => (
              <div className="gd-msg" key={i}>
                <span className="gd-msg-subj">{masked ? MASK : m.subject}</span>
                <span className="gd-msg-meta">{m.from} · {m.time}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Calendar · Today" shed={cal.shed} personal testId="calendar" profile={profile}>
          {masked
            ? <Row k="EVENTS" v={cal.events.length + " today"} />
            : cal.events.map((e) => <Row key={e.time} k={e.time} v={e.title} />)}
        </Panel>

        <Panel title="Notifications" shed={nt.shed} personal testId="notifications" profile={profile}>
          {nt.items.map((n, i) => (
            <div className="gd-msg" key={i}>
              <span className="gd-msg-subj">{n.text}</span>
              <span className="gd-msg-meta">{n.time}</span>
            </div>
          ))}
        </Panel>

        <Panel title="Storage" shed={st.shed} testId="storage" {...qp(st)}>
          {st.mounts.map((m) => (
            <div className="gd-barrow" key={m.name}>
              <Row k={m.name} v={m.label} />
              <Bar pct={m.pct} />
            </div>
          ))}
        </Panel>

        <Panel title="Vehicle" shed={ve.shed} testId="vehicle" {...qp(ve)}>
          <VehicleMap />
          <Row k={ve.name} v={ve.state} />
          <Row k={ve.battery} v={"→ " + ve.dest} />
        </Panel>
      </div>

      <div className="gd-center">{children}</div>

      <div className="gd-col gd-right">
        <Panel title="System" shed={sy.shed} testId="system" {...qp(sy)}>
          <Row k={sy.distro} v={sy.kernel} />
          <Row k={sy.uptime} v={sy.lastBoot} />
          <SunburstProcesses procs={sy.procs} ramTotal={sy.ramTotal} />
        </Panel>

        <Panel title="Network" shed={ne.shed} testId="network" {...qp(ne)}>
          {ne.rows.filter((r) => r.k !== "TRAFFIC").map((r) => <Row key={r.k} k={r.k} v={r.v} />)}
          <NetChart />
        </Panel>

        <Panel title="Power" shed={po.shed} testId="power">
          <div className="gd-big">{ui.battery}%<span className="gd-cond"> {po.device}</span></div>
          <Bar pct={ui.battery} />
          <Row k={po.state} v={po.runtime} />
        </Panel>

        <Panel title="Updates" shed={up.shed} testId="updates">
          {up.rows.filter((r) => r.k !== "SECURITY").map((r) => <Row key={r.k} k={r.k} v={r.v} />)}
        </Panel>

        <Panel title="Security" shed={se.shed} testId="security" {...qp(se)}>
          <CamGrid />
          {se.rows.filter((r) => r.k === "FIREWALL").map((r) => <Row key={r.k} k={r.k} v={r.v} />)}
        </Panel>

        <Panel title="Now Playing" shed={np.shed} personal testId="nowplaying" profile={profile}>
          <div className="gd-msg">
            <span className="gd-msg-subj">{np.track}</span>
            <span className="gd-msg-meta">{np.artist}</span>
          </div>
          <Bar pct={npPct} />
          <Row k="PROGRESS" v={npLabel} />
          <div className="gd-transport">
            <button type="button" className="gd-tbtn" aria-label="Previous track" onClick={() => setNpPct(0)}>⏮</button>
            <button type="button" className="gd-tbtn main" aria-label={playing ? "Pause" : "Play"} onClick={() => setPlaying((p) => !p)}>{playing ? "⏸" : "▶"}</button>
            <button type="button" className="gd-tbtn" aria-label="Next track" onClick={() => setNpPct(0)}>⏭</button>
          </div>
        </Panel>
      </div>
    </div>
  );
}

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
 * Responsive shedding is pure CSS (styles/nct-desktop.css):
 * panels carry their shed group as a class (gd-s1 … gd-s4,
 * gd-core) and media queries on width OR height compact, then
 * hide, group by group, until only the login modal remains.
 */

import { useSlice } from "../core/react.js";
import { GREETER_DATA as D } from "./greeterData.js";

const MASK = "• • • • • • • •";

function Panel({ title, shed, personal, profile, children, testId }) {
  if (personal && profile === "public") return null;
  const cls = "gd-panel " + (shed === "core" ? "gd-core" : "gd-s" + shed);
  return (
    <div className={cls} data-gd={testId}>
      <div className="gd-ptitle"><span className="led"></span>{title}</div>
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
  const masked = profile === "household";
  const w = D.weather, em = D.email, cal = D.calendar, nt = D.notifications,
    st = D.storage, sy = D.system, ne = D.network, po = D.power,
    up = D.updates, se = D.security, np = D.nowPlaying;
  const unread = em.accounts.reduce((a, x) => a + x.unread, 0);

  return (
    <div className="login-wrap gdash">
      <div className="gd-col gd-left">
        <Panel title="Weather" shed={w.shed} testId="weather">
          <div className="gd-big">{w.temp}<span className="gd-cond"> {w.cond}</span></div>
          <Row k={w.place} v={w.range} />
          <div className="gd-hourly gd-minor">
            {w.hourly.map((h) => (
              <span key={h.t} className="gd-hour"><b>{h.t}</b>{h.v}</span>
            ))}
          </div>
          <div className="gd-minor">
            {w.days.map((d) => <Row key={d.d} k={d.d} v={d.v} />)}
          </div>
        </Panel>

        <Panel title={"Email · " + unread + " unread"} shed={em.shed} personal testId="email" profile={profile}>
          <div className="gd-big">{unread}<span className="gd-cond"> unread</span></div>
          {em.accounts.map((a) => <Row key={a.name} k={a.name} v={a.unread + " unread"} />)}
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

        <Panel title="Storage" shed={st.shed} testId="storage">
          {st.mounts.map((m) => (
            <div className="gd-barrow" key={m.name}>
              <Row k={m.name} v={m.label} />
              <Bar pct={m.pct} />
            </div>
          ))}
        </Panel>
      </div>

      <div className="gd-center">{children}</div>

      <div className="gd-col gd-right">
        <Panel title="System" shed={sy.shed} testId="system">
          <Row k={sy.distro} v={sy.kernel} />
          <Row k={sy.uptime} v={sy.lastBoot} />
          {sy.bars.map((b) => (
            <div className="gd-barrow" key={b.name}>
              <Row k={b.name} v={b.label} />
              <Bar pct={b.pct} />
            </div>
          ))}
          <Row k="GPU" v={sy.gpu} />
        </Panel>

        <Panel title="Network" shed={ne.shed} testId="network">
          {ne.rows.map((r) => <Row key={r.k} k={r.k} v={r.v} />)}
        </Panel>

        <Panel title="Power" shed={po.shed} testId="power">
          <div className="gd-big">{ui.battery}%<span className="gd-cond"> {po.device}</span></div>
          <Bar pct={ui.battery} />
          <Row k={po.state} v={po.runtime} />
        </Panel>

        <Panel title="Updates" shed={up.shed} testId="updates">
          {up.rows.map((r) => <Row key={r.k} k={r.k} v={r.v} />)}
        </Panel>

        <Panel title="Security" shed={se.shed} testId="security">
          {se.rows.map((r) => <Row key={r.k} k={r.k} v={r.v} />)}
        </Panel>

        <Panel title="Now Playing" shed={np.shed} personal testId="nowplaying" profile={profile}>
          <div className="gd-msg">
            <span className="gd-msg-subj">{np.track}</span>
            <span className="gd-msg-meta">{np.artist}</span>
          </div>
          <Bar pct={np.pct} />
          <Row k="PROGRESS" v={np.label} />
        </Panel>
      </div>
    </div>
  );
}

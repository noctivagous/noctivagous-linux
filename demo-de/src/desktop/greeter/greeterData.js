/* The Greeter Dashboard's data, as one module.
 *
 * This is data, not code: demo sample values for the widgets
 * that surround the login panel (weather, mail, calendar,
 * network, updates…). The greeter is pre-login — there is no
 * session and no live source yet — so the dashboard renders
 * this table. When the real system grows sources for these
 * (a weather service, the mail spool, the package manager),
 * they replace this module's contents; the components in
 * GreeterDashboard.jsx read only the shape below.
 *
 * Shape notes:
 *  - shed: which responsive stage hides the panel (1 sheds
 *    first … 4 last; "core" panels are the final three).
 *  - personal: panels a Public profile hides outright, and
 *    whose details a Household profile masks to counts.
 */

export const HOSTNAME = "NCT-WS1";

export const GREETER_DATA = {
  weather: {
    shed: "core", personal: false,
    place: "Chicago, IL",
    temp: "41°F", cond: "Clear · NW 12 mph",
    range: "H 47° · L 33°",
    hourly: [
      { t: "09", v: "41°" }, { t: "11", v: "44°" }, { t: "13", v: "46°" },
      { t: "15", v: "47°" }, { t: "17", v: "43°" }, { t: "19", v: "38°" },
    ],
    days: [
      { d: "TUE", v: "47° / 33° · Clear" },
      { d: "WED", v: "45° / 31° · Cloudy" },
      { d: "THU", v: "39° / 28° · Rain" },
    ],
  },
  email: {
    shed: "core", personal: true,
    accounts: [
      { name: "noct@muse.ai", unread: 5 },
      { name: "Personal", unread: 9 },
    ],
    messages: [
      { from: "Kavi", subject: "Greeter Dashboard build verified", time: "08:41" },
      { from: "GitHub", subject: "[noctivagous-linux] Push landed: 64cd66f", time: "07:26" },
      { from: "M—", subject: "Re: what the machine is for", time: "06:12" },
    ],
  },
  calendar: {
    shed: 4, personal: true,
    events: [
      { time: "09:30", title: "Studio — greeter review" },
      { time: "13:00", title: "Call with M—" },
      { time: "17:45", title: "Reading group" },
    ],
  },
  notifications: {
    shed: 2, personal: true,
    items: [
      { text: "Backup completed · /home → /backup", time: "07:58" },
      { text: "Build finished · demo-de", time: "07:31" },
      { text: "Reminder · water the plants", time: "07:00" },
    ],
  },
  storage: {
    shed: 1, personal: false,
    mounts: [
      { name: "/home", pct: 54, label: "412 / 763 GB" },
      { name: "/data", pct: 71, label: "1.4 / 2.0 TB" },
      { name: "/backup", pct: 38, label: "291 / 763 GB" },
    ],
  },
  system: {
    shed: "core", personal: false,
    distro: "NOCTIVAGOUS OS 4.2",
    kernel: "Kernel 6.8-NCT",
    uptime: "Uptime 3d 04:12",
    lastBoot: "Last boot · Sun 07:46",
    bars: [
      { name: "CPU", pct: 23, label: "23%" },
      { name: "MEM", pct: 46, label: "7.4 / 16 GB" },
      { name: "DISK /", pct: 61, label: "302 / 495 GB" },
    ],
    gpu: "GPU · RTX · driver 550.54",
  },
  network: {
    shed: 4, personal: false,
    rows: [
      { k: "ETH0", v: "192.168.1.42 · 1 GbE" },
      { k: "STATE", v: "LINK · UP" },
      { k: "VPN", v: "WireGuard · OFF" },
      { k: "TRAFFIC", v: "↓ 1.2 MB/s · ↑ 0.3 MB/s" },
    ],
  },
  power: {
    shed: 3, personal: false,
    device: "UPS · APC 1500",
    state: "On line power",
    runtime: "Est. runtime on battery · 42 min",
  },
  updates: {
    shed: 2, personal: false,
    rows: [
      { k: "PACKAGES", v: "23 pending" },
      { k: "SECURITY", v: "4 pending" },
      { k: "CHECKED", v: "Today 06:40" },
    ],
  },
  security: {
    shed: 3, personal: false,
    rows: [
      { k: "LAST LOGIN", v: "Today 07:58 · VT7" },
      { k: "FAILED", v: "2 since midnight" },
      { k: "FIREWALL", v: "nftables · ON" },
    ],
  },
  nowPlaying: {
    shed: 1, personal: true,
    track: "Blue in Green",
    artist: "Miles Davis · Kind of Blue",
    pct: 62, label: "3:12 / 5:09",
  },
};

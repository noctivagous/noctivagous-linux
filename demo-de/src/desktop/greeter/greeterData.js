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

/* Click-to-queue: a widget with an `app` field names the app it
 * corresponds to. Clicking the widget on the greeter queues the
 * app; the queue launches after login (sessionActions). Widgets
 * without a corresponding app carry no field and do not queue. */
export const LAUNCH_NAMES = {
  monitor: "Monitor",
  navgraph: "NavGraph",
  home: "Home",
  files: "Files",
  settings: "Settings",
};

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
    /* The weather panel's satellite loop: real GOES-18 ABI
     * GeoColor frames of the 2026-11-19 atmospheric river,
     * sampled from CIRA's SLIDER API (slider.cira.colostate.edu)
     * into a 4×4 sprite sheet (assets/cira-ar-loop.webp). Frames
     * are 15 minutes apart, 17:01–20:46 UTC. */
    loop: {
      date: "2026-11-19", startMin: 17 * 60 + 1, stepMin: 15, frames: 16,
      credit: "GOES-18 · ABI GeoColor · CIRA SLIDER",
    },
  },
  email: {
    shed: "core", personal: true,
    accounts: [
      { name: "noct@muse.ai", unread: 5 },
      { name: "Personal", unread: 9 },
    ],
    /* Unread divided by day / week / month (user, 2026-11-25):
     * nested buckets — day ⊆ week ⊆ month, and month is the
     * total unread across the accounts above. */
    unreadBuckets: { day: 3, week: 8, month: 14 },
    messages: [
      { from: "Kavi", subject: "Greeter Dashboard build verified", time: "08:41" },
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
    ],
  },
  storage: {
    shed: 1, personal: false, app: "files",
    mounts: [
      { name: "/home", pct: 54, label: "412 / 763 GB" },
      { name: "/data", pct: 71, label: "1.4 / 2.0 TB" },
    ],
  },
  system: {
    shed: "core", personal: false, app: "monitor",
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
    /* The sunburst's tree: RAM by process group, MB. The widget
     * animates the values around these bases. */
    procs: [
      { name: "System", children: [
        { name: "kernel", mb: 812 }, { name: "compositor", mb: 640 },
        { name: "systemd", mb: 210 }, { name: "greeter", mb: 145 },
      ] },
      { name: "Apps", children: [
        { name: "browser", mb: 1890 }, { name: "editor", mb: 940 },
        { name: "files", mb: 455 }, { name: "terminal", mb: 380 },
      ] },
      { name: "Services", children: [
        { name: "pipewire", mb: 240 }, { name: "dbus", mb: 96 },
        { name: "sshd", mb: 42 }, { name: "cron", mb: 18 },
      ] },
      { name: "Cache", children: [
        { name: "page cache", mb: 1240 }, { name: "buffers", mb: 510 },
      ] },
    ],
    ramTotal: 16384,
  },
  vehicle: {
    shed: 2, personal: false, app: "navgraph",
    name: "Model Y · NCT-1",
    state: "En route · ETA 12 min",
    battery: "Battery 78%",
    dest: "Home",
  },
  network: {
    shed: 4, personal: false, app: "settings",
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
    shed: 3, personal: false, app: "home",
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

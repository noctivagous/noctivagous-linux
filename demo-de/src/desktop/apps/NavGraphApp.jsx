import NavGraphLayer from "../shell/NavGraphLayer.jsx";

/* NavGraph as a conventional window app: the same component
 * the desktop layer hosts, framed by the window. NavGraph
 * defaults to desktop-layer mode (see core/layers.js); this
 * wrapper is what its window mode mounts. */
export default function NavGraphApp() {
  return <NavGraphLayer framed />;
}

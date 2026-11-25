/* NCT-WL-KIT — menus are TREES, and every node carries a
 * presentation for its children (user, 2026-11-25).
 *
 * A menu is not a flat list. It is a tree of nodes:
 *
 *   item    { t:"item", label, action, kbd?, icon?, hint? }
 *   sep     { t:"sep" }
 *   group   { t:"group", label?, pres?, children, defaultOpen? }
 *   menu    { t:"menu", pres?, children }        (the root)
 *
 * PRESENTATION — a node’s `pres` says how ITS CHILDREN are
 * laid out; a group’s pres overrides the menu’s for that
 * section only, so one menu can MIX presentations section by
 * section (grid cards on top, a plain list under them, an
 * accordion below that):
 *
 *   direction  "v" | "h"     a 1D list runs vertical (the
 *                            system menu bar) or horizontal.
 *   view       "list"        items as rows (or a row, if "h")
 *              "grid"        items as cards in a grid
 *              "accordion"   (groups only) the group’s label is
 *                            a header that expands/collapses
 *                            its children in place — a tree
 *                            that opens where it stands.
 *   columns    n             the column count: a list with
 *                            columns 2 is a 2D layout, a grid’s
 *                            columns are its tracks. 1 column
 *                            with direction "v" is the classic
 *                            1D vertical list.
 *
 * DEFAULTS: the conventional menus (the system menu bar’s
 * File / Edit / View … and the Start launcher) lay out in
 * MULTIPLE COLUMNS by default — DEFAULT_MENU_PRESENTATION
 * sets columns to 2. Any menu may set its own pres; any group
 * inside it may set another.
 */

import { useState } from "react";

export const DEFAULT_MENU_PRESENTATION = { direction: "v", view: "list", columns: 2 };

export const item = (label, action, opts = {}) => ({ t: "item", label, action, ...opts });
export const sep = () => ({ t: "sep" });
export const group = (label, pres, children, opts = {}) => ({ t: "group", label, pres, children, ...opts });
export const menu = (pres, children) => ({ t: "menu", pres, children });

/* A node’s effective presentation: the defaults, under the
 * menu’s pres, under the group’s own pres. */
export const resolvePres = (...layers) =>
  Object.assign({}, DEFAULT_MENU_PRESENTATION, ...layers.filter(Boolean));

function ItemButton({ node, onAction, card }) {
  return (
    <button type="button" className={"mitem" + (card ? " mcard" : "")} data-act={node.action}
      onClick={() => onAction(node.action)}>
      {node.icon ? <span className="mic">{node.icon}</span> : null}
      <span className="mlabel">{node.label}</span>
      {node.hint ? <small className="mhint">{node.hint}</small> : null}
      {node.kbd ? <span className="k">{node.kbd}</span> : null}
    </button>
  );
}

/* Lay a run of items/seps out under one presentation. */
function ItemRun({ nodes, pres, onAction }) {
  const items = nodes.map((n, i) =>
    n.t === "sep"
      ? <div className="sep" key={i}></div>
      : <ItemButton key={i} node={n} onAction={onAction} card={pres.view === "grid"} />,
  );
  if (pres.view === "grid") {
    return (
      <div className="mgrid" data-view="grid" data-columns={pres.columns}
        style={{ gridTemplateColumns: "repeat(" + pres.columns + ", 1fr)" }}>
        {items}
      </div>
    );
  }
  if (pres.direction === "h") {
    return <div className="mrow" data-view="list" data-direction="h">{items}</div>;
  }
  return (
    <div className="mlist" data-view="list" data-direction="v" data-columns={pres.columns}
      style={pres.columns > 1 ? { columnCount: pres.columns } : undefined}>
      {items}
    </div>
  );
}

function GroupSection({ node, inherited, onAction, path, open, onToggle, openMap }) {
  const pres = resolvePres(inherited, node.pres);
  if (pres.view === "accordion") {
    return (
      <div className="msec macc" data-view="accordion">
        <button type="button" className="macc-h" aria-expanded={!!open} onClick={() => onToggle(path, !!open)}>
          <span className="mlabel">{node.label}</span>
          <span className="macc-arrow">{open ? "▾" : "▸"}</span>
        </button>
        {open ? (
          <div className="macc-body">
            <NodeList nodes={node.children} pres={{ ...pres, view: "list" }} onAction={onAction} path={path} openMap={openMap} onToggle={onToggle} />
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <div className="msec" data-view={pres.view}>
      {node.label ? <div className="msec-h">{node.label}</div> : null}
      <NodeList nodes={node.children} pres={pres} onAction={onAction} path={path} openMap={openMap} onToggle={onToggle} />
    </div>
  );
}

/* Render a node list: consecutive items/seps form a run laid
 * out under the current presentation; groups are sections
 * with their own. */
function NodeList({ nodes, pres, onAction, path, openMap, onToggle }) {
  const out = [];
  let run = [];
  const flush = (key) => {
    if (run.length) {
      out.push(<ItemRun key={key} nodes={run} pres={pres} onAction={onAction} />);
      run = [];
    }
  };
  nodes.forEach((n, i) => {
    if (n.t === "group") {
      flush("run" + i);
      const p = path + "/" + i;
      out.push(
        <GroupSection key={i} node={n} inherited={pres} onAction={onAction} path={p}
          open={openMap[p] !== undefined ? openMap[p] : !!n.defaultOpen}
          onToggle={onToggle} openMap={openMap} />,
      );
    } else {
      run.push(n);
    }
  });
  flush("runEnd");
  return <>{out}</>;
}

/* The renderer: give it a menu tree and an action handler.
 * Accordion open-state is held here, keyed by group path. */
export function MenuTree({ tree, onAction }) {
  const [openMap, setOpenMap] = useState({});
  const onToggle = (p, current) => setOpenMap((m) => ({ ...m, [p]: !current }));
  const pres = resolvePres(tree.pres);
  return (
    <div className="mtree" data-columns={pres.columns} data-view={pres.view} data-direction={pres.direction}>
      <NodeList nodes={tree.children} pres={pres} onAction={onAction} path="" openMap={openMap} onToggle={onToggle} />
    </div>
  );
}

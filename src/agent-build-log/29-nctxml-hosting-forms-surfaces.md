# 29 — NCTXML drives the real surfaces: hosting, the XForms layer, greeter, launch bar, titlebar

2026-11-26. Branch feat/nctxml-hosting-forms off main 89563ff.
Direction (user): get NCTXML into a state where it can drive
the login screen, the launch bar, and window titlebars;
dashboard widgets remain a style of window. Decisions (user,
all recommendations): 1A source-sync hosting; 2A Repeat in the
renderer; 3A TitleBar as an NCTXML component for NCT windows'
own chrome (foreign windows keep labwc's decorations); 4A
hosting first, then the greeter. The XForms offshoot (§11)
became its own slice between hosting and the greeter, with
the user's addition: the model must allow layout — annotations
in the platform's layout vocabulary (the NCTGraphite grid
terms), so a form of data can be laid out in any way.

## E1 — Hosting

- tools/sync-nctxml.sh vendors the library (nctxml/*.cs +
  .cs.uid, nctgrid.gdextension + uid, bin/.so) from
  src/modules into godot/greeter and godot/shell;
  tools/check-nctxml-copies.sh is a tier-0 drift check —
  copies stay byte-identical to the source of truth.
- Both projects are .NET projects now (NCTGreeter.csproj /
  NCTShell.csproj, [dotnet] assembly names); each has an
  nctxml-smoke/ scene that renders a bound label + a measured
  Grid from its own copy (NCTXML_SMOKE_OK ×2 in tier 0).
- FINDING (renderer fix): a document's single content root
  was never anchored to the document root, so a top-level
  container rendered at minimum size inside its document —
  invisible in the harnesses (they sized roots directly),
  immediate in a hosted project. Load() now fills a lone
  content root. Also from this slice: SetConverted parses
  Vector2 ("280, 36") — document-declared minimum sizes work.

## E2 — The XForms layer (nctxml/FormModel.cs, FormExpr.cs)

- .nctform: <instance> (the data as an XML tree; the instance
  IS an NctDataObject keyed by path, so the existing binding
  engine drives form views unchanged), <bind> (type,
  required, readonly, relevant, calculate), <submission>
  (validate → host action(instance); result true/false/string;
  async hosts return {"state":"pending"} and complete via
  ResolveSubmission — with an in-call resolution guard for
  failures known synchronously), <layout> annotations +
  per-bind <layout> (area/row/column/span/order).
- Views declare Model="f.nctform" (instance becomes the
  context; host keys merge in); bound controls follow live
  relevance/readonly; Submit="id" on a button runs a
  submission. <FormView Model="..."/> renders a form from
  model + annotations alone; LoadAutoForm hosts that.
- Expressions (FormExpr): paths, literals, + - * /,
  comparisons, and/or/not. Not XPath, deliberately.
- Proofs (nctxml/forms/, NCTFORM_OK): the login model in TWO
  layouts over ONE shared instance (typing in the hand grid
  appears in the auto-view; measured widths differ);
  submission gating (empty required never reaches the host;
  the error is instance data in both views; a host failure
  string becomes the status; success clears it); an order
  model (calculate at load + on change, relevance toggling a
  field's visibility, readonly rendered as output, typed
  values); repeats as data (GetItems, item writes serialize
  back into the XML — the form stores its data well).

## E3 — The greeter (login screen driven)

- godot/greeter: login.nctform (the proof model, greeter-
  owned) + login.nctxml (Center + Stack: title, user field,
  secret password field, Log In with Submit="attempt", bound
  status) hosted by GreeterForm.cs; main.gd keeps the
  backdrop and the bridge conversation, exposes
  form_attempt_login (returns pending), and reports outcomes
  back (resolve_login / set_status / refocus_password).
  greetd IPC unchanged. Enter in the password submits
  (onTextSubmitted); Enter in the user field moves focus.
- greeter-ui test: 8/8 — wrong password rejected with the
  failure shown in the form, right password starts the
  session, keyboard-only throughout. The test now builds the
  greeter's assembly first.
- Two bugs found by that test: a GDScript parse error (a
  parameter named `pass`, a reserved word — renamed passwd)
  took the whole script out while the form still rendered and
  received input; and the pending-submission in-call guard
  above came from the connect-failure path resolving during
  the submission call.
- Known cosmetic gap: the title's 34px size is a theme
  override, which NCTXML v1 does not express; the title
  renders at the default size.

## E4 — Repeat + the launch bar

- <Repeat Items="{path}">: one template child per item —
  form-instance repeats (medications/med) or context arrays
  (objects, dictionaries wrapped). Rebuilds when its source
  path changes. Inside a template, handlers receive their
  item as argument (the launch button knows its entry).
  Registry gained Panel (PanelContainer) and Center (E3).
- godot/shell: bar.nctxml (shell kind: Panel > horizontal
  Stack — brand, bound clock, the Repeat of entry buttons)
  hosted by ShellBar.cs; main.gd keeps the launch list, the
  self-test output and nct-launch. First-button focus +
  focus-in regrab preserved (the BarHost owns them now).
- Proof: shell self-test SHELL_SELFTEST_OK entries=5 (also
  via the .pck in tier 0), and greeter-ui's last phase drives
  the new bar's first button by keyboard into Firefox.

## E5 — TitleBar component

- Component instances gained commands: a template button
  declares Command="Close"; the instance maps it with
  onClose="hostMethod". Unmapped commands render disabled
  (a legitimate configuration, visibly inert). Drag="window"
  makes a control its window's drag handle.
- nctxml/components/title-bar.nctxml: the stock TitleBar
  (bound Title, ShowMinimize via the Visibility converter,
  Minimize/Close commands, drag on the bar + label).
  TITLEBAR_OK: a proof window wearing two instances as its
  chrome — title follows the outer context, commands reach
  the host, the no-minimize instance hides + disables.
  The drag itself needs a real window manager; wired, not
  exercised headless.

## Gates

- run-chain tiers 0+1: 39/39 (five new checks: forms,
  titlebar, drift, hosted-in-greeter, hosted-in-shell; the
  pck build now packs C# with the greeter and shell).
- run-greeter-ui-test.sh: 8/8.

## Not built / owed

- Tier-2 rig proof of the NCTXML greeter + bar (the chain's
  greeter path changed: C# in the greeter pack).
- The web adapter for forms; per-item repeat validation;
  DataTemplates (Repeat uses a single template); the
  designer's form mode; NCTXML theme overrides (font sizes).
- The modules window-manager world and the shipped shell
  remain two worlds; the compositor link is still the
  bridge between them, as before.

using Godot;
using System.Collections.Generic;

/// <summary>
/// Slice 3 harness: the shell, composed. The environment manager
/// hosts the real GDScript window manager and app registry; the
/// C# security policy sits beside them. On top:
///
/// - the top bar and side tabs are SHELL-kind NCTXML documents,
///   rendered by the Slice 2 interpreter and registered with the
///   window manager as panel windows in the Top layer;
/// - the bar's buttons are live: pressing one launches an app
///   through the registry, and the app's window appears under
///   the window manager with the right origin and style;
/// - the registry proves single-instance, the foundation-chain
///   launch command, foreign apps, crash detection (window gone,
///   app.crashed on the bus) and clean close;
/// - the security manager reads the profiles (MATRIX-SPEC
///   transcribed to data) and computes indicator states for the
///   spec's own worked examples; the states are rendered by an
///   NCTXML indicator bar and carried on the window record —
///   security computes, the shell renders (§6).
///
/// Run: godot --headless --path src/modules \
///   res://nct-environment-manager/harness/main.tscn
/// </summary>
public partial class Slice3Harness : Control
{
    private readonly List<string> _failures = new();
    private GodotObject _env, _wm, _registry;
    private GDScript _recordScript;
    private NctXmlRenderer _renderer;
    private SecurityPolicy _policy;
    private NctDataObject _tabsCtx;
    private string _helloWindow = "", _notesWindow = "";
    private int _workspacePicked = 1;

    // -- furniture handlers (wired by the renderer, onPressed) ----
    public void OnLaunchHello()
    {
        _helloWindow = _registry.Call("launch", "nct-hello").AsString();
    }

    public void OnLaunchNotes()
    {
        var doc = _renderer.Load("res://nctxml/proofs/notes-app.nctxml",
            this, new NctDataObject());
        _notesWindow = _registry.Call("launch", "nct-notes", doc.Root).AsString();
    }

    public void OnWorkspace1() { PickWorkspace(1); }
    public void OnWorkspace2() { PickWorkspace(2); }

    private void PickWorkspace(int n)
    {
        _workspacePicked = n;
        _tabsCtx?.Set("ActiveWorkspace", "Workspace " + n);
    }

    public override void _Ready()
    {
        _renderer = new NctXmlRenderer();
        var envScript = GD.Load<GDScript>("res://nct-environment-manager/environment_manager.gd");
        var wmScript = GD.Load<GDScript>("res://nct-window-manager/window_manager.gd");
        var regScript = GD.Load<GDScript>("res://nct-app-registry/app_registry.gd");
        _recordScript = GD.Load<GDScript>("res://nct-window-manager/window_record.gd");

        _env = (GodotObject)envScript.New();
        AddChild((Node)_env);
        _wm = (GodotObject)wmScript.New(this);
        AddChild((Node)_wm);
        _wm.Call("build_layers");
        _registry = (GodotObject)regScript.New();
        AddChild((Node)_registry);
        _registry.Call("set_window_manager", _wm);
        _registry.Call("set_environment", _env);
        _policy = new SecurityPolicy();
        AddChild(_policy);

        _env.Call("register_module", "nct-window-manager", _wm);
        _env.Call("register_module", "nct-app-registry", _registry);
        _env.Call("register_module", "nct-security-manager", _policy);
        Check(_env.Call("has_module", "nct-security-manager").AsBool(),
            "security manager not registered at the root");

        Furniture();
        RegistryAndLaunch();
        Security();

        if (_failures.Count == 0)
        {
            GD.Print("SLICE3_OK");
            GetTree().Quit(0);
        }
        else
        {
            foreach (var f in _failures) GD.PrintErr("SLICE3_FAIL ", f);
            GetTree().Quit(1);
        }
    }

    // ---------------------------------------------------------------
    private void Furniture()
    {
        var barCtx = new NctDataObject();
        barCtx.Set("ShellTitle", "Noctivagous");
        barCtx.Set("Clock", "06:25");
        var bar = _renderer.Load(
            "res://nct-environment-manager/furniture/top-bar.nctxml", this, barCtx);
        Check(bar.Kind == "shell", "top bar kind is not shell: " + bar.Kind);
        Check(bar.Manifest["requested_style"].AsString() == "panel",
            "top bar did not request panel style");
        Check(NoWireFailures(bar), "top bar handlers failed to wire: " + JoinDiag(bar));
        RegisterFurniture("top-bar", bar, new Rect2(0, 0, 1280, 40));
        Check(LabelOf(bar.Root, "ShellTitle") == "Noctivagous", "bar title not bound");
        Check(LabelOf(bar.Root, "Clock") == "06:25", "bar clock not bound");

        _tabsCtx = new NctDataObject();
        _tabsCtx.Set("ActiveWorkspace", "Workspace 1");
        var tabs = _renderer.Load(
            "res://nct-environment-manager/furniture/side-tabs.nctxml", this, _tabsCtx);
        Check(tabs.Kind == "shell", "side tabs kind is not shell: " + tabs.Kind);
        RegisterFurniture("side-tabs", tabs, new Rect2(0, 40, 168, 720));

        foreach (var id in new[] { "top-bar", "side-tabs" })
        {
            var rec = _wm.Call("get_record", id).AsGodotObject();
            Check(rec != null, "furniture not registered: " + id);
            if (rec == null) continue;
            Check(rec.Get("origin").AsString() == "shell", id + " origin not shell");
            Check(rec.Get("kind_link").AsString() == "shell", id + " kind_link not shell");
            Check(rec.Get("layer").AsString() == "Top",
                id + " not in Top layer: " + rec.Get("layer").AsString());
            var backing = rec.Get("backing").AsGodotObject() as Node;
            var topLayer = _wm.Call("layer_node", "Top").AsGodotObject();
            Check(backing != null && topLayer != null &&
                  backing.GetParent().GetInstanceId() == topLayer.GetInstanceId(),
                id + " backing not under the Top CanvasLayer");
            Check(!_wm.Call("focus_window", id).AsBool(),
                id + " took focus (panel policy refuses)");
        }

        // The side tabs are live: pressing Workspace 2 moves the
        // binding, not just a flag.
        PressButton(tabs.Root, "Workspace2");
        Check(_workspacePicked == 2, "workspace handler did not run");
        Check(LabelOf(tabs.Root, "ActiveWorkspace") == "Workspace 2",
            "active workspace label did not follow the binding");
    }

    private void RegisterFurniture(string id, NctDocument doc, Rect2 geo)
    {
        var rec = _recordScript.New(id, doc.Manifest["requested_style"].AsString())
            .AsGodotObject();
        rec.Set("origin", "shell");
        rec.Set("app_id", "");
        rec.Set("kind_link", "shell");
        rec.Set("backing", doc.Root);
        rec.Set("title", doc.Manifest["name"].AsString());
        rec.Set("geometry", geo);
        Check(_wm.Call("register_window", rec).AsBool(), "WM refused furniture " + id);
    }

    // ---------------------------------------------------------------
    private void RegistryAndLaunch()
    {
        Manifest("nct-hello", "NCT Hello", "pck", "apps/nct-hello.pck", true);
        Manifest("nct-notes", "Notes", "nctxml",
            "res://nctxml/proofs/notes-app.nctxml", true);
        Manifest("fake-browser", "Fake Browser", "foreign", "fake-browser", true);
        var bad = new Godot.Collections.Dictionary
        {
            ["id"] = "bogus", ["name"] = "Bogus", ["kind"] = "warp-drive",
            ["entry"] = "x",
        };
        Check(!_registry.Call("register_manifest", bad).AsBool(),
            "registry accepted a manifest with an unknown kind");
        Check(_registry.Call("app_ids").AsGodotArray().Count == 3,
            "registry should hold exactly 3 manifests");

        // Launch through the FURNITURE: the bar's button is wired
        // by the renderer to this host, which calls the registry.
        var barRoot = _wm.Call("get_record", "top-bar").AsGodotObject()
            .Get("backing").AsGodotObject() as Control;
        PressButton(barRoot, "LaunchHello");
        Check(_helloWindow != "", "bar launch produced no window");
        var rec = _wm.Call("get_record", _helloWindow).AsGodotObject();
        Check(rec.Get("app_id").AsString() == "nct-hello", "hello window app_id wrong");
        Check(rec.Get("origin").AsString() == "own-process",
            "pck app origin not own-process: " + rec.Get("origin").AsString());
        Check(rec.Get("layer").AsString() == "Workspace", "hello window not in Workspace");
        var cmd = _registry.Call("launch_command", "nct-hello").AsGodotArray();
        Check(cmd.Count == 2 && cmd[0].AsString() == "nct-godot-run" &&
              cmd[1].AsString() == "apps/nct-hello.pck",
            "chain launch command wrong: " + cmd.Count);

        PressButton(barRoot, "LaunchNotes");
        Check(_notesWindow != "", "notes launch produced no window");
        var nrec = _wm.Call("get_record", _notesWindow).AsGodotObject();
        Check(nrec.Get("kind_link").AsString() == "app", "notes kind_link not app");

        // Foreign app: its own command, foreign origin.
        var fb = _registry.Call("launch", "fake-browser").AsString();
        var frec = _wm.Call("get_record", fb).AsGodotObject();
        Check(frec.Get("origin").AsString() == "foreign", "foreign origin wrong");
        Check(_registry.Call("launch_command", "fake-browser")
                .AsGodotArray()[0].AsString() == "fake-browser",
            "foreign launch command wrong");

        // Single-instance: relaunching hello returns the SAME
        // window, adds none, and focuses it.
        int before = _wm.Call("window_count").AsInt32();
        var again = _registry.Call("launch", "nct-hello").AsString();
        Check(again == _helloWindow, "single-instance returned a different window");
        Check(_wm.Call("window_count").AsInt32() == before,
            "single-instance added a window");
        Check(_wm.Get("focused_id").AsString() == _helloWindow,
            "single-instance relaunch did not focus the existing window");

        // Crash detection: the process dies; the next liveness
        // check removes the window and announces app.crashed.
        _registry.Call("mark_process_dead", "nct-hello");
        var crashed = _registry.Call("check_liveness").AsGodotArray();
        Check(crashed.Count == 1 && crashed[0].AsString() == "nct-hello",
            "liveness check did not report the crash");
        Check(!_wm.Call("has_window", _helloWindow).AsBool(),
            "crashed app's window stayed registered");
        Check(!_registry.Call("is_running", "nct-hello").AsBool(),
            "crashed app stayed in the running set");
        Check(BusHas("app.crashed", "nct-hello"), "app.crashed not announced on the bus");
        Check(BusHas("app.launched", "nct-notes"), "app.launched not announced");

        // Clean close.
        Check(_registry.Call("close_app", "fake-browser").AsBool(), "close refused");
        Check(!_wm.Call("has_window", fb).AsBool(), "closed app's window stayed");
        Check(BusHas("app.exited", "fake-browser"), "app.exited not announced");

        // Record-only hosting (the shipped shell's mode): with
        // placeholder backings off, a launch registers the
        // record with NO backing — the surface is a compositor
        // surface, attached later, never a shell-drawn fake.
        Manifest("batch-tool", "Batch Tool", "foreign", "batch-tool", true);
        _registry.Set("placeholder_backings", false);
        var bt = _registry.Call("launch", "batch-tool").AsString();
        Check(bt != "", "record-only launch produced no window");
        var brec = _wm.Call("get_record", bt).AsGodotObject();
        Check(brec.Get("backing").AsGodotObject() == null,
            "record-only launch got a placeholder backing");
        Check(_registry.Call("close_app", "batch-tool").AsBool(),
            "record-only close refused");
        _registry.Set("placeholder_backings", true);
    }

    private void Manifest(string id, string name, string kind, string entry, bool single)
    {
        var m = new Godot.Collections.Dictionary
        {
            ["id"] = id, ["name"] = name, ["kind"] = kind,
            ["entry"] = entry, ["single_instance"] = single,
        };
        Check(_registry.Call("register_manifest", m).AsBool(),
            "manifest refused: " + id);
    }

    // ---------------------------------------------------------------
    private void Security()
    {
        Check(_policy.LoadProfiles("res://nct-security-manager/profiles.json"),
            "profiles.json did not load (4 profiles, 11 capabilities expected)");
        Check(_policy.ProfileName("P3") == "Redirect", "P3 name wrong");
        Check(_policy.CapabilityName("C1") == "Microphone", "C1 name wrong");
        // The matrix, spot-checked against MATRIX-SPEC Axis 3.
        Expect("P1", "C1", "ALLOW"); Expect("P1", "C4", "ASK");
        Expect("P2", "C1", "ASK");   Expect("P2", "C9", "ALLOW");
        Expect("P3", "C1", "PLUG");  Expect("P3", "C8", "DENY");
        Expect("P3", "C10", "SANDBOX"); Expect("P4", "C1", "DENY");
        Expect("P4", "C5", "SANDBOX");  Expect("P4", "C3", "ASK");
        Check(_policy.PlugFor("P3", "C1") == "silence", "P3 mic plug not silence");
        Check(_policy.PlugFor("P3", "C4") == "fixed location set in advance",
            "P3 location plug wrong");
        Check(_policy.Disposition("P9", "C1") == "", "unknown profile not empty");

        // Indicator states for the spec's own worked examples.
        var t = new IndicatorTracker();
        // "Notes app opens mic, P1: I1 flickers while recording,
        // then I2 latched."
        Check(t.Engage("notes", "C1", _policy.Disposition("P1", "C1"), true) == "I1",
            "notes mic under P1 should be I1 while flowing");
        Check(t.FlowStopped("notes", "C1") == "I2",
            "notes mic should latch to I2 when the flow stops");
        // "New agent-made game opens mic, P3: PLUG; I3 shown."
        Check(t.Engage("game", "C1", _policy.Disposition("P3", "C1"), true) == "I3",
            "game mic under P3 should be I3 (plugged)");
        // P3 spawn is SANDBOX: I5. P4 mic is DENY: I4.
        Check(t.Engage("game", "C10", _policy.Disposition("P3", "C10"), false) == "I5",
            "game spawn under P3 should be I5 (sandboxed)");
        Check(t.Engage("locked-notes", "C1", _policy.Disposition("P4", "C1"), true) == "I4",
            "mic under P4 should be I4 (attempted/denied)");
        // Notes network under P1, ordinary foreground: I2 latched.
        Check(t.Engage("notes", "C3", _policy.Disposition("P1", "C3"), false) == "I2",
            "notes network under P1 should latch I2");
        t.AppClosed("game");
        Check(t.State("game", "C1") == "I0", "indicators must clear when the app closes");

        // Rendering: security computes, the shell renders (§6).
        // The notes window's record carries the headline state,
        // and the indicator bar shows every capability's state.
        var ctx = new NctDataObject();
        ctx.Set("AppLine", "Notes — capability indicators");
        ctx.Set("MicText", Line("C1", t.State("notes", "C1")));
        ctx.Set("CameraText", Line("C2", t.State("notes", "C2")));
        ctx.Set("NetworkText", Line("C3", t.State("notes", "C3")));
        ctx.Set("SpawnText", Line("C10", t.State("notes", "C10")));
        var bar = _renderer.Load(
            "res://nct-security-manager/indicator-bar.nctxml", this, ctx);
        Check(bar.Kind == "shell", "indicator bar kind is not shell");
        RegisterFurniture("indicator-bar", bar, new Rect2(1090, 40, 190, 120));
        Check(LabelOf(bar.Root, "Mic") == "C1 Microphone — I2 used this session",
            "rendered mic indicator wrong: " + LabelOf(bar.Root, "Mic"));
        Check(LabelOf(bar.Root, "Network") == "C3 Network — I2 used this session",
            "rendered network indicator wrong");
        Check(LabelOf(bar.Root, "Camera") == "C2 Camera — I0 none",
            "rendered camera indicator wrong");
        var nrec = _wm.Call("get_record", _notesWindow).AsGodotObject();
        nrec.Set("indicators", t.State("notes", "C1"));
        Check(nrec.Get("indicators").AsString() == "I2",
            "window record does not carry the indicator state");
    }

    private string Line(string capability, string state)
    {
        var words = state switch
        {
            "I1" => "I1 active",
            "I2" => "I2 used this session",
            "I3" => "I3 plugged",
            "I4" => "I4 attempted / denied",
            "I5" => "I5 sandboxed",
            _ => "I0 none",
        };
        return $"{capability} {_policy.CapabilityName(capability)} — {words}";
    }

    private void Expect(string profile, string capability, string want)
    {
        var got = _policy.Disposition(profile, capability);
        Check(got == want, $"matrix {profile}x{capability}: want {want}, got {got}");
    }

    // ---------------------------------------------------------------
    private bool BusHas(string topic, string payload)
    {
        foreach (var entry in _env.Get("bus_log").AsGodotArray())
        {
            var d = entry.AsGodotDictionary();
            if (d["topic"].AsString() == topic && d["payload"].AsString() == payload)
                return true;
        }
        return false;
    }

    private bool NoWireFailures(NctDocument doc)
    {
        foreach (var d in doc.Diagnostics)
            if (d.Contains("cannot wire")) return false;
        return true;
    }

    private string JoinDiag(NctDocument doc) => string.Join("; ", doc.Diagnostics);

    private void PressButton(Node root, string name)
    {
        var b = FindButton(root, name);
        Check(b != null, "button not found: " + name);
        b?.EmitSignal("pressed");
    }

    private static Button FindButton(Node root, string name)
    {
        if (root is Button b && b.Name == name) return b;
        foreach (var c in root.GetChildren())
        {
            var found = FindButton(c, name);
            if (found != null) return found;
        }
        return null;
    }

    private static string LabelOf(Node root, string name)
    {
        if (root is Label l && l.Name == name) return l.Text;
        foreach (var c in root.GetChildren())
        {
            var found = LabelOf(c, name);
            if (found != null) return found;
        }
        return null;
    }

    private void Check(bool cond, string what)
    {
        if (!cond) _failures.Add(what);
    }
}

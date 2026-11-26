using Godot;
using System;
using System.Collections.Generic;
using System.Linq;

/// <summary>
/// Slice 2 harness — the five proofs of plans/NCTXML.md §12, all
/// rendered by the one interpreter, with hosts played by this class:
/// the shell's Settings (pane), File Navigator (preview), the
/// shell (window), and a minimal app host (app). The window
/// manager is the real Slice 1 GDScript, loaded and driven
/// through its records — the app proof's dashboard conversion is
/// Slice 1's set_style on the live record.
///
/// Run: godot --headless --path src/modules res://nctxml/harness/main.tscn -- --self-test
/// (the project assembly must be built first: dotnet build)
/// </summary>
public partial class Harness : Control
{
    private const string Proofs = "res://nctxml/proofs/";

    private NctXmlRenderer _renderer;
    private GodotObject _wm;
    private GDScript _recScript;
    private readonly List<string> _failures = new();
    private readonly Dictionary<string, string> _appRegistry = new(); // app id -> window id
    private readonly List<string> _notifications = new();

    public int PreviewOpenCount;
    public int WindowPingCount;

    public override void _Ready()
    {
        _renderer = new NctXmlRenderer();
        var wmScript = GD.Load<GDScript>("res://nct-window-manager/window_manager.gd");
        _recScript = GD.Load<GDScript>("res://nct-window-manager/window_record.gd");
        _wm = wmScript.New(this).AsGodotObject();
        AddChild(_wm as Node);
        _wm.Call("build_layers");

        if (OS.GetCmdlineUserArgs().Contains("--self-test"))
            _ = RunTests();
    }

    // ---------------------------------------------------------------
    // Host services (played by the harness)
    // ---------------------------------------------------------------
    public void OnPreviewOpen() => PreviewOpenCount++;
    public void OnWindowPing() => WindowPingCount++;

    public void OnAppNotify()
    {
        _notifications.Add("Notes: reminder");
        var panel = new PanelContainer();
        var label = new Label { Text = "Notes: reminder" };
        panel.AddChild(label);
        RegisterWindow("osd-notes", "osd", panel);
    }

    private GodotObject MakeRecord(string id, string style, Control backing, string parentId = "")
    {
        var rec = _recScript.New(id, style).AsGodotObject();
        rec.Set("backing", backing);
        if (parentId != "") rec.Set("parent_id", parentId);
        return rec;
    }

    private bool RegisterWindow(string id, string style, Control backing, string parentId = "")
    {
        var rec = MakeRecord(id, style, backing, parentId);
        return _wm.Call("register_window", rec).AsBool();
    }

    private GodotObject RecordOf(string windowId) =>
        _wm.Call("get_record", windowId).AsGodotObject();

    private string LaunchApp(NctDocument doc)
    {
        var appId = doc.Manifest["id"].AsString();
        if (doc.Manifest["single_instance"].AsBool() && _appRegistry.TryGetValue(appId, out var existing))
            return existing;  // single-instance: the second launch returns the live window
        var windowId = "win-" + appId;
        RegisterWindow(windowId, doc.Manifest["requested_style"].AsString(), doc.Root);
        _appRegistry[appId] = windowId;
        return windowId;
    }

    // ---------------------------------------------------------------
    // Tree queries
    // ---------------------------------------------------------------
    private static Node FindByName(Node root, string name)
    {
        if (root.Name == name) return root;
        foreach (var child in root.GetChildren())
        {
            var found = FindByName(child, name);
            if (found != null) return found;
        }
        return null;
    }

    private static Node FindComponent(Node root, string component)
    {
        if (root.HasMeta("nct_component") && root.GetMeta("nct_component").AsString() == component)
            return root;
        foreach (var child in root.GetChildren())
        {
            var found = FindComponent(child, component);
            if (found != null) return found;
        }
        return null;
    }

    private void Check(bool cond, string what)
    {
        if (!cond) _failures.Add(what);
    }

    // ---------------------------------------------------------------
    // The proofs (§12)
    // ---------------------------------------------------------------
    private async System.Threading.Tasks.Task RunTests()
    {
        // P1 setup: the component registers as a class (§12.1).
        Check(_renderer.RegisterComponentFile(Proofs + "labelled-slider.nctxml"),
            "component file did not register");
        Check(_renderer.HasComponent("LabelledSlider"), "LabelledSlider not in the library");

        // ---- P2: a pane, hosted by Settings, bound to the host's DataContext
        var settingsCtx = NctDataObject.Of(
            ("UserName", "Ada"), ("Volume", 30.0), ("DarkMode", true));
        var pane = _renderer.Load(Proofs + "settings-pane.nctxml", this, settingsCtx);
        Check(pane.Kind == "pane", "settings file kind is not pane: " + pane.Kind);
        Check(RegisterWindow("settings-win", "normal", pane.Root),
            "host could not window the pane");
        Check(FindComponent(pane.Root, "LabelledSlider") != null,
            "pane does not use the LabelledSlider component");

        var slider = FindByName(pane.Root, "Slider") as HSlider;
        Check(slider != null && Math.Abs(slider.Value - 30.0) < 0.01,
            "slider did not take the host's Volume=30");
        settingsCtx.Set("Volume", 55.0);
        Check(Math.Abs(slider.Value - 55.0) < 0.01,
            "OneWay: host Volume=55 did not reach the slider");
        slider.SetValue(70.0);
        Check(Math.Abs(settingsCtx.Get("Volume").AsDouble() - 70.0) < 0.01,
            "TwoWay: slider=70 did not write back to the host context");
        var valueLabel = FindByName(pane.Root, "ValueLabel") as Label;
        Check(valueLabel != null && valueLabel.Text == "70",
            "component value label (Round converter) is not 70: " + valueLabel?.Text);

        var nameField = FindByName(pane.Root, "NameField") as LineEdit;
        nameField.Text = "Grace";
        nameField.EmitSignal(LineEdit.SignalName.TextChanged, "Grace");
        Check(settingsCtx.Get("UserName").AsString() == "Grace",
            "TwoWay: TextField edit did not reach the host context");
        var nameEcho = FindByName(pane.Root, "NameEcho") as Label;
        Check(nameEcho.Text == "Grace", "OneWay: name echo label did not follow the context");

        var darkBox = FindByName(pane.Root, "DarkModeBox") as CheckBox;
        Check(darkBox.ButtonPressed, "CheckBox did not take DarkMode=true");
        darkBox.SetPressed(false);
        Check(!settingsCtx.Get("DarkMode").AsBool(), "TwoWay: CheckBox toggle did not write back");

        // Layout is real: the Stack lays its children out in order.
        await ToSignal(GetTree(), SceneTree.SignalName.ProcessFrame);
        await ToSignal(GetTree(), SceneTree.SignalName.ProcessFrame);
        Check(nameEcho.Position.Y < nameField.Position.Y,
            "Stack layout: echo label is not above the name field");

        // ---- P3: a preview — read-only, no code, by kind
        var img = Image.CreateEmpty(8, 8, false, Image.Format.Rgba8);
        img.Fill(new Color(0.2f, 0.6f, 0.9f));
        img.SavePng("user://preview-fixture.png");
        var previewCtx = NctDataObject.Of(
            ("Text", "hello preview"),
            ("ImagePath", ProjectSettings.GlobalizePath("user://preview-fixture.png")));
        var preview = _renderer.Load(Proofs + "text-preview.nctxml", this, previewCtx);
        Check(preview.Kind == "preview", "preview file kind wrong: " + preview.Kind);
        Check(preview.Manifest["for"].AsString().Contains("txt"),
            "preview did not declare its file types");
        var editField = FindByName(preview.Root, "EditField") as LineEdit;
        Check(editField != null && !editField.Editable, "preview TextField is still editable");
        var openBtn = FindByName(preview.Root, "OpenButton") as Button;
        Check(openBtn != null && openBtn.Disabled, "preview Button is not disabled");
        Check(preview.BlockedHandlers >= 1, "preview handler was not counted as blocked");
        Check(preview.ReadOnlyEnforced >= 2, "preview read-only enforcement missing");
        openBtn.EmitSignal(Button.SignalName.Pressed);
        Check(PreviewOpenCount == 0, "preview handler RAN — no-code rule broken");
        editField.Text = "changed";
        editField.EmitSignal(LineEdit.SignalName.TextChanged, "changed");
        Check(previewCtx.Get("Text").AsString() == "hello preview",
            "preview TwoWay binding wrote back — downgrade failed");
        var pic = FindByName(preview.Root, "Pic") as TextureRect;
        Check(pic != null && pic.Texture != null, "preview image did not load through its binding");

        // ---- P4: a window — isolated, no system linkage
        var winCtx = NctDataObject.Of(("Level", 10.0));
        var win = _renderer.Load(Proofs + "hello-window.nctxml", this, winCtx);
        Check(win.Kind == "window", "window file kind wrong: " + win.Kind);
        Check(RegisterWindow("hello-win", "normal", win.Root), "window did not register");
        Check(RecordOf("hello-win").Get("layer").AsString() == "Workspace",
            "window is not in the Workspace layer");
        Check(_appRegistry.Count == 0, "a window kind registered as an app — isolation broken");
        Check(FindComponent(win.Root, "LabelledSlider") != null,
            "window does not use the LabelledSlider component");
        var pingBtn = FindByName(win.Root, "PingButton") as Button;
        pingBtn.EmitSignal(Button.SignalName.Pressed);
        Check(WindowPingCount == 1, "window handler did not run (handlers wire for window kind)");

        // ---- P5: an app — registered, single-instance, settings,
        //      one notification, live dashboard conversion
        var appCtx = NctDataObject.Of(
            ("NoteTitle", "Shopping"), ("Priority", 2.0), ("AutoSave", true));
        var app = _renderer.Load(Proofs + "notes-app.nctxml", this, appCtx);
        Check(app.Kind == "app", "app file kind wrong: " + app.Kind);
        Check(app.Manifest["id"].AsString() == "nct.notes", "app manifest id wrong");
        Check(app.Manifest["settings_src"].AsString().EndsWith("notes-settings.nctxml"),
            "app manifest did not resolve its settings pane");
        Check(FindComponent(app.Root, "LabelledSlider") != null,
            "app does not use the LabelledSlider component");
        var prio = FindByName(app.Root, "Slider") as HSlider;
        Check(prio != null && Math.Abs(prio.MaxValue - 5.0) < 0.01 && Math.Abs(prio.Value - 2.0) < 0.01,
            "app slider did not take Max=5 / Priority=2 through the component");

        int windowsBefore = _wm.Call("window_count").AsInt32();
        var appWin1 = LaunchApp(app);
        var appWin2 = LaunchApp(app);
        Check(appWin1 == appWin2, "single-instance: second launch made a second window");
        Check(_wm.Call("window_count").AsInt32() == windowsBefore + 1,
            "single-instance: window count moved on the second launch");

        var appSettings = _renderer.Load(app.Manifest["settings_src"].AsString(), this, appCtx);
        Check(appSettings.Kind == "pane", "app settings file is not a pane");
        Check(RegisterWindow("notes-settings-win", "dialog", appSettings.Root, appWin1),
            "app settings dialog did not register");
        Check(RecordOf("notes-settings-win").Get("layer").AsString()
                == RecordOf(appWin1).Get("layer").AsString(),
            "settings dialog is not in its parent app's layer band");
        var autoSave = FindByName(appSettings.Root, "AutoSaveBox") as CheckBox;
        Check(autoSave.ButtonPressed, "app settings did not bind AutoSave=true");
        autoSave.SetPressed(false);
        Check(!appCtx.Get("AutoSave").AsBool(), "app settings toggle did not write back");

        var notifyBtn = FindByName(app.Root, "NotifyButton") as Button;
        notifyBtn.EmitSignal(Button.SignalName.Pressed);
        Check(_notifications.Count == 1, "app notification was not delivered");
        Check(RecordOf("osd-notes").Get("layer").AsString() == "Overlay-OSD",
            "notification surface is not in Overlay-OSD");

        var backingBefore = RecordOf(appWin1).Get("backing").AsGodotObject();
        Check(_wm.Call("set_style", appWin1, "dashboard").AsBool(), "dashboard conversion refused");
        Check(RecordOf(appWin1).Get("layer").AsString() == "Desktop",
            "converted app is not in the Desktop layer");
        Check(RecordOf(appWin1).Get("backing").AsGodotObject() == backingBefore,
            "conversion replaced the app's live tree — restart in disguise");

        if (_failures.Count == 0)
        {
            GD.Print("NCTXML_SELFTEST_OK proofs=5");
            GetTree().Quit(0);
        }
        else
        {
            foreach (var f in _failures) GD.PrintErr("NCTXML_SELFTEST_FAIL ", f);
            GetTree().Quit(1);
        }
    }
}

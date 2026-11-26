using Godot;
using System.Collections.Generic;

/// <summary>
/// Breadth proof: the Attention inbox as a shell surface
/// (plans/SYSTEM-INTERFACE.md §3 — "persistent in the bar until
/// resolved or dismissed, severity-ordered"). The contexts come
/// from the watch itself (inbox_snapshot.py drives the bridge's
/// fixture streams through the real watch); this harness renders
/// them with the NCTXML interpreter and seats the bar item in
/// the window manager as a panel window in the Top layer, next
/// to the Slice 3 furniture. The surface renders the watch's
/// data — it holds no copy of the Issues.
///
/// Run: godot --headless --path src/modules \
///   res://nct-system-watch/harness/main.tscn \
///   -- --contexts &lt;inbox-contexts.json&gt;
/// </summary>
public partial class AttentionHarness : Control
{
    private readonly List<string> _failures = new();

    public override void _Ready()
    {
        var args = OS.GetCmdlineUserArgs();
        string contextsPath = null;
        for (int i = 0; i < args.Length - 1; i++)
            if (args[i] == "--contexts") contextsPath = args[i + 1];
        if (contextsPath == null)
        {
            GD.PrintErr("ATTENTION_FAIL no --contexts given");
            GetTree().Quit(1);
            return;
        }

        var all = Json.ParseString(FileAccess.GetFileAsString(contextsPath))
            .AsGodotDictionary();
        var renderer = new NctXmlRenderer();

        // The shell the item sits in: root + window manager.
        var envScript = GD.Load<GDScript>("res://nct-environment-manager/environment_manager.gd");
        var wmScript = GD.Load<GDScript>("res://nct-window-manager/window_manager.gd");
        var recordScript = GD.Load<GDScript>("res://nct-window-manager/window_record.gd");
        var env = envScript.New().AsGodotObject();
        AddChild((Node)env);
        var wm = wmScript.New(this).AsGodotObject();
        AddChild((Node)wm);
        wm.Call("build_layers");
        env.Call("register_module", "nct-window-manager", wm);

        // --- the bar item ---
        var barDict = all["bar"].AsGodotDictionary();
        var barCtx = new NctDataObject();
        barCtx.Set("AttentionText", barDict["AttentionText"].AsString());
        var bar = renderer.Load(
            "res://nct-system-watch/views/attention-bar.nctxml", this, barCtx);
        Check(bar.Kind == "shell", "attention bar kind is not shell: " + bar.Kind);
        var rec = recordScript.New("attention-bar",
            bar.Manifest["requested_style"].AsString()).AsGodotObject();
        rec.Set("origin", "shell");
        rec.Set("app_id", "");
        rec.Set("kind_link", "shell");
        rec.Set("backing", bar.Root);
        rec.Set("title", "Attention");
        rec.Set("geometry", new Rect2(900, 0, 220, 40));
        Check(wm.Call("register_window", rec).AsBool(), "WM refused the attention bar");
        Check(rec.Get("layer").AsString() == "Top",
            "attention bar not in Top: " + rec.Get("layer").AsString());
        var topLayer = wm.Call("layer_node", "Top").AsGodotObject();
        Check(bar.Root.GetParent().GetInstanceId() == topLayer.GetInstanceId(),
            "attention bar backing not under the Top CanvasLayer");
        Check(LabelOf(bar.Root, "AttentionText") == "Attention: 3 open",
            "bar text wrong: " + LabelOf(bar.Root, "AttentionText"));

        // --- one pane per open Issue ---
        var issues = all["issues"].AsGodotArray();
        Check(issues.Count == 3, "expected 3 issue panes, got " + issues.Count);
        var titles = new List<string>();
        foreach (var issueVar in issues)
        {
            var d = issueVar.AsGodotDictionary();
            var ctx = new NctDataObject();
            foreach (var key in d.Keys)
                ctx.Set(key.AsString(), d[key].VariantType == Variant.Type.Int
                    ? d[key].AsInt32().ToString() : d[key].AsString());
            var pane = renderer.Load(
                "res://nct-system-watch/views/attention-pane.nctxml", this, ctx);
            AddChild(pane.Root);
            titles.Add(LabelOf(pane.Root, "Title"));
            if (LabelOf(pane.Root, "Title") == "Bluetooth service failed")
                Check(LabelOf(pane.Root, "Actions").Contains("Restart the service"),
                    "unit pane lacks its Fix action");
            if (LabelOf(pane.Root, "Title") == "NCT Hello crashed")
                Check(LabelOf(pane.Root, "Actions").StartsWith("Report"),
                    "crash pane's way out should lead with Report");
        }
        Check(titles.Contains("Bluetooth service failed")
              && titles.Contains("NCT Hello crashed")
              && titles.Contains("Fake Browser crashed"),
            "pane titles wrong: " + string.Join(", ", titles));

        if (_failures.Count == 0)
        {
            GD.Print("ATTENTION_OK");
            GetTree().Quit(0);
        }
        else
        {
            foreach (var f in _failures) GD.PrintErr("ATTENTION_FAIL ", f);
            GetTree().Quit(1);
        }
    }

    private void Check(bool cond, string what)
    {
        if (!cond) _failures.Add(what);
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
}

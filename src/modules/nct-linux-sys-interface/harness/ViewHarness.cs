using Godot;
using System.Collections.Generic;

/// <summary>
/// Slice A view proof: the Services and Logs views are NCTXML
/// panes rendered over the bridge's system object tree — the
/// reflection proof of plans/SYSTEM-INTERFACE.md §6 Slice A.
/// The harness turns a bridge snapshot (JSON, written by
/// sys_interface.py) into DataContexts and asserts the panes show
/// what the tree holds: the failed unit by name, the error line
/// from its journal.
///
/// Run: godot --headless --path src/modules \
///   res://nct-linux-sys-interface/harness/main.tscn \
///   -- --snapshot &lt;tree.json&gt;
/// </summary>
public partial class ViewHarness : Control
{
    private readonly List<string> _failures = new();

    public override void _Ready()
    {
        var args = OS.GetCmdlineUserArgs();
        string snapshotPath = null;
        for (int i = 0; i < args.Length - 1; i++)
            if (args[i] == "--snapshot") snapshotPath = args[i + 1];
        if (snapshotPath == null)
        {
            GD.PrintErr("SLICEA_VIEWS_FAIL no --snapshot given");
            GetTree().Quit(1);
            return;
        }

        var parsed = Json.ParseString(FileAccess.GetFileAsString(snapshotPath));
        var snap = parsed.AsGodotDictionary();
        var tree = snap["tree"].AsGodotDictionary();

        // --- Services context from /units ---
        var unitNames = new List<string>();
        foreach (var key in tree.Keys)
            if (key.AsString().StartsWith("/units/"))
                unitNames.Add(key.AsString().Substring("/units/".Length));
        unitNames.Sort();
        int failed = 0;
        var svc = new NctDataObject();
        for (int i = 0; i < unitNames.Count; i++)
        {
            var props = tree["/units/" + unitNames[i]].AsGodotDictionary();
            var health = props["health"].AsString();
            if (health == "failed") failed++;
            svc.Set("U" + (i + 1), unitNames[i] + " — " + health);
        }
        svc.Set("Summary", $"{unitNames.Count} services · {failed} failed");

        // --- Logs context from /journal ---
        var lines = new List<string>();
        foreach (var key in tree.Keys)
        {
            var path = key.AsString();
            if (!path.StartsWith("/journal/")) continue;
            var unit = path.Substring("/journal/".Length);
            foreach (var entryVar in tree[key].AsGodotDictionary()["entries"].AsGodotArray())
            {
                var e = entryVar.AsGodotDictionary();
                lines.Add($"{unit}: {e["message"].AsString()}");
            }
        }
        var logs = new NctDataObject();
        for (int i = 0; i < lines.Count && i < 4; i++)
            logs.Set("L" + (i + 1), lines[i]);

        // --- Crashes context from /crashes (breadth: the
        // coredump domain joins the same tree) ---
        var crashIds = new List<string>();
        foreach (var key in tree.Keys)
            if (key.AsString().StartsWith("/crashes/"))
                crashIds.Add(key.AsString().Substring("/crashes/".Length));
        crashIds.Sort();
        bool hasCrashes = crashIds.Count > 0;
        var crashCtx = new NctDataObject();
        if (hasCrashes)
        {
            var apps = new HashSet<string>();
            for (int i = 0; i < crashIds.Count; i++)
            {
                var p = tree["/crashes/" + crashIds[i]].AsGodotDictionary();
                apps.Add(p["app"].AsString());
                crashCtx.Set("Cr" + (i + 1),
                    $"{p["app"].AsString()} — signal {p["signal"].AsInt32()} — {p["when"].AsString()}");
            }
            crashCtx.Set("Summary", $"{crashIds.Count} crashes · {apps.Count} apps");
        }

        var renderer = new NctXmlRenderer();
        var svcDoc = renderer.Load(
            "res://nct-linux-sys-interface/views/services-pane.nctxml", this, svc);
        var logDoc = renderer.Load(
            "res://nct-linux-sys-interface/views/logs-pane.nctxml", this, logs);
        AddChild(svcDoc.Root);
        AddChild(logDoc.Root);
        if (hasCrashes)
        {
            var crashDoc = renderer.Load(
                "res://nct-linux-sys-interface/views/crashes-pane.nctxml", this, crashCtx);
            AddChild(crashDoc.Root);
            var crashText = AllLabelText(crashDoc.Root);
            Check(crashText.Contains("NCT Hello — signal 11"),
                "Crashes view does not show the hello crash: " + crashText);
            Check(crashText.Contains("Fake Browser — signal 6"),
                "Crashes view does not show the browser crash: " + crashText);
            Check(crashText.Contains("3 crashes · 2 apps"),
                "Crashes summary wrong: " + crashText);
        }

        var svcText = AllLabelText(svcDoc.Root);
        var logText = AllLabelText(logDoc.Root);
        Check(svcText.Contains("bluetooth.service — failed"),
            "Services view does not show the failed unit: " + svcText);
        Check(svcText.Contains("4 services · 1 failed"),
            "Services summary wrong: " + svcText);
        Check(svcText.Contains("greetd.service — ok"),
            "Services view does not show greetd ok: " + svcText);
        Check(logText.Contains("adapter not responding"),
            "Logs view does not show the journal error line: " + logText);

        if (_failures.Count == 0)
        {
            GD.Print("SLICEA_VIEWS_OK");
            if (hasCrashes) GD.Print("CRASHES_VIEW_OK");
            GetTree().Quit(0);
        }
        else
        {
            foreach (var f in _failures) GD.PrintErr("SLICEA_VIEWS_FAIL ", f);
            GetTree().Quit(1);
        }
    }

    private void Check(bool cond, string what)
    {
        if (!cond) _failures.Add(what);
    }

    private static string AllLabelText(Node root)
    {
        var parts = new List<string>();
        void Walk(Node n)
        {
            if (n is Label l) parts.Add(l.Text);
            foreach (var c in n.GetChildren()) Walk(c);
        }
        Walk(root);
        return string.Join(" | ", parts);
    }
}

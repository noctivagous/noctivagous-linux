using Godot;
using System.Collections.Generic;

/// <summary>
/// Slice C view proof: the device pane (NCTXML) rendered over the
/// device-centre's view contexts — the four Secure Boot states as
/// words. Contexts are produced by device_centre.py from the same
/// fixture the logic tests use, so the view is checked against
/// the logic, not against a second copy of the truth.
///
/// Run: godot --headless --path src/modules \
///   res://nct-device-centre/harness/main.tscn \
///   -- --contexts &lt;device-contexts.json&gt;
/// </summary>
public partial class DeviceViewHarness : Control
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
            GD.PrintErr("SLICEC_VIEW_FAIL no --contexts given");
            GetTree().Quit(1);
            return;
        }

        var all = Json.ParseString(FileAccess.GetFileAsString(contextsPath))
            .AsGodotDictionary();
        var renderer = new NctXmlRenderer();

        foreach (var deviceId in new[] { "wifi-rtw", "gpu-nvidia" })
        {
            var ctxDict = all[deviceId].AsGodotDictionary();
            var ctx = new NctDataObject();
            foreach (var key in ctxDict.Keys)
                ctx.Set(key.AsString(), ctxDict[key].AsString());
            var doc = renderer.Load(
                "res://nct-device-centre/device-pane.nctxml", this, ctx);
            AddChild(doc.Root);
            var text = AllLabelText(doc.Root);
            if (deviceId == "wifi-rtw")
            {
                Check(text.Contains("Realtek RTL8852"), "wifi name missing: " + text);
                Check(LabelOf(doc.Root, "Enrolled") == "NO",
                    "wifi Enrolled should read NO: " + text);
                Check(LabelOf(doc.Root, "Signed") == "yes",
                    "wifi Signed should read yes: " + text);
                Check(LabelOf(doc.Root, "Verdict") == "built and signed, key not enrolled",
                    "wifi verdict wrong: " + text);
            }
            else
            {
                Check(LabelOf(doc.Root, "Loaded") == "yes",
                    "gpu Loaded should read yes: " + text);
                Check(LabelOf(doc.Root, "Verdict") == "working",
                    "gpu verdict wrong: " + text);
            }
        }

        if (_failures.Count == 0)
        {
            GD.Print("SLICEC_VIEW_OK");
            GetTree().Quit(0);
        }
        else
        {
            foreach (var f in _failures) GD.PrintErr("SLICEC_VIEW_FAIL ", f);
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

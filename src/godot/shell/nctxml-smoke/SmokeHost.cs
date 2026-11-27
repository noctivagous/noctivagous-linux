using Godot;

// E1 hosting smoke: this project can load an NCTXML document —
// binding resolves against a data context and the Grid lays out —
// using the vendored copy of the library. Prints NCTXML_SMOKE_OK.
public partial class SmokeHost : Control
{
    public override async void _Ready()
    {
        var ctx = new NctDataObject();
        ctx.Set("Title", "hosted");
        var doc = new NctXmlRenderer().Load(
            "res://nctxml-smoke/smoke.nctxml", this, ctx);
        if (doc.Kind == "error")
        {
            GD.Print("NCTXML_SMOKE_FAIL notes=", string.Join(";", doc.Diagnostics));
            GetTree().Quit(1);
            return;
        }
        AddChild(doc.Root);
        // Deterministic size: headless windows start tiny and the
        // grid assertions below are measured in pixels, so pin the
        // document root instead of anchoring it to the window.
        doc.Root.SetAnchorsPreset(LayoutPreset.TopLeft);
        doc.Root.Size = new Vector2(400, 200);
        await ToSignal(GetTree(), SceneTree.SignalName.ProcessFrame);
        await ToSignal(GetTree(), SceneTree.SignalName.ProcessFrame);

        var label = doc.Root.FindChild("SmokeTitle", true, false) as Label;
        var a = doc.Root.FindChild("CellA", true, false) as Control;
        var b = doc.Root.FindChild("CellB", true, false) as Control;
        bool ok = label != null && label.Text == "hosted"
            && a != null && b != null
            && Mathf.Abs(a.Size.X - b.Size.X) < 1.0f && a.Size.X > 50;
        GD.Print(ok
            ? $"NCTXML_SMOKE_OK project={ProjectSettings.GetSetting("application/config/name")}"
            : $"NCTXML_SMOKE_FAIL label={label?.Text} a={a?.Size} b={b?.Size}");
        GetTree().Quit(ok ? 0 : 1);
    }
}

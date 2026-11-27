using Godot;
using System.Collections.Generic;

// E5 proofs for the TitleBar component: an app window wearing
// it as client-side chrome. Title binds through the component
// bag; the template's commands reach the host through the
// instance's on<Event> mappings; ShowMinimize hides the
// minimize button via the Visibility converter; no command or
// drag wiring may produce diagnostics. (The drag itself needs
// a real window manager and is not exercised headless.)
// Prints TITLEBAR_OK.
public partial class TitleBarHarness : Control
{
    private readonly List<string> _fail = new();
    private int _closes, _minimizes;

    public void OnClose() => _closes++;
    public void OnMinimize() => _minimizes++;

    private void Check(bool ok, string what) { if (!ok) _fail.Add(what); }

    public override async void _Ready()
    {
        var renderer = new NctXmlRenderer();
        Check(renderer.RegisterComponentFile(
            "res://nctxml/components/title-bar.nctxml"),
            "titlebar component registered");
        var ctx = NctDataObject.Of(("WindowTitle", "Notes"));
        var doc = renderer.Load(
            "res://nctxml/components/proof-app.nctxml", this, ctx);
        AddChild(doc.Root);
        doc.Root.SetAnchorsPreset(LayoutPreset.TopLeft);
        doc.Root.Size = new Vector2(400, 200);
        await ToSignal(GetTree(), SceneTree.SignalName.ProcessFrame);
        await ToSignal(GetTree(), SceneTree.SignalName.ProcessFrame);

        var bar = doc.Root.FindChild("Bar", true, false);
        var title = bar?.FindChild("TitleLabel", true, false) as Label;
        Check(title != null && title.Text == "Notes",
            $"title bound through the bag ('{title?.Text}')");
        ctx.Set("WindowTitle", "Ledger");
        Check(title.Text == "Ledger", "title follows the outer context");

        var close = bar.FindChild("CloseButton", true, false) as Button;
        var min = bar.FindChild("MinButton", true, false) as Button;
        close.EmitSignal(BaseButton.SignalName.Pressed);
        min.EmitSignal(BaseButton.SignalName.Pressed);
        Check(_closes == 1 && _minimizes == 1,
            $"commands reached the host (close={_closes}, min={_minimizes})");

        var bar2 = doc.Root.FindChild("BarNoMin", true, false);
        var min2 = bar2?.FindChild("MinButton", true, false) as Button;
        Check(min2 != null && !min2.Visible,
            "ShowMinimize=false hides the minimize button");
        Check(min2.Disabled,
            "an unmapped command renders its button disabled");
        var close2 = bar2.FindChild("CloseButton", true, false) as Button;
        close2.EmitSignal(BaseButton.SignalName.Pressed);
        Check(_closes == 2, "second instance's close maps to the same host method");

        foreach (var note in doc.Diagnostics)
            if (note.Contains("command") || note.Contains("Command"))
                _fail.Add("unexpected diagnostic: " + note);

        if (_fail.Count == 0) GD.Print("TITLEBAR_OK");
        else
        {
            foreach (var f in _fail) GD.Print("TITLEBAR_FAIL: ", f);
            GD.Print("TITLEBAR_FAILED count=", _fail.Count);
        }
        GetTree().Quit(_fail.Count == 0 ? 0 : 1);
    }
}

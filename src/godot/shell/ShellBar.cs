using Godot;

/// <summary>
/// The launch bar's host (E4): builds the bar's data context
/// from main.gd's launch list and loads bar.nctxml. Launching
/// stays in main.gd (nct-launch, no program paths here either).
/// The bar's first button holds keyboard focus from the start —
/// the session is keyboard-drivable the moment it appears.
/// </summary>
public partial class ShellBar : Control
{
    private NctDataObject _ctx;
    private Button _firstButton;
    private Control _barRoot;
    private string _lastSecond = "";

    public override void _Ready()
    {
        _ctx = new NctDataObject();
        _ctx.Set("Clock", "");
        var entries = new Godot.Collections.Array();
        foreach (var e in GetParent().Call("get_launch_entries").AsGodotArray())
        {
            var d = e.AsGodotDictionary();
            var id = d["id"].AsString();
            if (id == "shell") continue;
            var item = new NctDataObject();
            item.Set("id", id);
            item.Set("title", d["title"].AsString());
            item.Set("key", d["key"].AsString());
            entries.Add(item);
        }
        _ctx.Set("Entries", entries);

        var doc = new NctXmlRenderer().Load("res://bar.nctxml", this, _ctx);
        if (doc.Kind == "error")
        {
            GD.PushError("launch bar failed to load: "
                + string.Join("; ", doc.Diagnostics));
            return;
        }
        AddChild(doc.Root);
        _barRoot = doc.Root;
        _firstButton = FindFirstButton(doc.Root);
        Callable.From(() => _firstButton?.GrabFocus()).CallDeferred();
    }

    private static Button FindFirstButton(Node node)
    {
        if (node is Button b) return b;
        foreach (var child in node.GetChildren())
        {
            var found = FindFirstButton(child);
            if (found != null) return found;
        }
        return null;
    }

    // Repeat handler convention: the item is the argument.
    public void LaunchItem(NctDataObject item) =>
        GetParent().Call("launch_entry", item.Get("id").AsString());

    public override void _Process(double delta)
    {
        var t = Time.GetTimeStringFromSystem();
        if (t != _lastSecond)
        {
            _lastSecond = t;
            _ctx?.Set("Clock", t);
        }
    }

    // The bar's backing for its Window record: main.gd hands
    // this root to the window manager, which seats it on the
    // Top layer (the manager reparents it out of this host).
    public Control get_bar_root() => _barRoot;

    // Called from main.gd's focus guard.
    public void ensure_focus()
    {
        if (GetViewport().GuiGetFocusOwner() == null)
            _firstButton?.GrabFocus();
    }
}

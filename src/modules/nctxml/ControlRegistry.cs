using Godot;
using System;
using System.Collections.Generic;

/// <summary>
/// One registry entry — the component contract (plans/NCTXML.md §6)
/// in data. An entry without an accessibility role does not enter
/// the registry. ChangeSignal names the signal a TwoWay binding
/// listens to for write-back; Aliases map NCTXML attribute names
/// onto Godot property names; ApplyAttr handles attributes that
/// are not plain properties (Items, Src, grouping).
/// </summary>
public class NctControlEntry
{
    public string Name;
    public Func<Dictionary<string, string>, Control> Factory;
    public string Role;          // §6.4 accessibility role — required
    public bool Focusable;       // §6.5 keyboard fact
    public string ChangeSignal;  // for TwoWay write-back, may be null
    public Dictionary<string, string> Aliases = new();
    public Func<Control, string, string, NctRenderContext, bool> ApplyAttr;
}

public class NctRenderContext
{
    public NctXmlRenderer Renderer;
    public string Kind;                       // the document kind being built
    public NctDataObject DataContext;         // context at this logical node
    public GodotObject Host;                  // handler target (code-behind)
    public NctDocument Document;
    public Dictionary<string, ButtonGroup> RadioGroups = new();
}

/// <summary>
/// The control registry (§4: namespace resolution → control
/// registry). Stock controls for v1 (§6): the full list from the
/// plan; depth where the Slice-2 proofs need it, factory-level
/// breadth elsewhere, grown later by backwards derivation from
/// apps — never hand-rolled in an app.
/// </summary>
public class ControlRegistry
{
    private readonly Dictionary<string, NctControlEntry> _entries = new();

    public void Register(NctControlEntry e)
    {
        if (string.IsNullOrEmpty(e.Role))
            throw new InvalidOperationException(
                $"Control '{e.Name}' has no accessibility role and cannot enter the registry (§6.4).");
        _entries[e.Name] = e;
    }

    public bool TryGet(string name, out NctControlEntry e) => _entries.TryGetValue(name, out e);
    public bool Has(string name) => _entries.ContainsKey(name);
    public IEnumerable<string> Names => _entries.Keys;

    public static ControlRegistry Stock()
    {
        var r = new ControlRegistry();
        void Add(NctControlEntry e) => r.Register(e);

        // --- layout (§7) ---
        Add(new NctControlEntry { Name = "Stack", Role = "layout", Factory = a =>
            (a.TryGetValue("Orientation", out var o) && o == "horizontal")
                ? new HBoxContainer() : new VBoxContainer() });
        Add(new NctControlEntry { Name = "Box", Role = "layout", Factory = a =>
            (a.TryGetValue("Orientation", out var o) && o == "horizontal")
                ? new HBoxContainer() : new VBoxContainer() });
        Add(new NctControlEntry { Name = "Grid", Role = "layout", Factory = a =>
        {
            // The system's own grid (NCTXML §7 semantics ported
            // from NCTGraphite's grid model): two engines behind
            // one surface — the C# solver (default) and the
            // native GDExtension (Engine="native"), chosen per
            // document; native falls back to the solver when the
            // extension is not loaded on this machine.
            string Str(string k, string dflt) =>
                a.TryGetValue(k, out var v) ? v : dflt;
            float Num(string k, float dflt) =>
                a.TryGetValue(k, out var v) && float.TryParse(v,
                    System.Globalization.NumberStyles.Float,
                    System.Globalization.CultureInfo.InvariantCulture,
                    out var f) ? f : dflt;
            var cols = Str("Columns", "1fr");
            var rows = Str("Rows", "auto");
            var proportions = Str("Proportions", "");
            var areas = Str("Areas", "");
            var breakpoints = Str("Breakpoints", "");
            float gap = Num("Gap", 0), pad = Num("Padding", 0);
            float baseline = Num("Baseline", 0), baseOff = Num("BaselineOffset", 0);
            if (Str("Engine", "solver") == "native"
                && ClassDB.ClassExists("NctGridNative"))
            {
                var native = ClassDB.Instantiate("NctGridNative").As<Container>();
                native.Call("set_grid_spec", cols, rows, proportions,
                    areas, breakpoints, gap, pad, baseline, baseOff);
                return native;
            }
            return new NctGridContainer
            {
                ColumnsSpec = cols, RowsSpec = rows,
                ProportionsSpec = proportions, AreasSpec = areas,
                BreakpointsSpec = breakpoints, Gap = gap, Padding = pad,
                BaselineUnit = baseline, BaselineOffset = baseOff,
            };
        } });
        Add(new NctControlEntry { Name = "Dock", Role = "layout", Factory = _ => new DockContainer() });
        Add(new NctControlEntry { Name = "Free", Role = "layout", Factory = _ => new Control() });
        Add(new NctControlEntry { Name = "Scroll", Role = "scroll", Focusable = true, Factory = _ => new ScrollContainer() });

        // --- stock controls (§6) ---
        Add(new NctControlEntry { Name = "Label", Role = "text", Factory = _ => new Label() });
        Add(new NctControlEntry { Name = "Button", Role = "button", Focusable = true,
            ChangeSignal = "pressed", Factory = _ => new Button() });
        Add(new NctControlEntry { Name = "TextField", Role = "textbox", Focusable = true,
            ChangeSignal = "text_changed", Factory = _ => new LineEdit(),
            Aliases = new() { ["Placeholder"] = "PlaceholderText" } });
        Add(new NctControlEntry { Name = "TextArea", Role = "textbox", Focusable = true,
            Factory = _ => new TextEdit() });
        Add(new NctControlEntry { Name = "CheckBox", Role = "checkbox", Focusable = true,
            ChangeSignal = "toggled", Factory = _ => new CheckBox() });
        Add(new NctControlEntry { Name = "Radio", Role = "radio", Focusable = true,
            ChangeSignal = "toggled", Factory = _ => new CheckBox { Text = "" },
            ApplyAttr = (ctrl, attr, val, ctx) =>
            {
                if (attr != "Group") return false;
                if (!ctx.RadioGroups.TryGetValue(val, out var g))
                    ctx.RadioGroups[val] = g = new ButtonGroup();
                ((CheckBox)ctrl).ButtonGroup = g;
                return true;
            } });
        Add(new NctControlEntry { Name = "Slider", Role = "slider", Focusable = true,
            ChangeSignal = "value_changed", Factory = _ => new HSlider(),
            Aliases = new() { ["Min"] = "MinValue", ["Max"] = "MaxValue" } });
        Add(new NctControlEntry { Name = "Select", Role = "combobox", Focusable = true,
            ChangeSignal = "item_selected", Factory = _ => new OptionButton(),
            ApplyAttr = (ctrl, attr, val, _) =>
            {
                if (attr != "Items") return false;
                var ob = (OptionButton)ctrl;
                ob.Clear();
                foreach (var item in val.Split(',')) ob.AddItem(item.Trim());
                return true;
            } });
        Add(new NctControlEntry { Name = "List", Role = "list", Focusable = true,
            ChangeSignal = "item_selected", Factory = _ => new ItemList(),
            ApplyAttr = (ctrl, attr, val, _) =>
            {
                if (attr != "Items") return false;
                foreach (var item in val.Split(',')) ((ItemList)ctrl).AddItem(item.Trim());
                return true;
            } });
        Add(new NctControlEntry { Name = "Tree", Role = "tree", Focusable = true,
            Factory = _ => new Godot.Tree(),
            Aliases = new() { ["Columns"] = "Columns" } });
        Add(new NctControlEntry { Name = "Tabs", Role = "tablist", Focusable = true,
            Factory = _ => new TabContainer() });
        Add(new NctControlEntry { Name = "Menu", Role = "menu", Focusable = true,
            Factory = _ => new MenuButton(),
            ApplyAttr = (ctrl, attr, val, _) =>
            {
                if (attr != "Items") return false;
                var popup = ((MenuButton)ctrl).GetPopup();
                foreach (var item in val.Split(',')) popup.AddItem(item.Trim());
                return true;
            } });
        Add(new NctControlEntry { Name = "Image", Role = "image",
            Factory = _ => new TextureRect { StretchMode = TextureRect.StretchModeEnum.KeepAspectCentered },
            ApplyAttr = (ctrl, attr, val, _) =>
            {
                if (attr != "Src") return false;
                ((TextureRect)ctrl).Texture = NctXmlRenderer.LoadTexture(val);
                return true;
            } });
        Add(new NctControlEntry { Name = "Progress", Role = "progressbar",
            Factory = _ => new ProgressBar(),
            Aliases = new() { ["Min"] = "MinValue", ["Max"] = "MaxValue" } });
        return r;
    }
}

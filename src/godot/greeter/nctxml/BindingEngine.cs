using Godot;
using System;
using System.Globalization;

/// <summary>
/// Binding v1 (plans/NCTXML.md §9): {Path} attribute expressions
/// with modes OneTime / OneWay / TwoWay and named converters.
/// Expressions are paths, literals and named converters only —
/// no expression language. DataContext inheritance is resolved by
/// the renderer; this engine binds one property to one path on
/// one context object. Change flows through the context's
/// PropertyChanged signal — no polling.
/// </summary>
public class BindingSpec
{
    public string Path;
    public string Mode = "OneWay";
    public string Converter;

    public static bool IsBinding(string value) =>
        value != null && value.StartsWith("{") && value.EndsWith("}") && value.Length > 2;

    public static BindingSpec Parse(string value)
    {
        var inner = value.Substring(1, value.Length - 2).Trim();
        var spec = new BindingSpec();
        var parts = inner.Split(',');
        spec.Path = parts[0].Trim();
        for (int i = 1; i < parts.Length; i++)
        {
            var kv = parts[i].Split('=', 2);
            if (kv.Length != 2) continue;
            var key = kv[0].Trim();
            var val = kv[1].Trim();
            if (key == "Mode") spec.Mode = val;
            else if (key == "Converter") spec.Converter = val;
        }
        return spec;
    }
}

/// <summary>One live binding. Kept alive by its document.</summary>
public partial class BindingLink : GodotObject
{
    private Control _target;
    private string _targetProp;
    private NctDataObject _context;
    private BindingSpec _spec;
    private bool _updating;

    public static Variant Convert(Variant v, string converter)
    {
        if (converter == null) return v;
        switch (converter)
        {
            case "Negate": return !v.AsBool();
            case "Visibility": return v.AsBool();
            case "Upper": return v.AsString().ToUpper();
            case "Round": return ((long)Math.Round(v.AsDouble())).ToString(CultureInfo.InvariantCulture);
            case "Percent": return (Math.Round(v.AsDouble() * 100)).ToString(CultureInfo.InvariantCulture) + "%";
            default: return v;
        }
    }

    /// <summary>Coerce a Variant toward the type a control property already holds.</summary>
    public static Variant CoerceFor(Control c, string prop, Variant v)
    {
        Variant current;
        try { current = c.Get(NctXmlRenderer.ToEngineName(prop)); } catch { return v; }
        try
        {
            switch (current.VariantType)
            {
                case Variant.Type.Float: return v.AsDouble();
                case Variant.Type.Int: return v.AsInt64();
                case Variant.Type.Bool: return v.AsBool();
                case Variant.Type.String: return v.AsString();
                default: return v;
            }
        }
        catch { return v; }
    }

    public void BindControl(Control target, NctControlEntry entry, string targetProp,
        BindingSpec spec, NctDataObject context)
    {
        _target = target;
        _targetProp = targetProp;
        _context = context;
        _spec = spec;

        PushToTarget();  // every mode sets the initial value
        if (spec.Mode == "OneTime") return;

        context.Connect(NctDataObject.SignalName.PropertyChanged,
            Callable.From<string>(OnContextChanged));

        if (spec.Mode == "TwoWay" && entry?.ChangeSignal != null)
            ConnectWriteBack(entry.ChangeSignal);
    }

    private void OnContextChanged(string name)
    {
        if (name == _spec.Path) PushToTarget();
    }

    private void PushToTarget()
    {
        if (_updating || !_context.Has(_spec.Path)) return;
        _updating = true;
        var v = Convert(_context.Get(_spec.Path), _spec.Converter);
        if (_target is TextureRect && _targetProp == "Src")
            ((TextureRect)_target).Texture = NctXmlRenderer.LoadTexture(v.AsString());
        else
            _target.Set(NctXmlRenderer.ToEngineName(_targetProp),
                CoerceFor(_target, _targetProp, v));
        _updating = false;
    }

    private void WriteBack(Variant v)
    {
        if (_updating) return;
        _updating = true;
        _context.Set(_spec.Path, v);
        _updating = false;
    }

    private void ConnectWriteBack(string signal)
    {
        var t = _target;
        var prop = _targetProp;
        switch (signal)
        {
            case "toggled":
                t.Connect(CheckBox.SignalName.Toggled, Callable.From<bool>(b => WriteBack(b)));
                break;
            case "text_changed":
                t.Connect(LineEdit.SignalName.TextChanged, Callable.From<string>(s => WriteBack(s)));
                break;
            case "value_changed":
                t.Connect(HSlider.SignalName.ValueChanged, Callable.From<double>(d => WriteBack(d)));
                break;
            case "item_selected":
                t.Connect(OptionButton.SignalName.ItemSelected, Callable.From<long>(i => WriteBack(i)));
                break;
            default:
                t.Connect(signal, Callable.From(() =>
                    WriteBack(t.Get(NctXmlRenderer.ToEngineName(prop)))));
                break;
        }
    }
}

/// <summary>A binding between two context objects — how a component
/// instance's property bag talks to the outer DataContext (§9,
/// component pattern in §2).</summary>
public partial class ObjectLink : GodotObject
{
    private NctDataObject _a, _b;
    private string _aPath, _bPath;
    private bool _updating;

    public static void Link(NctDataObject outer, string outerPath,
        NctDataObject inner, string innerPath, string mode, NctDocument doc)
    {
        var link = new ObjectLink { _a = outer, _aPath = outerPath, _b = inner, _bPath = innerPath };
        doc.KeepAlive(link);
        // outer -> inner: initial + OneWay/TwoWay subscription
        if (outer.Has(outerPath)) inner.Set(innerPath, outer.Get(outerPath));
        if (mode == "OneTime") return;
        outer.Connect(NctDataObject.SignalName.PropertyChanged, Callable.From<string>(name =>
        {
            if (name != outerPath || link._updating) return;
            link._updating = true;
            inner.Set(innerPath, outer.Get(outerPath));
            link._updating = false;
        }));
        if (mode == "TwoWay")
        {
            inner.Connect(NctDataObject.SignalName.PropertyChanged, Callable.From<string>(name =>
            {
                if (name != innerPath || link._updating) return;
                link._updating = true;
                outer.Set(outerPath, inner.Get(innerPath));
                link._updating = false;
            }));
        }
    }
}

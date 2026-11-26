using Godot;
using System.Collections.Generic;

/// <summary>
/// The DataContext object (plans/NCTXML.md §9): a property bag with
/// change notification. Bindings resolve paths against it, hosts
/// (Settings, an app, File Navigator) supply it, and panes inherit
/// it without knowing the host. Change notification is the
/// PropertyChanged signal — no polling, no frame-loop checks.
/// Values are Variants; numbers are stored as doubles.
/// </summary>
public partial class NctDataObject : GodotObject
{
    [Signal]
    public delegate void PropertyChangedEventHandler(string name);

    private readonly Dictionary<string, Variant> _values = new();

    public void Set(string name, Variant value)
    {
        if (_values.TryGetValue(name, out var old) && old.Equals(value))
            return;
        _values[name] = value;
        EmitSignal(SignalName.PropertyChanged, name);
    }

    public Variant Get(string name)
    {
        return _values.TryGetValue(name, out var v) ? v : default;
    }

    public bool Has(string name) => _values.ContainsKey(name);

    public static NctDataObject Of(params (string, Variant)[] pairs)
    {
        var o = new NctDataObject();
        foreach (var (k, v) in pairs)
            o._values[k] = v;
        return o;
    }
}

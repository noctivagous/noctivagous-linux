using Godot;
using System.Collections.Generic;

/// <summary>
/// nct-security-manager, policy half (its README: policy
/// evaluation in the shell, C#). Slice 3 scope is the plan's
/// specced-not-built line: profiles are READ (the matrix from
/// security/MATRIX-SPEC.md, transcribed to profiles.json) and
/// indicator states are COMPUTED and RENDERED — nothing here
/// grants, denies, plugs or sandboxes anything. Enforcement is
/// the guard's, in the service layer, and is not in this file.
///
/// The indicator rules are MATRIX-SPEC Axis 5: I0 none,
/// I1 active (data flowing now), I2 used this session (latched),
/// I3 plugged, I4 attempted/denied, I5 sandboxed. The security
/// manager does not draw (ENVIRONMENT-MANAGER.md §6): it owns
/// the state on the window record and the values the shell
/// renders; the window manager renders them.
/// </summary>
public partial class SecurityPolicy : Node
{
    private readonly Dictionary<string, string> _capabilities = new();
    private readonly Dictionary<string, Dictionary<string, string>> _cells = new();
    private readonly Dictionary<string, Dictionary<string, string>> _plugs = new();
    private readonly Dictionary<string, string> _profileNames = new();

    public bool LoadProfiles(string path)
    {
        var parsed = Json.ParseString(FileAccess.GetFileAsString(path));
        if (parsed.VariantType != Variant.Type.Dictionary) return false;
        var root = parsed.AsGodotDictionary();
        foreach (var kv in root["capabilities"].AsGodotDictionary())
            _capabilities[kv.Key.AsString()] = kv.Value.AsString();
        foreach (var kv in root["profiles"].AsGodotDictionary())
        {
            var pid = kv.Key.AsString();
            var p = kv.Value.AsGodotDictionary();
            _profileNames[pid] = p["name"].AsString();
            _cells[pid] = new Dictionary<string, string>();
            foreach (var cell in p["cells"].AsGodotDictionary())
                _cells[pid][cell.Key.AsString()] = cell.Value.AsString();
            _plugs[pid] = new Dictionary<string, string>();
            foreach (var plug in p["plugs"].AsGodotDictionary())
                _plugs[pid][plug.Key.AsString()] = plug.Value.AsString();
        }
        return _cells.Count == 4 && _capabilities.Count == 11;
    }

    public string[] ProfileIds() => new List<string>(_cells.Keys).ToArray();
    public string ProfileName(string profile) =>
        _profileNames.TryGetValue(profile, out var n) ? n : "";
    public string CapabilityName(string capability) =>
        _capabilities.TryGetValue(capability, out var n) ? n : "";

    /// <summary>The matrix cell: ALLOW / ASK / PLUG / DENY /
    /// SANDBOX, or "" when the profile or capability is unknown.</summary>
    public string Disposition(string profile, string capability) =>
        _cells.TryGetValue(profile, out var cells) &&
        cells.TryGetValue(capability, out var d) ? d : "";

    /// <summary>The plug a PLUG cell redirects to (Axis 4 names),
    /// or "" when the cell names none.</summary>
    public string PlugFor(string profile, string capability) =>
        _plugs.TryGetValue(profile, out var plugs) &&
        plugs.TryGetValue(capability, out var p) ? p : "";
}

/// <summary>
/// Indicator state per app + capability, computed from the
/// disposition in force (Axis 5). Engagement is reported by the
/// guard at runtime; at this slice's scope the tracker is fed
/// the MATRIX-SPEC's own worked examples (§ worked examples
/// after Axis 5) and computes the states the shell will render.
/// </summary>
public class IndicatorTracker
{
    private readonly Dictionary<string, string> _states = new();

    private static string Key(string app, string capability) => app + "|" + capability;

    public string State(string app, string capability) =>
        _states.TryGetValue(Key(app, capability), out var s) ? s : "I0";

    /// <summary>An app engages a capability under a disposition.
    /// flowing: data is moving right now. Returns the new state.</summary>
    public string Engage(string app, string capability, string disposition, bool flowing)
    {
        string state = disposition switch
        {
            "DENY" => "I4",          // attempted / denied, latched
            "PLUG" => "I3",          // plugged, for as long as it engages
            "SANDBOX" => "I5",       // contained
            "ALLOW" => flowing ? "I1" : "I2",
            "ASK" => flowing ? "I1" : "I2",  // an ASK the user granted engages like ALLOW
            _ => "I0",
        };
        _states[Key(app, capability)] = state;
        return state;
    }

    /// <summary>The flow stops: an active indicator latches to
    /// used-this-session (I1 → I2). Other states are unaffected.</summary>
    public string FlowStopped(string app, string capability)
    {
        var k = Key(app, capability);
        if (_states.TryGetValue(k, out var s) && s == "I1")
            _states[k] = "I2";
        return State(app, capability);
    }

    /// <summary>The app closes: its indicators clear (Axis 5:
    /// I2/I3/I4 all end at app close).</summary>
    public void AppClosed(string app)
    {
        var prefix = app + "|";
        var dead = new List<string>();
        foreach (var k in _states.Keys)
            if (k.StartsWith(prefix)) dead.Add(k);
        foreach (var k in dead) _states.Remove(k);
    }
}

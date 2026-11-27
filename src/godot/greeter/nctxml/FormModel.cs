using Godot;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Xml.Linq;

/// <summary>
/// The XForms offshoot (NCTXML.md §11): a model layer under
/// NCTXML. A .nctform file declares the form as DATA —
///   instance    the data itself, as an XML tree: serializable,
///               diffable, storable (the topics file's "stores
///               form data well");
///   bind        per-node type + constraints: required, readonly,
///               relevant (skip logic), calculate — the
///               validation and business-logic layer, declarative;
///   submission  a named transaction: validate, then call the
///               host's action with the instance (§9's deferred
///               transactional submit semantics, arriving here);
///   layout      ANNOTATIONS: layout hints in the platform's own
///               layout vocabulary (the NCTGraphite grid terms —
///               container, columns, areas, breakpoints; per-field
///               area/row/column/span/order). Per the topics
///               file's XForms 2.0 extension-module pattern, the
///               annotations ride with the form so a form of data
///               can be rendered with a default layout — and a
///               hand-written NCTXML view may ignore them and lay
///               the same fields out any way it likes. Both are
///               proven against one shared instance.
///
/// The instance IS an NctDataObject (paths are its keys), so the
/// existing binding engine drives form views unchanged.
/// </summary>
public class FormBind
{
    public string Node;
    public string Type = "string";       // string | number | boolean
    public bool Required;
    public bool ReadOnly;
    public string Relevant;              // expression or null
    public string Calculate;             // expression or null
    public string Label;                 // auto-view label
    public string Control;               // auto-view control hint
    public bool Secret;                  // auto-view: masked input
    public Dictionary<string, string> Layout = new();  // annotation
}

public class FormSubmission
{
    public string Id;
    public string Action;                // host method name
    public string Label;                 // auto-view button label
    public string ErrorTarget;           // instance node for errors
}

public partial class FormInstance : NctDataObject
{
    private readonly XDocument _xml;
    private readonly XElement _root;

    public FormInstance(XDocument xml)
    {
        _xml = xml;
        _root = xml.Root;
        // Seed the bag from the tree (leaves only).
        foreach (var leaf in Leaves(_root, ""))
            base.Set(leaf.Item1, leaf.Item2);
        // Every later Set writes through to the tree when the
        // path names a node; bag-only keys (host extras like a
        // clock) live in the bag alone.
        Connect(SignalName.PropertyChanged,
            Callable.From<string>(SyncToXml));
    }

    public string RootName => _root.Name.LocalName;

    /// <summary>Paths are relative to the instance root; an
    /// absolute XForms-style ref (/login/password) normalizes by
    /// dropping the root segment.</summary>
    public string Normalize(string path)
    {
        if (string.IsNullOrEmpty(path)) return path;
        var p = path.Trim();
        if (p.StartsWith("/"))
        {
            var parts = p.Split('/', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length > 0 && parts[0] == RootName)
                parts = parts.Skip(1).ToArray();
            p = string.Join("/", parts);
        }
        return p;
    }

    public string Text(string path)
    {
        var v = Get(Normalize(path));
        return v.VariantType switch
        {
            Variant.Type.Nil => "",
            Variant.Type.Bool => v.AsBool() ? "true" : "false",
            Variant.Type.Float => v.AsDouble().ToString("0.####",
                CultureInfo.InvariantCulture),
            _ => v.ToString(),
        };
    }

    private void SyncToXml(string name)
    {
        var el = Find(Normalize(name));
        if (el != null && !el.HasElements)
            el.Value = Text(name);
    }

    public XElement Find(string path)
    {
        if (string.IsNullOrEmpty(path)) return _root;
        var cur = _root;
        foreach (var seg in path.Split('/'))
        {
            cur = cur.Elements().FirstOrDefault(e => e.Name.LocalName == seg);
            if (cur == null) return null;
        }
        return cur;
    }

    private static IEnumerable<(string, string)> Leaves(XElement el, string prefix)
    {
        foreach (var child in el.Elements())
        {
            var p = prefix.Length == 0 ? child.Name.LocalName
                                       : prefix + "/" + child.Name.LocalName;
            if (child.HasElements)
            {
                // A repeated element (same name twice) is a list,
                // not a leaf: items are read via GetItems.
                if (el.Elements(child.Name).Count() > 1) continue;
                foreach (var l in Leaves(child, p)) yield return l;
            }
            else yield return (p, child.Value ?? "");
        }
    }

    /// <summary>Repeated nodes (medications/med, items/item):
    /// one scoped data object per element, two-way synced to its
    /// element; a Set on an item also raises the repeat path on
    /// the instance so views can refresh.</summary>
    public List<NctDataObject> GetItems(string repeatPath)
    {
        var path = Normalize(repeatPath);
        var idx = path.LastIndexOf('/');
        var parentPath = idx < 0 ? "" : path.Substring(0, idx);
        var itemName = idx < 0 ? path : path.Substring(idx + 1);
        var parent = Find(parentPath);
        var items = new List<NctDataObject>();
        if (parent == null) return items;
        foreach (var el in parent.Elements().Where(e => e.Name.LocalName == itemName))
            items.Add(new FormItemObject(this, path, el));
        return items;
    }

    public string Serialize() => _xml.ToString();
}

/// <summary>One repeated element as a scoped data object
/// (FormInstance.GetItems). Top-level because Godot's source
/// generators only process top-level GodotObject types.</summary>
public partial class FormItemObject : NctDataObject
{
    public FormItemObject(FormInstance owner, string repeatPath, XElement el)
    {
        foreach (var child in el.Elements())
            if (!child.HasElements) base.Set(child.Name.LocalName, child.Value ?? "");
        Connect(SignalName.PropertyChanged, Callable.From<string>(name =>
        {
            var c = el.Elements().FirstOrDefault(e => e.Name.LocalName == name);
            if (c != null && !c.HasElements) c.Value = Get(name).ToString();
            owner.EmitSignal(SignalName.PropertyChanged, repeatPath);
        }));
    }
}

public partial class NctFormModel : GodotObject
{
    public FormInstance Instance { get; private set; }
    public List<FormBind> Binds { get; } = new();
    public List<FormSubmission> Submissions { get; } = new();
    public Dictionary<string, string> LayoutSpec { get; } = new();
    public GodotObject Host { get; set; }
    public string LastError { get; private set; } = "";

    private readonly List<(Control, string)> _tracked = new();
    private bool _recalculating;
    private readonly HashSet<string> _pending = new();

    public bool IsPending(string id) => _pending.Contains(id);

    /// <summary>Complete a pending submission: the outcome lands
    /// in the error target (message or cleared), like a
    /// synchronous result.</summary>
    public string ResolveSubmission(string id, bool ok, string message = "")
    {
        _pending.Remove(id);
        var sub = Submissions.FirstOrDefault(s => s.Id == id);
        if (sub?.ErrorTarget != null)
            Instance.Set(Instance.Normalize(sub.ErrorTarget), ok ? "" : message);
        LastError = ok ? "" : message;
        return ok ? "ok" : "failed";
    }

    public static NctFormModel Load(string path)
    {
        var model = new NctFormModel();
        var text = FileAccess.GetFileAsString(path);
        if (string.IsNullOrEmpty(text))
        {
            GD.PushError($"nctform: cannot read {path}");
            return model;
        }
        var doc = XDocument.Parse(text);
        var root = doc.Root;
        var instEl = root.Elements().FirstOrDefault(e => e.Name.LocalName == "instance");
        var dataRoot = instEl?.Elements().FirstOrDefault();
        if (dataRoot == null)
        {
            GD.PushError($"nctform: {path} has no instance data");
            return model;
        }
        model.Instance = new FormInstance(new XDocument(dataRoot));
        foreach (var el in root.Elements())
        {
            switch (el.Name.LocalName)
            {
                case "bind":
                    var b = new FormBind
                    {
                        Node = model.Instance.Normalize(Attr(el, "node") ?? ""),
                        Type = Attr(el, "type") ?? "string",
                        Required = Attr(el, "required") == "true",
                        ReadOnly = Attr(el, "readonly") == "true",
                        Relevant = Attr(el, "relevant"),
                        Calculate = Attr(el, "calculate"),
                        Label = Attr(el, "label"),
                        Control = Attr(el, "control"),
                        Secret = Attr(el, "secret") == "true",
                    };
                    var lay = el.Elements().FirstOrDefault(e => e.Name.LocalName == "layout");
                    if (lay != null)
                        foreach (var a in lay.Attributes())
                            b.Layout[a.Name.LocalName] = a.Value;
                    model.Binds.Add(b);
                    break;
                case "submission":
                    model.Submissions.Add(new FormSubmission
                    {
                        Id = Attr(el, "id") ?? "",
                        Action = Attr(el, "action") ?? "",
                        Label = Attr(el, "label"),
                        ErrorTarget = Attr(el, "errorTarget"),
                    });
                    break;
                case "layout":
                    foreach (var a in el.Attributes())
                        model.LayoutSpec[a.Name.LocalName] = a.Value;
                    break;
            }
        }
        // Typed values: boolean/number binds hold typed Variants
        // in the bag (the tree keeps their canonical text), so
        // bindings push correctly-typed values into controls.
        foreach (var b in model.Binds)
        {
            if (b.Node.Contains("/")) continue;
            var t = model.Instance.Text(b.Node);
            if (b.Type == "boolean")
                model.Instance.Set(b.Node, t == "true");
            else if (b.Type == "number" && double.TryParse(t,
                NumberStyles.Float, CultureInfo.InvariantCulture, out var d))
                model.Instance.Set(b.Node, d);
        }
        // Constraint machinery: any instance change re-runs
        // calculate + relevance + readonly state.
        model.Instance.Connect(NctDataObject.SignalName.PropertyChanged,
            Callable.From<string>(_ => model.Recalculate()));
        model.Recalculate();
        return model;
    }

    private static string Attr(XElement el, string name) =>
        el.Attributes().FirstOrDefault(a => a.Name.LocalName == name)?.Value;

    public FormBind BindFor(string node) =>
        Binds.FirstOrDefault(b => b.Node == Instance.Normalize(node));

    public bool IsRelevant(FormBind b) =>
        b.Relevant == null || FormExpr.Truthy(
            FormExpr.Eval(b.Relevant, p => Instance.Text(p)));

    public bool IsReadOnly(FormBind b) => b.ReadOnly || b.Calculate != null;

    private void Recalculate()
    {
        if (_recalculating || Instance == null) return;
        _recalculating = true;
        // Two passes: a calculate may feed another calculate.
        for (int pass = 0; pass < 2; pass++)
            foreach (var b in Binds)
                if (b.Calculate != null)
                {
                    var v = FormExpr.Eval(b.Calculate, p => Instance.Text(p));
                    var s = v is double d
                        ? d.ToString("0.####", CultureInfo.InvariantCulture)
                        : v?.ToString() ?? "";
                    if (Instance.Text(b.Node) != s) Instance.Set(b.Node, s);
                }
        _recalculating = false;
        ApplyStates();
    }

    // ---------------------------------------------------------------
    // Live view state: tracked controls follow relevance/readonly.
    // ---------------------------------------------------------------
    public void TrackControl(Control control, string node)
    {
        _tracked.Add((control, Instance.Normalize(node)));
        ApplyStates();
    }

    private void ApplyStates()
    {
        foreach (var (control, node) in _tracked)
        {
            if (!GodotObject.IsInstanceValid(control)) continue;
            var b = BindFor(node);
            if (b == null) continue;
            control.Visible = IsRelevant(b);
            bool ro = IsReadOnly(b);
            switch (control)
            {
                case LineEdit le: le.Editable = !ro; break;
                case TextEdit te: te.Editable = !ro; break;
                case BaseButton bb: bb.Disabled = ro; break;
            }
        }
    }

    // ---------------------------------------------------------------
    // Validation + submission (transactional: §9 via §11).
    // ---------------------------------------------------------------
    public List<(string, string)> Validate()
    {
        var errors = new List<(string, string)>();
        foreach (var b in Binds)
        {
            if (!IsRelevant(b)) continue;
            var v = Instance.Text(b.Node);
            var label = b.Label ?? b.Node;
            if (b.Required && v.Trim().Length == 0)
                errors.Add((b.Node, $"{label} is required"));
            else if (b.Type == "number" && v.Trim().Length > 0
                     && !double.TryParse(v, NumberStyles.Float,
                         CultureInfo.InvariantCulture, out _))
                errors.Add((b.Node, $"{label} must be a number"));
        }
        return errors;
    }

    /// <summary>Validate, then call the host action with the
    /// instance. Host returns: true/null = success; false =
    /// failure (the host has set its own status); a string =
    /// failure with that message. Returns "ok" | "invalid" |
    /// "failed".</summary>
    public string Submit(string id)
    {
        var sub = Submissions.FirstOrDefault(s => s.Id == id);
        if (sub == null) { LastError = $"no submission '{id}'"; return "invalid"; }
        var errors = Validate();
        if (errors.Count > 0)
        {
            LastError = errors[0].Item2;
            if (sub.ErrorTarget != null)
                Instance.Set(Instance.Normalize(sub.ErrorTarget), LastError);
            return "invalid";
        }
        if (Host == null || sub.Action.Length == 0)
        { LastError = "submission has no host action"; return "failed"; }
        // Async hosts (the greeter's bridge conversation is the
        // first) may resolve the submission DURING the call —
        // a connect failure is known synchronously — so snapshot
        // the error target before calling.
        var errorBefore = sub.ErrorTarget != null
            ? Instance.Text(sub.ErrorTarget) : null;
        var result = new Callable(Host, sub.Action).Call(Instance);
        if (result.VariantType == Variant.Type.Dictionary)
        {
            var d = result.AsGodotDictionary();
            if (d.TryGetValue("state", out var st) && st.AsString() == "pending")
            {
                if (sub.ErrorTarget != null
                    && Instance.Text(sub.ErrorTarget) != errorBefore)
                    return "failed";  // already resolved in-call
                _pending.Add(sub.Id);
                return "pending";
            }
        }
        if (result.VariantType == Variant.Type.String)
        {
            LastError = result.AsString();
            if (sub.ErrorTarget != null)
                Instance.Set(Instance.Normalize(sub.ErrorTarget), LastError);
            return "failed";
        }
        if (result.VariantType == Variant.Type.Bool && !result.AsBool())
            return "failed";
        LastError = "";
        if (sub.ErrorTarget != null)
            Instance.Set(Instance.Normalize(sub.ErrorTarget), "");
        return "ok";
    }
}

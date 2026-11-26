using Godot;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Xml.Linq;

/// <summary>
/// The NCTXML renderer (plans/NCTXML.md §4): a runtime interpreter.
/// XML parse → namespace resolution → control registry → logical
/// tree → visual tree → properties, handlers, bindings → layout.
/// The same library runs in every hosting (shell / app / embedded);
/// the host supplies the DataContext and the handler target.
/// Preview documents are enforced read-only + no-code HERE, by
/// kind — a host never has to trust the file (§2).
/// </summary>
public partial class NctXmlRenderer : RefCounted
{
    public readonly ControlRegistry Registry = ControlRegistry.Stock();

    private class ComponentDef
    {
        public string Name;
        public List<(string Name, string Type, string Default)> Props = new();
        public XElement Template;
    }

    private readonly Dictionary<string, ComponentDef> _components = new();
    private static readonly HashSet<string> Kinds =
        new() { "component", "pane", "preview", "window", "app", "shell" };

    // ---------------------------------------------------------------
    // Component library (§2: a component file's root is its class
    // declaration, usable from any other file by namespace)
    // ---------------------------------------------------------------
    public bool RegisterComponentFile(string path, NctDocument diag = null)
    {
        var root = ParseFile(path, diag);
        if (root == null || root.Name.LocalName != "component") return false;
        var def = new ComponentDef { Name = Attr(root, "Name") };
        if (string.IsNullOrEmpty(def.Name)) return false;
        foreach (var el in root.Elements())
        {
            if (el.Name.LocalName == "properties")
                foreach (var p in el.Elements().Where(e => e.Name.LocalName == "property"))
                    def.Props.Add((Attr(p, "Name"), Attr(p, "Type") ?? "string", Attr(p, "Default") ?? ""));
            else if (def.Template == null)
                def.Template = el;
        }
        if (def.Template == null) return false;
        _components[def.Name] = def;
        return true;
    }

    public bool HasComponent(string name) => _components.ContainsKey(name);

    // ---------------------------------------------------------------
    // Load + build one document
    // ---------------------------------------------------------------
    public NctDocument Load(string path, GodotObject host, NctDataObject dataContext)
    {
        var doc = new NctDocument { DataContext = dataContext };
        var rootEl = ParseFile(path, doc);
        if (rootEl == null) { doc.Kind = "error"; return doc; }

        var kind = rootEl.Name.LocalName;
        if (!Kinds.Contains(kind))
        {
            doc.Note($"unknown root kind '{kind}' in {path}");
            doc.Kind = "error";
            return doc;
        }
        doc.Kind = kind;
        if (kind == "component")
        {
            doc.Note("a component file declares a class; register it, do not load it as a document");
            return doc;
        }

        var root = new Control { Name = System.IO.Path.GetFileNameWithoutExtension(path) };
        root.SetAnchorsPreset(Control.LayoutPreset.FullRect);
        doc.Root = root;

        var ctx = new NctRenderContext
        {
            Renderer = this, Kind = kind, DataContext = dataContext,
            Host = host, Document = doc,
        };

        string baseDir = path.GetBaseDir();
        if (kind == "app")
        {
            doc.Manifest["id"] = Attr(rootEl, "Id") ?? "";
            doc.Manifest["name"] = Attr(rootEl, "Name") ?? "";
            doc.Manifest["requested_style"] = Attr(rootEl, "RequestedStyle") ?? "normal";
            doc.Manifest["single_instance"] =
                (Attr(rootEl, "SingleInstance") ?? "true") == "true";
            root.Name = Attr(rootEl, "Name") ?? root.Name;
        }
        if (kind == "preview")
            doc.Manifest["for"] = Attr(rootEl, "For") ?? "";
        if (kind == "window" && Attr(rootEl, "Title") is string t)
            root.Name = t;

        foreach (var child in rootEl.Elements())
        {
            // Metadata elements are consumed, never rendered.
            if (kind == "app" && child.Name.LocalName == "settings")
            {
                var src = Attr(child, "Src");
                if (src != null) doc.Manifest["settings_src"] = baseDir.PathJoin(src);
                continue;
            }
            var visual = BuildNode(child, ctx);
            if (visual != null) root.AddChild(visual);
        }

        if (kind == "preview") EnforcePreview(root, doc);
        return doc;
    }

    // ---------------------------------------------------------------
    // The build: one logical node → its visual subtree
    // ---------------------------------------------------------------
    private Control BuildNode(XElement el, NctRenderContext ctx)
    {
        if (el.Name.NamespaceName == "nct")
            return BuildComponentInstance(el, ctx);

        var name = el.Name.LocalName;
        if (!Registry.TryGet(name, out var entry))
        {
            ctx.Document.Note($"unknown element <{name}> — placeholder substituted");
            var ph = new Label { Text = $"<{name}?>" };
            return ph;
        }

        var attrs = el.Attributes()
            .Where(a => !a.IsNamespaceDeclaration)
            .ToDictionary(a => a.Name.LocalName, a => a.Value);

        var control = entry.Factory(attrs);
        if (attrs.TryGetValue("Name", out var nodeName)) control.Name = nodeName;

        // DataContext scoping (§9): a node may scope the context to
        // a named sub-object; descendants inherit it.
        var nodeCtx = ctx;
        if (attrs.TryGetValue("DataContext", out var dcName) && ctx.DataContext != null)
        {
            var sub = ctx.DataContext.Get(dcName).AsGodotObject() as NctDataObject;
            if (sub != null)
                nodeCtx = new NctRenderContext
                {
                    Renderer = this, Kind = ctx.Kind, DataContext = sub,
                    Host = ctx.Host, Document = ctx.Document,
                    RadioGroups = ctx.RadioGroups,
                };
            else
                ctx.Document.Note($"DataContext '{dcName}' not found on the parent context");
        }

        foreach (var (attr, value) in attrs)
        {
            if (attr is "Name" or "DataContext") continue;
            ApplyAttribute(control, entry, attr, value, nodeCtx);
        }

        // Element text → Text property (Label, Button, …)
        if (!el.Elements().Any() && !string.IsNullOrWhiteSpace(el.Value))
        {
            try { control.Set("text", el.Value.Trim()); }
            catch { ctx.Document.Note($"<{name}> has text content but no Text property"); }
        }

        foreach (var childEl in el.Elements())
        {
            var child = BuildNode(childEl, nodeCtx);
            if (child == null) continue;
            control.AddChild(child);
            PostPlaceChild(control, child, childEl);
        }
        return control;
    }

    private void PostPlaceChild(Control parent, Control child, XElement childEl)
    {
        var dock = Attr(childEl, "Dock");
        if (parent is DockContainer && dock != null)
            child.SetMeta("dock", dock);
        if (parent is TabContainer tc)
        {
            var title = Attr(childEl, "Title");
            if (title != null) tc.SetTabTitle(tc.GetChildCount() - 1, title);
        }
        if (Attr(childEl, "Expand") == "true")
        {
            if (parent is VBoxContainer) child.SizeFlagsVertical = Control.SizeFlags.ExpandFill;
            else if (parent is HBoxContainer) child.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill;
            else { child.SizeFlagsHorizontal = Control.SizeFlags.ExpandFill; child.SizeFlagsVertical = Control.SizeFlags.ExpandFill; }
        }
    }

    private void ApplyAttribute(Control control, NctControlEntry entry,
        string attr, string value, NctRenderContext ctx)
    {
        var doc = ctx.Document;

        // Layout attributes are consumed by the parent's placement
        // pass (PostPlaceChild), never set as properties.
        if (attr is "Dock" or "Expand" or "Title") return;

        // Handlers: on<Signal>="MethodName" on the host (§6.2).
        if (attr.Length > 2 && attr.StartsWith("on") && char.IsUpper(attr[2]))
        {
            if (ctx.Kind == "preview")
            {
                doc.BlockedHandlers++;
                doc.Note($"preview: handler '{attr}' not wired (no code execution by kind)");
                return;
            }
            if (ctx.Host == null) { doc.Note($"handler '{attr}' has no host to wire to"); return; }
            var signal = PascalToSnake(attr.Substring(2));
            try { control.Connect(signal, new Callable(ctx.Host, value)); }
            catch { doc.Note($"cannot wire handler '{attr}' → {value} (signal '{signal}')"); }
            return;
        }

        // Bindings (§9).
        if (BindingSpec.IsBinding(value))
        {
            var spec = BindingSpec.Parse(value);
            if (ctx.DataContext == null) { doc.Note($"binding '{attr}' with no DataContext"); return; }
            var mode = spec.Mode;
            if (ctx.Kind == "preview" && mode == "TwoWay")
            {
                mode = "OneWay";
                doc.Note($"preview: binding '{attr}' downgraded TwoWay → OneWay (read-only by kind)");
            }
            var prop = entry.Aliases.TryGetValue(attr, out var alias) ? alias : attr;
            var link = new BindingLink();
            doc.KeepAlive(link);
            link.BindControl(control, entry, prop,
                new BindingSpec { Path = spec.Path, Mode = mode, Converter = spec.Converter },
                ctx.DataContext);
            return;
        }

        // Registry-handled attributes (Items, Src, Group, …).
        if (entry.ApplyAttr != null && entry.ApplyAttr(control, attr, value, ctx))
            return;

        // Plain typed property.
        var target = entry.Aliases.TryGetValue(attr, out var a2) ? a2 : attr;
        SetConverted(control, target, value, doc, attr);
    }

    // ---------------------------------------------------------------
    // Component instances: <nct:LabelledSlider Value="{Volume}"/>
    // The instance's property bag is the template's DataContext;
    // instance attributes bind the bag to the outer context (§2).
    // ---------------------------------------------------------------
    private Control BuildComponentInstance(XElement el, NctRenderContext ctx)
    {
        var name = el.Name.LocalName;
        if (!_components.TryGetValue(name, out var def))
        {
            ctx.Document.Note($"component '{name}' is not registered");
            return new Label { Text = $"<nct:{name}?>" };
        }

        var bag = new NctDataObject();
        foreach (var (pName, pType, pDefault) in def.Props)
            bag.Set(pName, ParseTyped(pDefault, pType));

        var outer = ctx.DataContext;
        foreach (var attr in el.Attributes().Where(x => !x.IsNamespaceDeclaration))
        {
            var attrName = attr.Name.LocalName;
            var declared = def.Props.FirstOrDefault(p => p.Name == attrName);
            if (declared.Name == null)
            {
                if (attrName != "Name")
                    ctx.Document.Note($"component '{name}' has no property '{attrName}'");
                continue;
            }
            if (BindingSpec.IsBinding(attr.Value) && outer != null)
            {
                var spec = BindingSpec.Parse(attr.Value);
                var mode = spec.Mode;
                if (ctx.Kind == "preview" && mode == "TwoWay") mode = "OneWay";
                ObjectLink.Link(outer, spec.Path, bag, attrName, mode, ctx.Document);
            }
            else
            {
                bag.Set(attrName, ParseTyped(attr.Value, declared.Type));
            }
        }

        var templateCtx = new NctRenderContext
        {
            Renderer = this, Kind = ctx.Kind, DataContext = bag,
            Host = ctx.Host, Document = ctx.Document, RadioGroups = ctx.RadioGroups,
        };
        var visual = BuildNode(def.Template, templateCtx);
        var instName = Attr(el, "Name");
        visual.Name = instName ?? name;
        visual.SetMeta("nct_component", name);
        return visual;
    }

    // ---------------------------------------------------------------
    // Preview enforcement (§2): read-only + no code, by kind.
    // ---------------------------------------------------------------
    private void EnforcePreview(Control root, NctDocument doc)
    {
        int count = 0;
        void Walk(Node n)
        {
            switch (n)
            {
                // Derived button types first: OptionButton and
                // CheckBox are Buttons, and each has its own
                // read-only shape.
                case OptionButton ob: ob.Disabled = true; count++; break;
                case CheckBox cb: cb.Disabled = true; count++; break;
                case Button b: b.Disabled = true; count++; break;
                case LineEdit le: le.Editable = false; count++; break;
                case TextEdit te: te.Editable = false; count++; break;
                case HSlider hs: hs.Editable = false; count++; break;
            }
            if (n is Control c) c.FocusMode = Control.FocusModeEnum.None;
            foreach (var child in n.GetChildren()) Walk(child);
        }
        Walk(root);
        doc.ReadOnlyEnforced = count;
        doc.Note($"preview: {count} controls made read-only by the renderer");
    }

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------
    private XElement ParseFile(string path, NctDocument diag)
    {
        try
        {
            var text = FileAccess.GetFileAsString(path);
            if (string.IsNullOrEmpty(text)) { diag?.Note($"cannot read {path}"); return null; }
            return XDocument.Parse(text).Root;
        }
        catch (Exception e)
        {
            diag?.Note($"XML parse failed for {path}: {e.Message}");
            return null;
        }
    }

    private static string Attr(XElement el, string name) =>
        el.Attributes().FirstOrDefault(a => a.Name.LocalName == name)?.Value;

    public static Variant ParseTyped(string value, string type)
    {
        switch (type)
        {
            case "float": return double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var d) ? d : 0.0;
            case "int": return long.TryParse(value, out var l) ? l : 0;
            case "bool": return value == "true";
            default: return value;
        }
    }

    public static void SetConverted(Control c, string prop, string value, NctDocument doc, string attrForMsg)
    {
        var engineProp = ToEngineName(prop);
        Variant current;
        try { current = c.Get(engineProp); }
        catch { doc.Note($"no property '{prop}' for attribute '{attrForMsg}'"); return; }
        Variant v;
        switch (current.VariantType)
        {
            case Variant.Type.Float: v = double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var d) ? d : 0.0; break;
            case Variant.Type.Int: v = long.TryParse(value, out var l) ? l : 0; break;
            case Variant.Type.Bool: v = value == "true"; break;
            default: v = value; break;
        }
        c.Set(engineProp, v);
    }

    public static Texture2D LoadTexture(string path)
    {
        if (string.IsNullOrEmpty(path)) return null;
        if (path.StartsWith("res://") || path.StartsWith("user://"))
            return GD.Load<Texture2D>(path);
        var img = Image.LoadFromFile(path);
        return img != null ? ImageTexture.CreateFromImage(img) : null;
    }

    /// <summary>Engine property/signal names are snake_case; NCTXML
    /// attributes and the registry use PascalCase. Every Set/Get that
    /// crosses into the engine goes through this conversion.</summary>
    public static string ToEngineName(string s) => PascalToSnake(s);

    private static string PascalToSnake(string s)
    {
        var chars = new List<char>();
        for (int i = 0; i < s.Length; i++)
        {
            if (char.IsUpper(s[i]) && i > 0) chars.Add('_');
            chars.Add(char.ToLower(s[i]));
        }
        return new string(chars.ToArray());
    }
}

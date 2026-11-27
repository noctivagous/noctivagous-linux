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
    public NctDocument Load(string path, GodotObject host, NctDataObject dataContext,
        NctFormModel modelOverride = null)
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

        string baseDir = path.GetBaseDir();
        doc.BaseDir = baseDir;

        // The XForms layer (§11): a view may declare Model=
        // "file.nctform". The model's instance becomes the
        // DataContext (host-supplied keys the instance lacks are
        // merged in as bag-only extras — a clock, a title), binds
        // drive live relevance/readonly state on bound controls,
        // and submissions become callable from the view.
        var effectiveContext = dataContext;
        NctFormModel formModel = null;
        if (modelOverride != null)
        {
            formModel = modelOverride;
            formModel.Host = host;
            doc.Model = formModel;
            if (formModel.Instance != null)
            {
                effectiveContext = formModel.Instance;
                doc.DataContext = effectiveContext;
            }
        }
        else if (Attr(rootEl, "Model") is string modelRef)
        {
            formModel = NctFormModel.Load(baseDir.PathJoin(modelRef));
            formModel.Host = host;
            doc.Model = formModel;
            if (formModel.Instance != null)
            {
                if (dataContext != null)
                    foreach (var key in dataContext.Keys)
                        if (!formModel.Instance.Has(key))
                            formModel.Instance.Set(key, dataContext.Get(key));
                effectiveContext = formModel.Instance;
                doc.DataContext = effectiveContext;
            }
            else doc.Note($"model '{modelRef}' failed to load");
        }

        var ctx = new NctRenderContext
        {
            Renderer = this, Kind = kind, DataContext = effectiveContext,
            Host = host, Document = doc, Model = formModel,
        };

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
        if (kind == "shell")
        {
            // Shell furniture (NCTXML.md §2): identity + the style
            // it requests from the window manager (panel by
            // default — a bar or side tab; dashboard for a pinned
            // widget).
            doc.Manifest["id"] = Attr(rootEl, "Id") ?? "";
            doc.Manifest["name"] = Attr(rootEl, "Name") ?? "";
            doc.Manifest["requested_style"] = Attr(rootEl, "RequestedStyle") ?? "panel";
        }
        if (kind == "window" && Attr(rootEl, "Title") is string t)
            root.Name = t;

        var visuals = new List<Control>();
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
            if (visual != null) { root.AddChild(visual); visuals.Add(visual); }
        }
        // A document has one content root: it fills the document.
        // (Without this, a top-level container keeps its minimum
        // size inside the wrapper and nothing downstream lays out —
        // found by the E1 hosting smoke, where a Grid inside a
        // Stack rendered at content size inside a 400px document.)
        if (visuals.Count == 1)
            visuals[0].SetAnchorsPreset(Control.LayoutPreset.FullRect);

        if (kind == "preview") EnforcePreview(root, doc);
        return doc;
    }

    /// <summary>Render a form's auto-view as a whole document
    /// (the XForms layer standing alone: model + annotations, no
    /// hand-written view). Hosts that already hold the model —
    /// tests, embedders — pass it in, so several views can share
    /// one instance.</summary>
    public NctDocument LoadAutoForm(NctFormModel model, GodotObject host)
    {
        var doc = new NctDocument { Kind = "form" };
        model.Host = host;
        doc.Model = model;
        doc.DataContext = model.Instance;
        var root = new Control { Name = "AutoForm" };
        root.SetAnchorsPreset(Control.LayoutPreset.FullRect);
        doc.Root = root;
        var ctx = new NctRenderContext
        {
            Renderer = this, Kind = "form", DataContext = model.Instance,
            Host = host, Document = doc, Model = model,
        };
        var view = BuildFormView(model, ctx);
        root.AddChild(view);
        view.SetAnchorsPreset(Control.LayoutPreset.FullRect);
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

        // <FormView Model="f.nctform"/>: the XForms layer's
        // auto-view — the form rendered from its model + layout
        // annotations alone (§11). A hand-written view may lay
        // the same model out any other way; both bind the one
        // instance.
        if (name == "FormView")
        {
            var modelRef = Attr(el, "Model");
            if (modelRef == null)
            {
                ctx.Document.Note("<FormView> without Model= — placeholder substituted");
                return new Label { Text = "<FormView?>" };
            }
            var fvModel = NctFormModel.Load(ctx.Document.BaseDir.PathJoin(modelRef));
            fvModel.Host = ctx.Host;
            ctx.Document.KeepAlive(fvModel);
            return BuildFormView(fvModel, ctx);
        }

        // <Repeat Items="{path}"> with ONE child element as the
        // item template (§11 names repeats with the XForms
        // layer; the launch bar is the first use). Items come
        // from a form instance's repeated nodes or from an array
        // on the DataContext (objects, or dictionaries wrapped
        // as objects). The repeat rebuilds when the source path
        // changes on the context.
        if (name == "Repeat")
        {
            var itemsAttr = Attr(el, "Items");
            var template = el.Elements().FirstOrDefault();
            if (itemsAttr == null || !BindingSpec.IsBinding(itemsAttr) || template == null)
            {
                ctx.Document.Note("<Repeat> needs Items=\"{path}\" and one template child — placeholder substituted");
                return new Label { Text = "<Repeat?>" };
            }
            var path = BindingSpec.Parse(itemsAttr).Path;
            Control box = Attr(el, "Orientation") == "horizontal"
                ? new HBoxContainer() : new VBoxContainer();
            box.Name = Attr(el, "Name") ?? "Repeat";
            BuildRepeatItems(box, template, path, ctx);
            if (ctx.DataContext != null)
            {
                var capturedCtx = ctx;
                ctx.DataContext.Connect(NctDataObject.SignalName.PropertyChanged,
                    Callable.From<string>(changed =>
                    {
                        if (changed == path && GodotObject.IsInstanceValid(box))
                            BuildRepeatItems(box, template, path, capturedCtx);
                    }));
            }
            return box;
        }

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
                    RadioGroups = ctx.RadioGroups, Model = ctx.Model,
                    RepeatItem = ctx.RepeatItem, Commands = ctx.Commands,
                };
            else
                ctx.Document.Note($"DataContext '{dcName}' not found on the parent context");
        }

        foreach (var (attr, value) in attrs)
        {
            if (attr is "Name" or "DataContext") continue;
            ApplyAttribute(control, entry, attr, value, nodeCtx);
        }

        // The XForms layer in a hand-written view (§11): a
        // control bound to a model node follows the node's live
        // relevance/readonly state, and Submit="id" on a button
        // runs the model's named submission.
        if (ctx.Model != null)
        {
            foreach (var (attr, value) in attrs)
            {
                if (!BindingSpec.IsBinding(value)) continue;
                var p = BindingSpec.Parse(value).Path;
                if (ctx.Model.BindFor(p) != null)
                { ctx.Model.TrackControl(control, p); break; }
            }
            if (attrs.TryGetValue("Submit", out var subId) && control is BaseButton btn)
            {
                var model = ctx.Model; var id = subId;
                btn.Connect(BaseButton.SignalName.Pressed,
                    Callable.From(() => model.Submit(id)));
            }
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
        // Grid placement (§7): consumed by the grid engines'
        // placement pass via child metadata — the same channel
        // Dock uses, so the solver and native engines read
        // identical placement facts.
        if (parent is NctGridContainer || parent.GetClass() == "NctGridNative")
        {
            var area = Attr(childEl, "Area");
            if (area != null) child.SetMeta("grid_area", area);
            if (int.TryParse(Attr(childEl, "Column"), out var gc))
                child.SetMeta("grid_col", gc - 1);
            if (int.TryParse(Attr(childEl, "Row"), out var gr))
                child.SetMeta("grid_row", gr - 1);
            if (int.TryParse(Attr(childEl, "ColumnSpan"), out var gcs))
                child.SetMeta("grid_col_span", gcs);
            if (int.TryParse(Attr(childEl, "RowSpan"), out var grs))
                child.SetMeta("grid_row_span", grs);
        }
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
        if (attr is "Dock" or "Expand" or "Title" or "Submit"
            or "Column" or "Row" or "ColumnSpan" or "RowSpan" or "Area") return;

        // A Grid's own spec attributes are consumed by its
        // registry factory (both engines), never set as properties.
        if ((control is NctGridContainer || control.GetClass() == "NctGridNative")
            && (attr is "Columns" or "Rows" or "Proportions" or "Areas"
                or "Breakpoints" or "Gap" or "Padding" or "Baseline"
                or "BaselineOffset" or "Engine")) return;

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
            try
            {
                // Inside a Repeat template, the handler receives
                // the item as its argument — that is how a launch
                // button knows which entry it is.
                if (ctx.RepeatItem != null)
                {
                    var host = ctx.Host; var method = value; var item = ctx.RepeatItem;
                    control.Connect(signal, Callable.From(
                        () => new Callable(host, method).Call(item)));
                }
                else control.Connect(signal, new Callable(ctx.Host, value));
            }
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

    private void BuildRepeatItems(Control box, XElement template,
        string path, NctRenderContext ctx)
    {
        foreach (var child in box.GetChildren())
        {
            box.RemoveChild(child);
            child.QueueFree();
        }
        foreach (var item in ResolveItems(ctx, path))
        {
            var itemCtx = new NctRenderContext
            {
                Renderer = this, Kind = ctx.Kind, DataContext = item,
                Host = ctx.Host, Document = ctx.Document,
                RadioGroups = ctx.RadioGroups, Model = ctx.Model,
                RepeatItem = item, Commands = ctx.Commands,
            };
            var node = BuildNode(template, itemCtx);
            if (node != null) box.AddChild(node);
        }
    }

    private List<NctDataObject> ResolveItems(NctRenderContext ctx, string path)
    {
        var items = new List<NctDataObject>();
        if (ctx.DataContext is FormInstance form)
        {
            var found = form.GetItems(path);
            if (found.Count > 0) return found;
        }
        var v = ctx.DataContext?.Get(path) ?? default;
        if (v.VariantType == Variant.Type.Array)
        {
            foreach (var el in v.AsGodotArray())
            {
                if (el.AsGodotObject() is NctDataObject o) items.Add(o);
                else if (el.VariantType == Variant.Type.Dictionary)
                {
                    var wrap = new NctDataObject();
                    foreach (var kv in el.AsGodotDictionary())
                        wrap.Set(kv.Key.AsString(), kv.Value);
                    items.Add(wrap);
                }
            }
        }
        return items;
    }

    // ---------------------------------------------------------------
    // The XForms auto-view (§11): render a form from its model +
    // layout annotations alone. The container spec and the
    // per-field placement speak the platform's layout vocabulary
    // (the NCTGraphite grid terms); field controls are chosen by
    // bind type (or the bind's control annotation); submissions
    // become buttons. Nothing here is form-specific — the same
    // builder renders any .nctform.
    // ---------------------------------------------------------------
    private Control BuildFormView(NctFormModel model, NctRenderContext ctx)
    {
        var doc = ctx.Document;
        var instance = model.Instance;
        if (instance == null) return new Label { Text = "<FormView: no instance>" };

        var spec = model.LayoutSpec;
        Control container;
        if (spec.TryGetValue("container", out var c) && c == "grid"
            && Registry.TryGet("Grid", out var gridEntry))
        {
            var keys = new Dictionary<string, string>
            {
                ["columns"] = "Columns", ["rows"] = "Rows",
                ["areas"] = "Areas", ["gap"] = "Gap",
                ["padding"] = "Padding", ["breakpoints"] = "Breakpoints",
                ["proportions"] = "Proportions", ["baseline"] = "Baseline",
                ["baselineOffset"] = "BaselineOffset",
            };
            var attrs = new Dictionary<string, string>();
            foreach (var (from, to) in keys)
                if (spec.TryGetValue(from, out var v)) attrs[to] = v;
            container = gridEntry.Factory(attrs);
        }
        else container = new VBoxContainer();
        container.Name = "FormView";

        // Top-level fields only: a node with '/' belongs to a
        // repeat or a group, rendered by a Repeat or a hand view.
        var fields = model.Binds.Where(b => !b.Node.Contains("/"))
            .OrderBy(b => b.Layout.TryGetValue("order", out var o)
                          && int.TryParse(o, out var n) ? n : 0)
            .ToList();
        foreach (var bind in fields)
        {
            var wrapper = new VBoxContainer { Name = "Field_" + bind.Node };
            if (!string.IsNullOrEmpty(bind.Label))
                wrapper.AddChild(new Label { Text = bind.Label });
            bool ro = model.IsReadOnly(bind);
            var kind = bind.Control
                ?? (ro ? "Label" : bind.Type == "boolean" ? "CheckBox" : "TextField");
            if (!Registry.TryGet(kind, out var entry))
            { doc.Note($"form view: unknown control '{kind}'"); continue; }
            var field = entry.Factory(new Dictionary<string, string>());
            field.Name = "Input_" + bind.Node;
            if (field is LineEdit le && bind.Secret) le.Secret = true;
            var link = new BindingLink();
            doc.KeepAlive(link);
            link.BindControl(field, entry,
                kind == "CheckBox" ? "ButtonPressed" : "Text",
                new BindingSpec
                {
                    Path = bind.Node,
                    Mode = ro ? "OneWay" : "TwoWay",
                }, instance);
            wrapper.AddChild(field);
            container.AddChild(wrapper);
            model.TrackControl(field, bind.Node);
            if (container is NctGridContainer || container.GetClass() == "NctGridNative")
            {
                if (bind.Layout.TryGetValue("area", out var area))
                    wrapper.SetMeta("grid_area", area);
                if (bind.Layout.TryGetValue("column", out var col)
                    && int.TryParse(col, out var ci))
                    wrapper.SetMeta("grid_col", ci - 1);
                if (bind.Layout.TryGetValue("row", out var row)
                    && int.TryParse(row, out var ri))
                    wrapper.SetMeta("grid_row", ri - 1);
                if (bind.Layout.TryGetValue("columnSpan", out var cs)
                    && int.TryParse(cs, out var csi))
                    wrapper.SetMeta("grid_col_span", csi);
                if (bind.Layout.TryGetValue("rowSpan", out var rs)
                    && int.TryParse(rs, out var rsi))
                    wrapper.SetMeta("grid_row_span", rsi);
            }
        }
        foreach (var sub in model.Submissions)
        {
            var b = new Button { Text = sub.Label ?? sub.Id, Name = "Submit_" + sub.Id };
            var m = model; var id = sub.Id;
            b.Connect(BaseButton.SignalName.Pressed,
                Callable.From(() => m.Submit(id)));
            container.AddChild(b);
        }
        return container;
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
            case Variant.Type.Vector2:
                var parts = value.Split(',');
                v = parts.Length == 2
                    && float.TryParse(parts[0], NumberStyles.Float, CultureInfo.InvariantCulture, out var vx)
                    && float.TryParse(parts[1], NumberStyles.Float, CultureInfo.InvariantCulture, out var vy)
                    ? new Vector2(vx, vy) : Vector2.Zero;
                break;
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

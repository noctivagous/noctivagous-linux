using Godot;
using System.Collections.Generic;

/// <summary>
/// The result of rendering one NCTXML file: its kind, its live
/// visual tree, its manifest (app / preview kinds), and the
/// diagnostics the build produced. Hosts keep the document alive
/// for as long as the tree lives — it owns the binding links.
/// </summary>
public partial class NctDocument : GodotObject
{
    public string Kind = "";
    public Control Root;
    public NctDataObject DataContext;
    public NctFormModel Model;   // set when the view declares Model= (the XForms layer, §11)
    public string BaseDir = "";  // the document's directory, for relative model/resource paths
    public Godot.Collections.Dictionary Manifest = new();
    public Godot.Collections.Array<string> Diagnostics = new();
    public int BlockedHandlers;   // preview kind: handlers the renderer refused to wire
    public int ReadOnlyEnforced;  // preview kind: controls the renderer made read-only

    private readonly List<GodotObject> _keepAlive = new();
    public void KeepAlive(GodotObject o) => _keepAlive.Add(o);

    public void Note(string message) => Diagnostics.Add(message);
}

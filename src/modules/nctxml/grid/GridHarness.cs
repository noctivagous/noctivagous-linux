using Godot;
using System;
using System.Collections.Generic;

/// <summary>
/// The NCTXML Grid proof: four documents through the renderer,
/// every claim a MEASURED rect (the layout rule — no claim
/// rests on source intent):
///   areas        named areas + fixed/fr tracks + spans
///   baseline     row pitches quantized to the rhythm unit
///   breakpoint   the grid's own width flips its columns
///   proportions  the AppShell weight form sizes the tracks
/// Prints NCTGRID_OK. The comparison with the native engine
/// lives in GridCompareHarness.
/// </summary>
public partial class GridHarness : Control
{
    private readonly List<string> _failures = new();
    private const float Tol = 0.75f;

    public override void _Ready()
    {
        var renderer = new NctXmlRenderer();

        // --- areas + tracks ---
        var areas = Load(renderer, "grid-areas.nctxml");
        SetSize(areas, 640, 480);
        // columns: 100 fixed, gaps 2x10, remainder 520 -> 173.33 / 346.67
        RectNear(areas, "Nav", new Rect2(0, 0, 100, 480), "nav area");
        RectNear(areas, "Head", new Rect2(110, 0, 530, 48), "head area (span 2)");
        RectNear(areas, "Body", new Rect2(110, 58, 530, 422), "body area");

        // --- baseline rhythm ---
        var baseline = Load(renderer, "grid-baseline.nctxml");
        SetMin(baseline, "R1", 50, 30);
        SetMin(baseline, "R2", 50, 50);
        SetMin(baseline, "R3", 50, 10);
        SetSize(baseline, 300, 400);
        // pitches: ceil(30/24)=48, ceil(50/24)=72, ceil(10/24)=24
        RectNear(baseline, "R1", new Rect2(0, 0, 300, 48), "baseline row 1");
        RectNear(baseline, "R2", new Rect2(0, 48, 300, 72), "baseline row 2");
        RectNear(baseline, "R3", new Rect2(0, 120, 300, 24), "baseline row 3");

        // --- breakpoint on the grid's own width ---
        var bp = Load(renderer, "grid-breakpoint.nctxml");
        SetMin(bp, "A", 10, 50);
        SetMin(bp, "B", 10, 50);
        SetSize(bp, 640, 200);
        var aLow = RectOf(bp, "A");
        var bLow = RectOf(bp, "B");
        Check(Mathf.Abs(bLow.Position.X) < Tol
              && Mathf.Abs(bLow.Position.Y - 50) < Tol,
            $"below the breakpoint the children should stack (A={aLow}, B={bLow})");
        SetSize(bp, 800, 200);
        var aHigh = RectOf(bp, "A");
        var bHigh = RectOf(bp, "B");
        Check(Mathf.Abs(aHigh.Size.X - 200) < Tol
              && Mathf.Abs(bHigh.Position.X - 200) < Tol
              && Mathf.Abs(bHigh.Size.X - 600) < Tol,
            $"above the breakpoint: 200px + 1fr (A={aHigh}, B={bHigh})");

        // --- proportions ---
        var props = Load(renderer, "grid-proportions.nctxml");
        SetMin(props, "A", 10, 100);
        SetMin(props, "B", 10, 100);
        SetMin(props, "C", 10, 100);
        SetSize(props, 400, 100);
        RectNear(props, "A", new Rect2(0, 0, 100, 100), "proportion 1");
        RectNear(props, "B", new Rect2(100, 0, 200, 100), "proportion 2");
        RectNear(props, "C", new Rect2(300, 0, 100, 100), "proportion 1 again");

        if (_failures.Count == 0)
        {
            GD.Print("NCTGRID_OK");
            GetTree().Quit(0);
        }
        else
        {
            foreach (var f in _failures) GD.PrintErr("NCTGRID_FAIL ", f);
            GetTree().Quit(1);
        }
    }

    private Control Load(NctXmlRenderer renderer, string file)
    {
        var doc = renderer.Load("res://nctxml/grid/" + file, this, null);
        AddChild(doc.Root);
        return (Control)doc.Root.GetNode("RootGrid");
    }

    private static void SetSize(Control grid, float w, float h)
    {
        grid.Size = new Vector2(w, h);
    }

    private static void SetMin(Control grid, string name, float w, float h)
    {
        ((Control)grid.GetNode(name)).CustomMinimumSize = new Vector2(w, h);
    }

    private static Rect2 RectOf(Control grid, string name)
        => ((Control)grid.GetNode(name)).GetRect();

    private void RectNear(Control grid, string name, Rect2 want, string what)
    {
        var got = RectOf(grid, name);
        bool ok = Mathf.Abs(got.Position.X - want.Position.X) < Tol
               && Mathf.Abs(got.Position.Y - want.Position.Y) < Tol
               && Mathf.Abs(got.Size.X - want.Size.X) < Tol
               && Mathf.Abs(got.Size.Y - want.Size.Y) < Tol;
        Check(ok, $"{what}: want {want}, got {got}");
    }

    private void Check(bool cond, string what)
    {
        if (!cond) _failures.Add(what);
    }
}

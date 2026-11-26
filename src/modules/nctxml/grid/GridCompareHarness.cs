using Godot;
using System;
using System.Collections.Generic;

/// <summary>
/// The two-engines comparison (the owner's direction: build
/// both, compare what works, allow both). The four grid proof
/// documents render through the solver engine and through the
/// native GDExtension engine (Engine="native" injected into a
/// temp copy); every named child's MEASURED rect must agree.
/// Then a stress grid (2000 cells) times the layout pass of
/// each engine over repeated resizes — the numbers are
/// reported, not judged: what they show decides where each
/// engine earns its place.
///
/// Prints GRID_COMPARE_OK solver_us_per_fit=N native_us_per_fit=M
/// or GRID_COMPARE_FAIL &lt;reason&gt;.
/// </summary>
public partial class GridCompareHarness : Control
{
    private readonly List<string> _failures = new();
    private const float Tol = 0.05f;

    private static readonly (string File, string[] Names)[] Cases =
    {
        ("grid-areas.nctxml", new[] { "Nav", "Head", "Body" }),
        ("grid-baseline.nctxml", new[] { "R1", "R2", "R3" }),
        ("grid-breakpoint.nctxml", new[] { "A", "B" }),
        ("grid-proportions.nctxml", new[] { "A", "B", "C" }),
    };

    public override void _Ready()
    {
        if (!ClassDB.ClassExists("NctGridNative"))
        {
            GD.PrintErr("GRID_COMPARE_FAIL native engine not loaded " +
                        "(NctGridNative missing — is bin/libnctgrid present?)");
            GetTree().Quit(1);
            return;
        }
        var renderer = new NctXmlRenderer();

        foreach (var (file, names) in Cases)
        {
            var solver = LoadDoc(renderer, file, native: false);
            var native = LoadDoc(renderer, file, native: true);
            Check(native.GetClass() == "NctGridNative",
                $"{file}: Engine=native did not produce the native class (got {native.GetClass()})");
            ApplyMins(file, solver);
            ApplyMins(file, native);
            foreach (var size in SizesFor(file))
            {
                solver.Size = size;
                native.Size = size;
                foreach (var name in names)
                {
                    var a = ((Control)solver.GetNode(name)).GetRect();
                    var b = ((Control)native.GetNode(name)).GetRect();
                    Check(Mathf.Abs(a.Position.X - b.Position.X) < Tol
                          && Mathf.Abs(a.Position.Y - b.Position.Y) < Tol
                          && Mathf.Abs(a.Size.X - b.Size.X) < Tol
                          && Mathf.Abs(a.Size.Y - b.Size.Y) < Tol,
                        $"{file} @{size} child {name}: solver {a} vs native {b}");
                }
            }
            solver.GetParent().RemoveChild(solver);
            native.GetParent().RemoveChild(native);
        }

        // --- stress: 2000 cells, repeated refits ---
        const int cells = 2000;
        var solverGrid = BuildStress(native: false, cells);
        var nativeGrid = BuildStress(native: true, cells);
        AddChild(solverGrid);
        AddChild(nativeGrid);
        long solverUs = TimeFits(solverGrid);
        long nativeUs = TimeFits(nativeGrid);
        var sFirst = ((Control)solverGrid.GetChild(0)).GetRect();
        var nFirst = ((Control)nativeGrid.GetChild(0)).GetRect();
        var sLast = ((Control)solverGrid.GetChild(cells - 1)).GetRect();
        var nLast = ((Control)nativeGrid.GetChild(cells - 1)).GetRect();
        Check(sFirst == nFirst && sLast == nLast,
            $"stress rects differ: first {sFirst} vs {nFirst}, last {sLast} vs {nLast}");

        if (_failures.Count == 0)
        {
            GD.Print($"GRID_COMPARE_OK solver_us_per_fit={solverUs} " +
                     $"native_us_per_fit={nativeUs} cells={cells}");
            GetTree().Quit(0);
        }
        else
        {
            foreach (var f in _failures) GD.PrintErr("GRID_COMPARE_FAIL ", f);
            GetTree().Quit(1);
        }
    }

    private Control LoadDoc(NctXmlRenderer renderer, string file, bool native)
    {
        string path = "res://nctxml/grid/" + file;
        if (native)
        {
            var text = FileAccess.GetFileAsString(path);
            text = text.Replace("<Grid ", "<Grid Engine=\"native\" ");
            path = "/tmp/grid-native-" + file;
            using var f = FileAccess.Open(path, FileAccess.ModeFlags.Write);
            f.StoreString(text);
            f.Close();
        }
        var doc = renderer.Load(path, this, null);
        AddChild(doc.Root);
        return (Control)doc.Root.GetNode("RootGrid");
    }

    private static void ApplyMins(string file, Control grid)
    {
        void Min(string name, float w, float h) =>
            ((Control)grid.GetNode(name)).CustomMinimumSize = new Vector2(w, h);
        switch (file)
        {
            case "grid-baseline.nctxml":
                Min("R1", 50, 30); Min("R2", 50, 50); Min("R3", 50, 10);
                break;
            case "grid-breakpoint.nctxml":
                Min("A", 10, 50); Min("B", 10, 50);
                break;
            case "grid-proportions.nctxml":
                Min("A", 10, 100); Min("B", 10, 100); Min("C", 10, 100);
                break;
        }
    }

    private static IEnumerable<Vector2> SizesFor(string file)
    {
        yield return new Vector2(640, 480);
        yield return new Vector2(800, 200);
        yield return new Vector2(333, 257);
    }

    private Container BuildStress(bool native, int cells)
    {
        Container grid;
        if (native)
        {
            grid = ClassDB.Instantiate("NctGridNative").As<Container>();
            grid.Call("set_grid_spec", "100px 1fr 2fr hug", "auto", "", "",
                "", 4.0, 0.0, 0.0, 0.0);
        }
        else
        {
            grid = new NctGridContainer
            {
                ColumnsSpec = "100px 1fr 2fr hug",
                RowsSpec = "auto",
                Gap = 4,
            };
        }
        for (int i = 0; i < cells; i++)
            grid.AddChild(new Control
            {
                CustomMinimumSize = new Vector2(30 + (i % 7), 18),
            });
        return grid;
    }

    private static long TimeFits(Control grid)
    {
        const int iterations = 60;
        grid.Size = new Vector2(1200, 900);
        long start = (long)Time.GetTicksUsec();
        for (int i = 0; i < iterations; i++)
            grid.Size = new Vector2(1200 + (i % 2), 900);
        long elapsed = (long)Time.GetTicksUsec() - start;
        return elapsed / iterations;
    }

    private void Check(bool cond, string what)
    {
        if (!cond) _failures.Add(what);
    }
}

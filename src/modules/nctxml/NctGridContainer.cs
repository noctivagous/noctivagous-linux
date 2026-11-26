using Godot;
using System;
using System.Collections.Generic;
using System.Globalization;

/// <summary>
/// The NCTXML Grid (plans/NCTXML.md §7), with its semantics
/// ported from the system's own grid model — NCTGraphite's
/// NCTGraphiteGrid / NCTGraphiteBaseline / AppShell proportions
/// (demo-de/NCTGraphite) — rather than from Godot's
/// GridContainer:
///
///   tracks      "220px 1fr 300px" — fixed px, Nfr proportional
///               (float weights: 1.618fr is a golden split),
///               fill = 1fr, hug/auto = min-content. A bare
///               integer ("3") means that many 1fr tracks.
///   Proportions "1 2 1" — the AppShell weight-array form, as
///               an alternative way to declare the columns.
///   Areas       "'nav main' 'nav foot'" — named areas; a
///               child's Area attribute places it.
///   placement   Column / Row (1-based) + ColumnSpan / RowSpan
///               via child metadata (the renderer sets it, the
///               Dock precedent); unpinned children auto-flow
///               row-major, growing implicit hug rows.
///   Baseline    a rhythm unit (+ offset): row pitches quantize
///               to whole units so row tops sit on the rhythm —
///               the snapping API NCTGraphite's Baseline guide
///               never grew. The gap lives inside the pitch.
///   Breakpoints "700:1fr; 1100:220px 1fr 300px:auto:12" —
///               min-width entries (this grid's OWN width — a
///               container query, not a viewport query; device
///               classes are §7's viewport mechanism); the last
///               matching entry wins per field, as in the source.
///
/// This is the SOLVER engine. The GDExtension engine
/// (NctGridNative) implements the identical model natively;
/// NCTXML documents cannot tell them apart (Engine attribute).
/// </summary>
public partial class NctGridContainer : Container
{
    public string ColumnsSpec = "1fr";
    public string RowsSpec = "auto";
    public string ProportionsSpec = "";
    public string AreasSpec = "";
    public string BreakpointsSpec = "";
    public float Gap = 0;
    public float Padding = 0;
    public float BaselineUnit = 0;   // 0 = rhythm off
    public float BaselineOffset = 0;

    private const int Fixed = 0, Fr = 1, Hug = 2;

    private struct Track
    {
        public int Kind;
        public float Value; // px for Fixed, weight for Fr
    }

    private struct Placed
    {
        public Control Child;
        public int Col, Row, ColSpan, RowSpan;
    }

    // ---------------------------------------------------------------
    // Track parsing (shared spec — the native engine matches this)
    // ---------------------------------------------------------------
    private static List<Track> ParseTracks(string spec, string proportions)
    {
        var tracks = new List<Track>();
        if (!string.IsNullOrWhiteSpace(proportions))
        {
            foreach (var tok in proportions.Split(new[] { ' ', ',' },
                         StringSplitOptions.RemoveEmptyEntries))
                if (float.TryParse(tok, NumberStyles.Float,
                        CultureInfo.InvariantCulture, out var w))
                    tracks.Add(new Track { Kind = Fr, Value = w });
            if (tracks.Count > 0) return tracks;
        }
        spec = (spec ?? "").Trim();
        if (spec.Length == 0) spec = "1fr";
        if (int.TryParse(spec, out var count) && count > 0)
        {
            for (int i = 0; i < count; i++)
                tracks.Add(new Track { Kind = Fr, Value = 1 });
            return tracks;
        }
        foreach (var tok in spec.Split(new[] { ' ' },
                     StringSplitOptions.RemoveEmptyEntries))
        {
            var t = tok.Trim();
            if (t == "fill")
                tracks.Add(new Track { Kind = Fr, Value = 1 });
            else if (t == "hug" || t == "auto")
                tracks.Add(new Track { Kind = Hug, Value = 0 });
            else if (t.EndsWith("fr") && float.TryParse(t[..^2],
                         NumberStyles.Float, CultureInfo.InvariantCulture, out var w))
                tracks.Add(new Track { Kind = Fr, Value = w });
            else if (t.EndsWith("px") && float.TryParse(t[..^2],
                         NumberStyles.Float, CultureInfo.InvariantCulture, out var px))
                tracks.Add(new Track { Kind = Fixed, Value = px });
            else if (float.TryParse(t, NumberStyles.Float,
                         CultureInfo.InvariantCulture, out var bare))
                tracks.Add(new Track { Kind = Fixed, Value = bare });
            else
                tracks.Add(new Track { Kind = Hug, Value = 0 });
        }
        return tracks;
    }

    // ---------------------------------------------------------------
    // Areas: "'nav main' 'nav foot'" -> name -> (col,row,cs,rs)
    // ---------------------------------------------------------------
    private Dictionary<string, (int, int, int, int)> ParseAreas(
        out int areaCols, out int areaRows)
    {
        var map = new Dictionary<string, (int, int, int, int)>();
        areaCols = 0; areaRows = 0;
        if (string.IsNullOrWhiteSpace(AreasSpec)) return map;
        var rows = new List<string[]>();
        var rest = AreasSpec;
        while (true)
        {
            int q1 = rest.IndexOf('\'');
            if (q1 < 0) break;
            int q2 = rest.IndexOf('\'', q1 + 1);
            if (q2 < 0) break;
            rows.Add(rest.Substring(q1 + 1, q2 - q1 - 1)
                .Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries));
            rest = rest.Substring(q2 + 1);
        }
        if (rows.Count == 0) return map;
        areaRows = rows.Count;
        areaCols = rows[0].Length;
        var cells = new Dictionary<string, List<(int, int)>>();
        for (int r = 0; r < rows.Count; r++)
            for (int c = 0; c < rows[r].Length && c < areaCols; c++)
            {
                var n = rows[r][c];
                if (n == ".") continue;
                if (!cells.TryGetValue(n, out var list))
                    cells[n] = list = new List<(int, int)>();
                list.Add((c, r));
            }
        foreach (var (name, list) in cells)
        {
            int c0 = int.MaxValue, r0 = int.MaxValue, c1 = 0, r1 = 0;
            foreach (var (c, r) in list)
            {
                c0 = Math.Min(c0, c); r0 = Math.Min(r0, r);
                c1 = Math.Max(c1, c); r1 = Math.Max(r1, r);
            }
            map[name] = (c0, r0, c1 - c0 + 1, r1 - r0 + 1);
        }
        return map;
    }

    // ---------------------------------------------------------------
    // Breakpoints: the last entry at/below our own width wins
    // per field (the NCTGraphite cascade).
    // ---------------------------------------------------------------
    private (string, string, float) EffectiveSpec(float width)
    {
        string cols = ColumnsSpec, rows = RowsSpec;
        float gap = Gap;
        if (string.IsNullOrWhiteSpace(BreakpointsSpec))
            return (cols, rows, gap);
        var entries = new List<(float, string, string, string)>();
        foreach (var raw in BreakpointsSpec.Split(';'))
        {
            var parts = raw.Split(':');
            if (parts.Length < 2) continue;
            if (!float.TryParse(parts[0].Trim(), NumberStyles.Float,
                    CultureInfo.InvariantCulture, out var min)) continue;
            entries.Add((min,
                parts.Length > 1 ? parts[1].Trim() : "",
                parts.Length > 2 ? parts[2].Trim() : "",
                parts.Length > 3 ? parts[3].Trim() : ""));
        }
        entries.Sort((x, y) => x.Item1.CompareTo(y.Item1));
        foreach (var (min, c, r, g) in entries)
        {
            if (width < min) continue;
            if (c.Length > 0) cols = c;
            if (r.Length > 0) rows = r;
            if (g.Length > 0 && float.TryParse(g, NumberStyles.Float,
                    CultureInfo.InvariantCulture, out var gv)) gap = gv;
        }
        return (cols, rows, gap);
    }

    // ---------------------------------------------------------------
    // One axis of the solver. mins[i] = span-1 content minimums;
    // spans contribute their deficits to hug tracks (or to fr
    // minimums when no hug track is spanned).
    // ---------------------------------------------------------------
    private static float[] SolveAxis(List<Track> tracks, float available,
        float gap, float[] contentMin, List<(int, int, float)> spans)
    {
        int n = tracks.Count;
        var sizes = new float[n];
        var frMin = new float[n];
        for (int i = 0; i < n; i++)
        {
            if (tracks[i].Kind == Fixed) sizes[i] = tracks[i].Value;
            else if (tracks[i].Kind == Hug) sizes[i] = contentMin[i];
        }
        foreach (var (start, span, need) in spans)
        {
            float have = gap * (span - 1);
            for (int i = start; i < start + span && i < n; i++)
                have += tracks[i].Kind == Fr ? frMin[i] : sizes[i];
            if (need <= have) continue;
            float deficit = need - have;
            var hugIdx = new List<int>();
            var frIdx = new List<int>();
            for (int i = start; i < start + span && i < n; i++)
            {
                if (tracks[i].Kind == Hug) hugIdx.Add(i);
                else if (tracks[i].Kind == Fr) frIdx.Add(i);
            }
            var targets = hugIdx.Count > 0 ? hugIdx : frIdx;
            if (targets.Count == 0) continue;
            float each = deficit / targets.Count;
            foreach (var i in targets)
            {
                if (tracks[i].Kind == Hug) sizes[i] += each;
                else frMin[i] += each;
            }
        }
        float used = gap * Math.Max(0, n - 1);
        float weights = 0;
        for (int i = 0; i < n; i++)
        {
            if (tracks[i].Kind == Fr) weights += tracks[i].Value;
            else used += sizes[i];
        }
        float rest = Math.Max(0, available - used);
        for (int i = 0; i < n; i++)
            if (tracks[i].Kind == Fr)
                sizes[i] = Math.Max(frMin[i],
                    weights > 0 ? rest * tracks[i].Value / weights : 0);
        return sizes;
    }

    // ---------------------------------------------------------------
    // Layout
    // ---------------------------------------------------------------
    public override void _Notification(int what)
    {
        if (what == NotificationResized || what == NotificationSortChildren)
            FitChildren();
    }

    private List<Placed> PlaceChildren(List<Track> colTracks,
        List<Track> rowTracks, Dictionary<string, (int, int, int, int)> areas)
    {
        var placed = new List<Placed>();
        var occupied = new HashSet<(int, int)>();
        var autos = new List<Control>();

        void Occupy(Placed p)
        {
            for (int r = p.Row; r < p.Row + p.RowSpan; r++)
                for (int c = p.Col; c < p.Col + p.ColSpan; c++)
                    occupied.Add((c, r));
        }

        foreach (var node in GetChildren())
        {
            if (node is not Control child || !child.Visible) continue;
            string area = child.HasMeta("grid_area")
                ? child.GetMeta("grid_area").AsString() : "";
            bool hasCol = child.HasMeta("grid_col");
            bool hasRow = child.HasMeta("grid_row");
            if (area.Length > 0 && areas.TryGetValue(area, out var rect))
            {
                var p = new Placed
                {
                    Child = child,
                    Col = rect.Item1,
                    Row = rect.Item2,
                    ColSpan = rect.Item3,
                    RowSpan = rect.Item4,
                };
                placed.Add(p); Occupy(p);
            }
            else if (hasCol && hasRow)
            {
                var p = new Placed
                {
                    Child = child,
                    Col = Math.Max(0, child.GetMeta("grid_col").AsInt32()),
                    Row = Math.Max(0, child.GetMeta("grid_row").AsInt32()),
                    ColSpan = Math.Max(1, child.HasMeta("grid_col_span")
                        ? child.GetMeta("grid_col_span").AsInt32() : 1),
                    RowSpan = Math.Max(1, child.HasMeta("grid_row_span")
                        ? child.GetMeta("grid_row_span").AsInt32() : 1),
                };
                placed.Add(p); Occupy(p);
            }
            else autos.Add(child);
        }

        int colCount = colTracks.Count;
        foreach (var child in autos)
        {
            int cs = Math.Max(1, child.HasMeta("grid_col_span")
                ? child.GetMeta("grid_col_span").AsInt32() : 1);
            int rs = Math.Max(1, child.HasMeta("grid_row_span")
                ? child.GetMeta("grid_row_span").AsInt32() : 1);
            cs = Math.Min(cs, Math.Max(1, colCount));
            int r = 0;
            while (true)
            {
                bool done = false;
                for (int c = 0; c + cs <= colCount; c++)
                {
                    bool free = true;
                    for (int rr = r; rr < r + rs && free; rr++)
                        for (int cc = c; cc < c + cs; cc++)
                            if (occupied.Contains((cc, rr))) { free = false; break; }
                    if (free)
                    {
                        var p = new Placed
                        { Child = child, Col = c, Row = r, ColSpan = cs, RowSpan = rs };
                        placed.Add(p); Occupy(p);
                        done = true;
                        break;
                    }
                }
                if (done) break;
                r++;
            }
        }

        // Grow implicit hug rows to cover every placement.
        int needRows = rowTracks.Count;
        foreach (var p in placed)
            needRows = Math.Max(needRows, p.Row + p.RowSpan);
        while (rowTracks.Count < needRows)
            rowTracks.Add(new Track { Kind = Hug, Value = 0 });
        // Clamp column spans to the declared columns.
        for (int i = 0; i < placed.Count; i++)
        {
            var p = placed[i];
            p.Col = Math.Min(p.Col, Math.Max(0, colTracks.Count - 1));
            p.ColSpan = Math.Min(p.ColSpan, colTracks.Count - p.Col);
            placed[i] = p;
        }
        return placed;
    }

    private void FitChildren()
    {
        if (!IsInsideTree() || Size.X <= 0 || Size.Y <= 0) return;
        var (colsSpec, rowsSpec, gap) = EffectiveSpec(Size.X);
        var areas = ParseAreas(out int areaCols, out int areaRows);
        var colTracks = ParseTracks(colsSpec, ProportionsSpec);
        var rowTracks = ParseTracks(rowsSpec, "");
        while (colTracks.Count < areaCols)
            colTracks.Add(new Track { Kind = Fr, Value = 1 });
        while (rowTracks.Count < areaRows)
            rowTracks.Add(new Track { Kind = Hug, Value = 0 });

        var placed = PlaceChildren(colTracks, rowTracks, areas);
        if (placed.Count == 0) return;

        float availW = Math.Max(0, Size.X - Padding * 2);
        float availH = Math.Max(0, Size.Y - Padding * 2);

        var colMin = new float[colTracks.Count];
        var rowMin = new float[rowTracks.Count];
        var colSpans = new List<(int, int, float)>();
        var rowSpans = new List<(int, int, float)>();
        foreach (var p in placed)
        {
            var min = p.Child.GetCombinedMinimumSize();
            if (p.ColSpan == 1) colMin[p.Col] = Math.Max(colMin[p.Col], min.X);
            else colSpans.Add((p.Col, p.ColSpan, min.X));
            if (p.RowSpan == 1) rowMin[p.Row] = Math.Max(rowMin[p.Row], min.Y);
            else rowSpans.Add((p.Row, p.RowSpan, min.Y));
        }

        var colSizes = SolveAxis(colTracks, availW, gap, colMin, colSpans);
        var rowSizes = SolveAxis(rowTracks, availH, gap, rowMin, rowSpans);

        // Baseline rhythm: quantize row pitches to whole units.
        float[] rowTops;
        float[] rowHeights;
        if (BaselineUnit > 0)
        {
            int n = rowSizes.Length;
            var pitch = new float[n];
            for (int i = 0; i < n; i++)
            {
                float raw = rowSizes[i] + (i < n - 1 ? gap : 0);
                pitch[i] = raw <= 0 ? 0
                    : (float)(Math.Ceiling(raw / BaselineUnit) * BaselineUnit);
            }
            float total = 0;
            foreach (var q in pitch) total += q;
            if (total > availH)
            {
                // Trim whole units from fr rows, largest first.
                while (total > availH)
                {
                    int best = -1;
                    for (int i = 0; i < n; i++)
                        if (rowTracks[i].Kind == Fr && pitch[i] > BaselineUnit
                            && (best < 0 || pitch[i] > pitch[best])) best = i;
                    if (best < 0) break;
                    pitch[best] -= BaselineUnit;
                    total -= BaselineUnit;
                }
            }
            else
            {
                // Grow the last fr row by whole units to fill.
                int lastFr = -1;
                for (int i = 0; i < n; i++)
                    if (rowTracks[i].Kind == Fr) lastFr = i;
                if (lastFr >= 0)
                    while (total + BaselineUnit <= availH)
                    {
                        pitch[lastFr] += BaselineUnit;
                        total += BaselineUnit;
                    }
            }
            rowTops = new float[n];
            rowHeights = new float[n];
            float y = Padding + BaselineOffset;
            for (int i = 0; i < n; i++)
            {
                rowTops[i] = y;
                rowHeights[i] = Math.Max(0, pitch[i] - (i < n - 1 ? gap : 0));
                y += pitch[i];
            }
        }
        else
        {
            rowTops = new float[rowSizes.Length];
            rowHeights = rowSizes;
            float y = Padding;
            for (int i = 0; i < rowSizes.Length; i++)
            {
                rowTops[i] = y;
                y += rowSizes[i] + gap;
            }
        }

        var colLefts = new float[colSizes.Length];
        {
            float x = Padding;
            for (int i = 0; i < colSizes.Length; i++)
            {
                colLefts[i] = x;
                x += colSizes[i] + gap;
            }
        }

        foreach (var p in placed)
        {
            float w = gap * (p.ColSpan - 1);
            for (int c = p.Col; c < p.Col + p.ColSpan; c++) w += colSizes[c];
            float h = gap * (p.RowSpan - 1);
            for (int r = p.Row; r < p.Row + p.RowSpan; r++) h += rowHeights[r];
            FitChildInRect(p.Child, new Rect2(
                new Vector2(colLefts[p.Col], rowTops[p.Row]),
                new Vector2(w, h)));
        }
    }

    public override Vector2 _GetMinimumSize()
    {
        var (colsSpec, rowsSpec, gap) = EffectiveSpec(0);
        var areas = ParseAreas(out int areaCols, out int areaRows);
        var colTracks = ParseTracks(colsSpec, ProportionsSpec);
        var rowTracks = ParseTracks(rowsSpec, "");
        while (colTracks.Count < areaCols)
            colTracks.Add(new Track { Kind = Fr, Value = 1 });
        while (rowTracks.Count < areaRows)
            rowTracks.Add(new Track { Kind = Hug, Value = 0 });
        var placed = PlaceChildren(colTracks, rowTracks, areas);
        var colMin = new float[colTracks.Count];
        var rowMin = new float[rowTracks.Count];
        var colSpans = new List<(int, int, float)>();
        var rowSpans = new List<(int, int, float)>();
        foreach (var p in placed)
        {
            var min = p.Child.GetCombinedMinimumSize();
            if (p.ColSpan == 1) colMin[p.Col] = Math.Max(colMin[p.Col], min.X);
            else colSpans.Add((p.Col, p.ColSpan, min.X));
            if (p.RowSpan == 1) rowMin[p.Row] = Math.Max(rowMin[p.Row], min.Y);
            else rowSpans.Add((p.Row, p.RowSpan, min.Y));
        }
        // Fr tracks contribute only their span minimums at min size.
        var cw = SolveAxis(colTracks, 0, gap, colMin, colSpans);
        var rh = SolveAxis(rowTracks, 0, gap, rowMin, rowSpans);
        float w = Padding * 2, h = Padding * 2;
        foreach (var s in cw) w += s;
        foreach (var s in rh) h += s;
        if (cw.Length > 1) w += gap * (cw.Length - 1);
        if (rh.Length > 1) h += gap * (rh.Length - 1);
        return new Vector2(w, h);
    }
}

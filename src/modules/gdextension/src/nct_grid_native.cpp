#include "nct_grid_native.h"

#include <godot_cpp/core/class_db.hpp>
#include <godot_cpp/variant/array.hpp>
#include <godot_cpp/variant/packed_string_array.hpp>

#include <algorithm>
#include <cmath>
#include <set>
#include <utility>

using namespace godot;

static const int TRACK_FIXED = 0;
static const int TRACK_FR = 1;
static const int TRACK_HUG = 2;

void NctGridNative::_bind_methods() {
    ClassDB::bind_method(D_METHOD("set_grid_spec", "columns", "rows",
                                  "proportions", "areas", "breakpoints",
                                  "gap", "padding", "baseline",
                                  "baseline_offset"),
                         &NctGridNative::set_grid_spec);
}

void NctGridNative::set_grid_spec(const String &cols, const String &rows,
                                  const String &proportions,
                                  const String &areas,
                                  const String &breakpoints, double p_gap,
                                  double p_padding, double p_baseline,
                                  double p_baseline_offset) {
    columns_spec = cols;
    rows_spec = rows;
    proportions_spec = proportions;
    areas_spec = areas;
    breakpoints_spec = breakpoints;
    gap = p_gap;
    padding = p_padding;
    baseline_unit = p_baseline;
    baseline_offset = p_baseline_offset;
    queue_sort();
}

static bool parse_int_strict(const String &s, int &out) {
    String t = s.strip_edges();
    if (t.is_empty()) return false;
    for (int i = 0; i < t.length(); i++) {
        char32_t ch = t.unicode_at(i);
        if (ch < '0' || ch > '9') return false;
    }
    out = (int)t.to_int();
    return true;
}

static std::vector<String> tokens_of(const String &spec, const char *delims) {
    std::vector<String> out;
    PackedStringArray parts = spec.split(delims);
    for (int i = 0; i < parts.size(); i++) {
        String t = parts[i].strip_edges();
        if (!t.is_empty()) out.push_back(t);
    }
    return out;
}

// Mirrors NctGridContainer.ParseTracks exactly.
std::vector<NctGridNative::Track> NctGridNative::parse_tracks(
        const String &spec_in, const String &proportions) const {
    std::vector<Track> tracks;
    if (!proportions.strip_edges().is_empty()) {
        // The solver splits on a char SET {' ', ','}; Godot's
        // split() takes one literal delimiter, so normalise
        // commas to spaces first.
        String prop = proportions.replace(",", " ");
        for (const String &tok : tokens_of(prop, " "))
            tracks.push_back({TRACK_FR, tok.to_float()});
        if (!tracks.empty()) return tracks;
    }
    String spec = spec_in.strip_edges();
    if (spec.is_empty()) spec = "1fr";
    int count = 0;
    if (parse_int_strict(spec, count) && count > 0) {
        for (int i = 0; i < count; i++)
            tracks.push_back({TRACK_FR, 1});
        return tracks;
    }
    for (const String &tok : tokens_of(spec, " ")) {
        if (tok == "fill")
            tracks.push_back({TRACK_FR, 1});
        else if (tok == "hug" || tok == "auto")
            tracks.push_back({TRACK_HUG, 0});
        else if (tok.ends_with("fr"))
            tracks.push_back({TRACK_FR, tok.left(tok.length() - 2).to_float()});
        else if (tok.ends_with("px"))
            tracks.push_back({TRACK_FIXED, tok.left(tok.length() - 2).to_float()});
        else {
            // Bare number = fixed px; anything else degrades to hug,
            // as in the solver.
            bool numeric = true;
            for (int i = 0; i < tok.length(); i++) {
                char32_t ch = tok.unicode_at(i);
                if (!(ch >= '0' && ch <= '9') && ch != '.' && ch != '-') {
                    numeric = false;
                    break;
                }
            }
            if (numeric)
                tracks.push_back({TRACK_FIXED, tok.to_float()});
            else
                tracks.push_back({TRACK_HUG, 0});
        }
    }
    return tracks;
}

// Mirrors NctGridContainer.ParseAreas.
std::vector<NctGridNative::AreaRect> NctGridNative::parse_areas(
        int &area_cols, int &area_rows) const {
    std::vector<AreaRect> out;
    area_cols = 0;
    area_rows = 0;
    if (areas_spec.strip_edges().is_empty()) return out;
    std::vector<std::vector<String>> rows;
    String rest = areas_spec;
    while (true) {
        int q1 = (int)rest.find("'");
        if (q1 < 0) break;
        int q2 = (int)rest.find("'", q1 + 1);
        if (q2 < 0) break;
        rows.push_back(tokens_of(rest.substr(q1 + 1, q2 - q1 - 1), " "));
        rest = rest.substr(q2 + 1);
    }
    if (rows.empty()) return out;
    area_rows = (int)rows.size();
    area_cols = (int)rows[0].size();
    std::vector<std::pair<String, std::vector<std::pair<int, int>>>> cells;
    for (int r = 0; r < (int)rows.size(); r++) {
        for (int c = 0; c < (int)rows[r].size() && c < area_cols; c++) {
            String n = rows[r][c];
            if (n == ".") continue;
            size_t idx = cells.size();
            for (size_t i = 0; i < cells.size(); i++)
                if (cells[i].first == n) { idx = i; break; }
            if (idx == cells.size())
                cells.push_back({n, {}});
            cells[idx].second.push_back({c, r});
        }
    }
    for (auto &entry : cells) {
        int c0 = 1 << 30, r0 = 1 << 30, c1 = 0, r1 = 0;
        for (auto &cell : entry.second) {
            c0 = std::min(c0, cell.first);
            r0 = std::min(r0, cell.second);
            c1 = std::max(c1, cell.first);
            r1 = std::max(r1, cell.second);
        }
        out.push_back({entry.first, c0, r0, c1 - c0 + 1, r1 - r0 + 1});
    }
    return out;
}

// Mirrors NctGridContainer.EffectiveSpec (the NCTGraphite
// cascade: last entry at/below our own width wins per field).
void NctGridNative::effective_spec(double width, String &cols, String &rows,
                                   double &out_gap) const {
    cols = columns_spec;
    rows = rows_spec;
    out_gap = gap;
    if (breakpoints_spec.strip_edges().is_empty()) return;
    struct Entry { double min; String c, r, g; };
    std::vector<Entry> entries;
    PackedStringArray raws = breakpoints_spec.split(";");
    for (int i = 0; i < raws.size(); i++) {
        PackedStringArray parts = raws[i].split(":");
        if (parts.size() < 2) continue;
        Entry e;
        e.min = parts[0].strip_edges().to_float();
        e.c = parts.size() > 1 ? parts[1].strip_edges() : String("");
        e.r = parts.size() > 2 ? parts[2].strip_edges() : String("");
        e.g = parts.size() > 3 ? parts[3].strip_edges() : String("");
        entries.push_back(e);
    }
    std::sort(entries.begin(), entries.end(),
              [](const Entry &a, const Entry &b) { return a.min < b.min; });
    for (const Entry &e : entries) {
        if (width < e.min) continue;
        if (!e.c.is_empty()) cols = e.c;
        if (!e.r.is_empty()) rows = e.r;
        if (!e.g.is_empty()) out_gap = e.g.to_float();
    }
}

// Mirrors NctGridContainer.SolveAxis.
std::vector<double> NctGridNative::solve_axis(
        const std::vector<Track> &tracks, double available, double p_gap,
        const std::vector<double> &content_min,
        const std::vector<Span> &spans) const {
    int n = (int)tracks.size();
    std::vector<double> sizes(n, 0), fr_min(n, 0);
    for (int i = 0; i < n; i++) {
        if (tracks[i].kind == TRACK_FIXED) sizes[i] = tracks[i].value;
        else if (tracks[i].kind == TRACK_HUG) sizes[i] = content_min[i];
    }
    for (const Span &sp : spans) {
        double have = p_gap * (sp.span - 1);
        for (int i = sp.start; i < sp.start + sp.span && i < n; i++)
            have += tracks[i].kind == TRACK_FR ? fr_min[i] : sizes[i];
        if (sp.need <= have) continue;
        double deficit = sp.need - have;
        std::vector<int> hug_idx, fr_idx;
        for (int i = sp.start; i < sp.start + sp.span && i < n; i++) {
            if (tracks[i].kind == TRACK_HUG) hug_idx.push_back(i);
            else if (tracks[i].kind == TRACK_FR) fr_idx.push_back(i);
        }
        const std::vector<int> &targets = !hug_idx.empty() ? hug_idx : fr_idx;
        if (targets.empty()) continue;
        double each = deficit / (double)targets.size();
        for (int i : targets) {
            if (tracks[i].kind == TRACK_HUG) sizes[i] += each;
            else fr_min[i] += each;
        }
    }
    double used = p_gap * std::max(0, n - 1);
    double weights = 0;
    for (int i = 0; i < n; i++) {
        if (tracks[i].kind == TRACK_FR) weights += tracks[i].value;
        else used += sizes[i];
    }
    double rest = std::max(0.0, available - used);
    for (int i = 0; i < n; i++)
        if (tracks[i].kind == TRACK_FR)
            sizes[i] = std::max(fr_min[i],
                                weights > 0 ? rest * tracks[i].value / weights : 0);
    return sizes;
}

// Mirrors NctGridContainer.PlaceChildren.
std::vector<NctGridNative::Placed> NctGridNative::place_children(
        std::vector<Track> &col_tracks, std::vector<Track> &row_tracks,
        const std::vector<AreaRect> &areas) const {
    std::vector<Placed> placed;
    std::set<std::pair<int, int>> occupied;
    std::vector<Control *> autos;

    auto occupy = [&](const Placed &p) {
        for (int r = p.row; r < p.row + p.row_span; r++)
            for (int c = p.col; c < p.col + p.col_span; c++)
                occupied.insert({c, r});
    };
    auto meta_int = [](Control *child, const char *key, int dflt) {
        return child->has_meta(key) ? (int)child->get_meta(key) : dflt;
    };

    Array children = get_children();
    for (int i = 0; i < children.size(); i++) {
        Control *child = Object::cast_to<Control>(children[i]);
        if (child == nullptr || !child->is_visible()) continue;
        String area = child->has_meta("grid_area")
                              ? String(child->get_meta("grid_area"))
                              : String("");
        bool done = false;
        if (!area.is_empty()) {
            for (const AreaRect &rect : areas) {
                if (rect.name == area) {
                    Placed p{child, rect.col, rect.row, rect.col_span, rect.row_span};
                    placed.push_back(p);
                    occupy(p);
                    done = true;
                    break;
                }
            }
        }
        if (done) continue;
        if (child->has_meta("grid_col") && child->has_meta("grid_row")) {
            Placed p{child,
                     std::max(0, meta_int(child, "grid_col", 0)),
                     std::max(0, meta_int(child, "grid_row", 0)),
                     std::max(1, meta_int(child, "grid_col_span", 1)),
                     std::max(1, meta_int(child, "grid_row_span", 1))};
            placed.push_back(p);
            occupy(p);
        } else {
            autos.push_back(child);
        }
    }

    int col_count = (int)col_tracks.size();
    for (Control *child : autos) {
        int cs = std::max(1, meta_int(child, "grid_col_span", 1));
        int rs = std::max(1, meta_int(child, "grid_row_span", 1));
        cs = std::min(cs, std::max(1, col_count));
        int r = 0;
        while (true) {
            bool placed_here = false;
            for (int c = 0; c + cs <= col_count; c++) {
                bool free = true;
                for (int rr = r; rr < r + rs && free; rr++)
                    for (int cc = c; cc < c + cs; cc++)
                        if (occupied.count({cc, rr})) { free = false; break; }
                if (free) {
                    Placed p{child, c, r, cs, rs};
                    placed.push_back(p);
                    occupy(p);
                    placed_here = true;
                    break;
                }
            }
            if (placed_here) break;
            r++;
        }
    }

    int need_rows = (int)row_tracks.size();
    for (const Placed &p : placed)
        need_rows = std::max(need_rows, p.row + p.row_span);
    while ((int)row_tracks.size() < need_rows)
        row_tracks.push_back({TRACK_HUG, 0});
    for (Placed &p : placed) {
        p.col = std::min(p.col, std::max(0, (int)col_tracks.size() - 1));
        p.col_span = std::min(p.col_span, (int)col_tracks.size() - p.col);
    }
    return placed;
}

void NctGridNative::_notification(int p_what) {
    if (p_what == NOTIFICATION_RESIZED || p_what == NOTIFICATION_SORT_CHILDREN)
        fit_children();
}

// Mirrors NctGridContainer.FitChildren, including the baseline
// rhythm quantization.
void NctGridNative::fit_children() {
    if (!is_inside_tree() || get_size().x <= 0 || get_size().y <= 0) return;
    String cols_spec, rows_spec;
    double eff_gap = gap;
    effective_spec(get_size().x, cols_spec, rows_spec, eff_gap);
    int area_cols = 0, area_rows = 0;
    std::vector<AreaRect> areas = parse_areas(area_cols, area_rows);
    std::vector<Track> col_tracks = parse_tracks(cols_spec, proportions_spec);
    std::vector<Track> row_tracks = parse_tracks(rows_spec, "");
    while ((int)col_tracks.size() < area_cols)
        col_tracks.push_back({TRACK_FR, 1});
    while ((int)row_tracks.size() < area_rows)
        row_tracks.push_back({TRACK_HUG, 0});

    std::vector<Placed> placed = place_children(col_tracks, row_tracks, areas);
    if (placed.empty()) return;

    double avail_w = std::max(0.0, get_size().x - padding * 2);
    double avail_h = std::max(0.0, get_size().y - padding * 2);

    std::vector<double> col_min(col_tracks.size(), 0), row_min(row_tracks.size(), 0);
    std::vector<Span> col_spans, row_spans;
    for (const Placed &p : placed) {
        Vector2 min = p.child->get_combined_minimum_size();
        if (p.col_span == 1)
            col_min[p.col] = std::max(col_min[p.col], (double)min.x);
        else
            col_spans.push_back({p.col, p.col_span, (double)min.x});
        if (p.row_span == 1)
            row_min[p.row] = std::max(row_min[p.row], (double)min.y);
        else
            row_spans.push_back({p.row, p.row_span, (double)min.y});
    }

    std::vector<double> col_sizes =
            solve_axis(col_tracks, avail_w, eff_gap, col_min, col_spans);
    std::vector<double> row_sizes =
            solve_axis(row_tracks, avail_h, eff_gap, row_min, row_spans);

    std::vector<double> row_tops, row_heights;
    if (baseline_unit > 0) {
        int n = (int)row_sizes.size();
        std::vector<double> pitch(n, 0);
        for (int i = 0; i < n; i++) {
            double raw = row_sizes[i] + (i < n - 1 ? eff_gap : 0);
            pitch[i] = raw <= 0 ? 0
                                : std::ceil(raw / baseline_unit) * baseline_unit;
        }
        double total = 0;
        for (double q : pitch) total += q;
        if (total > avail_h) {
            while (total > avail_h) {
                int best = -1;
                for (int i = 0; i < n; i++)
                    if (row_tracks[i].kind == TRACK_FR &&
                        pitch[i] > baseline_unit &&
                        (best < 0 || pitch[i] > pitch[best]))
                        best = i;
                if (best < 0) break;
                pitch[best] -= baseline_unit;
                total -= baseline_unit;
            }
        } else {
            int last_fr = -1;
            for (int i = 0; i < n; i++)
                if (row_tracks[i].kind == TRACK_FR) last_fr = i;
            if (last_fr >= 0)
                while (total + baseline_unit <= avail_h) {
                    pitch[last_fr] += baseline_unit;
                    total += baseline_unit;
                }
        }
        row_tops.assign(n, 0);
        row_heights.assign(n, 0);
        double y = padding + baseline_offset;
        for (int i = 0; i < n; i++) {
            row_tops[i] = y;
            row_heights[i] = std::max(0.0, pitch[i] - (i < n - 1 ? eff_gap : 0));
            y += pitch[i];
        }
    } else {
        row_tops.assign(row_sizes.size(), 0);
        row_heights = row_sizes;
        double y = padding;
        for (size_t i = 0; i < row_sizes.size(); i++) {
            row_tops[i] = y;
            y += row_sizes[i] + eff_gap;
        }
    }

    std::vector<double> col_lefts(col_sizes.size(), 0);
    {
        double x = padding;
        for (size_t i = 0; i < col_sizes.size(); i++) {
            col_lefts[i] = x;
            x += col_sizes[i] + eff_gap;
        }
    }

    for (const Placed &p : placed) {
        double w = eff_gap * (p.col_span - 1);
        for (int c = p.col; c < p.col + p.col_span; c++) w += col_sizes[c];
        double h = eff_gap * (p.row_span - 1);
        for (int r = p.row; r < p.row + p.row_span; r++) h += row_heights[r];
        fit_child_in_rect(p.child,
                          Rect2(Vector2((float)col_lefts[p.col],
                                        (float)row_tops[p.row]),
                                Vector2((float)w, (float)h)));
    }
}

Vector2 NctGridNative::_get_minimum_size() const {
    // Mirrors NctGridContainer._GetMinimumSize: fr tracks
    // contribute only their span minimums; fixed + hug + gaps
    // + padding count.
    String cols_spec, rows_spec;
    double eff_gap = gap;
    effective_spec(0, cols_spec, rows_spec, eff_gap);
    int area_cols = 0, area_rows = 0;
    std::vector<AreaRect> areas = parse_areas(area_cols, area_rows);
    std::vector<Track> col_tracks = parse_tracks(cols_spec, proportions_spec);
    std::vector<Track> row_tracks = parse_tracks(rows_spec, "");
    while ((int)col_tracks.size() < area_cols)
        col_tracks.push_back({TRACK_FR, 1});
    while ((int)row_tracks.size() < area_rows)
        row_tracks.push_back({TRACK_HUG, 0});
    std::vector<Placed> placed = place_children(col_tracks, row_tracks, areas);
    std::vector<double> col_min(col_tracks.size(), 0), row_min(row_tracks.size(), 0);
    std::vector<Span> col_spans, row_spans;
    for (const Placed &p : placed) {
        Vector2 min = p.child->get_combined_minimum_size();
        if (p.col_span == 1)
            col_min[p.col] = std::max(col_min[p.col], (double)min.x);
        else
            col_spans.push_back({p.col, p.col_span, (double)min.x});
        if (p.row_span == 1)
            row_min[p.row] = std::max(row_min[p.row], (double)min.y);
        else
            row_spans.push_back({p.row, p.row_span, (double)min.y});
    }
    std::vector<double> cw = solve_axis(col_tracks, 0, eff_gap, col_min, col_spans);
    std::vector<double> rh = solve_axis(row_tracks, 0, eff_gap, row_min, row_spans);
    double w = padding * 2, h = padding * 2;
    for (double s : cw) w += s;
    for (double s : rh) h += s;
    if (cw.size() > 1) w += eff_gap * (double)(cw.size() - 1);
    if (rh.size() > 1) h += eff_gap * (double)(rh.size() - 1);
    return Vector2((float)w, (float)h);
}

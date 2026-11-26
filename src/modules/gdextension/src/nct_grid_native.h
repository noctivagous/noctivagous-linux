#ifndef NCT_GRID_NATIVE_H
#define NCT_GRID_NATIVE_H

#include <godot_cpp/classes/container.hpp>
#include <godot_cpp/classes/control.hpp>
#include <godot_cpp/core/class_db.hpp>

#include <vector>

namespace godot {

// The NCTXML Grid, native engine (plans/NCTXML.md §7; semantics
// ported from NCTGraphite's grid model). This class implements
// the IDENTICAL model to the C# solver engine
// (nctxml/NctGridContainer.cs): same track grammar, placement,
// areas, baseline quantization and breakpoint cascade, so an
// NCTXML document produces the same measured rects under either
// engine. Placement facts arrive as child metadata set by the
// renderer (grid_col / grid_row / grid_col_span / grid_row_span
// / grid_area) — the same channel the solver reads.
class NctGridNative : public Container {
    GDCLASS(NctGridNative, Container)

    String columns_spec = "1fr";
    String rows_spec = "auto";
    String proportions_spec = "";
    String areas_spec = "";
    String breakpoints_spec = "";
    double gap = 0;
    double padding = 0;
    double baseline_unit = 0;
    double baseline_offset = 0;

    struct Track {
        int kind; // 0 fixed, 1 fr, 2 hug
        double value;
    };
    struct Placed {
        Control *child;
        int col, row, col_span, row_span;
    };
    struct AreaRect {
        String name;
        int col, row, col_span, row_span;
    };
    struct Span {
        int start, span;
        double need;
    };

    std::vector<Track> parse_tracks(const String &spec,
                                    const String &proportions) const;
    std::vector<AreaRect> parse_areas(int &area_cols, int &area_rows) const;
    void effective_spec(double width, String &cols, String &rows,
                        double &out_gap) const;
    std::vector<double> solve_axis(const std::vector<Track> &tracks,
                                   double available, double p_gap,
                                   const std::vector<double> &content_min,
                                   const std::vector<Span> &spans) const;
    std::vector<Placed> place_children(std::vector<Track> &col_tracks,
                                       std::vector<Track> &row_tracks,
                                       const std::vector<AreaRect> &areas) const;
    void fit_children();

protected:
    static void _bind_methods();

public:
    NctGridNative() = default;

    void set_grid_spec(const String &cols, const String &rows,
                       const String &proportions, const String &areas,
                       const String &breakpoints, double p_gap,
                       double p_padding, double p_baseline,
                       double p_baseline_offset);

    void _notification(int p_what);
    Vector2 _get_minimum_size() const override;
};

} // namespace godot

#endif // NCT_GRID_NATIVE_H

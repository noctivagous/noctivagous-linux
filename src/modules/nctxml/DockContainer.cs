using Godot;

/// <summary>
/// The Dock layout control (plans/NCTXML.md §7): children carry a
/// "dock" metadata value (Top / Bottom / Left / Right / Fill) set by
/// the renderer from their Dock attribute, and a minimum size that
/// gives edge children their thickness. Edges consume space in
/// child order; Fill takes what remains.
/// </summary>
public partial class DockContainer : Container
{
    public override void _Notification(int what)
    {
        if (what == 28) // NOTIFICATION_RESIZED
            FitChildren();
    }

    private void FitChildren()
    {
        var rect = new Rect2(Vector2.Zero, Size);
        foreach (Node childNode in GetChildren())
        {
            if (childNode is not Control child || !child.Visible)
                continue;
            string dock = child.HasMeta("dock") ? child.GetMeta("dock").AsString() : "Fill";
            Vector2 min = child.GetCombinedMinimumSize();
            switch (dock)
            {
                case "Top":
                    FitChildInRect(child, new Rect2(rect.Position, new Vector2(rect.Size.X, min.Y)));
                    rect.Position += new Vector2(0, min.Y);
                    rect.Size -= new Vector2(0, min.Y);
                    break;
                case "Bottom":
                    FitChildInRect(child, new Rect2(
                        new Vector2(rect.Position.X, rect.Position.Y + rect.Size.Y - min.Y),
                        new Vector2(rect.Size.X, min.Y)));
                    rect.Size -= new Vector2(0, min.Y);
                    break;
                case "Left":
                    FitChildInRect(child, new Rect2(rect.Position, new Vector2(min.X, rect.Size.Y)));
                    rect.Position += new Vector2(min.X, 0);
                    rect.Size -= new Vector2(min.X, 0);
                    break;
                case "Right":
                    FitChildInRect(child, new Rect2(
                        new Vector2(rect.Position.X + rect.Size.X - min.X, rect.Position.Y),
                        new Vector2(min.X, rect.Size.Y)));
                    rect.Size -= new Vector2(min.X, 0);
                    break;
                default: // Fill
                    FitChildInRect(child, rect);
                    break;
            }
        }
    }
}

using Godot;

/// <summary>
/// The greeter's form host (E3): loads the login form — the
/// NCTXML view (login.nctxml) over the XForms model
/// (login.nctform) — and bridges it to main.gd, which owns the
/// greetd-bridge conversation. The conversation is async, so
/// the submission is pending until main.gd resolves it.
/// Method names called from GDScript are snake_case on purpose:
/// GDScript looks methods up by their exact registered name.
/// </summary>
public partial class GreeterForm : Control
{
    private NctFormModel _model;
    private LineEdit _userField, _passField;

    public override void _Ready()
    {
        _model = NctFormModel.Load("res://login.nctform");
        var doc = new NctXmlRenderer().Load("res://login.nctxml",
            this, null, _model);
        if (doc.Kind == "error")
        {
            GD.PushError("greeter form failed to load: "
                + string.Join("; ", doc.Diagnostics));
            return;
        }
        AddChild(doc.Root);
        _userField = doc.Root.FindChild("UserField", true, false) as LineEdit;
        _passField = doc.Root.FindChild("PassField", true, false) as LineEdit;
        // A greeter's first field holds focus from the start.
        Callable.From(() => _userField?.GrabFocus()).CallDeferred();
    }

    // The model's submission action: hand the credentials to
    // main.gd's bridge conversation and return its answer
    // ({"state": "pending"} — the outcome arrives later).
    public Variant AttemptLogin(FormInstance form)
    {
        return GetParent().Call("form_attempt_login",
            form.Text("username"), form.Text("password"));
    }

    public void OnUserSubmitted(string _) => _passField?.GrabFocus();

    public void OnPasswordSubmitted(string _) => _model.Submit("attempt");

    // ---- called from main.gd ----
    public void resolve_login(bool ok, string message) =>
        _model.ResolveSubmission("attempt", ok, message);

    public void set_status(string text) =>
        _model.Instance.Set("status", text);

    public void refocus_password()
    {
        _passField?.SelectAll();
        _passField?.GrabFocus();
    }

    public void ensure_focus()
    {
        if (GetViewport().GuiGetFocusOwner() == null)
            _userField?.GrabFocus();
    }
}

using Godot;
using System.Collections.Generic;

// E2 proofs for the XForms layer (NCTXML.md §11):
//  - one login model, TWO layouts of it (hand-written grid view
//    vs the annotation-driven auto-view), sharing ONE instance:
//    typing in one appears in the other;
//  - measured layout difference between the two arrangements;
//  - submission gating: invalid (empty required) never reaches
//    the host; the error lands in the errorTarget node; a host
//    failure string becomes the status; success clears it;
//  - constraints on a second model: calculate, relevance,
//    readonly-as-output, typed values;
//  - repeats as data: GetItems + write-back into the XML tree.
// Prints NCTFORM_OK.
public partial class FormHarness : Control
{
    private readonly List<string> _fail = new();
    private int _loginCalls;
    private string _seenUser = "", _seenPass = "";
    private Variant _loginResult = true;
    private string _picked = "";

    public void PickEntry(NctDataObject item) =>
        _picked = item.Get("title").ToString();

    public Variant AttemptLogin(FormInstance form)
    {
        _loginCalls++;
        _seenUser = form.Text("username");
        _seenPass = form.Text("password");
        return _loginResult;
    }

    private void Check(bool ok, string what) { if (!ok) _fail.Add(what); }

    public override async void _Ready()
    {
        var renderer = new NctXmlRenderer();
        var model = NctFormModel.Load("res://nctxml/forms/login.nctform");
        model.Host = this;

        var hand = renderer.Load("res://nctxml/forms/login-hand.nctxml",
            this, null, model);
        var auto = renderer.LoadAutoForm(model, this);
        AddChild(hand.Root);
        hand.Root.SetAnchorsPreset(LayoutPreset.TopLeft);
        hand.Root.Size = new Vector2(300, 260);
        AddChild(auto.Root);
        auto.Root.SetAnchorsPreset(LayoutPreset.TopLeft);
        auto.Root.Position = new Vector2(320, 0);
        auto.Root.Size = new Vector2(300, 260);
        await ToSignal(GetTree(), SceneTree.SignalName.ProcessFrame);
        await ToSignal(GetTree(), SceneTree.SignalName.ProcessFrame);

        var handUser = FindChild("HandUser", true, false) as LineEdit;
        var handPass = FindChild("HandPass", true, false) as LineEdit;
        var handGo = FindChild("HandGo", true, false) as Button;
        var handStatus = FindChild("HandStatus", true, false) as Label;
        var autoUser = FindChild("Input_username", true, false) as LineEdit;
        var autoPass = FindChild("Input_password", true, false) as LineEdit;
        var autoStatus = FindChild("Input_status", true, false) as Label;
        var autoGo = FindChild("Submit_attempt", true, false) as Button;
        Check(handUser != null && autoUser != null && autoGo != null,
            "both views built their controls");
        Check(handPass.Secret && autoPass.Secret,
            "password masked in both views");

        // One instance, two layouts: type in the hand view, the
        // auto view's field follows through the shared instance.
        handUser.Text = "nct";
        handUser.EmitSignal(LineEdit.SignalName.TextChanged, "nct");
        Check(model.Instance.Text("username") == "nct",
            "typing reached the instance");
        Check(autoUser.Text == "nct",
            "the other layout shows the same data");

        // Laid out differently, measurably: the hand grid gives
        // the field the 1fr column beside a 120px label column;
        // the annotated auto-view gives it the full width.
        Check(autoUser.Size.X > handUser.Size.X + 50,
            $"layouts differ (hand={handUser.Size.X}, auto={autoUser.Size.X})");

        // Submission gating: password still empty (required) —
        // the host must NOT be called; the error is data.
        handGo.EmitSignal(BaseButton.SignalName.Pressed);
        Check(_loginCalls == 0, "invalid submission never reached the host");
        Check(handStatus.Text.Contains("required")
              && autoStatus.Text == handStatus.Text,
            $"validation error is instance data ('{handStatus.Text}')");

        // Valid now; the host fails with a message → status.
        model.Instance.Set("password", "secret");
        Check(autoPass.Text == "secret", "instance writes reach both views");
        _loginResult = "Login failed";
        autoGo.EmitSignal(BaseButton.SignalName.Pressed);
        Check(_loginCalls == 1 && _seenUser == "nct" && _seenPass == "secret",
            "host action received the instance");
        Check(handStatus.Text == "Login failed",
            "host failure string became the status");

        // Success clears the error target.
        _loginResult = true;
        handGo.EmitSignal(BaseButton.SignalName.Pressed);
        Check(_loginCalls == 2 && handStatus.Text == "",
            "successful submission cleared the status");

        // ---- the order model: calculate / relevance / types ----
        var order = NctFormModel.Load("res://nctxml/forms/order.nctform");
        var orderDoc = renderer.LoadAutoForm(order, this);
        AddChild(orderDoc.Root);
        orderDoc.Root.SetAnchorsPreset(LayoutPreset.TopLeft);
        orderDoc.Root.Position = new Vector2(0, 300);
        orderDoc.Root.Size = new Vector2(300, 300);
        await ToSignal(GetTree(), SceneTree.SignalName.ProcessFrame);
        await ToSignal(GetTree(), SceneTree.SignalName.ProcessFrame);

        var total = FindChild("Input_total", true, false) as Label;
        Check(order.Instance.Text("total") == "120",
            $"calculate ran at load (total={order.Instance.Text("total")})");
        Check(total != null && total.Text == "120",
            "calculated value renders as a readonly output");
        order.Instance.Set("subtotal", 200.0);
        Check(order.Instance.Text("total") == "240",
            "calculate re-ran on change");

        var discount = FindChild("Input_discount", true, false) as LineEdit;
        Check(discount != null && !discount.Visible,
            "irrelevant field starts hidden");
        order.Instance.Set("advanced", true);
        Check(discount.Visible, "relevance follows the instance");

        var items = order.Instance.GetItems("items/item");
        Check(items.Count == 2 && items[1].Get("name").ToString() == "Cup",
            "repeat items read from the tree");
        items[1].Set("qty", "5");
        Check(order.Instance.Serialize().Contains("<qty>5</qty>"),
            "item writes land back in the XML (the form stores its data)");

        // ---- Repeat: instance nodes + context arrays ----
        var entryCtx = new NctDataObject();
        var two = new Godot.Collections.Array
        {
            NctDataObject.Of(("title", "Firefox")),
            NctDataObject.Of(("title", "Files")),
        };
        entryCtx.Set("Entries", two);
        var repeatDoc = renderer.Load(
            "res://nctxml/forms/repeat-proof.nctxml", this, entryCtx);
        AddChild(repeatDoc.Root);
        repeatDoc.Root.SetAnchorsPreset(LayoutPreset.TopLeft);
        repeatDoc.Root.Position = new Vector2(640, 0);
        repeatDoc.Root.Size = new Vector2(300, 200);
        await ToSignal(GetTree(), SceneTree.SignalName.ProcessFrame);

        var meds = repeatDoc.Root.FindChild("MedRepeat", true, false);
        Check(meds != null && meds.GetChildCount() == 2
              && (meds.GetChild(0) as Label).Text == "Tea"
              && (meds.GetChild(1) as Label).Text == "Soup",
            "repeat renders repeated instance nodes");
        var entries = repeatDoc.Root.FindChild("EntryRepeat", true, false);
        Check(entries != null && entries.GetChildCount() == 2,
            "repeat renders a context array");
        (entries.GetChild(1) as Button).EmitSignal(
            BaseButton.SignalName.Pressed);
        Check(_picked == "Files",
            $"repeat handlers receive their item (picked='{_picked}')");
        var three = new Godot.Collections.Array
        {
            NctDataObject.Of(("title", "Firefox")),
            NctDataObject.Of(("title", "Files")),
            NctDataObject.Of(("title", "Terminal")),
        };
        // (The view's Model= made the instance the context, with
        // Entries merged in — the refresh fires on the instance.)
        repeatDoc.Model.Instance.Set("Entries", three);
        Check(entries.GetChildCount() == 3,
            "repeat rebuilds when its source changes");

        if (_fail.Count == 0) GD.Print("NCTFORM_OK");
        else
        {
            foreach (var f in _fail) GD.Print("NCTFORM_FAIL: ", f);
            GD.Print("NCTFORM_FAILED count=", _fail.Count);
        }
        GetTree().Quit(_fail.Count == 0 ? 0 : 1);
    }
}

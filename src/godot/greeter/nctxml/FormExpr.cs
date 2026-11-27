using System;
using System.Collections.Generic;
using System.Globalization;

/// <summary>
/// The form layer's expression evaluator (NCTXML.md §11, the
/// XForms offshoot): the small expression language that bind
/// constraints speak — relevant="age > 18", calculate=
/// "subtotal * tax". Paths, literals, arithmetic, comparisons,
/// and/or/not. Deliberately NOT XPath and NOT a general language:
/// §9's rule for v1 expressions (paths, literals, named
/// converters) extended with just the operators constraints need.
///
/// Values are double, string or bool. A path resolves through the
/// caller's resolver to its instance text; numeric coercion
/// happens when both sides parse as numbers.
/// </summary>
public static class FormExpr
{
    public static object Eval(string expr, Func<string, string> resolve)
    {
        var p = new Parser(Tokenize(expr ?? ""), resolve);
        var v = p.ParseOr();
        return v;
    }

    public static bool Truthy(object v) => v switch
    {
        bool b => b,
        double d => d != 0,
        string s => s.Length > 0 && s != "false" && s != "0",
        null => false,
        _ => true,
    };

    public static double Num(object v) => v switch
    {
        double d => d,
        bool b => b ? 1 : 0,
        string s => double.TryParse(s, NumberStyles.Float,
            CultureInfo.InvariantCulture, out var d) ? d : 0,
        _ => 0,
    };

    private static bool IsNum(object v) =>
        v is double || (v is string s && double.TryParse(s,
            NumberStyles.Float, CultureInfo.InvariantCulture, out _));

    private static int Compare(object a, object b)
    {
        if (IsNum(a) && IsNum(b)) return Num(a).CompareTo(Num(b));
        return string.Compare(a?.ToString() ?? "", b?.ToString() ?? "",
            StringComparison.Ordinal);
    }

    // ---------------------------------------------------------------
    private enum Tk { Num, Str, Path, Op, LParen, RParen, End }
    private readonly struct Tok
    {
        public readonly Tk Kind; public readonly string Text;
        public Tok(Tk k, string t) { Kind = k; Text = t; }
    }

    private static List<Tok> Tokenize(string s)
    {
        var toks = new List<Tok>();
        int i = 0;
        while (i < s.Length)
        {
            char c = s[i];
            if (char.IsWhiteSpace(c)) { i++; continue; }
            if (c == '(') { toks.Add(new Tok(Tk.LParen, "(")); i++; continue; }
            if (c == ')') { toks.Add(new Tok(Tk.RParen, ")")); i++; continue; }
            if (c == '\'')
            {
                int j = s.IndexOf('\'', i + 1);
                if (j < 0) j = s.Length;
                toks.Add(new Tok(Tk.Str, s.Substring(i + 1, Math.Max(0, j - i - 1))));
                i = Math.Min(s.Length, j + 1);
                continue;
            }
            if (char.IsDigit(c) || (c == '.' && i + 1 < s.Length && char.IsDigit(s[i + 1])))
            {
                int j = i;
                while (j < s.Length && (char.IsDigit(s[j]) || s[j] == '.')) j++;
                toks.Add(new Tok(Tk.Num, s.Substring(i, j - i)));
                i = j; continue;
            }
            if (c == '<' || c == '>' || c == '!' || c == '=')
            {
                string op = c.ToString();
                if (i + 1 < s.Length && s[i + 1] == '=') { op += "="; i++; }
                toks.Add(new Tok(Tk.Op, op)); i++; continue;
            }
            if (c == '+' || c == '-' || c == '*' || c == '/')
            {
                toks.Add(new Tok(Tk.Op, c.ToString())); i++; continue;
            }
            if (char.IsLetter(c) || c == '_' || c == '/')
            {
                int j = i;
                while (j < s.Length && (char.IsLetterOrDigit(s[j])
                    || s[j] == '_' || s[j] == '/' || s[j] == '.' || s[j] == '-')) j++;
                toks.Add(new Tok(Tk.Path, s.Substring(i, j - i)));
                i = j; continue;
            }
            i++; // unknown character: skip, never throw on author text
        }
        toks.Add(new Tok(Tk.End, ""));
        return toks;
    }

    private sealed class Parser
    {
        private readonly List<Tok> _t; private int _i;
        private readonly Func<string, string> _resolve;
        public Parser(List<Tok> t, Func<string, string> r) { _t = t; _resolve = r; }
        private Tok Peek => _t[_i];
        private string Next() => _t[_i++].Text;
        private bool Eat(string op)
        {
            if (Peek.Kind == Tk.Op && Peek.Text == op || Peek.Kind == Tk.Path && Peek.Text == op)
            { _i++; return true; }
            return false;
        }

        public object ParseOr()
        {
            var l = ParseAnd();
            while (Peek.Kind == Tk.Path && Peek.Text == "or")
            { _i++; var r = ParseAnd(); l = Truthy(l) || Truthy(r); }
            return l;
        }
        private object ParseAnd()
        {
            var l = ParseCmp();
            while (Peek.Kind == Tk.Path && Peek.Text == "and")
            { _i++; var r = ParseCmp(); l = Truthy(l) && Truthy(r); }
            return l;
        }
        private object ParseCmp()
        {
            var l = ParseAdd();
            if (Peek.Kind == Tk.Op && Peek.Text is "=" or "!=" or "<" or "<=" or ">" or ">=")
            {
                var op = Next(); var r = ParseAdd();
                int c = Compare(l, r);
                return op switch
                {
                    "=" => c == 0, "!=" => c != 0, "<" => c < 0,
                    "<=" => c <= 0, ">" => c > 0, _ => c >= 0,
                };
            }
            return l;
        }
        private object ParseAdd()
        {
            var l = ParseMul();
            while (Peek.Kind == Tk.Op && (Peek.Text == "+" || Peek.Text == "-"))
            {
                var op = Next(); var r = ParseMul();
                l = op == "+" ? Num(l) + Num(r) : Num(l) - Num(r);
            }
            return l;
        }
        private object ParseMul()
        {
            var l = ParseUnary();
            while (Peek.Kind == Tk.Op && (Peek.Text == "*" || Peek.Text == "/"))
            {
                var op = Next(); var r = ParseUnary();
                l = op == "*" ? Num(l) * Num(r) : (Num(r) == 0 ? 0 : Num(l) / Num(r));
            }
            return l;
        }
        private object ParseUnary()
        {
            if (Peek.Kind == Tk.Path && Peek.Text == "not")
            { _i++; return !Truthy(ParseUnary()); }
            if (Peek.Kind == Tk.Op && Peek.Text == "-")
            { _i++; return -Num(ParseUnary()); }
            if (Peek.Kind == Tk.Op && Peek.Text == "!")
            { _i++; return !Truthy(ParseUnary()); }
            return ParsePrimary();
        }
        private object ParsePrimary()
        {
            var t = _t[_i++];
            switch (t.Kind)
            {
                case Tk.Num: return double.Parse(t.Text, CultureInfo.InvariantCulture);
                case Tk.Str: return t.Text;
                case Tk.LParen:
                    var v = ParseOr();
                    if (Peek.Kind == Tk.RParen) _i++;
                    return v;
                case Tk.Path:
                    if (t.Text == "true") return true;
                    if (t.Text == "false") return false;
                    return _resolve(t.Text) ?? "";
                default: return "";
            }
        }
    }
}

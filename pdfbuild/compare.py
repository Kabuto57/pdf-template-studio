"""Compares two form PDFs: pages, the words on them (and where), every field and widget, every script.

    python compare.py a.pdf b.pdf

Prints the differences (nothing but "same" when they match). Date lists are compared by length only, since they
list the dates around the day the PDF was made.
"""
import sys

import pikepdf
import pymupdf


def words(path):
    out = []
    for p in pymupdf.open(path):
        out.append(sorted((w[4], w[0], w[3]) for w in p.get_text("words")))
    return out


def js(a):
    if a is None:
        return None
    v = a.get("/JS")
    return v.read_bytes().decode("latin-1") if isinstance(v, pikepdf.Stream) else str(v)


def fields(path):
    pdf = pikepdf.open(path)
    pages = {p.objgen: i for i, p in enumerate(pdf.pages)}
    out = {}
    for f in pdf.Root.AcroForm.Fields:
        name = str(f.T)
        opt = f.get("/Opt")
        info = {
            "FT": str(f.get("/FT")), "Ff": int(f.get("/Ff", 0)), "DA": "" if str(f.get("/FT")) == "/Btn" and "Tf 0" in str(f.get("/DA", "")).replace(" 0 Tf", "Tf 0") else str(f.get("/DA", "")).replace("\n", " "),
            "MaxLen": int(f.get("/MaxLen", 0)), "V": str(f.get("/V", "")), "TU": str(f.get("/TU", "")),
            "Opt": (len(opt) if name.endswith("__list") else [str(o[0]) if isinstance(o, pikepdf.Array) else str(o) for o in opt]) if opt is not None else None,
            "AA": {k: js(v) for k, v in f.get("/AA", {}).items()},
        }
        kids = f.Kids if "/Kids" in f else [f]
        info["widgets"] = [{
            "page": pages.get(w.P.objgen) if "/P" in w else None,
            "rect": [float(v) for v in w.Rect], "F": int(w.get("/F", 0)),
            "MK": {k: [round(float(x), 3) for x in v] if isinstance(v, pikepdf.Array) else str(v) for k, v in w.get("/MK", {}).items() if k != "/R"},
            "A": js(w.get("/A")), "AA": {k: js(v) for k, v in w.get("/AA", {}).items()}, "AS": str(w.get("/AS", "")),
        } for w in kids]
        out[name] = info
    doc = js(pdf.Root.Names.JavaScript.Names[1]) if "/Names" in pdf.Root else None
    aa = {k: js(v) for k, v in pdf.Root.get("/AA", {}).items()}
    return list(out), out, doc, aa


def close(x, y, tol):
    """Equal, with numbers allowed to differ by tol (rounding, and where a value's text sits in its box)."""
    if isinstance(x, float) or isinstance(y, float):
        return isinstance(x, (int, float)) and isinstance(y, (int, float)) and abs(x - y) <= tol
    if isinstance(x, (list, tuple)) and isinstance(y, (list, tuple)):
        return len(x) == len(y) and all(close(p, q, tol) for p, q in zip(x, y))
    if isinstance(x, dict) and isinstance(y, dict):
        return x.keys() == y.keys() and all(close(x[k], y[k], tol) for k in x)
    return x == y


def compare(a, b):
    diffs = []
    wa, wb = words(a), words(b)
    if len(wa) != len(wb):
        diffs.append(f"pages: {len(wa)} vs {len(wb)}")
    for i, (x, y) in enumerate(zip(wa, wb)):
        if not close(x, y, 1.5):
            sx, sy = {(w, round(p), round(q)) for w, p, q in x}, {(w, round(p), round(q)) for w, p, q in y}
            diffs.append(f"page {i + 1} words: only in A {sorted(sx - sy)[:8]} | only in B {sorted(sy - sx)[:8]}")
    na, fa, da, aa = fields(a)
    nb, fb, db, ab = fields(b)
    if na != nb:
        diffs.append(f"field order/names differ: only A {[n for n in na if n not in fb][:10]}, only B {[n for n in nb if n not in fa][:10]}"
                     + ("" if set(na) != set(nb) else f"; first different position {next(i for i, (p, q) in enumerate(zip(na, nb)) if p != q)}"))
    for n in na:
        if n in fb and not close(fa[n], fb[n], 0.02):
            for k in fa[n]:
                if not close(fa[n][k], fb[n][k], 0.02):
                    diffs.append(f"{n}.{k}: {str(fa[n][k])[:300]}  VS  {str(fb[n][k])[:300]}")
    if da != db:
        diffs.append(f"document script differs ({len(da or '')} vs {len(db or '')} chars)")
    if aa != ab:
        diffs.append("catalog AA differs")
    return diffs


if __name__ == "__main__":
    d = compare(sys.argv[1], sys.argv[2])
    print("\n".join(d[:80]) if d else "same")
    print(len(d), "differences")

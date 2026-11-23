#!/usr/bin/env python3
"""Copies the smart forms from the lc-form project into the studio (rerun after any form changes there).

    python3 scripts/smartforms.py ~/Documents/lc-form

Writes
    src/canvas/smartforms.json      every form file in lc-form/forms: FORM, DEFAULTS, PDF_NAME (the studio's form list)
    src/canvas/metrics.json         Adobe's Helvetica widths, the same table layout.py measures text with
    tests/fixtures/layout-parity.json   where lc-form's layout.py puts every field of every form, so a test can check
                                    the studio's copy of the layout (src/canvas/layout.ts) puts them in the same place
Only lc-form's step 1 (layout.py) runs: no pikepdf needed.
"""
import importlib.util
import json
import os
import sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP = {"example_form.py"}   # the copy-me example, not a bank form


def main(lc_form):
    lc_form = os.path.abspath(os.path.expanduser(lc_form))
    forms_dir = os.path.join(lc_form, "forms")
    sys.path[:0] = [lc_form, forms_dir]
    sys.dont_write_bytecode = True
    import layout   # lc-form's layout.py (no pikepdf)

    forms, parity = [], {}
    for name in sorted(os.listdir(forms_dir)):
        if not name.endswith("_form.py") or name in SKIP:
            continue
        spec = importlib.util.spec_from_file_location(name[:-3], os.path.join(forms_dir, name))
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        form, defaults = module.FORM, getattr(module, "DEFAULTS", {})
        forms.append({"file": name, "form": form, "defaults": defaults, "pdfName": getattr(module, "PDF_NAME", None)})
        parity[name] = lay_out(layout, form, defaults)

    # the options no smart form uses yet (section buttons, paragraph height), on the example form
    example = importlib.util.spec_from_file_location("example_form", os.path.join(forms_dir, "example_form.py"))
    ex = importlib.util.module_from_spec(example)
    example.loader.exec_module(ex)
    ex.FORM["sections"][-1]["buttons"] = ["check-form", "generate-qr", "print-form"]
    ex.FORM["sections"][1]["fields"][-1]["height"] = 110
    parity["options"] = {**lay_out(layout, ex.FORM, ex.DEFAULTS), "form": ex.FORM, "defaults": ex.DEFAULTS}

    lists = {}
    lc = importlib.import_module("lc_form")
    for key in ("CURRENCIES", "COUNTRIES"):
        lists[key] = getattr(lc, key)

    write("src/canvas/smartforms.json", {"lists": lists, "forms": forms})
    write("src/canvas/metrics.json", layout.METRICS)
    write("tests/fixtures/layout-parity.json", parity)
    print(f"{len(forms)} forms copied from {lc_form}")


def lay_out(layout, form, defaults):
    """Step 1 the way pdf_writer.build runs it (twice: spare room on the last page goes to its paragraph boxes)."""
    def once(extra):
        lay = layout.Layout(form, defaults, extra)
        lay.draw()
        return lay
    lay = once({})
    last = [qid for qid, page in lay.paragraph_page.items() if page == lay.last_question_page]
    if last and lay.spare >= 20:
        each = min(90, int((lay.spare - 10) // len(last)))
        taller = once({qid: each for qid in last})
        if len(taller.pages) == len(lay.pages):
            lay = taller
    r = lambda n: round(n, 3)
    return {"pages": len(lay.pages), "ops": [len(p.ops) for p in lay.pages],
            "widgets": [[f["name"], w["page"], *map(r, w["rect"])] for f in lay.fields for w in f["widgets"]]}


def write(path, data):
    with open(os.path.join(HERE, path), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "~/Documents/lc-form")

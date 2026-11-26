#!/usr/bin/env python3
"""Copies lc-form's own Acrobat JavaScript into the studio, so the browser form (fill/) runs the SAME rules engine,
QR payload and QR encoder as the PDF. Rerun after any change in lc-form (acrobat_js.py, pdf_writer.py, layout.py, forms/):

    ~/Documents/lc-form/.venv/bin/python scripts/fill-engine.py ~/Documents/lc-form [--out DIR]

For every form (the same list as scripts/smartforms.py) it runs lc-form's steps 1 and 2 (layout, then pdf_writer.add_scripts)
and writes what step 3 would have stored in the PDF:
    src/fill/gen/<form>.ts       the form's document script (lcModel, lcDeps, lcRules, lcPayload, lcQrMatrix, lcDrawQr ...,
                                 filled in exactly as pdf_writer.document_script does) as a function, the K / V scripts of its
                                 boxes (keys refused while typing, a whole answer checked) and which event re-runs the rules
    src/fill/gen/buttons.ts      the button scripts (check-form, reset-form, generate-qr, print-form) and the two rule events
    src/fill/gen/menu.json       build_all.py's main menu: groups, form codes, the terms wording and the two messages
    tests/fixtures/fill-fields.json    the fields the PDF has (name, kind, options) and which event re-runs the rules on which
                                 box, for the tests to check that the browser form builds the same fields
The scripts are copied word for word, only wrapped in a function (no eval, so the site's content security policy holds).
Only lc-form is read; nothing in it is changed.
"""
import importlib.util
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP = {"example_form.py"}   # the copy-me example, not a bank form
# The document script's functions the button scripts call by name (in Acrobat they are document-level functions). The first four are
# lcRules ... lcDates as before; the rest are found in the button scripts, so a new one in lc-form is passed on without a change here.
CORE = ["lcRules", "lcPayload", "lcDrawQr", "lcDates"]
HEADER = "// @ts-nocheck: lc-form's Acrobat JavaScript, copied word for word by scripts/fill-engine.py (do not edit; rerun it)\n"


def main(lc_form, out):
    lc_form = os.path.abspath(os.path.expanduser(lc_form))
    forms_dir = os.path.join(lc_form, "forms")
    sys.path[:0] = [lc_form, forms_dir]
    sys.dont_write_bytecode = True
    import acrobat_js
    import build_all
    import layout
    import pdf_writer

    names = lib_names(acrobat_js.BUTTON_JS)
    files, raw = {}, {}
    for name in sorted(os.listdir(forms_dir)):
        if not name.endswith("_form.py") or name in SKIP:
            continue
        spec = importlib.util.spec_from_file_location(name[:-3], os.path.join(forms_dir, name))
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        lay = lay_out(layout, module.FORM, getattr(module, "DEFAULTS", {}))
        doc_script = pdf_writer.add_scripts(lay)   # step 2, exactly as pdf_writer.build runs it

        events, rule_events, section_buttons = {}, {}, {}
        for f in lay.fields:
            if f.get("events") and not f["name"].startswith("__"):
                kv = {k: v for k, v in f["events"].items() if k in ("K", "V") and "AFDate" not in v}   # a date box's AFDate_* calendar is Acrobat's own
                if kv:
                    events[f["name"]] = kv
            for w in f["widgets"]:
                for k, code in (w.get("events") or {}).items():
                    assert code == pdf_writer.RULES_ON_EVENT, (name, f["name"], code)
                    rule_events[f["name"]] = k
            if f.get("script"):
                section_buttons[f["name"]] = f["script"]
        fields = [{"name": f["name"], "type": f["type"], **({"options": f["options"]} if f["type"] == "radio" else {})} for f in lay.fields
                  if not re.fullmatch(r"__qr[12]_\d+", f["name"])]   # the 2 x 177 rows of the QR codes: the same on every form
        raw[name] = {"fields": fields, "ruleEvents": rule_events, "sectionButtons": section_buttons}
        files[f"src/fill/gen/{name[:-3]}.ts"] = form_module(doc_script, events, rule_events, section_buttons, names)

    files["src/fill/gen/buttons.ts"] = buttons_module(acrobat_js.BUTTON_JS, pdf_writer.RULES_ON_EVENT, pdf_writer.RULES_ON_CALC, names)
    files["src/fill/gen/menu.json"] = json_text(menu(build_all, lc_form))
    files["tests/fixtures/fill-fields.json"] = json_text(raw)
    for path, text in files.items():
        os.makedirs(os.path.dirname(os.path.join(out, path)), exist_ok=True)
        with open(os.path.join(out, path), "w", encoding="utf-8", newline="\n") as f:
            f.write(text)
    print(f"{len(raw)} forms' scripts copied from {lc_form} into {out}")


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
    return lay


def json_text(data):
    return json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n"


def fn(code, params):
    return f"function ({params}) {{\n{code}\n}}"


def lib_names(buttons):
    """Every document function a button script calls: CORE first, then the others in name order (lcWarnedAt is the buttons' own)."""
    used = set(re.findall(r"\blc[A-Z]\w*", "\n".join(buttons.values()))) - {"lcWarnedAt"} - set(CORE)
    return CORE + sorted(used)


def form_module(doc_script, events, rule_events, section_buttons, names):
    """The document script is a function that defines lcRules ... and returns them; `this` is the document."""
    ev = ",\n".join(f"{json.dumps(n)}: {{ " + ", ".join(f"{k}: {fn(c, 'event, app')}" for k, c in kv.items()) + " }" for n, kv in events.items())
    return (HEADER +
            "export const document = " + fn(doc_script + "\nreturn { lcRules: lcRules, lcPayload: lcPayload, lcDrawQr: lcDrawQr, lcDates: lcDates, lcQrMatrix: lcQrMatrix, lcWords: lcWords" +
            "".join(f", {n}: typeof {n} == \"function\" ? {n} : undefined" for n in names if n not in CORE) + " };", "app, color, display, console") + ";\n" +
            f"export const keys = {{\n{ev}\n}};\n" +
            f"export const ruleEvents = {json.dumps(rule_events)};\n" +
            f"export const sectionButtons = {json.dumps(section_buttons)};\n")


def buttons_module(buttons, on_event, on_calc, names):
    """Each button script runs with `this` = the document, and the functions of the document script as arguments (before-save too: the
    warning the PDF gives before saving or printing, which the page runs when the browser prints)."""
    params = "app, event, " + ", ".join(names)
    body = ",\n".join(f"{json.dumps(k)}: {fn(v, params)}" for k, v in buttons.items())
    # before-save ("Before printing: ...", on the browser's own print) keeps the time it last warned in lcWarnedAt, a variable of the document script
    return (HEADER + "let lcWarnedAt = 0;\n" + f"export const libNames = {json.dumps(names)};\n" + f"export const buttons = {{\n{body}\n}};\n" +
            f"export const onEvent = {fn(on_event, 'event, lcRules')};\n" +
            f"export const onCalc = {fn(on_calc, 'event, lcRules')};\n")


def menu(build_all, lc_form):
    """The main menu as build_all.py makes it: its groups, form codes, terms wording and messages (read from its showForm / showMenu)."""
    js = build_all.MENU_JS
    ticked = re.search(r'app\.alert\("(Please tick the box[^"]*)"', js).group(1)
    back = re.search(r'app\.alert\("(Go back to the main menu\? The answers in )" \+ TITLES\[was\] \+ "([^"]*)"', js)
    groups = []
    for group, forms in build_all.MENU:
        entries = []
        for file, code in forms:
            module = importlib.util.spec_from_file_location(file[:-3], os.path.join(lc_form, "forms", file))
            m = importlib.util.module_from_spec(module)
            module.loader.exec_module(m)
            entries.append({"file": file, "code": code, "formCode": re.search(r"[A-Z]+-\d+", m.FORM["formCode"]).group(0), "title": m.FORM["title"]})
        groups.append({"group": group, "forms": entries})
    return {"terms": build_all.TERMS_TEXT, "notTicked": ticked, "back": [back.group(1), back.group(2)], "groups": groups}


if __name__ == "__main__":
    if os.environ.get("PYTHONHASHSEED") != "0":   # lc-form's dependency index is built from sets: fix the order so the same input gives the same files
        os.execve(sys.executable, [sys.executable, *sys.argv], {**os.environ, "PYTHONHASHSEED": "0"})
    args = sys.argv[1:]
    out = args[args.index("--out") + 1] if "--out" in args else HERE
    rest = [a for i, a in enumerate(args) if a != "--out" and (i == 0 or args[i - 1] != "--out")]
    main(rest[0] if rest else "~/Documents/lc-form", out)

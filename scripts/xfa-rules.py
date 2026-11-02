"""Pulls the "mandatory when ..." rules out of the bank smart form's scripts.

The smart form makes fields mandatory with scripts such as
    if (this.rawValue == "Term") { controlScript.mandatoryChange(txtTerm, 1); }
This reads the decrypted XFA template and writes one rule per (trigger field, values, target field):
    python3 scripts/xfa-rules.py template.xml rules.json
With --open, it instead lists what each choice unlocks (accessChange(field, "open"): read-only until then).
Get template.xml from the PDF with pypdf + cryptography (see README). Only simple conditions
(this.rawValue == "a" || ...) and their else-branches are understood; anything else is skipped.
"""
import json, re, sys, xml.etree.ElementTree as ET

OPEN = "--open" in sys.argv
if OPEN: sys.argv.remove("--open")

root = ET.parse(sys.argv[1]).getroot()
NS = root.tag.split("}")[0] + "}"
tag = lambda e: e.tag.replace(NS, "")
parents = {c: p for p in root.iter() for c in p}

def path(e):  # named subforms from the root, the same path the app's XFA reader uses
    out = []
    while e in parents:
        e = parents[e]
        if tag(e) == "subform" and e.get("name"): out.append(e.get("name"))
    return out[::-1]

key = lambda e: ".".join(path(e) + [e.get("name") or "choice"])
FIELDS = [e for e in root.iter() if tag(e) in ("field", "exclGroup") and not (tag(e) == "field" and tag(parents[e]) == "exclGroup")]

def find(name, start):
    """XFA-style name lookup: a full path from form1, else the nearest container that has it."""
    parts = name.replace("[0]", "").split(".")
    if parts[0] == "form1":
        return next((f for f in FIELDS if key(f) == ".".join(parts)), None)
    scope = start
    while scope is not None:
        for f in FIELDS:
            k = key(f).split(".")
            p, s = path(f), path(scope) + ([scope.get("name")] if tag(scope) == "subform" and scope.get("name") else [])
            if k[-1] == parts[-1] and p[:len(s)] == s and (len(parts) == 1 or p[-(len(parts) - 1):] == parts[:-1]):
                return f
        scope = parents.get(scope)
    return None

def on_values(f):  # what rawValue each choice of a radio group has, in order
    out = []
    for c in f:
        if tag(c) == "field":
            items = c.find(NS + "items")
            out.append((items[0].text or "").strip() if items is not None and len(items) else "")
    return out

def blocks(src):
    """Top-level if / else-if / else chains: [(condition or None, body)]."""
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    src = re.sub(r"//[^\n]*", "", src)
    i, chains = 0, []
    def body_at(j):
        while j < len(src) and src[j].isspace(): j += 1
        if not src.startswith("{", j):  # if (...) one statement;
            end = src.find(";", j); end = len(src) if end < 0 else end + 1
            return src[j:end], end
        d = 0
        for k in range(j, len(src)):
            d += {"{": 1, "}": -1}.get(src[k], 0)
            if d == 0: return src[j + 1:k], k + 1
        return src[j + 1:], len(src)
    while (m := re.compile(r"\bif\s*\(").search(src, i)):
        chain, j = [], m.end()
        while True:
            d, k = 1, j
            while d and k < len(src): d += {"(": 1, ")": -1}.get(src[k], 0); k += 1
            cond = src[j:k - 1]
            body, j = body_at(k)
            chain.append((cond, body))
            e = re.compile(r"\s*else\s*if\s*\(").match(src, j)
            if e: j = e.end(); continue
            e = re.compile(r"\s*else\s*\{").match(src, j)
            if e: body, j = body_at(e.end() - 1); chain.append((None, body))
            break
        chains.append(chain); i = j
    return chains

def values(cond):
    alts = [a.strip().strip("()").strip() for a in cond.split("||")]
    out = []
    for a in alts:
        m = re.fullmatch(r'(?:this\.rawValue|xfa\.event\.newText)\s*==\s*"?([^"]*)"?', a)
        if not m: return None
        out.append(m.group(1))
    return out

def targets(body):
    flat = body
    while (m := re.search(r"\bif\s*\(", flat)):  # nested ifs have their own conditions: leave them out
        d, k = 0, flat.index("{", m.end())
        for k2 in range(k, len(flat)):
            d += {"{": 1, "}": -1}.get(flat[k2], 0)
            if d == 0: break
        flat = flat[:m.start()] + flat[k2 + 1:]
    if OPEN: return [t for t in re.findall(r"accessChange(?:BE)?\(\s*([\w.\[\]]+)\s*,\s*\"open\"\s*\)", flat) if t != "this"]
    on = re.findall(r"mandatoryChange\(\s*([\w.\[\]]+)\s*,\s*1\s*\)", flat) + re.findall(r"([\w.\[\]]+)\.validate\.nullTest\s*=\s*\"error\"", flat)
    return [t for t in on if t != "this"]

rules = []
for f in FIELDS:
    scripts = [s.text for ev in f.iter(NS + "event") if ev.get("activity") in ("change", "click") for s in ev.iter(NS + "script") if s.text]
    for src in scripts:
        for chain in blocks(src):
            seen = []
            for cond, body in chain:
                vs = values(cond) if cond is not None else seen
                if vs is None: break
                for t in targets(body):
                    target = find(t, parents[f])
                    if target is None or target is f: continue
                    idx = None
                    if tag(f) == "exclGroup":
                        ov = on_values(f); idx = [ov.index(v) for v in vs if v in ov]
                        if not idx: continue
                    rule = {"trigger": key(f), "values": vs, "options": idx, "not": cond is None, "target": key(target)}
                    if rule not in rules: rules.append(rule)
                if cond is not None: seen = seen + vs
json.dump(rules, open(sys.argv[2], "w"), indent=1)
print(len(rules), "rules;", "LC:", sum(r["trigger"].startswith("form1.LC.") for r in rules))

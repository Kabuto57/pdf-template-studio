"""Copies the LC application's page layout out of the bank smart form, so our PDF looks like the one customers know.

    python3 scripts/xfa-layout.py template.xml src/lc-layout.json

template.xml is the decrypted XFA template (see README). Output: pages of items in millimetres from the
page's top-left: text, lines, boxes, and each fillable field's box (keyed by its XFA path), ready for
src/lc-pdf.ts to draw with pdf-lib. Only what XFA needs for this form is understood: positioned and
top-to-bottom subforms, draws (text, rich text, lines, rectangles), captions, borders and check boxes.
"""
import json, re, sys, xml.etree.ElementTree as ET

root = ET.parse(sys.argv[1]).getroot()
NS = root.tag.split("}")[0] + "}"
T = lambda e: e.tag.replace(NS, "")
XH = "{http://www.w3.org/1999/xhtml}"
PAGE_TOP, PAGE_LEFT, PAGE_H = 28.325, 12.0, 255.675  # content area of the bank's page (A4)
S = 1.0   # 1 = the bank's own size and spacing (the original look)
FIELD = 1.0  # how much boxes grow with the rows (when S > 1)

def mm(v, default=0.0):
    if v is None: return default
    m = re.fullmatch(r"(-?[\d.]+)(mm|in|pt|cm)?", v.strip())
    n, u = float(m.group(1)), m.group(2) or "in"
    return n * {"mm": 1, "in": 25.4, "pt": 25.4 / 72, "cm": 10}[u]

def plain(s):  # no bank name in the copy
    s = re.sub(r"go\.dbs\.com\S*?(?=[\]\s)]|$)", "the Bank's website", s)
    s = re.sub(r"DBS Bank Ltd\.?|DBS BANK LTD\.?", "the Bank", s)
    return re.sub(r"\bDBS\b", "Bank", s)

def font(e, inherit=(9.0, False)):
    f = e.find(NS + "font")
    if f is None: return inherit
    return (mm(f.get("size"), inherit[0] * 25.4 / 72) * 72 / 25.4 if f.get("size") else inherit[0], f.get("weight") == "bold" or inherit[1])

def rich(v):
    """Paragraphs of an exData (XHTML) or text value, with bold if the paragraph's style says so."""
    out = []
    for c in v:
        if T(c) == "text" and (c.text or "").strip(): out.append((re.sub(r"\s+", " ", c.text).strip(), None, None))
        if T(c) == "exData":
            for p in c.iter(XH + "p") if list(c.iter(XH + "p")) else [c]:
                txt = re.sub(r"\s+", " ", "".join(p.itertext())).strip()
                style = " ".join(x.get("style") or "" for x in p.iter())
                size = re.search(r"font-size:([\d.]+)pt", style)
                if txt: out.append((txt, float(size.group(1)) if size else None, "font-weight:bold" in style))
    return out

def edges(e):
    """Which sides of an element's border show: (top, right, bottom, left) or None."""
    b = e.find(NS + "border")
    if b is None or b.get("presence") in ("hidden", "invisible"): return None
    es = b.findall(NS + "edge")
    if not es: return (True,) * 4
    vis = [x.get("presence") not in ("hidden", "invisible") for x in es]
    vis = (vis * 4)[:4] if len(vis) == 1 else vis + [vis[-1]] * (4 - len(vis)) if len(vis) < 4 else vis[:4]
    return tuple(vis) if any(vis) else None

# Shown after a choice in the smart form; always shown here (mandatory only when they apply). The other
# shipment-place variants sit in the same spot, so only the port ones are kept.
SHOW = {"subfrmPortOfLoad", "subfrmDischarge", "lblTermOps", "radTerm", "lblFOBCFR", "drpForFOBCFR", "subfrmCoverNo"}
# The bank's form grows these boxes as you type; a PDF cannot, so they start taller (mm, before stretching).
GROW = {"txtGoodsDescription": 22.0, "txtAdditionalCond": 14.0}
GROW_PARENT = {"subfrmGoodsDescription": 28.5, "subfrmAdditionalCond": 20.5}

def hidden(e): return e.get("presence") in ("hidden", "invisible", "inactive") and e.get("name") not in SHOW

items, KEEP = [], False
def add(kind, x, y, **kw): items.append({"k": kind, "x": round(x, 2), "y": round(y, 2), **kw, **({"keep": 1} if KEEP else {})})

def path_of(stack, name): return ".".join(stack + [name or "choice"])

def flow(e, width):
    """Child offsets of a flowed container: top to bottom, or left to right wrapping at `width`."""
    out, x, y, row = [], 0.0, 0.0, 0.0
    for c in e:
        if T(c) not in ("subform", "draw", "field", "exclGroup") or hidden(c): continue
        h = extent(c)
        if e.get("layout") == "lr-tb":
            w = mm(c.get("w"), 0)
            if x > 0 and x + w > width + 0.01: x, y, row = 0.0, y + row, 0.0
            out.append((c, x, y)); x += w; row = max(row, h)
        else:
            out.append((c, mm(c.get("x")), y)); y += h
    return out, y + row

def extent(e, width=186.0):
    """Height a child takes when its own h is not given."""
    if e.get("name") in GROW_PARENT: return max(mm(e.get("h"), 0), GROW_PARENT[e.get("name")])
    if e.get("h"): return mm(e.get("h"))
    if T(e) == "subform":
        if e.get("layout") in ("tb", "lr-tb"): return flow(e, mm(e.get("w"), width))[1]
        return max([mm(c.get("y")) + extent(c) for c in e if T(c) in ("subform", "draw", "field", "exclGroup") and not hidden(c)] or [0])
    if T(e) == "draw":
        v = e.find(NS + "value"); size = font(e)[0]
        return max(1, len(rich(v)) if v is not None else 1) * size * 1.25 * 25.4 / 72
    return mm(e.get("minH"), 6)

def lay(e, ox, oy, stack, width=186.0):
    """Lays out the children of container e whose top-left is (ox, oy)."""
    width = mm(e.get("w"), width)
    if e.get("layout") in ("tb", "lr-tb"): kids = [(c, ox + dx, oy + dy) for c, dx, dy in flow(e, width)[0]]
    else: kids = [(c, ox + mm(c.get("x")), oy + mm(c.get("y"))) for c in e if T(c) in ("subform", "draw", "field", "exclGroup") and not hidden(c)]
    global KEEP
    for c, cx, cy in kids:
        k = T(c)
        h = extent(c, width)
        was = KEEP; KEEP = KEEP or c.get("name") in ("lblTermOps", "radTerm")
        if k == "subform":
            name = c.get("name")
            b = edges(c)
            if b: add("box", cx, cy, w=mm(c.get("w"), 0), h=h, edges=b)
            lay(c, cx, cy, stack + ([name] if name else []), width)
        elif k == "draw": draw(c, cx, cy, h)
        elif k == "field": field(c, cx, cy, h, stack)
        elif k == "exclGroup":
            for opt in c:
                if T(opt) == "field" and not hidden(opt):
                    field(opt, cx + mm(opt.get("x")), cy + mm(opt.get("y")), mm(opt.get("h"), 4), stack, group=path_of(stack, c.get("name")))
        KEEP = was

def draw(d, x, y, h):
    w = mm(d.get("w"), 0)
    v = d.find(NS + "value")
    if v is None: return
    kids = [T(c) for c in v]
    size, bold = font(d)
    para = d.find(NS + "para"); align = para.get("hAlign", "left") if para is not None else "left"
    if "line" in kids:
        ln = v.find(NS + "line"); slope = ln.get("slope", "\\")
        if w <= 0.01: add("line", x, y, x2=x, y2=y + h)
        elif h <= 0.01: add("line", x, y, x2=x + w, y2=y)
        else: add("line", x, y + (0 if slope == "\\" else h), x2=x + w, y2=y + (h if slope == "\\" else 0))
    elif "rectangle" in kids: add("box", x, y, w=w, h=h, edges=(True,) * 4)
    elif "arc" in kids: add("oval", x, y, w=w, h=h)
    elif "image" in kids: pass  # the bank's logo: left out
    else:
        paras = rich(v)
        if paras:
            s = paras[0][1] or size
            add("text", x, y, w=w, size=round(s, 2), bold=bool(paras[0][2] if paras[0][2] is not None else bold), align=align, text=plain("\n".join(p[0] for p in paras)))

def field(f, x, y, h, stack, group=None):
    w = mm(f.get("w"), 0)
    h = GROW.get(f.get("name"), h)
    ui = f.find(NS + "ui"); kind = T(ui[0]) if ui is not None and len(ui) else "textEdit"
    if kind in ("button", "barcode", "signature"): return
    size, bold = font(f)
    cap = f.find(NS + "caption")
    ctext = plain(re.sub(r"\s+", " ", "".join(cap.itertext())).strip()) if cap is not None and cap.get("presence") not in ("hidden", "invisible") else ""
    place = cap.get("placement", "left") if cap is not None else "left"
    reserve = mm(cap.get("reserve")) if cap is not None and cap.get("reserve") else None
    csize = font(cap, (size, bold)) if cap is not None else (size, bold)
    bx, by, bw, bh = x, y, w, h
    if ctext:
        if place == "top":
            r = reserve or csize[0] * 1.4 * 25.4 / 72
            add("text", x, y, w=w, size=round(csize[0], 2), bold=csize[1], align="left", text=ctext); by, bh = y + r, h - r
        elif place == "bottom":
            r = reserve or csize[0] * 1.6 * 25.4 / 72; bh = h - r
            add("text", x, y + h - r + 0.5, w=w, size=round(csize[0], 2), bold=csize[1], align="center", text=ctext)
            add("line", x, y + h - r, x2=x + w, y2=y + h - r)
        elif place == "right" and kind != "checkButton":
            r = reserve or w / 2; bw = w - r
            add("text", x + bw + 1, y + (h - csize[0] * 25.4 / 72) / 2, w=r, size=round(csize[0], 2), bold=csize[1], align="left", text=ctext)
        elif kind != "checkButton":
            r = reserve if reserve is not None else w / 3
            add("text", x, y + (h - csize[0] * 25.4 / 72) / 2, w=r, size=round(csize[0], 2), bold=csize[1], align="left", text=ctext); bx, bw = x + r, w - r
    if kind == "checkButton":
        cb = ui[0]; s = mm(cb.get("size"), 3.5); shape = cb.get("shape", "square")
        add("check", x, y + (h - s) / 2, w=s, h=s, round=shape == "round", key=group or path_of(stack, f.get("name")),
            option=(f.find(NS + "items")[0].text if group and f.find(NS + "items") is not None else None))
        if ctext: add("text", x + s + 1.2, y + (h - csize[0] * 25.4 / 72) / 2, w=max(w - s - 1.2, 1), size=round(csize[0], 2), bold=csize[1], align="left", text=ctext)
        return
    multi = kind == "textEdit" and ui[0].get("multiLine") == "1"
    e = edges(ui[0]) or edges(f)
    line = "box" if e and all(e) else "under" if e and e[2] else "none"  # most boxes on the bank's form are a bottom line
    add("field", bx, by, w=bw, h=bh, key=path_of(stack, f.get("name")), ui=kind, multi=multi, size=round(size, 2), line=line)

def move(items, dy):
    for i in items:
        i["y"] = round(i["y"] + dy, 2)
        if "y2" in i: i["y2"] = round(i["y2"] + dy, 2)

def bottom(i):
    if i["k"] == "text": return i["y"] + i["size"] * 25.4 / 72 * 1.2 * (1 + i["text"].count("\n"))
    if i["k"] == "line": return max(i["y"], i["y2"])
    return i["y"] + i.get("h", 0)

def cut_at(items, limit):
    """The lowest section boundary (top of a box) above `limit` that no text, field or line crosses."""
    tops = sorted({i["y"] for i in items if i["k"] == "box" and i["y"] < limit - 1}, reverse=True)
    for c in tops:
        if c <= min(i["y"] for i in items) + 1: continue
        if not any(i["y"] < c - 0.3 and bottom(i) > c + 0.3 for i in items if i["k"] != "box"): return c
    return None

def split(items, c):
    """Items above the cut stay; the rest go over the page. Boxes crossing the cut are split in two."""
    here, rest = [], []
    for i in items:
        if i["k"] == "box" and i["y"] < c < i["y"] + i["h"]:
            t, r, b, l = i["edges"]
            here.append({**i, "h": round(c - i["y"], 2), "edges": [t, r, False, l]})
            rest.append({**i, "y": c, "h": round(i["y"] + i["h"] - c, 2), "edges": [False, r, b, l]})
        elif i["k"] == "line" and i["y"] < c < i["y2"]:
            here.append({**i, "y2": c}); rest.append({**i, "y": c})
        else: (here if i["y"] < c else rest).append(i)
    return here, rest

lc = next(s for s in root.iter(NS + "subform") if s.get("name") == "LC")
# Header from the bank's page master: title, date, mandatory note (the bank's name, address and logo are left out).
page1 = next(p for p in root.iter(NS + "pageArea") if p.get("name") == "Page1")
hdr = next(c for c in page1 if T(c) == "subform")
for c in hdr:
    if c.get("name") in ("lblLC", "lblMandatory", "lblOriginalCopy"): draw(c, mm(hdr.get("x")) + mm(c.get("x")), mm(c.get("y")), extent(c))
    if c.get("name") == "txtLCDate": field(c, mm(hdr.get("x")) + mm(c.get("x")), mm(c.get("y")), mm(c.get("h")), ["header"])
header = items; items = []

# The form body, page by page: subforms flow top to bottom and move to a new page when they no longer fit.
pages, y = [[]], PAGE_TOP
for part in lc:
    if T(part) != "subform" or hidden(part) or part.get("name") in ("LCBcode", "subfrmOthers", "subfrmBarcodeRecord", "subfrmMandatory"): continue
    blocks = [c for c in part if T(c) in ("subform", "draw", "field", "exclGroup") and not hidden(c)] if part.get("layout") == "tb" else [part]
    for b in blocks:
        h = extent(b)
        items = []
        holder = ET.Element(NS + "subform"); holder.set("layout", "tb"); holder.append(b)  # lay out b alone at y
        lay(holder, PAGE_LEFT, y, ["form1", "LC"] + ([part.get("name")] if b is not part else []))
        if b is part and part.get("name") == "subfrmLC":
            # The smart form shows the term-LC prepayment choice over the "Documents Required" heading when
            # Term is picked; here it is always shown, so everything below it moves down to make room.
            CUT, D = 114.1 + y - 0.0, 8.0
            for i in items:
                if i.get("keep"): continue
                if i["y"] >= CUT: i["y"] += D; i["y2"] = i["y2"] + D if "y2" in i else None
                elif i["k"] == "box" and i["y"] + i["h"] > CUT: i["h"] += D
                elif i["k"] == "line" and i["y2"] > CUT: i["y2"] += D
                i.pop("y2", None) if i.get("y2") is None else None
            h += D
        # Breathing room: stretch the block downwards. Text and tick boxes keep their size and stay
        # centred on the row they belonged to; boxes, lines and text fields grow.
        def sy(v): return y + (v - y) * S
        for i in items:
            if i["k"] == "check": i["y"] = round(sy(i["y"] + i["h"] / 2) - i["h"] / 2, 2)
            elif i["k"] == "field":
                nh = i["h"] * FIELD if i["h"] < 10 else i["h"] * S  # big text areas grow with the page
                i["y"] = round(sy(i["y"] + i["h"] / 2) - nh / 2, 2); i["h"] = round(nh, 2)
            elif i["k"] == "text":
                th = i["size"] * 25.4 / 72
                i["y"] = round(sy(i["y"] + th / 2) - th / 2, 2)
            else:
                if "h" in i: i["h"] = round(i["h"] * S, 2)
                if "y2" in i: i["y2"] = round(sy(i["y2"]), 2)
                i["y"] = round(sy(i["y"]), 2)
        h *= S
        if y + h > PAGE_TOP + PAGE_H and pages[-1]:  # no longer fits once stretched: start a new page
            move(items, PAGE_TOP - y); pages.append([]); y = PAGE_TOP
        # Taller than what is left of the page: cut it between sections and carry on over the page.
        while y + h > PAGE_TOP + PAGE_H + 0.01:
            cut = cut_at(items, PAGE_TOP + PAGE_H)
            if cut is None: break
            here, rest = split(items, cut)
            pages[-1] += here; pages.append([])
            move(rest, PAGE_TOP - cut); items = rest
            h -= cut - y; y = PAGE_TOP
        pages[-1] += items; y += h

# Where the bank's boxes overlap a little (invisible at its size), stop each box above the one below it.
for page in pages:
    boxes = [i for i in page if i["k"] == "field"]
    for a in boxes:
        for b in boxes:
            if a is not b and a.get("line") != "under" and a["y"] < b["y"] < a["y"] + a["h"] and a["x"] < b["x"] + b["w"] and b["x"] < a["x"] + a["w"]:
                a["h"] = round(b["y"] - a["y"] - 0.5, 2)

# A box that runs into a label on its row (the bank's "Tel No" box covers the start of "Fax No:") stops before it.
for page in pages:
    labels = [i for i in page if i["k"] == "text"]
    for f in (i for i in page if i["k"] == "field"):
        for t in labels:
            th = t["size"] * 25.4 / 72
            if f["y"] < t["y"] + th / 2 < f["y"] + f["h"] and f["x"] + 3 < t["x"] < f["x"] + f["w"]:
                f["w"] = round(t["x"] - f["x"] - 0.8, 2)

json.dump({"header": header, "pages": pages}, open(sys.argv[2], "w"), indent=None, separators=(",", ":"))
print(len(pages), "pages;", sum(len(p) for p in pages), "items;", sum(i["k"] in ("field", "check") for p in pages for i in p), "fields")

#!/usr/bin/env python3
"""BUILD A FILLABLE FORM PDF (the "new design") WITH PyMuPDF AND pikepdf

    python build_form.py form.json out.pdf [--mode javascript|no-javascript|both] [--values answers.json]

The same libraries the company AI has:
  PyMuPDF (import pymupdf)  draws the pages: header, section boxes, labels, numbers, footers, the QR code frame.
  pikepdf                   adds everything Acrobat needs: the fields and their looks, the buttons, the page links,
                            the scripts (js/*.js, filled in for this form) and the form's description.
  Node.js                   not needed to build; useful for running the form's scripts (js/*.js) outside Acrobat to test.

form.json is the form's description: {"title", "note", "issuer", "formCode", "sections": [{"title", "fields": [...]}]}.
Each field: {"id", "label", "kind": text|long|date|radio|checks|check|select, "options", "half", "required",
"requiredIf": [{"field", "values", "not"}], "activeIf", "max", "format": number|amount|phone|account}.
--values gives starting answers (e.g. {"mode_of_advising": "Full Swift"}).

Modes:
  javascript     Acrobat checks everything (red boxes that follow the answers, locking, Check form, Reset form, and a
                 last page with the QR code of the answers, Generate QR Code and Print Form).
  no-javascript  no scripts at all: red frames and grey shading that work with JavaScript off.
  both           the two together.
Coordinates: PDF points, x from the left, y from the BOTTOM (as in the PDF itself); PyMuPDF counts y from the top,
so the drawing helpers (text, line, rect) turn y around.
"""
import datetime
import io
import json
import os
import re
import sys
import zlib

import pikepdf
import pymupdf
from pikepdf import Array, Dictionary, Name, String

HERE = os.path.dirname(os.path.abspath(__file__))
# Template Studio's "Download builder" fills this in (and FORM, at the end), so one .py file builds one form on its own:
EMBEDDED = {}   # the helper files (helvetica-metrics.json, js/*.js), by name


def asset(name):
    """A helper file: from EMBEDDED when this is a one-file builder, else from beside this script."""
    if name in EMBEDDED:
        return EMBEDDED[name]
    return open(os.path.join(HERE, name), encoding="latin-1" if name.endswith(".js") else "utf-8").read()

# ---------------------------------------------------------------- the look (look.ts)
W, H, M = 595.28, 841.89, 42              # A4 in points, side margin
RED, INK, GREY, RULE, WHITE = (0.8, 0, 0), (0, 0, 0), (0.35, 0.35, 0.35), (0.75, 0.75, 0.75), (1, 1, 1)
ACCENT, TINT = (0, 0, 0), (0.88, 0.88, 0.88)
BOTTOM, BOX, LABEL, TEXT, COLS, CGAP = 39, 15, 7.5, 8.5, 12, 4
PAD, BAND, SECTION_GAP, INDENT, SIGN = 6, 13, 5, 14, 46

FORMATS = {  # typing filter, whole-answer check, message (types.ts)
    "number": ("[^0-9]", r"^\d+$", "should be a whole number"),
    "amount": ("[^0-9.,]", r"^\d{1,3}(,?\d{3})*(\.\d{1,2})?$", "is not an amount"),
    "phone": ("[^0-9+() -]", r"^\+?[\d ()-]*\d[\d ()-]*$", "is not a phone number (digits, spaces, + - ( ) only)"),
    "account": ("[^0-9-]", r"^\d[\d-]*\d$|^\d$", "is not an account number (digits and - only)"),
}
BAD_CHARS = "[^A-Za-z0-9 .,\\-/()':?+#&@%\\r\\n]"
PLAIN = {"‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-", "…": "..."}


def safe(s):
    """Text the standard fonts can draw (WinAnsi): curly quotes and dashes become plain, anything else unknown '?'."""
    return re.sub(r"[^\n\x20-\x7e\xa0-\xff€]", lambda m: PLAIN.get(m.group(0), "?"), s or "")


# Adobe's Helvetica metrics (glyph widths and kerning, per 1000 units), so text is measured exactly as Acrobat and
# the website's builder (pdf-lib) measure it. PyMuPDF's own Helvetica widths differ slightly.
METRICS = json.loads(asset("helvetica-metrics.json"))


def width(text, size, bold=False):
    m = METRICS["bold" if bold else "helv"]
    w = sum(m["widths"].get(c, 0) for c in text) + sum(m["kern"].get(text[i:i + 2], 0) for i in range(len(text) - 1))
    return w * size / 1000


def wrap(text, size, w):
    lines = []
    for paragraph in safe(text).split("\n"):
        line = ""
        for word in re.split(r"\s+", paragraph):
            longer = f"{line} {word}" if line else word
            if line and width(longer, size) > w:
                lines.append(line)
                line = word
            else:
                line = longer
        lines.append(line)
    return lines


def num(n):
    """A number for a PDF object: whole numbers as int, the rest rounded to 4 places."""
    return int(n) if n == int(n) else round(n, 4)


def fmt(n):
    return ("%.4f" % n).rstrip("0").rstrip(".")


# ---------------------------------------------------------------- the rules (rules.ts)
def holds(values, rule):
    answer = values.get(rule["field"])
    if isinstance(answer, list):
        hit = any(o in rule["values"] for o in answer)
    else:
        hit = ("true" if answer is True else "false" if answer is False else str(answer if answer is not None else "")) in rule["values"]
    if rule.get("not"):
        return not hit and answer is not None and answer != ""
    return hit


def is_required(f, values):
    return bool(f.get("required")) or any(holds(values, r) for r in f.get("requiredIf") or [])


def active_rules(f):
    return f["activeIf"] if "activeIf" in f else [r for r in f.get("requiredIf") or [] if not r.get("not")]


def has_options(kind):
    return kind in ("radio", "checks", "select")


# ---------------------------------------------------------------- dates (dates.ts)
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def say(d):
    return f"{d.day:02d} {MONTHS[d.month - 1]} {d.year}"


def date_options(now=None):
    """Every real date from the 1st of this month a year ago to the end of this month in two years."""
    now = now or datetime.date.today()
    first = datetime.date(now.year - 1, now.month, 1)
    nxt = datetime.date(now.year + 2 + (now.month == 12), now.month % 12 + 1, 1)
    out, d = [], first
    while d < nxt:
        out.append(say(d))
        d += datetime.timedelta(days=1)
    return out


# ---------------------------------------------------------------- scripts (js/*.js, shared with the website's builder)
def script(name, **values):
    text = asset("js/" + name)
    for k, v in values.items():
        text = text.replace(f"__{k}__", v)
    return text


def jsdumps(o):
    """JSON exactly as JavaScript's JSON.stringify writes it (no spaces, non-ASCII kept)."""
    return json.dumps(o, ensure_ascii=False, separators=(",", ":"))


# ================================================================ BUILD
class Builder:
    def __init__(self, t, values, mode, long_extra):
        self.t, self.values, self.mode, self.long_extra = t, values, mode, long_extra
        self.js = mode != "no-javascript"
        self.doc = pymupdf.open()
        self.fields = []        # every field and its widgets, in the order they are made (pikepdf adds them later)
        self.byname = {}
        self.links = []         # page links: (page, rect, to page)
        self.blocks = {}        # where each question was drawn, for the red frames
        self.shrink = set()     # boxes whose text shrinks to fit in Acrobat
        self.longs_on = {}      # the page each paragraph box landed on
        self.all = [f for s in t["sections"] for f in s["fields"]]
        self.byid = {f["id"]: f for f in self.all}
        self.number = {f["id"]: f"{si + 1}.{qi + 1}" for si, s in enumerate(t["sections"]) for qi, f in enumerate(s["fields"])}
        self.triggers = {r["field"] for f in self.all for r in (f.get("requiredIf") or []) + (f.get("activeIf") or [])}

    # ---- drawing (PyMuPDF counts y from the top)
    def text(self, s, x, y, size, bold=False, color=INK, page=None):
        (page or self.page).insert_text((x, H - y), s, fontname="hebo" if bold else "helv", fontsize=size, color=color)

    def line(self, x1, y1, x2, y2, thickness, color, page=None):
        (page or self.page).draw_line((x1, H - y1), (x2, H - y2), color=color, width=thickness)

    def rect(self, x, y, w, h, fill=None, border=None, bw=1, dashes=None, page=None):
        (page or self.page).draw_rect(pymupdf.Rect(x, H - y - h, x + w, H - y), color=border, fill=fill,
                                      width=bw if border else 0, dashes=dashes)

    def new_page(self, first=False):
        self.page = self.doc.new_page(width=W, height=H)
        who = safe(self.t.get("issuer", "")).upper()
        if who:
            self.text(who, M, H - 22, 9 if first else 7, True, ACCENT)
        if not first:
            self.text(safe(self.t["title"]), M + (width(who, 7, True) + 8 if who else 0), H - 22, 7, False, GREY)
        self.line(M, H - 29, W - M, H - 29, 1.5 if first else 0.5, ACCENT)
        self.top = H - 34

    # ---- fields (described now, written by pikepdf in write())
    def field(self, name, ft, **d):
        f = {"name": name, "ft": ft, "widgets": [], **d}
        self.fields.append(f)
        self.byname[name] = f
        return f

    def widget(self, f, x, y, w, h, **d):
        b = d.get("bw", 0) if d.get("border") else 0   # the box grows by half its border on each side (as pdf-lib does)
        wd = {"page": self.page.number, "rect": [x - b / 2, y - b / 2, x + w + b / 2, y + h + b / 2], **d}
        f["widgets"].append(wd)
        return wd

    # ---- 4. one question at (x, top) in width w; draws it only when draw. Returns its height.
    def place(self, f, x, w, draw, inline=False):
        v = self.values.get(f["id"])
        required = is_required(f, self.values)
        flag = required and bool(f.get("required"))
        blank = v is None or v == "" or v is False or (isinstance(v, list) and not v)
        look = {"border": RED, "bw": 1.25, "bg": WHITE} if required and blank else {"border": INK, "bw": 0.75, "bg": WHITE}
        if active_rules(f):
            look = {**look, "bg": None}   # see-through, so the grey "not yet" shade under it shows
        top, no = self.top, self.number.get(f["id"], "")
        no_w = width(no, LABEL, True) + 4 if no else 0

        if f["kind"] == "check":
            lines = wrap(f["label"], TEXT, w - 14 - no_w)
            if draw:
                box = self.field(f["id"], "check", tip=f["label"], required=flag, value=v is True)
                self.widget(box, x, top - 10, 9, 9, **look)
                if required:
                    self.text("*", x + 14 + no_w + width(lines[0] if lines else "", TEXT) + 2, top - 8, 8.5, True, RED)
                if no:
                    self.text(no, x + 14, top - 8, LABEL, True, ACCENT)
                for i, l in enumerate(lines):
                    self.text(l, x + 14 + no_w, top - 8 - i * 10, TEXT)
            return max(11, len(lines) * 10)

        label = safe(f["label"])
        inline_w = no_w + width(f"{label}:", TEXT) + (8 if required else 0) + 10
        choices = f["kind"] in ("radio", "checks")
        options = f.get("options") or []
        if choices and inline_w + sum(self.option_w(o) for o in options) <= w:
            ox = x + inline_w
            if draw:
                if no:
                    self.text(no, x, top - 9, LABEL, True, ACCENT)
                self.blocks[f["id"]] = {"page": self.page.number, "label": (x + no_w, top - 9, f"{label}:")}
                self.text(f"{label}:", x + no_w, top - 9, TEXT)
                if required:
                    self.text("*", x + no_w + width(f"{label}:", TEXT) + 2, top - 9, 8.5, True, RED)
                cx = self.options(f, options, v, look, flag, lambda i, cx: (cx, top - 10.5, top - 9), ox)
                self.blocks[f["id"]]["box"] = [ox - 3, top - 13, cx - ox - 4, 16]
            return 13

        if inline and self.can_inline(f, w):
            label_w = self.inline_label_w(f)
            if draw:
                if no:
                    self.text(no, x, top - 10.5, LABEL, True, ACCENT)
                self.blocks[f["id"]] = {"page": self.page.number, "label": (x + no_w, top - 10.5, f"{label}:")}
                self.text(f"{label}:", x + no_w, top - 10.5, LABEL)
                if required:
                    self.text("*", x + no_w + width(f"{label}:", LABEL) + 2, top - 10.5, 8.5, True, RED)
                self.draw_box(f, x + label_w, top - 1 - BOX, w - label_w, BOX, v, look, flag)
            return BOX + 2

        if draw:
            lx = x + no_w
            if no:
                self.text(no, x, top - 7, LABEL, True, ACCENT)
            self.blocks[f["id"]] = {"page": self.page.number, "label": (lx, top - 7, label)}
            self.text(label, lx, top - 7, LABEL)
            if required:
                self.text("*", lx + width(label, LABEL) + 2, top - 7, 8.5, True, RED)
        y = top - 10
        if f["kind"] == "select":
            if draw:
                self.draw_box(f, x, y - BOX, w, BOX, v, look, flag)
            return 10 + BOX
        if has_options(f["kind"]):
            cx, right, rows = x, x, [y]
            spots = []
            for i, o in enumerate(options):     # wraps onto more lines when needed
                span = self.option_w(o)
                if cx > x and cx + span > x + w:
                    cx = x
                    y -= 12
                spots.append((cx, y))
                right = max(right, cx + span - 10)
                cx += span
            if draw:
                self.options(f, options, v, look, flag, lambda i, _cx: (spots[i][0], spots[i][1] - 10.5, spots[i][1] - 9), x)
                self.blocks[f["id"]]["box"] = [x - 3, y - 13, right - x + 6, top - 10 - y + 16]
            return top - y + 12
        h = 50 + self.long_extra.get(f["id"], 0) if f["kind"] == "long" else BOX
        if draw and f["kind"] == "long":
            self.longs_on[f["id"]] = self.page.number
        if draw:
            self.draw_box(f, x, y - h, w, h, v, look, flag)
        return 10 + h

    def options(self, f, options, v, look, flag, where, cx):
        """Radio buttons (one field) or tick boxes (one field per option), with their wording beside them."""
        group = self.field(f["id"], "radio", tip=f["label"], required=flag, options=[safe(o) for o in options],
                           value=options.index(v) if isinstance(v, str) and v in options else None) if f["kind"] == "radio" else None
        for i, o in enumerate(options):
            bx, by, ty = where(i, cx)
            if group:   # radio buttons keep a white background (the grey shade case is handled in red_frames)
                self.widget(group, bx, by, 9, 9, state=str(i), **{**look, "bg": look["bg"] or WHITE})
            else:
                box = self.field(f"{f['id']}__{i}", "check", tip=f"{f['label']}: {o}", value=isinstance(v, list) and o in v)
                self.widget(box, bx, by, 9, 9, **look)
            self.text(safe(o), bx + 12, ty, TEXT)
            cx = bx + self.option_w(o)
        return cx

    def draw_box(self, f, x, y, w, h, v, look, flag):
        if f["kind"] == "select":
            opts = [safe(o) for o in f.get("options") or []]
            box = self.field(f["id"], "choice", tip=f["label"], required=flag, options=opts,
                             value=safe(v) if isinstance(v, str) and v in (f.get("options") or []) else None, size=TEXT)
            self.widget(box, x, y, w, h, **look)
        elif f["kind"] == "date":
            parts = v.split("/") if isinstance(v, str) and v else []
            picked = say(datetime.date(int(parts[2]), int(parts[1]), int(parts[0]))) if len(parts) == 3 else ""
            dates = date_options()
            if picked and picked not in dates:
                dates.insert(0, picked)
            lst = self.field(f"{f['id']}__list", "choice", tip=safe(f["label"]), options=["Pick a date", *dates],
                             value=picked or "Pick a date", size=TEXT)
            self.widget(lst, x, y, w, h, **look)
            if self.js:   # the calendar box, hidden until Acrobat's JavaScript shows it (lcDates)
                cal = self.field(f["id"], "text", tip=f"{safe(f['label'])} (DD/MM/YYYY)", value=v if isinstance(v, str) else "",
                                 size=TEXT, aa={"K": 'AFDate_KeystrokeEx("dd/mm/yyyy");', "F": 'AFDate_FormatEx("dd/mm/yyyy");'})
                self.widget(cal, x, y, w, h, hidden=True, **look)
        else:
            text = safe(v)[: f.get("max") or None] if isinstance(v, str) and v else ""
            box = self.field(f["id"], "text", tip=f["label"], required=flag, multiline=f["kind"] == "long",
                             max=f.get("max"), value=text, size=TEXT)
            one = safe(v).replace("\n", " ") if f["kind"] == "text" and isinstance(v, str) else ""
            room = w - 6
            box["size"] = min(TEXT, TEXT * room / max(room, width(one, TEXT)) if one else TEXT)
            if f["kind"] == "text" and room < width("N" * (f.get("max") or 35), TEXT):
                self.shrink.add(f["id"])
            if self.js:   # Acrobat: refuse wrong keys
                if f.get("format"):
                    bad, ok, msg = FORMATS[f["format"]]
                    message = json.dumps(f"{safe(f['label'])} {msg}.", ensure_ascii=False)
                    box["aa"] = {"K": f"if (!event.willCommit && /{bad}/.test(event.change)) {{ event.rc = false; app.beep(0); }}",
                                 "V": f'if (event.value !== "" && !/{ok}/.test(event.value)) {{ app.alert({message}); event.rc = false; }}'}
                else:
                    box["aa"] = {"K": f"if (!event.willCommit) {{ event.change = event.change.toUpperCase(); if (/{BAD_CHARS}/.test(event.change)) {{ event.rc = false; app.beep(0); }} }}"}
            self.widget(box, x, y, w, h, **look)

    def option_w(self, o):
        return 12 + width(safe(o), TEXT) + 10

    def inline_label_w(self, f):
        return (width(self.number[f["id"]], LABEL, True) + 4 if f["id"] in self.number else 0) + \
            width(f"{safe(f['label'])}:", LABEL) + (7 if f.get("required") or f.get("requiredIf") else 0) + 6

    def can_inline(self, f, w):
        return f["kind"] in ("text", "date", "select") and (f.get("max") or 35) <= 70 and \
            self.inline_label_w(f) <= w * 0.65 and w - self.inline_label_w(f) >= min(self.box_need(f), 110)

    def box_need(self, f):
        k, mx = f["kind"], f.get("max")
        if k == "long":
            return float("inf")
        if k == "check":
            return 0
        if k == "date":
            return 96
        if k == "select":
            return max(width(safe(o), TEXT) for o in f.get("options") or [""]) + 24
        if has_options(k):
            return sum(self.option_w(o) for o in f.get("options") or [])
        if f.get("format") == "number" or (mx or 99) <= 3:
            return 40
        m = mx or 35
        return 100 if m <= 20 else 165 if m <= 35 else 330 if (mx or 0) <= 70 else float("inf")

    # ---- 3. the 12-column grid
    def span(self, f, above=False):
        col_w = (W - 2 * M - (COLS - 1) * CGAP) / COLS
        label = width(safe(f["label"]), TEXT if f["kind"] == "check" else LABEL) + (16 if f["kind"] == "check" else 10) + 18
        box = self.box_need(f)
        least = COLS // 3 if f["kind"] == "check" and f["id"] in self.triggers else 1
        need = label + box + 12 if f["kind"] in ("radio", "checks") else \
            max(label, box) if f["kind"] == "long" or above else max(label, min(self.inline_label_w(f) + box, label + box))
        for n in range(least, COLS):
            if n * col_w + (n - 1) * CGAP >= need:
                return n
        return COLS

    def under(self, f, seen=None):
        seen = seen if seen is not None else set()
        for r in (f.get("requiredIf") or []) + (f.get("activeIf") or []):
            p = self.byid.get(r["field"])
            if not p or p["id"] in seen:
                continue
            seen.add(p["id"])
            if p["kind"] == "check" or self.under(p, seen):
                return True
        return False

    def inner(self, a):
        w = a["w"] - 2 * PAD
        cw = (w - (a["cols"] - 1) * CGAP) / a["cols"]
        return a["x"] + PAD, w, lambda n: n * cw + (n - 1) * CGAP

    def lines(self, s, cols):
        rows, used, last = [], cols, None
        for f in s["fields"]:
            n = min(cols, self.span(f))
            if used + n > cols or f["id"] in self.triggers or f["kind"] == "check" or (last and last["kind"] == "check") or \
                    (last and self.under(last) != self.under(f)):
                rows.append([])
                used = 0
            rows[-1].append(f)
            used += n
            last = f
        return rows

    def layout(self, row, area):
        a = {**area, "x": area["x"] + INDENT, "w": area["w"] - INDENT} if self.under(row[0]) else area
        x0, _, sw = self.inner(a)
        n = [min(a["cols"], self.span(f)) for f in row]
        grow = [f["kind"] in ("long", "select") or (f["kind"] == "text" and f.get("format") != "number" and (f.get("max") or 99) > 3) for f in row]
        k, spare, x = sum(grow), a["cols"] - sum(n), x0
        if k:
            for i in range(len(row)):
                if grow[i]:
                    add = -(-spare // k)
                    k -= 1
                    n[i] += add
                    spare -= add
        out = []
        for i, f in enumerate(row):
            w = sw(n[i])
            out.append((f, x, w))
            x += w + CGAP
        return out

    def inline_row(self, row, a):
        return all(f["kind"] in ("radio", "checks") or self.can_inline(f, w) for f, _, w in self.layout(row, a))

    def row_height(self, row, a):
        inl = self.inline_row(row, a)
        return max(self.place(f, x, w, False, inl) for f, x, w in self.layout(row, a))

    def note_of(self, s, a):
        return wrap(s["note"], 7.5, self.inner(a)[1]) if s.get("note") else []

    def section_height(self, s, a):
        note = self.note_of(s, a)
        return BAND + 4 + len(note) * 9 + (4 if note else 0) + sum(self.row_height(r, a) + 4 for r in self.lines(s, a["cols"])) + \
            (SIGN if s.get("signoff") else 0) + 1

    def draw_section(self, s, si, a, breaks, bottom=None):
        rows, note, whole = self.lines(s, a["cols"]), self.note_of(s, a), self.section_height(s, a)
        cx, cw, _ = self.inner(a)
        if breaks and self.top - (whole if s.get("signoff") or s.get("bankOnly") else BAND + 12 + (self.row_height(rows[0], a) if rows else 0)) < BOTTOM:
            self.new_page()
        box_top = self.top

        def outline():
            self.rect(a["x"], self.top, a["w"], box_top - self.top, border=INK, bw=0.6)

        fill = max(whole, self.top - bottom) if bottom is not None else whole
        if s.get("bankOnly"):
            self.rect(a["x"], self.top - fill, a["w"], fill, fill=(0.95, 0.95, 0.95))
        self.rect(a["x"], self.top - BAND, a["w"], BAND, fill=TINT)
        self.line(a["x"], self.top - BAND, a["x"] + a["w"], self.top - BAND, 0.6, INK)
        heading = safe(f"{si + 1}   {s['title'].upper()}{'  (to be completed by the Bank)' if s.get('bankOnly') else ''}")
        self.text(heading, a["x"] + PAD, self.top - 9.3, min(7.5, 7.5 * (a["w"] - 2 * PAD) / width(heading, 7.5, True)), True)
        self.top -= BAND + 4
        for l in note:
            self.text(l, cx, self.top - 7.5, 7.5)
            self.top -= 9
        if note:
            self.top -= 4
        for i, row in enumerate(rows):
            h = self.row_height(row, a)
            if breaks and self.top - h < BOTTOM:
                self.top -= 1
                outline()
                self.new_page()
                box_top = self.top
                self.top -= 5
            if i > 0:
                self.line(cx, self.top + 3, cx + cw, self.top + 3, 0.4, RULE)
            inl = self.inline_row(row, a)
            for f, x, w in self.layout(row, a):
                self.place(f, x, w, True, inl)
            self.top -= h + 4
        if s.get("signoff"):
            for x, w, label in ((cx, 190, "Authorised signature(s)"), (cx + 210, 110, "Date")):
                self.line(x, self.top - 28, x + w, self.top - 28, 0.75, INK)
                self.text(label, x, self.top - 36, 7, color=GREY)
            self.rect(cx + cw - 150, self.top - 43, 150, 41, border=INK, bw=0.75, dashes="[2 2] 0")
            self.text("Company stamp", cx + cw - 146, self.top - 39, 7, color=GREY)
            self.top -= SIGN
        self.top -= 1
        if bottom is not None:
            self.top = min(self.top, bottom)
        outline()
        self.top -= SECTION_GAP

    # ---- the whole form
    def draw(self):
        t = self.t
        self.new_page(first=True)
        self.text(safe(t["title"]), M, H - 48, 14, True)
        if t.get("formCode"):
            code = safe(t["formCode"])
            self.text(code, W - M - width(code, 7), H - 47, 7, color=GREY)
        self.top = H - 54
        for l in wrap(f"{safe(t.get('note', ''))}  * Mandatory. Boxes outlined in red must be completed; a red note under a question says when it becomes mandatory.", 7, W - 2 * M):
            self.text(l, M, self.top - 7.5, 7, color=GREY)
            self.top -= 9
        self.top -= 5

        full = {"x": M, "w": W - 2 * M, "cols": COLS}
        half_w = (W - 2 * M - SECTION_GAP) / 2
        left = {"x": M, "w": half_w, "cols": COLS // 2}
        right = {**left, "x": M + half_w + SECTION_GAP}

        def half_ok(s):
            iw = self.inner(left)[1]
            return not s.get("note") and not s.get("signoff") and width(s["title"].upper(), 6, True) + 30 < half_w and \
                all(f["kind"] != "long" and (all(self.option_w(o) < iw for o in f.get("options") or []) if has_options(f["kind"])
                                             else f["kind"] == "check" or self.span(f, True) <= COLS // 2) for f in s["fields"]) and \
                self.section_height(s, left) < 300

        secs, si = t["sections"], 0
        while si < len(secs):
            a = secs[si]
            b = secs[si + 1] if si + 1 < len(secs) else None
            ha = self.section_height(a, left) if b else 0
            hb = self.section_height(b, right) if b else 0
            if not (b and half_ok(a) and half_ok(b) and min(ha, hb) >= 0.45 * max(ha, hb)):
                self.draw_section(a, si, full, True)
                si += 1
                continue
            h = max(ha, hb) + SECTION_GAP
            if self.top - h < BOTTOM and self.top - self.section_height(a, full) - SECTION_GAP >= BOTTOM:
                self.draw_section(a, si, full, True)
                si += 1
                continue
            if self.top - h < BOTTOM:
                self.new_page()
            start = self.top
            bottom = start - max(ha, hb)
            self.draw_section(a, si, left, False, bottom)
            self.top = start
            self.draw_section(b, si + 1, right, False, bottom)
            si += 2

        # 5. JavaScript version: a last page for the QR code of the answers.
        self.form_last = self.page.number
        self.spare = self.top - BOTTOM
        self.qr = None
        if self.mode == "javascript":
            self.new_page()
            self.text("APPLICATION QR CODE (FOR BANK USE)", M, H - 56, 11, True)
            y = H - 70
            for l in wrap("When the form is filled in, press Generate QR Code (under the code), then Print Form. The Bank scans the code to read the application (all the answers, as JSON). Do not write on or fold the code.", 8, W - 2 * M):
                self.text(l, M, y, 8, color=GREY)
                y -= 10
            size = 450
            self.qr = {"page": self.page.number, "x": (W - size) / 2, "y": y - 14 - size, "size": size,
                       "button": ((W - 312) / 2, y - 14 - size - 52)}
            self.rect(self.qr["x"], self.qr["y"], size, size, border=RULE, bw=0.5)
            code = safe(t.get("formCode") or t["title"])
            self.text(code, (W - width(code, 7)) / 2, self.qr["y"] - 14, 7, color=GREY)

        # 6. Footers, and "< Previous page" / "Next page >" links (plain PDF links: they work with JavaScript off).
        n = self.doc.page_count
        for i in range(n):
            p = self.doc[i]
            self.line(M, 36, W - M, 36, 0.5, RULE, page=p)
            self.text(safe(t.get("formCode") or t["title"]), M, 24, 7, color=GREY, page=p)
            label = f"Page {i + 1} of {n}"
            self.text(label, W - M - width(label, 7.5), 24, 7.5, color=GREY, page=p)
            for text, to, x in (("< Previous page", i - 1, W / 2 - 90), ("Next page >", i + 1, W / 2 + 20)):
                if 0 <= to < n:
                    self.text(text, x, 23.5, 7.5, True, ACCENT, page=p)
                    self.links.append((i, [x - 4, 18, x + width(text, 7.5, True) + 4, 34], to))

    # ================================================================ pikepdf: fields, scripts, description
    def write(self):
        pdf = pikepdf.open(io.BytesIO(self.doc.tobytes()))
        self.pdf = pdf
        pages = [p.obj for p in pdf.pages]
        helv = pdf.make_indirect(Dictionary(Type=Name.Font, Subtype=Name.Type1, BaseFont=Name.Helvetica, Encoding=Name.WinAnsiEncoding))
        zadb = pdf.make_indirect(Dictionary(Type=Name.Font, Subtype=Name.Type1, BaseFont=Name.ZapfDingbats))
        self.fonts = Dictionary(Helvetica=helv, Helv=helv, ZaDb=zadb)
        t = self.t
        pdf.docinfo[Name.Title] = String(safe(t["title"]))
        pdf.docinfo[Name.Creator] = String("PDF Template Studio")
        # 1. The form's description, inside the PDF (the workbench reads the questions from it).
        stamp = {k: v for k, v in t.items() if k != "base"}
        stamp["uploaded"] = False
        pdf.Root[Name.FormTemplate] = pdf.make_stream(zlib.compress(jsdumps(stamp).encode("utf-8")), Filter=Name.FlateDecode)

        def annots(i):
            if Name.Annots not in pages[i]:
                pages[i][Name.Annots] = Array()
            return pages[i].Annots

        # Page links.
        for i, r, to in self.links:
            annots(i).append(pdf.make_indirect(Dictionary(Type=Name.Annot, Subtype=Name.Link, Rect=r, Border=[0, 0, 0],
                                                          A=Dictionary(S=Name.GoTo, D=[pages[to], Name.XYZ, None, None, None]))))
        if self.mode != "javascript":
            self.red_frames()
        has_rules = any(f.get("required") or f.get("requiredIf") for f in self.all)
        if self.js and has_rules:
            self.checks()
        # JavaScript version: "Reset form" goes back to the starting answers (e.g. Full Swift), not blank.
        objs = []
        for f in self.fields:
            d = self.make_field(f, pages)
            objs.append(d)
            for w in f["widgets"]:
                if not w.get("under"):
                    annots(w["page"]).append(w["obj"])
        for f in self.fields:   # the red frames and grey shade sit under the real boxes
            for w in f["widgets"]:
                if w.get("under"):
                    annots(w["page"]).insert(0, w["obj"])
        af = Dictionary(Fields=Array(objs), DR=Dictionary(Font=self.fonts), DA=String("/Helv 0 Tf 0 g"))
        if "__checks" in self.byname:
            af[Name.CO] = Array([self.byname["__checks"]["obj"]])
        pdf.Root[Name.AcroForm] = pdf.make_indirect(af)
        if getattr(self, "doc_script", None):
            stream = pdf.make_stream(zlib.compress(self.doc_script.encode("latin-1", "replace")), Filter=Name.FlateDecode)
            pdf.Root[Name.Names] = Dictionary(JavaScript=Dictionary(Names=[String("lcRules"), Dictionary(S=Name.JavaScript, JS=stream)]))
            pdf.Root[Name.AA] = Dictionary(WS=self.action(script("before-save.js")), WP=self.action(script("before-save.js")))
        return pdf

    def action(self, code):
        return Dictionary(S=Name.JavaScript, JS=String(code))

    def appearance(self, w, h, content):
        return self.pdf.make_stream(content.encode("latin-1", "replace"), Type=Name.XObject, Subtype=Name.Form,
                                    BBox=[0, 0, num(w), num(h)], Resources=Dictionary(Font=self.fonts))

    def frame(self, wd, w, h):
        """A box's background and border, as drawn in its appearance."""
        out = ""
        if wd.get("bg"):
            out += "%s rg 0 0 %s %s re f " % (" ".join(map(fmt, wd["bg"])), fmt(w), fmt(h))
        if wd.get("border") and wd.get("bw"):
            b = wd["bw"]
            out += "%s RG %s w %s %s %s %s re S " % (" ".join(map(fmt, wd["border"])), fmt(b), fmt(b / 2), fmt(b / 2), fmt(w - b), fmt(h - b))
        return out

    def make_field(self, f, pages):
        pdf, ft = self.pdf, f["ft"]
        d = Dictionary(T=String(f["name"]))
        if f.get("tip"):
            d[Name.TU] = String(safe(f["tip"]))
        flags = 2 if f.get("required") else 0
        size = f.get("size", TEXT)
        if ft == "text":
            d[Name.FT] = Name.Tx
            if f.get("multiline"):
                flags |= 4096
            if f.get("comb"):
                flags |= 16777216 | 1
            if f.get("max"):
                d[Name.MaxLen] = f["max"]
            if f.get("value"):
                d[Name.V] = String(f["value"])
            da = f.get("da") or "0 0 0 rg\n/Helvetica %s Tf" % ("0" if f["name"] in self.shrink else fmt(size))
            d[Name.DA] = String(da)
        elif ft == "choice":
            d[Name.FT] = Name.Ch
            flags |= 131072
            d[Name.Opt] = Array([Array([String(o), String(o)]) for o in f["options"]])
            if f.get("value") is not None:
                d[Name.V] = String(f["value"])
            d[Name.DA] = String("0 0 0 rg\n/Helvetica %s Tf" % fmt(size))
        elif ft == "check":
            d[Name.FT] = Name.Btn
            if f.get("value"):
                d[Name.V] = Name.Yes
            d[Name.DA] = String("/ZaDb 0 Tf 0 g")
        elif ft == "radio":
            d[Name.FT] = Name.Btn
            flags |= 32768 | (33554432 if f.get("unison") else 0)
            d[Name.Opt] = Array([String(o) for o in f["options"]])
            if f.get("value") is not None:
                d[Name.V] = Name("/%d" % f["value"])
            d[Name.DA] = String("/ZaDb 0 Tf 0 g")
        elif ft == "button":
            d[Name.FT] = Name.Btn
            flags |= 65536
            d[Name.DA] = String("1 1 1 rg\n/Helvetica %s Tf" % fmt(size))
        if f.get("aa"):
            d[Name.AA] = Dictionary({"/" + k: self.action(v) for k, v in f["aa"].items()})
        if flags:
            d[Name.Ff] = flags
        if self.mode == "javascript" and Name.V in d:
            d[Name.DV] = d.V
        d = pdf.make_indirect(d)
        f["obj"] = d
        kids = Array()
        for wd in f["widgets"]:
            x1, y1, x2, y2 = wd["rect"]
            w, h = x2 - x1, y2 - y1
            k = Dictionary(Type=Name.Annot, Subtype=Name.Widget, Rect=[num(v) for v in wd["rect"]], P=pages[wd["page"]], Parent=d,
                           F=wd.get("flags", 2 if wd.get("hidden") else 4))
            if "raw" in wd:     # a red frame / grey shade copy (red_frames)
                for key, val in wd["raw"].items():
                    k["/" + key] = val
            else:
                mk = Dictionary()
                if wd.get("border"):
                    mk.BC = list(wd["border"])
                if wd.get("bg"):
                    mk.BG = list(wd["bg"])
                if wd.get("caption"):
                    mk.CA = String(wd["caption"])
                if len(mk) and not wd.get("nomk"):
                    k.MK = mk
                k.BS = Dictionary(W=num(wd.get("bw", 0)) if wd.get("border") else 0)
                k.AP = self.widget_ap(f, wd, w, h)
                if ft in ("check", "radio"):
                    on = wd.get("state", "Yes")
                    lit = (ft == "check" and f.get("value")) or (ft == "radio" and f.get("value") is not None and str(f["value"]) == on)
                    k.AS = Name("/" + on) if lit else Name.Off
                if wd.get("action"):
                    k.A = self.action(wd["action"])
                if wd.get("aa"):
                    k.AA = Dictionary({"/" + key: self.action(v) for key, v in wd["aa"].items()})
                if wd.get("da"):
                    k.DA = String(wd["da"])
            wd["obj"] = pdf.make_indirect(k)
            kids.append(wd["obj"])
        d.Kids = kids
        return d

    def widget_ap(self, f, wd, w, h):
        ft = f["ft"]
        base = self.frame(wd, w, h)
        if ft in ("text", "choice"):
            value = f.get("value") or ""
            if ft == "choice" and value == "":
                value = ""
            size = f.get("size", TEXT)
            body = ""
            if value and not f.get("comb"):
                if f.get("multiline"):
                    lines, ty, body = wrap(value, size, w - 4), h - 2 - size, ""
                    for l in lines:
                        body += "BT /Helv %s Tf 0 g 2 %s Td (%s) Tj ET " % (fmt(size), fmt(ty), pdfstr(l))
                        ty -= size * 1.2
                else:
                    body = "BT /Helv %s Tf 0 g 2 %s Td (%s) Tj ET " % (fmt(size), fmt((h - size * 0.72) / 2), pdfstr(value))
            return Dictionary(N=self.appearance(w, h, "%s/Tx BMC q %sQ EMC" % (base, body)))
        if ft == "check":
            tick = "q 0 g BT /ZaDb %s Tf %s %s Td (4) Tj ET Q" % (fmt(h * 0.8), fmt(w * 0.15), fmt(h * 0.22))
            return Dictionary(N=Dictionary(Yes=self.appearance(w, h, base + tick), Off=self.appearance(w, h, base)),
                              D=Dictionary(Yes=self.appearance(w, h, base + tick), Off=self.appearance(w, h, base)))
        if ft == "radio":
            r, k = w / 2 - wd.get("bw", 0.75) / 2, 0.5523
            c = w / 2

            def circle(rr):
                q = k * rr
                return ("%s %s m %s %s %s %s %s %s c %s %s %s %s %s %s c %s %s %s %s %s %s c %s %s %s %s %s %s c" %
                        tuple(map(fmt, (c + rr, c, c + rr, c + q, c + q, c + rr, c, c + rr, c - q, c + rr, c - rr, c + q, c - rr, c,
                                        c - rr, c - q, c - q, c - rr, c, c - rr, c + q, c - rr, c + rr, c - q, c + rr, c))))
            ring = ""
            if wd.get("bg"):
                ring += "%s rg %s f " % (" ".join(map(fmt, wd["bg"])), circle(r))
            ring += "%s RG %s w %s S " % (" ".join(map(fmt, wd.get("border") or INK)), fmt(wd.get("bw", 0.75)), circle(r))
            dot = ring + "0 g %s f" % circle(w * 0.21)
            on = wd["state"]
            return Dictionary(N=Dictionary({"/" + on: self.appearance(w, h, dot), "/Off": self.appearance(w, h, ring)}),
                              D=Dictionary({"/" + on: self.appearance(w, h, dot), "/Off": self.appearance(w, h, ring)}))
        if ft == "button":
            cap, size = wd["caption"], f.get("size", 8)
            tx = (w - width(cap, size)) / 2
            ty = (h - size * 0.72) / 2
            ap = self.appearance(w, h, "%s/Tx BMC q BT /Helv %s Tf 1 g %s %s Td (%s) Tj ET Q EMC" % (base, fmt(size), fmt(tx), fmt(ty), pdfstr(cap)))
            return Dictionary(N=ap, D=ap)
        return Dictionary(N=self.appearance(w, h, ""))

    # ---------------------------------------------------------------- red frames (no JavaScript needed; red-frames.ts)
    def red_frames(self):
        GAP, THICK = 0.6, 1.6

        def trigger(rule):
            if rule.get("not"):
                return None
            tf = self.byname.get(rule["field"])
            if not tf:
                return None
            if tf["ft"] == "check":
                if "true" not in rule["values"]:
                    return None
                state, on = "Yes", self.values.get(rule["field"]) is True
            elif tf["ft"] == "radio":
                try:
                    i = tf["options"].index(safe(rule["values"][0]))
                except ValueError:
                    return None
                state, on = str(i), self.values.get(rule["field"]) == rule["values"][0]
                tf["unison"] = True   # copies of the same option switch together
            else:
                return None
            return tf, state, on

        own = {f["id"]: [w for name in ([f"{f['id']}__{i}" for i in range(len(f.get("options") or []))] if f["kind"] == "checks"
                                         else [f"{f['id']}__list"] if f["kind"] == "date" else [f["id"]])
                         for w in (self.byname[name]["widgets"] if name in self.byname else [])] for f in self.all}
        own = {k: [dict(page=w["page"], rect=list(w["rect"])) for w in v] for k, v in own.items()}
        # Radio buttons of switchable questions are see-through, so the grey shade shows.
        for f in self.all:
            if active_rules(f) and f["id"] in self.byname and self.byname[f["id"]]["ft"] == "radio":
                for w in self.byname[f["id"]]["widgets"]:
                    w["bg"] = None

        def copy(tr, page, r, kind="red"):
            tf, state, on = tr
            x, y, w, h = r
            big = -(-(2 * max(w, h) + 10) // 1)
            shade = kind == "shade"
            red_ap = lambda: self.appearance(w, h, "0.85 0 0 rg 0 0 %s %s re f" % (fmt(w), fmt(h)))
            grey_ap = lambda: self.appearance(w, h, "0.86 g 0 0 %s %s re f" % (fmt(w), fmt(h)))
            none_ap = lambda: self.appearance(w, h, "")
            tf["widgets"].append({"page": page, "rect": [x, y, x + w, y + h], "flags": 64, "under": True, "raw": {
                "AS": Name("/" + state) if on else Name.Off,
                "MK": Dictionary(BG=[0.86], CA=String("n")) if shade else Dictionary(CA=String("n")),
                "DA": String("/ZaDb %d Tf %s" % (big, "1 g" if shade else "0.85 0 0 rg")), "BS": Dictionary(W=0),
                "AP_LAZY": (shade, state, red_ap, grey_ap, none_ap)}})

        for f in self.all:
            for rule in f.get("requiredIf") or []:
                tr = trigger(rule)
                if not tr:
                    continue

                def frame(page, x, y, w, h):
                    out = GAP + THICK
                    for strip in ([x - out, y + h + GAP, w + 2 * out, THICK], [x - out, y - out, w + 2 * out, THICK],
                                  [x - out, y - GAP, THICK, h + 2 * GAP], [x + w + GAP, y - GAP, THICK, h + 2 * GAP]):
                        copy(tr, page, strip)
                block = self.blocks.get(f["id"])
                if block and block.get("box"):
                    frame(block["page"], *block["box"])
                else:
                    for b in own.get(f["id"], []):
                        x1, y1, x2, y2 = b["rect"]
                        frame(b["page"], x1, y1, x2 - x1, y2 - y1)
                if block:
                    x, y, text = block["label"]
                    copy(tr, block["page"], [x, y - 3.5, width(text, 8), THICK])
        for f in self.all:
            for rule in active_rules(f):
                tr = trigger(rule)
                if tr:
                    for b in own.get(f["id"], []):
                        x1, y1, x2, y2 = b["rect"]
                        copy(tr, b["page"], [x1 - 0.5, y1 - 0.5, x2 - x1 + 1, y2 - y1 + 1], "shade")
        # The copies' pictures, now that the appearance helper exists.
        for fl in self.fields:
            for w in fl["widgets"]:
                lazy = w.get("raw", {}).pop("AP_LAZY", None)
                if lazy:
                    shade, state, red_ap, grey_ap, none_ap = lazy
                    w["raw"]["AP"] = Dictionary(N=Dictionary({"/" + state: none_ap(), "/Off": grey_ap()}) if shade else
                                                Dictionary({"/" + state: red_ap(), "/Off": none_ap()}))

    # ---------------------------------------------------------------- checks inside the PDF (acrobat-script.ts)
    def checks(self):
        t, run = self.t, "lcRules(this);"

        def as_list(rules):
            return [[r["field"], [safe(v) for v in r["values"]], 1 if r.get("not") else 0] for r in rules]

        model = {}

        def add(f):
            if f["id"] not in model:
                m = {"kind": f["kind"], "label": safe(f["label"])}
                if f["kind"] == "checks":
                    m["options"] = [safe(o) for o in f.get("options") or []]
                model[f["id"]] = m
            return model[f["id"]]

        for f in [f for f in self.all if f.get("required") or f.get("requiredIf")]:
            m = add(f)
            m["hasRule"] = 1
            if f.get("required"):
                m["always"] = 1
            if f.get("requiredIf"):
                m["requiredIf"] = as_list(f["requiredIf"])
            for r in f.get("requiredIf") or []:
                if r["field"] in self.byid:
                    add(self.byid[r["field"]])
        for f in [f for f in self.all if active_rules(f)]:
            add(f)["activeIf"] = as_list(active_rules(f))
            for r in active_rules(f):
                if r["field"] in self.byid:
                    add(self.byid[r["field"]])
        for f in [f for f in self.all if f["kind"] in ("text", "long", "date")]:
            add(f)["check"] = [FORMATS[f["format"]][1], FORMATS[f["format"]][2]] if f.get("format") else 1
        ordered = {f["id"]: model[f["id"]] for f in self.all if f["id"] in model}
        rules = script("rules.js", MODEL=jsdumps(ordered), DATES=jsdumps([f["id"] for f in self.all if f["kind"] == "date"]))
        if self.qr:
            groups = ", ".join(f"{json.dumps(f['id'])}: {jsdumps(f.get('options') or [])}" for f in self.all if f["kind"] == "checks")
            code = re.search(r"[A-Z]+-\d+", t.get("formCode") or "")
            ver = re.search(r"v([\d.]+)", t.get("formCode") or "")
            payload = script("payload.js", GROUPS=groups, LONG=jsdumps([f["id"] for f in self.all if f["kind"] == "long"]),
                             FORM=json.dumps(code.group(0) if code else safe(t["title"]), ensure_ascii=False),
                             VERSION=json.dumps(ver.group(1) if ver else "1"))
            rules = f"{rules}\n{payload}\n{script('qr.js')}"
        self.doc_script = rules

        # When to run it: on a click (U) for tick boxes, options and date lists; on leaving a box (Bl) for the rest.
        for fid, m in model.items():
            names = [f"{fid}__{i}" for i in range(len(m.get("options") or []))] if m["kind"] == "checks" else \
                [f"{fid}__list", fid] if m["kind"] == "date" and f"{fid}__list" in self.byname else [fid]
            for name in names:
                for w in self.byname.get(name, {"widgets": []})["widgets"]:
                    if w.get("raw"):
                        continue
                    clicked = m["kind"] in ("check", "checks", "radio") or (m["kind"] == "date" and name != fid)
                    w.setdefault("aa", {})["U" if clicked else "Bl"] = run
        self.page = self.doc[0]
        recalc = self.field("__checks", "text", size=3, aa={"C": run})
        self.widget(recalc, -20, -20, 1, 1, hidden=True, border=INK, bg=WHITE)
        if self.qr:
            q = self.qr
            self.page = self.doc[q["page"]]
            box = self.field("__qr", "text", size=3)
            self.widget(box, -20, -20, 1, 1, hidden=True, border=INK, bg=WHITE)
            m = q["size"] / 185
            da = "/ZaDb %s Tf 0 g" % fmt(round(m / 0.692 * 1000) / 1000)
            for y in range(177):   # one comb text box per row of the QR code; lcDrawQr fills them
                row = self.field(f"__qr_{y}", "text", max=177, comb=True, da=da)   # comb + read-only
                self.widget(row, q["x"] + 4 * m, q["y"] + q["size"] - (5 + y) * m, 177 * m, m)
        # Check form / Reset form at the top right of every page (shown on screen, not printed).
        pages = list(range(self.doc.page_count))
        buttons = [("__check_form", "Check form", script("check-form.js"), 64), ("__reset_form", "Reset form", script("reset-form.js"), 64)]
        for i, (name, caption, code, w) in enumerate(buttons):
            x = W - M - sum(b[3] + 4 for b in buttons[i:]) + 4
            b = self.field(name, "button", size=8)
            for p in pages:
                self.page = self.doc[p]
                self.widget(b, x, H - 25, w, 13, caption=caption, border=ACCENT, bg=ACCENT, bw=0, action=code, flags=0)
        if self.qr:
            for i, (name, caption, js_file) in enumerate((("__generate_qr", "Generate QR Code", "generate-qr.js"), ("__print_form", "Print Form", "print-form.js"))):
                self.page = self.doc[self.qr["page"]]
                b = self.field(name, "button", size=10)
                bx, by = self.qr["button"]
                self.widget(b, bx + i * 162, by, 150, 22, caption=caption, border=ACCENT, bg=ACCENT, bw=0, action=script(js_file), flags=0)


def pdfstr(s):
    return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def build(t, values=None, mode="javascript"):
    """The PDF as bytes. Laid out once, then again with the room left on the last page shared out to its paragraph
    boxes, so the form ends without a blank stretch (kept only if the page count stays the same)."""
    values = values or {}

    def once(extra):
        b = Builder(t, values, mode, extra)
        b.draw()
        return b

    first = once({})
    lasts = [i for i, p in first.longs_on.items() if p == first.form_last]
    chosen = first
    if lasts and first.spare >= 20:
        each = min(90, int((first.spare - 10) // len(lasts)))
        second = once({i: each for i in lasts})
        if second.doc.page_count == first.doc.page_count:
            chosen = second
    pdf = chosen.write()
    buf = io.BytesIO()
    pdf.save(buf)
    return buf.getvalue()

# ---------------------------------------------------------------- writing a form in Python
# One line per question, e.g.
#   FORM = form(title="Banker's Guarantee", sections=[
#       section("Applicant", text("applicant_name", "Applicant name", half=True, required=True, max=35)),
#   ])
# Options for every question: half, required, requiredIf=[when("field", "value")], activeIf, max, format.
def form(title, sections, note="", **more):
    """The whole form: title, sections, and optionally issuer, formCode and defaults (starting answers)."""
    return {"title": title, "note": note, "sections": sections, **more}


def section(title, *fields, **more):
    """A section and its questions (more: note, signoff=True, bankOnly=True)."""
    return {"title": title, "fields": list(fields), **more}


def when(field, *values, not_=False):
    """A rule: "when FIELD is one of VALUES" (a tick box's values are "true" / "false")."""
    return {"field": field, "values": list(values), **({"not": True} if not_ else {})}


def _question(kind):
    def make(id, label, options=None, **more):
        return {"id": id, "label": label, "kind": kind, **({"options": list(options)} if options is not None else {}), **more}
    make.__name__ = kind
    return make


text, long, date, radio, checks, check, select = (_question(k) for k in ("text", "long", "date", "radio", "checks", "check", "select"))

FORM = None     # Template Studio puts the form here, written with the functions above


if __name__ == "__main__":
    args = sys.argv[1:]
    mode = args[args.index("--mode") + 1] if "--mode" in args else "javascript"
    values = json.load(open(args[args.index("--values") + 1], encoding="utf-8")) if "--values" in args else {}
    paths = [a for i, a in enumerate(args) if not a.startswith("--") and (i == 0 or args[i - 1] not in ("--mode", "--values"))]
    if FORM is not None:     # one-file builder: python build_xx.py out.pdf
        form, out = json.loads(json.dumps(FORM)), paths[0] if paths else "form.pdf"
    else:
        form, out = json.load(open(paths[0], encoding="utf-8")), paths[1]
    values = {**form.pop("defaults", {}), **values}   # a form file may carry its starting answers
    open(out, "wb").write(build(form, values, mode))
    print("written", out)

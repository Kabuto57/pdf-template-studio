"""THE LC APPLICATION PDF, BUILT WITH PYTHON (reportlab)

    pip install reportlab
    python make_lc_pdf.py                    # reads lc-template.json from the website
    python make_lc_pdf.py lc-template.json   # or from a file

Writes LC-Application-reportlab.pdf: the same questions, options and rules as the website's form
(public/lc-template.json, written from src/lc.ts by `npm run pdfs`), as an ordinary PDF form with no JavaScript.

What it checks without JavaScript (so it behaves the same with Acrobat's JavaScript switched off):
  - always-mandatory questions: red box + the PDF "required" flag
  - mandatory-when / only-when questions: the condition printed under the question, in red / grey
  - max characters, drop-downs and pick-one lists (only the bank's options can be chosen)
What needs JavaScript in any PDF, so it isn't here: turning boxes red as answers change, locking questions
that don't apply, a "Check form" button, date and format checks. The Fill online page and the Trade Ops
workbench check all of those.
Field names match the website's PDF (tick-any options are <id>__<n>), so the workbench reads it the same way.
"""
import json
import sys
import urllib.request

from reportlab.lib.colors import Color, black, white
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfdoc
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen.canvas import Canvas

URL = "https://kabuto57.github.io/pdf-template-studio/lc-template.json"
OUT = "LC-Application-reportlab.pdf"

W, H = A4
M = 36                      # page margin
CW = W - 2 * M              # content width
GAP = 12                    # between two half-width questions
RED = Color(0.85, 0.1, 0.1)
GREY = Color(0.55, 0.55, 0.55)
BAR = Color(0.16, 0.24, 0.36)
SHADE = Color(0.96, 0.97, 0.99)
LABEL, LEAD = 7.5, 9.0      # label font size and line height
BOX = 16                    # one-line box height
TICK = 10                   # tick box / radio size

PLAIN = {"‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-", "…": "..."}


def plain(s):
    """Text the standard PDF fonts can draw (Latin-1)."""
    s = "".join(PLAIN.get(c, c) for c in s)
    return s.encode("latin-1", "replace").decode("latin-1")


def wrap(text, width, font="Helvetica", size=LABEL):
    """Words split into lines that fit `width`."""
    lines, line = [], ""
    for word in plain(text).split():
        test = f"{line} {word}".strip()
        if line and stringWidth(test, font, size) > width:
            lines.append(line)
            line = word
        else:
            line = test
    return lines + [line] if line else lines


def build(t):
    fields = [f for s in t["sections"] for f in s["fields"]]
    label_of = {f["id"]: f["label"] for f in fields}

    def say(rules):
        """'Bill of lading is ticked or Drafts at is "Term"', as on the website."""
        out = []
        for r in rules:
            label = label_of.get(r["field"], r["field"])
            if len(label) > 60:
                label = label[:57].rsplit(" ", 1)[0] + "..."
            vs = " or ".join("ticked" if v == "true" else "not ticked" if v == "false" else f'"{v}"' for v in r["values"])
            if r["values"] == [""]:  # "is not blank"
                out.append(f"{label} is {'filled in' if r.get('not') else 'blank'}")
            else:
                out.append(f"{label} is {'not ' if r.get('not') else ''}{vs}")
        return " or ".join(out)

    def hint(f):
        if f.get("requiredIf"):
            return f"Mandatory if {say(f['requiredIf'])}", RED
        if f.get("activeIf"):
            return f"Only if {say(f['activeIf'])}", GREY
        return None

    def option_rows(f, width):
        """Pick-one / tick-any options laid out left to right, wrapping: [[(x, text), ...], ...]."""
        rows, row, x = [], [], 0
        for o in f["options"]:
            w = TICK + 4 + stringWidth(plain(o), "Helvetica", LABEL) + 12
            if row and x + w > width:
                rows.append(row)
                row, x = [], 0
            row.append((x, o))
            x += w
        return rows + [row] if row else rows

    def height(f, width):
        """How tall a question is: label, condition, then its box(es)."""
        label = wrap(f["label"] + (" *" if f.get("required") else ""), width - (TICK + 4 if f["kind"] == "check" else 0))
        h = len(label) * LEAD + (LEAD if hint(f) else 0)
        kind = f["kind"]
        if kind in ("radio", "checks"):
            return h + len(option_rows(f, width)) * (TICK + 5) + 10
        if kind == "check":
            return max(h, TICK) + 6
        return h + 2 + (BOX * 3 if kind == "long" else BOX) + 6

    c = Canvas(OUT, pagesize=A4)
    c.setTitle(plain(t["title"]))
    form = c.acroForm
    page = [1]

    def footer():
        c.setFont("Helvetica", 7)
        c.setFillColor(GREY)
        c.drawRightString(W - M, M / 2, f"Page {page[0]}")
        c.drawString(M, M / 2, "Red box or * = mandatory. Red note = mandatory in that case.")

    def new_page():
        footer()
        c.showPage()
        page[0] += 1
        return H - M

    def draw(f, x, y, width):
        """One question with its top-left corner at (x, y)."""
        kind, req = f["kind"], bool(f.get("required"))
        border = RED if req else GREY
        flags = "required" if req else ""
        tip = plain(f["label"])
        c.setFillColor(black)
        c.setFont("Helvetica", LABEL)
        if kind == "check":
            form.checkbox(name=f["id"], tooltip=tip, x=x, y=y - TICK, size=TICK, buttonStyle="check",
                          borderColor=border, fillColor=white, borderWidth=1, fieldFlags=flags)
            x, width = x + TICK + 4, width - TICK - 4
        lines = wrap(f["label"] + (" *" if req else ""), width)
        for line in lines:
            y -= LEAD
            c.drawString(x, y + 2, line)
        h = hint(f)
        if h:
            y -= LEAD
            c.setFont("Helvetica-Oblique", LABEL - 0.5)
            c.setFillColor(h[1])
            c.drawString(x, y + 2, wrap(h[0], width, "Helvetica-Oblique", LABEL - 0.5)[0])
            c.setFillColor(black)
        if kind == "check":
            return
        y -= 2
        if kind in ("radio", "checks"):
            for row in option_rows(f, width):
                y -= TICK + 5
                for i, (ox, o) in enumerate(row):
                    n = f["options"].index(o)
                    if kind == "radio":
                        form.radio(name=f["id"], tooltip=tip, value=plain(o), selected=False, x=x + ox, y=y,
                                   size=TICK, buttonStyle="circle", shape="circle", borderColor=border,
                                   fillColor=white, borderWidth=1, fieldFlags="radio noToggleToOff " + flags)
                    else:
                        form.checkbox(name=f"{f['id']}__{n}", tooltip=plain(o), x=x + ox, y=y, size=TICK,
                                      buttonStyle="check", borderColor=border, fillColor=white, borderWidth=1)
                    c.setFont("Helvetica", LABEL)
                    c.drawString(x + ox + TICK + 4, y + 2, plain(o))
            return
        bh = BOX * 3 if kind == "long" else BOX
        y -= bh
        common = dict(name=f["id"], tooltip=tip + (" (DD/MM/YYYY)" if kind == "date" else ""), x=x, y=y,
                      width=width, height=bh, borderColor=border, fillColor=SHADE, borderWidth=1, fontSize=8)
        if kind == "select":
            # ponytail: reportlab can't make a drop-down with nothing picked (crashes on value=""), so the blank
            # choice is a space; the workbench trims it back to "".
            form.choice(value=" ", options=[" "] + [plain(o) for o in f["options"]], fieldFlags=("combo " + flags).strip(), **common)
        else:
            form.textfield(maxlen=10 if kind == "date" else f.get("max") or 0,
                           fieldFlags=(("multiline " if kind == "long" else "") + flags).strip(), **common)
            if kind == "date":
                c.setFont("Helvetica", 6.5)
                c.setFillColor(GREY)
                c.drawRightString(x + width - 4, y + 5, "DD/MM/YYYY")

    # Title and instructions.
    y = H - M
    c.setFont("Helvetica-Bold", 14)
    c.drawString(M, y - 14, plain(t["title"]))
    y -= 24
    c.setFont("Helvetica", LABEL)
    for line in wrap(t.get("note", ""), CW):
        y -= LEAD
        c.drawString(M, y, line)
    y -= 8

    for si, s in enumerate(t["sections"]):
        # Questions in rows: two half-width questions side by side, the rest full width.
        rows, pending = [], []
        for f in s["fields"]:
            if f.get("half"):
                pending.append(f)
                if len(pending) == 2:
                    rows.append(pending)
                    pending = []
            else:
                if pending:
                    rows.append(pending)
                    pending = []
                rows.append([f])
        if pending:
            rows.append(pending)

        def row_height(row):
            width = CW if len(row) == 1 and not row[0].get("half") else (CW - GAP) / 2
            return max(height(f, width) for f in row)

        if y - 22 - row_height(rows[0]) < M:  # keep the heading with its first row
            y = new_page()
        c.setFillColor(BAR)
        c.rect(M, y - 16, CW, 16, stroke=0, fill=1)
        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 9)
        c.drawString(M + 6, y - 11.5, plain(f"{si + 1}. {s['title']}"))
        y -= 22
        for row in rows:
            rh = row_height(row)
            if y - rh < M:
                y = new_page()
            width = CW if len(row) == 1 and not row[0].get("half") else (CW - GAP) / 2
            for i, f in enumerate(row):
                draw(f, M + i * (width + GAP), y, width)
            y -= rh
        y -= 4
    footer()
    # The form itself, stored inside the PDF like the website's PDFs do (src/form/stored-template.ts), so the
    # Trade Ops workbench knows every question, section and rule from the PDF alone.
    cat = c._doc.Catalog
    cat.__NoDefault__ = cat.__Refs__ = [*pdfdoc.PDFCatalog.__NoDefault__, "FormTemplate"]
    cat.FormTemplate = pdfdoc.PDFStream(content=json.dumps({**t, "uploaded": False}).encode(), filters=[pdfdoc.PDFZCompress])
    c.save()


if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else URL
    if src.startswith("http"):
        with urllib.request.urlopen(src) as r:
            template = json.load(r)
    else:
        with open(src, encoding="utf-8") as fh:
            template = json.load(fh)
    build(template)
    print(f"Wrote {OUT}")

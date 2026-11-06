"""BUILD THE LC APPLICATION PDF FROM ITS SPECIFICATION (plain Python 3, standard library only: no pip install)

    python build_lc_pdf.py lc-build-spec.json LC-Application-with-checks.pdf

lc-build-spec.json describes the working "Irrevocable Documentary Credit Application" PDF completely: every page
(its drawing as PDF content-stream text), every form field and widget (position, look, flags, options, appearance
streams), every action and the document-level JavaScript. This script writes it out as a PDF file, object for
object; it adds nothing and changes nothing. Do not edit the spec or this script to "improve" the form.

The spec's format:
  {"root": {"ref": n}, "objects": {"n": <value>, ...}}
  <value> is one of:
    a JSON number                       -> a PDF number
    {"real": "300.0"}                   -> a PDF number written exactly so (Acrobat needs "300.0" in barcode fields)
    "/Name"                             -> a PDF name (written as given)
    {"s": "text"}                       -> a PDF text string
    {"ref": n}                          -> a reference to object n ("n 0 R")
    [ ... ]                             -> an array
    {"/Key": <value>, ...}              -> a dictionary
    {"stream": {...}, "text": "..."}    -> a stream: its dictionary, and its data as Latin-1 text (written as is)
    true / false / null
"""
import json
import sys


def number(x):
    if isinstance(x, int):
        return str(x)
    if x == int(x):
        return str(int(x))
    return ("%.10f" % x).rstrip("0").rstrip(".")


def text(s):
    if all(ord(c) < 128 for c in s):  # plain ASCII: a literal string, e.g. (0 0 0 rg /Helvetica 8 Tf)
        return "(" + s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)").replace("\r", "\\r").replace("\n", "\\n") + ")"
    return "<FEFF" + s.encode("utf-16-be").hex().upper() + ">"  # anything else: UTF-16 with its byte-order mark


def value(v):
    if v is True:
        return "true"
    if v is False:
        return "false"
    if v is None:
        return "null"
    if isinstance(v, (int, float)):
        return number(v)
    if isinstance(v, str):
        return v
    if isinstance(v, list):
        return "[" + " ".join(value(x) for x in v) + "]"
    if "ref" in v and len(v) == 1:
        return "%d 0 R" % v["ref"]
    if "s" in v and len(v) == 1:
        return text(v["s"])
    if "real" in v and len(v) == 1:
        return v["real"]
    return "<<" + " ".join(k + " " + value(x) for k, x in v.items()) + ">>"


def build(spec_path, out_path):
    spec = json.load(open(spec_path, encoding="utf-8"))
    objects = {int(n): v for n, v in spec["objects"].items()}
    out = bytearray(b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n")
    where = {}
    for n in sorted(objects):
        v = objects[n]
        where[n] = len(out)
        out += b"%d 0 obj\n" % n
        if isinstance(v, dict) and "stream" in v:
            data = v["text"].encode("latin-1")  # not compressed: the same bytes on every computer (see the SHA-256 check)
            d = dict(v["stream"], **{"/Length": len(data)})
            out += value(d).encode("latin-1") + b"\nstream\n" + data + b"\nendstream"
        else:
            out += value(v).encode("latin-1")
        out += b"\nendobj\n"
    size = max(objects) + 1
    xref = len(out)
    out += b"xref\n0 %d\n" % size
    out += b"0000000000 65535 f \n"
    for n in range(1, size):
        out += (b"%010d 00000 n \n" % where[n]) if n in where else b"0000000000 65535 f \n"
    out += b"trailer\n" + ("<< /Size %d /Root %s >>" % (size, value(spec["root"]))).encode("latin-1")
    out += b"\nstartxref\n%d\n%%%%EOF\n" % xref
    open(out_path, "wb").write(out)


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "lc-build-spec.json",
          sys.argv[2] if len(sys.argv) > 2 else "LC-Application-with-checks.pdf")
    print("written")

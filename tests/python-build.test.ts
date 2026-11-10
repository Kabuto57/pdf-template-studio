// The LC PDFs the website serves are built in Python (pdfbuild/build_form.py: pikepdf + PyMuPDF, the company AI's
// libraries) by `npm run pdfs`. This checks they are still the same form as buildPdf makes: the same pages, fields (in
// order, of the same kind, in the same place), scripts, buttons and stored description. Rebuild them after a change:
//   npm run pdfs   (needs .venv: python3 -m venv .venv && .venv/bin/pip install -r pdfbuild/requirements.txt)
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFObject, PDFRawStream, PDFString, decodePDFRawStream } from "pdf-lib";
import { buildPdf } from "../src/pdf";
import { LC } from "../src/lc";

const text = (o: PDFObject | undefined): string | undefined =>
  o instanceof PDFRawStream ? new TextDecoder("latin1").decode(decodePDFRawStream(o).decode()) :
  o instanceof PDFString || o instanceof PDFHexString ? o.decodeText() : undefined;
const js = (d: PDFDict | undefined) => (d ? text(d.lookup(PDFName.of("JS"))) : undefined);
const actions = (d: PDFDict | undefined) =>
  Object.fromEntries([...(d?.entries() ?? [])].map(([k]) => [k.toString(), js(d!.lookup(k) as PDFDict)]));

/** What matters about a PDF form, with positions rounded so floating-point noise doesn't count. */
async function describeForm(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes);
  const pages = doc.getPages().map(p => p.ref.toString());
  const fields = doc.getForm().getFields().map(f => ({
    name: f.getName(),
    kind: f.constructor.name,
    actions: actions(f.acroField.dict.lookupMaybe(PDFName.of("AA"), PDFDict)),
    widgets: f.acroField.getWidgets().map(w => ({
        page: pages.indexOf(w.P()?.toString() ?? ""),
        rect: (w.dict.lookup(PDFName.of("Rect"), PDFArray)).asArray().map(n => Math.round(Number(n.toString()) * 10) / 10),
        flags: Number(w.dict.get(PDFName.of("F"))?.toString() ?? 0),
        click: js(w.dict.lookupMaybe(PDFName.of("A"), PDFDict)),
        actions: actions(w.dict.lookupMaybe(PDFName.of("AA"), PDFDict)),
      })),
  }));
  const names = doc.catalog.lookupMaybe(PDFName.of("Names"), PDFDict)?.lookupMaybe(PDFName.of("JavaScript"), PDFDict);
  const script = names ? js(names.lookup(PDFName.of("Names"), PDFArray).lookup(1) as PDFDict) : undefined;
  return {
    pages: pages.length, fields, script,
    beforeSave: actions(doc.catalog.lookupMaybe(PDFName.of("AA"), PDFDict)),
    stored: JSON.parse(text(doc.catalog.lookup(PDFName.of("FormTemplate"))) ?? "null"),
  };
}

const close = (a: unknown, b: unknown): boolean =>
  typeof a === "number" && typeof b === "number" ? Math.abs(a - b) <= 0.15 :
  Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every((x, i) => close(x, b[i])) :
  a && b && typeof a === "object" && typeof b === "object" ? close(Object.entries(a), Object.entries(b)) :
  a === b;

describe("the website's LC PDFs (built in Python) match buildPdf", () => {
  for (const [mode, file] of [["javascript", "LC-Application-JavaScript.pdf"], ["no-javascript", "LC-Application-no-JavaScript.pdf"]] as const)
    it(file, async () => {
      const python = await describeForm(new Uint8Array(readFileSync(`public/${file}`)));
      const ts = await describeForm(await buildPdf(LC.template, LC.defaults, mode));
      expect(python.pages).toBe(ts.pages);
      expect(python.fields.map(f => f.name)).toEqual(ts.fields.map(f => f.name));
      for (const [i, f] of python.fields.entries()) {
        const g = ts.fields[i];
        expect({ name: f.name, kind: f.kind, actions: f.actions, n: f.widgets.length }).toEqual({ name: g.name, kind: g.kind, actions: g.actions, n: g.widgets.length });
        if (!close(f.widgets, g.widgets)) expect(f.widgets).toEqual(g.widgets); // shows the difference
      }
      expect(python.script).toBe(ts.script);
      expect(python.beforeSave).toEqual(ts.beforeSave);
      expect(python.stored).toEqual(ts.stored);
    });
});

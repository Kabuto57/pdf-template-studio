import { describe, expect, it } from "vitest";
import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { buildPdf, extractPdf } from "../src/pdf";
import { LC, LC_SAMPLE } from "../src/lc";
import { buildLcPdf } from "../src/lc-pdf";

describe("LC in the bank's layout", () => {
  it("has a box for every question and gives every answer back", async () => {
    const pdf = await buildLcPdf(LC_SAMPLE);
    const names = new Set((await PDFDocument.load(pdf)).getForm().getFields().map(f => f.getName()));
    const missing = LC.template.sections.flatMap(s => s.fields).filter(f => f.kind === "checks" ? !names.has(`${f.id}__0`) : !names.has(f.id)).map(f => f.id);
    expect(missing).toEqual([]);
    const { data } = await extractPdf(pdf);
    for (const [k, v] of Object.entries(LC_SAMPLE)) expect([k, data[k]]).toEqual([k, v]);
  });
});

describe("fields can be typed in, in Acrobat", () => {
  // Acrobat needs the font named in each field's /DA in the form's /DR; without it clicking a field does nothing.
  it.each([["original look", () => buildLcPdf()], ["new design", () => buildPdf(LC.template)]])("%s", async (_, make) => {
    const doc = await PDFDocument.load(await make());
    const af = doc.getForm().acroForm.dict;
    const fonts = (af.lookup(PDFName.of("DR")) as PDFDict).lookup(PDFName.of("Font")) as PDFDict;
    for (const f of doc.getForm().getFields()) {
      const da = f.acroField.dict.lookup(PDFName.of("DA"))?.toString() ?? "";
      const name = /\/([\w-]+) [\d.]+ Tf/.exec(da)?.[1];
      if (name && name !== "dummy__noop") expect(fonts.has(PDFName.of(name)), `${f.getName()} uses /${name}`).toBe(true);
    }
  });
});

import { describe, expect, it } from "vitest";
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFRawStream, PDFString } from "pdf-lib";
import { FORMATS, buildPdf, extractPdf } from "../src/pdf";
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

describe("within Adobe's limits", () => {
  // Acrobat refuses strings over 32,767 bytes (PDF architectural limit); pdf.js and Chrome/Edge don't mind.
  const longest = (doc: PDFDocument) => {
    let max = 0;
    const walk = (o: unknown, seen = new Set<unknown>()): void => {
      if (seen.has(o)) return; seen.add(o);
      if (o instanceof PDFString || o instanceof PDFHexString) max = Math.max(max, o.asBytes().length);
      else if (o instanceof PDFDict) for (const [, v] of o.entries()) walk(v, seen);
      else if (o instanceof PDFArray) for (const v of o.asArray()) walk(v, seen);
    };
    for (const [, o] of doc.context.enumerateIndirectObjects()) walk(o instanceof PDFRawStream ? o.dict : o);
    return max;
  };
  it.each([["original look", () => buildLcPdf(LC_SAMPLE)], ["new design", () => buildPdf(LC.template, LC_SAMPLE)]])("%s: no string over 32,767 bytes", async (_, make) => {
    expect(longest(await PDFDocument.load(await make()))).toBeLessThanOrEqual(32767);
  });
});

describe("red frames without JavaScript", () => {
  it.each([
    // the tick box itself + 4 strips around each of the 6 boxes: made out to (3 options), freight (2), notify party (1)
    ["original look", () => buildLcPdf(), 1 + 4 * 6],
    // the tick box + per question: 4 strips around all its options + its label in red
    ["new design", () => buildPdf(LC.template), 1 + 3 * (4 + 1)],
  ] as const)("%s: ticking Bill of lading frames its 3 questions", async (_, make, n) => {
    const form = (await PDFDocument.load(await make())).getForm();
    expect(form.getCheckBox("doc_bill_of_lading").acroField.getWidgets().length).toBe(n);
  });
});

describe("formats", () => {
  it("phone and account numbers: right keys, right shape", () => {
    expect(["+65 6123 4567", "(021) 5888-1234"].every(v => FORMATS.phone.ok.test(v))).toBe(true);
    expect(["abc", "6123 ext 4", "+"].some(v => FORMATS.phone.ok.test(v))).toBe(false);
    expect(new RegExp(FORMATS.phone.bad).test("a")).toBe(true);
    expect(["072-123456-7", "0721234567"].every(v => FORMATS.account.ok.test(v))).toBe(true);
    expect(["072 123", "ABC123", "-12"].some(v => FORMATS.account.ok.test(v))).toBe(false);
  });
  it("the sample answers pass their own formats", () => {
    for (const f of LC.template.sections.flatMap(s => s.fields))
      if (f.format && typeof LC_SAMPLE[f.id] === "string") expect(FORMATS[f.format].ok.test(LC_SAMPLE[f.id] as string), f.id).toBe(true);
  });
});

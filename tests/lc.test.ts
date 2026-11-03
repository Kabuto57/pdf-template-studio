import { describe, expect, it } from "vitest";
import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFRawStream, PDFString, decodePDFRawStream } from "pdf-lib";
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

describe("Check form button: blanks, formats and funny characters", () => {
  // Runs the PDF's own script against a stand-in for Acrobat's fields.
  const lcRules = async (make: () => Promise<Uint8Array>) => {
    const doc = await PDFDocument.load(await make());
    const names = (doc.catalog.lookup(PDFName.of("Names"), PDFDict).lookup(PDFName.of("JavaScript"), PDFDict).lookup(PDFName.of("Names"), PDFArray));
    const js = new TextDecoder().decode(decodePDFRawStream(names.lookup(1, PDFDict).lookup(PDFName.of("JS")) as PDFRawStream).decode());
    return (values: Record<string, unknown>) => {
      const fields: Record<string, any> = {};
      for (const f of LC.template.sections.flatMap(s => s.fields)) {
        const v = values[f.id];
        if (f.kind === "checks") (f.options ?? []).forEach((o, i) => { fields[`${f.id}__${i}`] = { value: Array.isArray(v) && v.includes(o) ? "Yes" : "Off" }; });
        else fields[f.id] = { value: f.kind === "check" ? (v ? "Yes" : "Off") : v ?? (f.kind === "radio" ? "Off" : ""), valueAsString: String(v ?? "") };
      }
      const d = { getField: (n: string) => fields[n] ?? null };
      const m = new Function("color", "console", `${js}; return lcRules;`)({ red: 1, black: 0, white: 0, transparent: 0 }, { println: (e: string) => { throw new Error(e); } })(d);
      return { miss: [...m] as string[], bad: m.bad as string[], red: (id: string) => fields[id].strokeColor === 1 };
    };
  };
  it.each([["original look", () => buildLcPdf()], ["new design", () => buildPdf(LC.template)]])("%s", async (_, make) => {
    const check = await lcRules(make);
    expect(check(LC_SAMPLE)).toMatchObject({ miss: [], bad: [] });
    const r = check({ ...LC_SAMPLE, contact_tel: "6123 ABC", applicant_name: "Café * Co", expiry_date: "31/02/2026", amount: "4,80,000.0.0" });
    expect(r.miss).toEqual([]);
    expect(r.bad.join("\n")).toMatch(/Tel no.*phone number/);
    expect(r.bad.join("\n")).toMatch(/Applicant name.*remove é \*/);
    expect(r.bad.join("\n")).toMatch(/expiry.*not a real date/);
    expect(r.bad.join("\n")).toMatch(/Amount.*not an amount/);
    expect(r.red("contact_tel")).toBe(true);
    expect(check({ ...LC_SAMPLE, applicant_name: "" }).miss).toContain("Applicant name");
  });
});

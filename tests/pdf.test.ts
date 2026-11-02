import { describe, expect, it } from "vitest";
import { PDFDict, PDFDocument, PDFHexString, PDFName, PDFTextField } from "pdf-lib";
import { buildPdf, extractPdf, isRequired, type Field } from "../src/pdf";
import { GUARANTEE, SAMPLE } from "../src/sample";

describe("pdf form", () => {
  it("round-trips every answer through a filled PDF", async () => {
    const { data, rows, template } = await extractPdf(await buildPdf(GUARANTEE, SAMPLE));
    expect(template?.title).toBe(GUARANTEE.title);
    expect(data).toEqual(SAMPLE);
    expect(rows.find(r => r.id === "applicant_tel")).toMatchObject({ section: "Applicant", label: "Tel no", value: "+65 6123 4567" });
  });

  it("marks required questions as required PDF fields", async () => {
    const t = { title: "T", note: "", sections: [{ title: "S", fields: [{ id: "name", label: "Name", kind: "text" as const, required: true }, { id: "fax", label: "Fax", kind: "text" as const }] }] };
    const doc = await PDFDocument.load(await buildPdf(t));
    expect(doc.getForm().getTextField("name").isRequired()).toBe(true);
    expect(doc.getForm().getTextField("fax").isRequired()).toBe(false);
  });

  it("extracts empty answers from a blank form", async () => {
    const { data } = await extractPdf(await buildPdf(GUARANTEE));
    expect(data.applicant_name).toBe("");
    expect(data.agree).toBe(false);
    expect(data.attachments).toEqual([]);
  });

  it("reads a form filled by another app, without the embedded template", async () => {
    const doc = await PDFDocument.load(await buildPdf(GUARANTEE));
    doc.getForm().getTextField("applicant_tel").setText("999");
    doc.catalog.delete((await import("pdf-lib")).PDFName.of("FormTemplate"));
    const { rows } = await extractPdf(await doc.save());
    expect(rows.find(r => r.id === "applicant_tel")).toMatchObject({ label: "Tel no", value: "999" });
  });
});

describe("conditional mandatory questions", () => {
  const t = { title: "T", note: "", sections: [{ title: "S", fields: [
    { id: "drafts", label: "Drafts", kind: "radio" as const, options: ["Sight", "Term"] },
    { id: "term", label: "Term", kind: "text" as const, requiredIf: [{ field: "drafts", values: ["Term"] }] },
    { id: "tol", label: "Tolerance", kind: "check" as const },
    { id: "plus", label: "Plus", kind: "text" as const, requiredIf: [{ field: "tol", values: ["true"] }] },
  ] }] };

  it("is mandatory only when its option is picked", () => {
    const [, term, , plus] = t.sections[0].fields;
    expect(isRequired(term, { drafts: "Sight" })).toBe(false);
    expect(isRequired(term, { drafts: "Term" })).toBe(true);
    expect(isRequired(plus, { tol: false })).toBe(false);
    expect(isRequired(plus, { tol: true })).toBe(true);
  });

  it("extract flags the blank conditional answer", async () => {
    const { rows } = await extractPdf(await buildPdf(t, { drafts: "Term", tol: false }));
    expect(rows.find(r => r.id === "term")?.required).toBe(true);
    expect(rows.find(r => r.id === "plus")?.required).toBeFalsy();
  });

  it("the bank LC: picking Term, or ticking a document row, makes that row's boxes mandatory", async () => {
    const lc = (await import("../src/bank-forms.json")).default.find(f => f.code === "LC")!;
    const q = (id: string) => lc.template.sections.flatMap(s => s.fields).find(f => f.id === id) as Field;
    expect(isRequired(q("term_days"), { drafts_at: "Term" })).toBe(true);
    expect(isRequired(q("term_days"), { drafts_at: "Sight" })).toBe(false);
    expect(isRequired(q("invoice_originals"), { doc_commercial_invoice: true })).toBe(true);
    expect(isRequired(q("invoice_copies"), { doc_commercial_invoice: false })).toBe(false);
    expect(lc.template.sections.find(s => s.title === "Documents Required")?.fields.length).toBe(36);
  });
});

describe("checks built into the PDF (Acrobat / Reader)", () => {
  // Runs the PDF's own recalculation script against a stand-in for Acrobat's document object.
  async function acrobat(values: Record<string, string>) {
    const { LC } = await import("../src/lc");
    const doc = await PDFDocument.load(await buildPdf(LC.template));
    const aa = doc.getForm().getTextField("__checks").acroField.dict.lookup(PDFName.of("AA")) as PDFDict;
    const code = ((aa.lookup(PDFName.of("C")) as PDFDict).lookup(PDFName.of("JS")) as PDFHexString).decodeText();
    const fields: Record<string, { value: string; required?: boolean; strokeColor?: string }> = {};
    const acro = { getField: (n: string) => fields[n] ??= { value: values[n] ?? (doc.getForm().getFieldMaybe(n) instanceof PDFTextField ? "" : "Off") } } as Record<string, unknown>;
    new Function("color", code).call(acro, { red: "red", black: "black" });
    return { fields, missing: acro.missingQuestions as string[] };
  }

  it("a ticked document row turns its boxes red and required, as in the app", async () => {
    const off = await acrobat({});
    expect(off.fields.invoice_originals?.required).toBe(false);
    const on = await acrobat({ doc_commercial_invoice: "Yes" });
    expect(on.fields.invoice_originals).toMatchObject({ required: true, strokeColor: "red" });
    expect(on.missing).toContain("Commercial invoice: originals");
    const filled = await acrobat({ doc_commercial_invoice: "Yes", invoice_originals: "3" });
    expect(filled.fields.invoice_originals).toMatchObject({ required: true, strokeColor: "black" });
  });

  it("picking Term makes the term boxes mandatory", async () => {
    const { missing } = await acrobat({ drafts: "Yes", drafts_at: "Term" });
    expect(missing).toEqual(expect.arrayContaining(["Term: days", "days after", "If it is a term LC, please select one"]));
  });
});

it("the Check form button and the save / print warnings are valid scripts", async () => {
  const { LC } = await import("../src/lc");
  const doc = await PDFDocument.load(await buildPdf(LC.template));
  const js = (a: PDFDict) => ((a.lookup(PDFName.of("JS")) as PDFHexString).decodeText());
  const btn = doc.getForm().getButton("__check_form").acroField.getWidgets()[0].dict.lookup(PDFName.of("A")) as PDFDict;
  const aa = doc.catalog.lookup(PDFName.of("AA")) as PDFDict;
  for (const a of [btn, aa.lookup(PDFName.of("WS")) as PDFDict, aa.lookup(PDFName.of("WP")) as PDFDict]) expect(() => new Function("app", js(a))).not.toThrow();
  const alerts: string[] = [];
  new Function("app", js(btn)).call({ calculateNow() {}, missingQuestions: ["Amount"] }, { alert: (m: string) => alerts.push(m) });
  expect(alerts[0]).toContain("1 mandatory question is still blank");
});

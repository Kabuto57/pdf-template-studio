import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { buildPdf, extractPdf, importPdf } from "../src/pdf";
import { blanks, pairs, readText } from "../src/text";

/** A printed-style form (no fields), like an old template or a flattened, filled form. */
async function printed(lines: string[]) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]), font = await doc.embedFont(StandardFonts.Helvetica);
  lines.forEach((l, i) => page.drawText(l, { x: 50, y: 780 - i * 24, size: 11, font }));
  return doc.save();
}

describe("uploaded PDFs", () => {
  it("reads Label: value pairs from a PDF with no fields", async () => {
    const lines = await readText(await printed(["Applicant name: TAN ENGINEERING PTE LTD", "Tel no: +65 6123 4567", "Email:", "Country: Singapore"]));
    expect(pairs(lines)).toEqual([
      { label: "Applicant name", value: "TAN ENGINEERING PTE LTD", page: 1 },
      { label: "Tel no", value: "+65 6123 4567", page: 1 },
      { label: "Email", value: "", page: 1 },
      { label: "Country", value: "Singapore", page: 1 },
    ]);
  });

  it("turns the blanks of a printed form into fields, then fills and extracts them", async () => {
    const bytes = await printed(["Applicant name: ______________________", "Tel no ____________   Email ______________"]);
    const found = blanks(await readText(bytes));
    expect(found.map(b => b.label)).toEqual(["Applicant name", "Tel no", "Email"]);
    const { template, found: how } = await importPdf(bytes, "old-form.pdf", async () => found);
    expect(how).toBe("blanks");
    expect(template.sections[0].fields.map(f => f.id)).toEqual(["applicant_name", "tel_no", "email"]);
    const { data } = await extractPdf(await buildPdf(template, { applicant_name: "TAN", tel_no: "999", email: "a@b.sg" }));
    expect(data).toEqual({ applicant_name: "TAN", tel_no: "999", email: "a@b.sg" });
  });

  it("keeps the fields of a fillable PDF made elsewhere, with its answers", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage(), form = doc.getForm();
    const name = form.createTextField("ApplicantName"); name.addToPage(page, { x: 50, y: 700 }); name.setText("OLD CO");
    const agree = form.createCheckBox("agree"); agree.addToPage(page, { x: 50, y: 600 });
    const r = await importPdf(await doc.save(), "x.pdf", async () => []);
    expect(r.found).toBe("fields");
    expect(r.template.sections[0].fields.map(f => [f.id, f.label, f.kind])).toEqual([["ApplicantName", "Applicant Name", "text"], ["agree", "Agree", "check"]]);
    expect(r.values).toEqual({ ApplicantName: "OLD CO", agree: false });
    r.template.sections[0].fields[0].label = "Company";
    const out = await extractPdf(await buildPdf(r.template, { ApplicantName: "NEW CO", agree: true }));
    expect(out.rows.map(x => [x.label, x.value])).toEqual([["Company", "NEW CO"], ["Agree", true]]);
  });
});

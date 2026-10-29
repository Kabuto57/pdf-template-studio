import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildPdf, extractPdf } from "../src/pdf";
import { GUARANTEE, SAMPLE } from "../src/sample";

describe("pdf form", () => {
  it("round-trips every answer through a filled PDF", async () => {
    const { data, rows, template } = await extractPdf(await buildPdf(GUARANTEE, SAMPLE));
    expect(template?.title).toBe(GUARANTEE.title);
    expect(data).toEqual(SAMPLE);
    expect(rows.find(r => r.id === "applicant_tel")).toMatchObject({ section: "Applicant", label: "Tel no", value: "+65 6123 4567" });
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

import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { extractPdf } from "../src/pdf";
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

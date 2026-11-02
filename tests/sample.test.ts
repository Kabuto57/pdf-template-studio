import { expect, it } from "vitest";
import { buildPdf, extractPdf, type Template } from "../src/pdf";
import { GUARANTEE, SAMPLE, sampleFor } from "../src/sample";
import forms from "../src/bank-forms.json";

it("keeps the guarantee's own sample", () => expect(sampleFor(GUARANTEE)).toMatchObject(SAMPLE));

it("fills every bank form so it saves, extracts and has every mandatory answer", async () => {
  for (const f of forms) {
    const t = f.template as Template, values = sampleFor(t);
    const { rows } = await extractPdf(await buildPdf(t, values));
    const blank = rows.filter(r => r.required && !r.value);
    expect(blank.map(r => `${f.code}: ${r.label}`)).toEqual([]);
  }
}, 60000);

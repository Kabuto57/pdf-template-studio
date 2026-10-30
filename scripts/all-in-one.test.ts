// Builds one fillable PDF holding every bank form, with a "which application" picker up front:
//   ALL_IN_ONE=out.pdf npx vitest run scripts/all-in-one
import { expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { buildPdf, extractPdf, type Section, type Template, type Values } from "../src/pdf";
import forms from "../src/bank-forms.json";

export function allInOne(): { template: Template; values: Values } {
  const sections: Section[] = [{ title: "Application type", fields: [
    { id: "applying_for", label: "I / We are applying for (tick all that apply, then complete only those parts)", kind: "checks", required: true, options: forms.map(f => f.template.title) },
  ] }];
  const values: Values = {};
  forms.forEach((f, n) => {
    const t = f.template as Template, part = `Part ${n + 1}: ${t.title}`;
    // ponytail: ids prefixed per form so the same question in two forms stays two fields; no de-duplication of shared applicant details
    for (const s of t.sections) sections.push({
      title: t.sections.length === 1 ? part : `${part} - ${s.title}`,
      fields: s.fields.map(x => ({ ...x, id: `${f.code}_${x.id}` })),
    });
    for (const [k, v] of Object.entries(f.defaults as Values)) values[`${f.code}_${k}`] = v;
  });
  return { template: { title: "Trade Services Application (All-in-One)", note: "One form for all trade applications. Tick the applications you need in the first section and complete only those parts. Please complete in block letters. Dates are DD/MM/YYYY. Fields marked * are mandatory for the parts you complete.", sections }, values };
}

it("all-in-one form round-trips", async () => {
  const { template, values } = allInOne();
  const pdf = await buildPdf(template, { ...values, applying_for: ["Banker's Guarantee Application (BG)"] });
  const { data } = await extractPdf(pdf);
  expect(data.applying_for).toEqual(["Banker's Guarantee Application (BG)"]);
  if (process.env.ALL_IN_ONE) writeFileSync(process.env.ALL_IN_ONE, await buildPdf(template, values));
});

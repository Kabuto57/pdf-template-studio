// The studio's canvas: PDFs written from the smart-form layout, the design review and the edits it makes.
import { describe, expect, it } from "vitest";
import { SMART_FORMS } from "../src/canvas/forms";
import { layout } from "../src/canvas/layout";
import { review } from "../src/canvas/review";
import { moveField, removeField, renameField } from "../src/canvas/edit";
import { writePdf } from "../src/canvas/write-pdf";
import { extractPdf, type Template } from "../src/pdf";
import { sampleFor } from "../src/sample";

const form = (): Template => ({
  title: "Test", note: "",
  sections: [
    { title: "One", fields: [
      { id: "notes", label: "Notes", kind: "text", requiredIf: [{ field: "extra", values: ["true"] }] },
      { id: "extra", label: "Extra", kind: "check" },
      { id: "currency", label: "Currency", kind: "select", options: ["SGD", "USD"] },
    ] },
  ],
});

describe("PDF from the canvas layout", () => {
  for (const f of SMART_FORMS.filter(f => /^(lc|bg|eblc)_form/.test(f.file)))
    it(`${f.file}: same pages as the canvas, answers read back`, async () => {
      const values = { ...f.defaults, ...sampleFor(f.form) };
      const bytes = await writePdf(f.form, values);
      const { data, template } = await extractPdf(bytes);
      expect(template?.title).toBe(f.form.title);
      const some = Object.entries(values).filter(([, v]) => typeof v === "string" && v).slice(0, 15);
      const max = (id: string) => f.form.sections.flatMap(s => s.fields).find(q => q.id === id)?.max;
      for (const [k, v] of some) expect(data[k], k).toBe((v as string).slice(0, max(k))); // a box keeps at most max characters
    }, 20000);
});

describe("design review", () => {
  it("finds a follow-up placed before its trigger, and moves it under", () => {
    const t = form();
    const tip = review(t).find(i => i.id === "notes" && i.fix?.label === "Move it under")!;
    expect(tip).toBeTruthy();
    tip.fix!.apply(t);
    expect(t.sections[0].fields.map(f => f.id)).toEqual(["extra", "notes", "currency"]);
    expect(review(t).some(i => i.say.includes("comes after it"))).toBe(false);
  });
  it("suggests pick-one for a short drop-down, and a signature section", () => {
    const t = form(), issues = review(t);
    issues.find(i => i.id === "currency")!.fix!.apply(t);
    expect(t.sections[0].fields[2].kind).toBe("radio");
    issues.find(i => i.fix?.label === "Add a signature section")!.fix!.apply(t);
    expect(t.sections.at(-1)!.signoff).toBe(true);
  });
  it("reports what lc-form would refuse: duplicate keys, conditions on missing options", () => {
    const t = form();
    t.sections[0].fields[2].id = "notes";
    t.sections[0].fields.push({ id: "x", label: "X", kind: "text", requiredIf: [{ field: "currency", values: ["EUR"] }] });
    const problems = review(t).filter(i => i.level === "problem").map(i => i.say);
    expect(problems.some(s => s.includes("used twice"))).toBe(true);
  });
  it("fills a row sized by hand that leaves columns empty", () => {
    const t = form();
    t.sections[0].fields = [{ id: "a", label: "A", kind: "text", cols: 4 }, { id: "b", label: "B", kind: "text", cols: 4 }];
    const tip = review(t, layout(t)).find(i => i.fix?.label === "Fill the row")!;
    tip.fix!.apply(t);
    expect(t.sections[0].fields[1].cols).toBe(8);
  });
  it("the smart forms have no problems", () => {
    for (const f of SMART_FORMS) expect(review(f.form).filter(i => i.level === "problem"), f.file).toEqual([]);
  });
});

describe("edits", () => {
  it("renaming a key updates the rules that name it; deleting removes them", () => {
    const t = form();
    renameField(t, t.sections[0].fields[1], "more");
    expect(t.sections[0].fields[0].requiredIf![0].field).toBe("more");
    removeField(t, "more");
    expect(t.sections[0].fields[0].requiredIf).toBeUndefined();
    moveField(t, "currency", 0, 0);
    expect(t.sections[0].fields.map(f => f.id)).toEqual(["currency", "notes"]);
  });
});

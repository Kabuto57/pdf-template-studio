// The studio's code editor: a form written out as Python (formPython) reads back (readPythonForm) as the same form.
import { describe, expect, it } from "vitest";
import forms from "../src/bank-forms.json";
import { formPython } from "../src/code-view";
import { readPythonForm } from "../src/py-form";
import type { Template, Values } from "../src/pdf";

describe("form <-> Python", () => {
  for (const f of forms as { code: string; template: Template; defaults: Values }[])
    it(f.code, () => {
      const t = { issuer: "Demo Bank · Trade Services", ...f.template };
      expect(readPythonForm(formPython(t, f.defaults))).toEqual({ template: { ...t, note: t.note ?? "" }, values: f.defaults });
    });

  it("reads edits, and says where a mistake is", () => {
    const src = `FORM = form(title='Test', sections=[
      section("One", text("a", "Name \\"A\\"", half=True, required=True),  # a comment
        radio("b", "Pick", ["x", "y"], requiredIf=[when("a", "1", not_=True)]), note="n"),
    ])`;
    expect(readPythonForm(src).template.sections[0]).toEqual({
      title: "One", note: "n", fields: [
        { id: "a", label: 'Name "A"', kind: "text", half: true, required: true },
        { id: "b", label: "Pick", kind: "radio", options: ["x", "y"], requiredIf: [{ field: "a", values: ["1"], not: true }] },
      ],
    });
    expect(() => readPythonForm(`FORM = form(title="T", sections=[\n section("S", text("a" "b"))])`)).toThrow(/^Line 2/);
    expect(() => readPythonForm(`FORM = form(title="T", sections=[section("S", radio("a", "A"))])`)).toThrow(/needs its options/);
    expect(() => readPythonForm(`FORM = form(title="T", sections=[section("S", text("a", "A"), text("a", "B"))])`)).toThrow(/key "a"/);
  });
});

// The Open a form dropdown groups smart forms by category, in the old smart form's menu order; none may go missing.
import { describe, expect, it } from "vitest";
import { SMART_FORMS, groupSmartForms, smartFormLabel } from "../src/canvas/forms";

describe("groupSmartForms", () => {
  it("keeps the category and form order", () => {
    expect(groupSmartForms(SMART_FORMS).map(g => [g.label, g.forms.map(f => f.file)])).toEqual([
      ["Import", ["lc_form.py", "lc_pipe_form.py", "lc_amendment_form.py"]],
      ["Export", ["eblc_form.py", "bill_of_exchange_eblc_form.py", "obc_form.py", "bill_of_exchange_obc_form.py", "bill_of_exchange_form.py"]],
      ["Loans", ["import_financing_form.py", "export_financing_form.py"]],
      ["Guarantees", ["bg_form.py", "sblc_form.py", "bg_amendment_form.py", "sblc_amendment_form.py"]],
    ]);
  });
  it("drops no form: an unlisted one goes to More smart forms", () => {
    const extra = { ...SMART_FORMS[0], file: "future_form.py" };
    const groups = groupSmartForms([...SMART_FORMS, extra]);
    expect(groups.flatMap(g => g.forms).length).toBe(SMART_FORMS.length + 1);
    expect(groups.at(-1)).toMatchObject({ label: "More smart forms", forms: [extra] });
  });
  it("gives every option a distinct text", () => {
    const texts = SMART_FORMS.map(smartFormLabel);
    expect(new Set(texts).size).toBe(texts.length);
  });
});

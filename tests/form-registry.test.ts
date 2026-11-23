// The workbench finds a printed copy's form by the code and version in its QR code: registry, then this browser, then built in.
import { describe, expect, it } from "vitest";
import { addForm, findForm, keyOf, knownForms, removeForm } from "../src/form-registry";
import { LC } from "../src/lc";

const mem = new Map<string, string>();
globalThis.localStorage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v) } as Storage;

describe("form registry", () => {
  it("finds the built-in LC by the key its QR code carries", async () => {
    expect(keyOf(LC.template)).toBe("LC-01@1.0");
    expect((await findForm("LC-01", "1.0"))?.source).toBe("built in");
    expect(await findForm("LC-02", "1.0")).toBeUndefined();
  });

  it("keeps added forms side by side by version, and removes them", async () => {
    const v1 = { ...LC.template, title: "New form", formCode: "Form LC-02 · v1.0" }, v2 = { ...v1, formCode: "Form LC-02 · v2.0" };
    expect(addForm(v1)).toBe("LC-02@1.0");
    addForm(v2);
    expect((await findForm("LC-02", "1.0"))?.template.formCode).toBe(v1.formCode);
    expect((await findForm("LC-02", "2.0"))?.source).toBe("this browser");
    removeForm("LC-02@1.0");
    expect((await knownForms()).map(k => k.key)).toEqual(["LC-01@1.0", "LC-02@2.0"]);
  });
});

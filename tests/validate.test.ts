import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { LC, LC_SAMPLE } from "../src/lc";
import { SAMPLES } from "../src/demo-applications";
import { toSchema } from "../src/form/schema";
import { validateLc } from "../src/form/validate";
import { isActive, isRequired, type Values } from "../src/pdf";

const all = LC.template.sections.flatMap(s => s.fields);
const blank = (v: unknown) => v === undefined || v === "" || v === false || (Array.isArray(v) && !v.length);
const ids = (data: Values, kind: string) => validateLc(data).filter(i => i.kind === kind).map(i => i.id).sort();

describe("LC JSON Schema", () => {
  it("the published schema is up to date with lc.ts (else run LC_PDFS=1 npx vitest run scripts/lc-pdfs)", () => {
    expect(JSON.parse(readFileSync("public/lc-application.schema.json", "utf8"))).toEqual(toSchema(LC.template));
  });

  it("a complete application passes", () => expect(validateLc(LC_SAMPLE)).toEqual([]));

  // The schema must mean exactly what rules.ts means, for every trigger switched on and off.
  const triggers = [...new Set(all.flatMap(f => [...(f.requiredIf ?? []), ...(f.activeIf ?? [])]).map(r => r.field))];
  const variants: Values[] = [LC.defaults, LC_SAMPLE, ...SAMPLES.map(s => s.answers)];
  for (const id of triggers) {
    const f = all.find(q => q.id === id)!;
    for (const v of f.kind === "check" ? [true, false] : f.options ?? []) variants.push({ ...LC_SAMPLE, [id]: v });
  }
  it(`mandatory and not-applicable questions match rules.ts (${variants.length} variations)`, () => {
    for (const data of variants) {
      expect(ids(data, "missing")).toEqual(all.filter(f => isRequired(f, data) && blank(data[f.id])).map(f => f.id).sort());
      expect(ids(data, "not-applicable")).toEqual(all.filter(f => !isActive(f, data) && !blank(data[f.id])).map(f => f.id).sort());
    }
  });

  it("finds wrong formats, odd characters, impossible dates and contradictions", () => {
    const issues = validateLc({
      ...LC_SAMPLE, amount: "1,25,000.0.0", contact_tel: "6898 22II", beneficiary_name: "NORDIC SJØMAT",
      expiry_date: "31/02/2027", latest_shipment_date: "29/02/2027", price_basis: "CIF",
    });
    const say = (id: string) => issues.filter(i => i.id === id).map(i => i.msg);
    expect(say("amount")).toEqual(["is not an amount"]);
    expect(say("contact_tel")[0]).toMatch(/phone/);
    expect(say("beneficiary_name")).toEqual(["has characters the bank's SWIFT messages can't carry"]);
    expect(say("expiry_date")).toEqual(["is not a real DD/MM/YYYY date"]);
    expect(say("latest_shipment_date")).toEqual(["is 29 Feb in a year that isn't a leap year"]);
    expect(say("insurance_arrangement")[0]).toMatch(/only for FOB/);
    expect(validateLc({ ...LC_SAMPLE, latest_shipment_date: "15/01/2027" }).map(i => i.msg)).toEqual(["is before the latest shipment date"]);
    expect(validateLc({ ...LC_SAMPLE, mode_of_advising: "Pigeon" })[0]).toMatchObject({ id: "mode_of_advising", msg: "is not one of the options" });
  });

  it("explains conditional mandatory questions", () => {
    const i = validateLc({ ...LC_SAMPLE, drafts_at: "Term", term_days: "" }).find(x => x.id === "term_days");
    expect(i).toMatchObject({ kind: "missing", msg: 'is mandatory because Drafts at is "Term"' });
  });
});

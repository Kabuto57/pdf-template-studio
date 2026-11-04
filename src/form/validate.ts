// CHECKING AN APPLICATION
// Two parts, both run on the answers as JSON (what the Fill online page holds, or what extractPdf read from a PDF):
//   1. The JSON Schema (schema.ts), checked by Ajv, the most widely used JSON Schema validator. The LC's checker is
//      generated ahead of time (lc-validate.generated.js, by scripts/lc-pdfs.test.ts), because the site's security
//      policy doesn't let a page compile code while it runs.
//   2. Checks that compare answers with each other, which JSON Schema can't express: dates in order, amount above
//      zero, insurance against price basis.
import lcSchema from "../../public/lc-application.schema.json";
// @ts-expect-error generated JavaScript, no types
import lcValidate from "./lc-validate.generated.js";

export interface Issue {
  id: string;   // the question
  msg: string;  // what's wrong, e.g. "is mandatory because Bill of lading is ticked"
  kind: "missing" | "not-applicable" | "wrong";
}
type AjvError = { instancePath: string; schemaPath: string; keyword: string; params: Record<string, string> };
type Validator = ((data: unknown) => boolean) & { errors?: AjvError[] | null };

/** A real DD/MM/YYYY date (no 31/02, 29/02 only in leap years), as a Date. */
export const date = (s: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  const d = m && new Date(+m[3], +m[2] - 1, +m[1]);
  return d && d.getMonth() === +m![2] - 1 && d.getDate() === +m![1] ? d : undefined;
};

/** Ajv's errors as one message per question, using each rule's "description" in the schema. */
export function schemaIssues(validate: Validator, schema: unknown, data: unknown): Issue[] {
  if (validate(data)) return [];
  const out: Issue[] = [];
  for (const e of validate.errors ?? []) {
    if (e.keyword === "if") continue; // "must match then": the "then" part has its own error
    const id = e.instancePath.split("/")[1] || e.params.missingProperty;
    // The nearest "description" on the way down the schema to the rule that failed.
    let node: unknown = schema, msg = "is not valid";
    for (const part of e.schemaPath.replace(/^#\//, "").split("/")) {
      const d = (node as { description?: string } | undefined)?.description;
      if (d && node !== schema) msg = d;
      node = (node as Record<string, unknown> | undefined)?.[part];
    }
    if (e.keyword === "required" && msg === "is not valid") msg = "is mandatory";
    const kind = msg.startsWith("is mandatory") ? "missing" : msg.startsWith("only applies") ? "not-applicable" : "wrong";
    if (id && !out.some(i => i.id === id && i.msg === msg)) out.push({ id, msg, kind });
  }
  return out;
}

/** Checks across answers (LC field names; skipped when a form doesn't have them). */
export function crossChecks(data: Record<string, unknown>): Issue[] {
  const out: Issue[] = [];
  const wrong = (id: string, msg: string) => out.push({ id, msg, kind: "wrong" });
  const str = (id: string) => (typeof data[id] === "string" ? (data[id] as string) : "");
  for (const id of ["application_date", "latest_shipment_date", "expiry_date"])
    if (/^29\/02\/\d{4}$/.test(str(id)) && !date(str(id))) wrong(id, "is 29 Feb in a year that isn't a leap year");
  const ship = date(str("latest_shipment_date")), expiry = date(str("expiry_date")), applied = date(str("application_date"));
  if (ship && expiry && expiry < ship) wrong("expiry_date", "is before the latest shipment date");
  if (applied && ship && ship < applied) wrong("latest_shipment_date", "is before the application date");
  if (applied && expiry && expiry < applied) wrong("expiry_date", "is before the application date");
  if (applied && applied.getTime() > Date.now()) wrong("application_date", "is in the future");
  if (/^[\d,]+(\.\d+)?$/.test(str("amount")) && !(Number(str("amount").replace(/,/g, "")) > 0))
    wrong("amount", "must be more than zero");
  // The bank's form only offers the insurance arrangement for FOB / CFR / FCA / CPT (the seller doesn't insure).
  if (str("insurance_arrangement") && ["CIF", "CIP"].includes(str("price_basis")))
    wrong("insurance_arrangement", `is only for FOB/CFR/FCA/CPT, but price basis is ${str("price_basis")} (the beneficiary insures)`);
  return out;
}

/** Every issue with an LC application: the JSON Schema (Ajv), then the checks across answers. */
export const validateLc = (data: Record<string, unknown>): Issue[] => {
  const order = Object.keys(lcSchema.properties); // the form's order, top to bottom
  return [...schemaIssues(lcValidate as Validator, lcSchema, data), ...crossChecks(data)]
    .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
};

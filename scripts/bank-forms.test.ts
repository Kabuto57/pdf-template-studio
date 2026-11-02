// Regenerates src/bank-forms.json from the bank's trade smart form (not kept in this repo):
//   BANK_PDF=~/Downloads/Trade-Smartform.pdf BANK_RULES=rules.json npx vitest run scripts/bank-forms
// BANK_RULES (optional) is the output of scripts/xfa-rules.py: "mandatory when ..." rules from the form's scripts.
import { it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { readXfa, xfaForms, xfaTemplate } from "../src/text";
import type { Field } from "../src/pdf";
import { LC } from "../src/lc";

interface XfaRule { trigger: string; values: string[]; options: number[] | null; not: boolean; target: string }

const TITLES: Record<string, string> = {
  LC: "Irrevocable Documentary Credit (LC)",
  LC_Amendment: "Amendment to Documentary Credit (LC Amendment)",
  EBLC: "Handling / Financing of Documents under Export Documentary Credit (EBLC)",
  OBC: "Application for Export Documentary Collection (OBC)",
  DBRP: "Import Financing",
  BEOBC: "Bill of Exchange: Export Documentary Collection",
  BEEBLC: "Bill of Exchange: Export Documentary Credit",
  BEGeneric: "Bill of Exchange (Generic, free format)",
  SBLC: "Irrevocable Standby Letter of Credit Application (SBLC)",
  SBLCA: "Standby Letter of Credit Amendment (SBLC Amendment)",
  BG: "Banker's Guarantee Application (BG)",
  BGA: "Banker's Guarantee Amendment (BG Amendment)",
  EXPORT: "Export Financing: Pre-shipment / Sales Invoice Financing",
};
// No bank name in the templates.
const plain = (s: string) => s.replace(/DBS Bank Ltd\.?/g, "the Bank").replace(/go\.dbs\.com\S*/gi, "the Bank's website").replace(/DBS/g, "Bank");

it.skipIf(!process.env.BANK_PDF)("bank forms", async () => {
  const x = (await readXfa(new Uint8Array(readFileSync(process.env.BANK_PDF!))))!;
  for (const f of x.fields) { f.path = f.path.map(plain); f.name = plain(f.name); f.caption = plain(f.caption); f.options = f.options.map(plain); if (typeof f.value === "string") f.value = plain(f.value); }
  const rules: XfaRule[] = process.env.BANK_RULES ? JSON.parse(readFileSync(process.env.BANK_RULES, "utf8")) : [];
  const forms = xfaForms(x).filter(f => TITLES[f.code]).map(f => {
    const { template, values, keys } = xfaTemplate(x, f.code);
    const byKey = new Map<string, Field>(), all = template.sections.flatMap(s => s.fields);
    for (const [xf, id] of keys) byKey.set([...xf.path, xf.name].join("."), all.find(q => q.id === id)!);
    for (const r of rules) {
      const trigger = byKey.get(plain(r.trigger)), target = byKey.get(plain(r.target));
      if (!trigger || !target) continue;
      const vals = trigger.kind === "check" ? r.values.map(v => String(v === "1")) : r.options ? r.options.map(i => trigger.options![i]) : r.values;
      (target.requiredIf ??= []).push({ field: trigger.id, values: vals, ...(r.not ? { not: true } : {}) });
      delete target.required; // the smart form sets it at run time, so it is not mandatory by default
    }
    template.title = TITLES[f.code];
    template.note = "Please complete in block letters. Dates are DD/MM/YYYY.";
    for (const s of template.sections) if (/bcode/i.test(s.title)) s.title = "Form details";
    const defaults = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== "" && v !== false));
    return { code: f.code, template, defaults };
  });
  // The LC is maintained by hand in src/lc.ts so it matches the bank's form exactly (sections, fields, rules).
  forms.splice(forms.findIndex(f => f.code === "LC"), 1, LC);
  writeFileSync("src/bank-forms.json", JSON.stringify(forms, null, 1));
  console.log(forms.map(f => `${f.code}: ${f.template.sections.reduce((a, s) => a + s.fields.length, 0)}`).join(", "));
}, 60000);

// Test helper: fills a form in the browser stand-in until Check form has nothing left to list. It starts from sampleFor's answers, then
// answers what Check form names (the way a customer would), so every form gets valid answers without hand-written samples.
import type { Engine } from "../src/fill/engine";
import { safe } from "../src/canvas/layout";
import type { Field, Template, Values } from "../src/pdf";

const EXAMPLE: Record<string, string> = {
  number: "5", amount: "1,000.00", phone: "+65 6123 4567", account: "12345678", cif: "1234567", ref12: "553010012345",
  fx8: "12345678", fx2: "12", swift: "ABCDSGSG",
};

function put(eng: Engine, q: Field, v: Values[string]) {
  const doc = eng.doc, id = q.id;
  if (q.kind === "check") doc.getField(id)!.value = v === true ? "Yes" : "Off";
  else if (q.kind === "checks") (q.options ?? []).forEach((o, i) => (doc.getField(`${id}__${i}`)!.value = Array.isArray(v) && v.includes(o) ? "Yes" : "Off"));
  else if (q.kind === "radio") doc.getField(id)!.value = (q.options ?? []).map(safe).find(o => o === safe(String(v))) ?? "Off";
  else if (q.kind === "select") { const f = doc.getField(id)!; f.value = f.options.includes(safe(String(v))) ? safe(String(v)) : ""; }
  else doc.getField(id)!.value = typeof v === "string" ? safe(v).slice(0, q.max || undefined) : "";
}

export function solve(eng: Engine, form: Template, seed: Values) {
  const qs = form.sections.flatMap(s => s.fields);
  for (const q of qs) if (q.id in seed) put(eng, q, seed[q.id]);
  const fix = (q: Field, wrong: boolean) => {
    const opts = (q.options ?? []).filter(o => !o.startsWith("<"));
    if (q.kind === "check") put(eng, q, true);
    else if (q.kind === "checks" || q.kind === "radio") put(eng, q, q.kind === "radio" ? opts[0] : opts.slice(0, 1));
    else if (q.kind === "select") put(eng, q, opts[0]);
    else if (q.kind === "date") put(eng, q, wrong ? "15/06/2026" : "01/12/2026");
    else put(eng, q, q.format ? EXAMPLE[q.format] : "SAMPLE TEXT");
  };
  for (let round = 0; round < 40; round++) {
    const { missing, bad } = eng.check();
    if (!missing.length && !bad.length) return;
    for (const label of missing) for (const q of qs) if (safe(q.label) === label) fix(q, false);
    for (const msg of bad) for (const q of qs) if (msg.startsWith(`${safe(q.label)}: `)) fix(q, true);
  }
  throw new Error(`could not fill ${form.title}: ${JSON.stringify(eng.check())}`);
}

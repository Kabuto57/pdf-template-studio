// CHANGING A FORM: the few edits the canvas and the design review make (they change the form in place).
import { PAGE_ROOM } from "./layout";
import { slug, type Field, type Rule, type Template } from "../pdf";

/** Where a question is: section index si, position qi. */
export function locate(t: Template, id: string) {
  for (let si = 0; si < t.sections.length; si++) {
    const qi = t.sections[si].fields.findIndex(f => f.id === id);
    if (qi >= 0) return { si, qi, field: t.sections[si].fields[qi] };
  }
  return undefined;
}

export const allFields = (t: Template) => t.sections.flatMap(s => s.fields);
export const rulesOf = (f: Field): Rule[] => [...(f.requiredIf ?? []), ...(f.activeIf ?? [])];
/** The questions whose rules wait on this one. */
export const dependents = (t: Template, id: string) => allFields(t).filter(f => rulesOf(f).some(r => r.field === id));

/** A key no other question has: "applicant_name", then "applicant_name_2", ... */
export function uniqueId(t: Template, base: string, self?: Field) {
  const taken = new Set(allFields(t).filter(f => f !== self).map(f => f.id));
  let id = slug(base), n = 2;
  while (taken.has(id)) id = `${slug(base)}_${n++}`;
  return id;
}

/** Moves a question to section si at position qi (counted before it is taken out). */
export function moveField(t: Template, id: string, si: number, qi: number) {
  const from = locate(t, id);
  if (!from) return;
  t.sections[from.si].fields.splice(from.qi, 1);
  if (from.si === si && from.qi < qi) qi--;
  t.sections[si].fields.splice(Math.max(0, Math.min(qi, t.sections[si].fields.length)), 0, from.field);
}

/** Changes a question's key, and every rule, check and answer that names it. */
export function renameField(t: Template, field: Field, id: string) {
  const old = field.id;
  field.id = id;
  for (const f of allFields(t)) {
    for (const r of rulesOf(f)) if (r.field === old) r.field = id;
    if (f.words) f.words = f.words.map(w => (w === old ? id : w));
  }
  for (const c of t.checks ?? []) {
    if (c.a === old) c.a = id;
    if ("b" in c && c.b === old) c.b = id;
  }
}

/** Deletes a question, and the rules and checks that named it (they would point at nothing). */
export function removeField(t: Template, id: string) {
  const at = locate(t, id);
  if (!at) return;
  t.sections[at.si].fields.splice(at.qi, 1);
  for (const f of allFields(t)) {
    if (f.requiredIf) { f.requiredIf = f.requiredIf.filter(r => r.field !== id); if (!f.requiredIf.length) delete f.requiredIf; }
    if (f.activeIf) { f.activeIf = f.activeIf.filter(r => r.field !== id); if (!f.activeIf.length && !f.requiredIf) delete f.activeIf; }
    if (f.words) f.words = f.words.filter(w => w !== id);
  }
  if (t.checks) t.checks = t.checks.filter(c => c.a !== id && !("b" in c && c.b === id));
}

/** A section's min_height after dragging its bottom edge to `wanted` points tall: snapped to 5 pt, at most a page, and
 *  undefined (no setting, fit the content) when that is no taller than the content. */
export function minHeightFor(wanted: number, content: number): number | undefined {
  const snapped = Math.min(Math.round(wanted / 5) * 5, Math.floor(PAGE_ROOM / 5) * 5);
  return snapped > content ? snapped : undefined;
}

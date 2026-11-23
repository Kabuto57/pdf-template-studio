// DESIGN REVIEW: plain rules that look over a form and its layout, and say what to fix. No guessing:
//   problems  what lc-form's build would refuse (build.py check_form), so the form file wouldn't build
//   tips      what makes a form harder to read or fill in: logic that runs backwards, the wrong kind of choice,
//             a half-empty page, uneven rows. Most come with a one-click fix.
import { BOTTOM, H, type Laid } from "./layout";
import { allFields, dependents, locate, moveField, rulesOf } from "./edit";
import { FORMATS, hasOptions, type Field, type Template } from "../pdf";

export interface Issue {
  level: "problem" | "tip";
  si: number;          // the section it is about
  id?: string;         // the question, if it is about one
  say: string;
  fix?: { label: string; apply: (t: Template) => void };
}

const SIGNOFF_SECTION = { title: "Authorised Signature(s)", signoff: true, fields: [{ id: "signatory_name", label: "Name of authorised signatory", kind: "text" as const, half: true, max: 35 }] };
const short = (s: string) => (s.length > 48 ? `${s.slice(0, 45)}…` : s);

export function review(t: Template, laid?: Laid): Issue[] {
  const out: Issue[] = [];
  const problem = (si: number, say: string, id?: string, fix?: Issue["fix"]) => out.push({ level: "problem", si, id, say, fix });
  const tip = (si: number, say: string, id?: string, fix?: Issue["fix"]) => out.push({ level: "tip", si, id, say, fix });
  const fields = allFields(t), byId = new Map(fields.map(f => [f.id, f]));
  const no = (id: string) => { const at = locate(t, id); return at ? `${at.si + 1}.${at.qi + 1}` : id; };

  // ---- problems: what build.py's check_form refuses
  const seen = new Set<string>();
  t.sections.forEach((s, si) => {
    if (!s.title.trim()) problem(si, `Section ${si + 1} has no title.`);
    if (!s.fields.length) problem(si, `"${s.title}" has no questions. Add one, or delete the section.`, undefined,
      { label: "Delete section", apply: f => { f.sections.splice(si, 1); } });
    if (s.width === "half" && s.signoff) problem(si, `"${s.title}" has signature lines, so it needs the whole width.`, undefined,
      { label: "Make it auto width", apply: f => { delete f.sections[si].width; } });
    for (const q of s.fields) {
      if (!/^[A-Za-z_]\w*$/.test(q.id) || q.id.startsWith("__")) problem(si, `${no(q.id)}: the key "${q.id}" may only have letters, digits and _ (not starting with a digit).`, q.id);
      if (seen.has(q.id)) problem(si, `${no(q.id)}: the key "${q.id}" is used twice. Every key must be different.`, q.id);
      seen.add(q.id);
      if (!q.label.trim()) problem(si, `${no(q.id)} has no wording.`, q.id);
      if (hasOptions(q.kind) && !q.options?.length) problem(si, `${no(q.id)} "${short(q.label)}" needs its options.`, q.id);
      if (q.format && !(q.format in FORMATS)) problem(si, `${no(q.id)}: unknown answer format "${q.format}".`, q.id);
      for (const key of ["requiredIf", "activeIf"] as const) {
        q[key]?.forEach((r, ri) => {
          const other = byId.get(r.field);
          const drop = { label: "Remove this condition", apply: (f: Template) => { const x = locate(f, q.id)?.field; x?.[key]?.splice(ri, 1); if (x && !x[key]?.length && key === "requiredIf") delete x[key]; } };
          if (!other) return problem(si, `${no(q.id)} waits for a question that no longer exists ("${r.field}").`, q.id, drop);
          const bad = other.options && !r.not ? r.values.find(v => !other.options!.includes(v)) : undefined;
          if (bad !== undefined) problem(si, `${no(q.id)} waits for ${no(other.id)} to be "${bad}", which is not one of its options.`, q.id, drop);
        });
      }
    }
  });
  t.checks?.forEach((c, ci) => {
    for (const id of [c.a, "b" in c ? c.b : undefined]) if (id && !byId.has(id))
      problem(0, `A check across answers names "${id}", which no question has.`, undefined, { label: "Remove the check", apply: f => { f.checks?.splice(ci, 1); } });
  });

  // ---- tips: reading and filling in
  t.sections.forEach((s, si) => s.fields.forEach((q, qi) => {
    // a condition on a question further down: the person meets the follow-up before what switches it on
    const later = rulesOf(q).map(r => locate(t, r.field)).find(at => at && (at.si > si || (at.si === si && at.qi > qi)));
    if (later) tip(si, `${no(q.id)} "${short(q.label)}" depends on ${no(later.field.id)}, which comes after it. Put follow-ups under what switches them on.`, q.id,
      { label: "Move it under", apply: f => moveUnder(f, q.id, later.field.id) });

    if (q.kind === "select" && q.options && q.options.length <= 3 && q.options.every(o => o.length <= 30))
      tip(si, `${no(q.id)} "${short(q.label)}" is a drop-down with ${q.options.length} options. Pick-one shows them all at a glance.`, q.id,
        { label: "Make it pick-one", apply: f => { locate(f, q.id)!.field.kind = "radio"; } });
    if (q.kind === "radio" && q.options && q.options.length >= 8)
      tip(si, `${no(q.id)} "${short(q.label)}" has ${q.options.length} options to pick from. A drop-down is tidier.`, q.id,
        { label: "Make it a drop-down", apply: f => { locate(f, q.id)!.field.kind = "select"; } });
    if (q.label.length > 90 && (q.kind === "text" || q.kind === "date" || q.kind === "select"))
      tip(si, `${no(q.id)}'s wording is ${q.label.length} characters, so its label sits above the box. Shorten it, or move the explanation into the section's note.`, q.id);
    if (q.kind === "check" && dependents(t, q.id).length === 0 && /:\s*$/.test(q.label))
      tip(si, `${no(q.id)} "${short(q.label)}" ends with ":" but nothing depends on it. Add the follow-up question, or drop the colon.`, q.id);
  }));

  if (t.sections.length && !t.sections.some(s => s.signoff))
    tip(t.sections.length - 1, "The form has no signature block. Applications are usually signed.", undefined,
      { label: "Add a signature section", apply: f => { f.sections.push(structuredClone(SIGNOFF_SECTION)); } });

  if (laid) layoutTips(t, laid, tip, no);
  return out;
}

/** Tips that need to know where things landed. */
function layoutTips(t: Template, laid: Laid, tip: (si: number, say: string, id?: string, fix?: Issue["fix"]) => void, no: (id: string) => string) {
  // rows sized by hand that leave part of the row empty
  for (const row of laid.rows) {
    const qs = row.ids.map(id => locate(t, id)?.field).filter((f): f is Field => !!f);
    if (!qs.length || !qs.every(q => q.cols) || qs.some(q => q.kind === "check")) continue;
    const used = row.cols.reduce((a, b) => a + b, 0), gap = row.of - used;
    if (gap >= 2 && row.ids.length > 1) {
      const last = qs[qs.length - 1];
      tip(row.si, `A row in "${t.sections[row.si].title}" leaves ${gap} of ${row.of} columns empty. Widen ${no(last.id)} to close the gap.`, last.id,
        { label: "Fill the row", apply: f => { const x = locate(f, last.id)!.field; x.cols = (x.cols ?? 0) + gap; } });
    }
  }

  // a page that ends early: the next section was pushed over
  for (let p = 0; p < laid.lastQuestionPage; p++) {
    const onPage = laid.sections.filter(s => s.page === p);
    if (!onPage.length) continue;
    const lowest = Math.min(...onPage.map(s => s.y)), blank = lowest - BOTTOM;
    if (blank < (H - 80) * 0.22) continue;
    const next = laid.sections.find(s => s.page === p + 1);
    const sec = next ? t.sections[next.si] : undefined;
    const cm = (blank / 72 * 2.54).toFixed(1);
    if (sec?.new_page) tip(next!.si, `Page ${p + 1} ends with ${cm} cm blank because "${sec.title}" starts a new page.`, undefined,
      { label: "Let it follow on", apply: f => { delete f.sections[next!.si].new_page; } });
    else if (sec) tip(next!.si, `Page ${p + 1} ends with ${cm} cm blank: "${sec.title}" doesn't fit under it${sec.signoff || sec.bankOnly ? " and is kept whole" : ""}. Moving a shorter section up, or trimming paragraph boxes, fills the page.`);
  }

  // two half sections side by side, one much taller: the short one ends in an empty box
  for (let si = 0; si + 1 < t.sections.length; si++) {
    const [a, b] = [t.sections[si], t.sections[si + 1]];
    if (a.width !== "half" || b.width !== "half") continue;
    const content = (i: number) => {
      const qs = laid.questions.filter(q => q.si === i);
      const box = laid.sections.find(s => s.si === i);
      return qs.length && box ? box.y + box.h - Math.min(...qs.map(q => q.y)) : 0;
    };
    const [ha, hb] = [content(si), content(si + 1)];
    if (Math.min(ha, hb) < 0.45 * Math.max(ha, hb))
      tip(si, `"${a.title}" and "${b.title}" are set side by side, but one is less than half the other's height, leaving an empty box.`, undefined,
        { label: "Let the layout decide", apply: f => { delete f.sections[si].width; delete f.sections[si + 1].width; } });
  }
}

/** Moves a question to just after its trigger and the trigger's other follow-ups. */
function moveUnder(t: Template, id: string, trigger: string) {
  const at = locate(t, trigger);
  if (!at) return;
  const fields = t.sections[at.si].fields;
  let qi = at.qi + 1;
  while (qi < fields.length && fields[qi].id !== id && rulesOf(fields[qi]).some(r => r.field === trigger)) qi++;
  moveField(t, id, at.si, qi);
}

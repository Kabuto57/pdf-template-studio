// THE RULES: "is this question mandatory right now?" and "does this question apply right now?"
// Used everywhere the form's rules matter: the PDF builder, the studio's on-screen form and the Trade Ops workbench.
// (Inside the PDF, Acrobat runs the same logic in JavaScript: see acrobat-script.ts.)
import type { Field, Rule, Values } from "./types";

/** Does this rule hold, given the answers so far? */
const holds = (answers: Values) => (rule: Rule) => {
  const answer = answers[rule.field];
  const hit = Array.isArray(answer)
    ? answer.some(option => rule.values.includes(option))   // "tick any": one of the ticked options matches
    : rule.values.includes(String(answer ?? ""));           // anything else: the answer itself matches
  if (rule.not) return !hit && answer !== undefined && answer !== ""; // "anything else, but answered"
  return hit;
};

/** Mandatory now: always mandatory, or one of its "mandatory when" rules holds. */
export const isRequired = (f: Field, answers: Values) => !!f.required || !!f.requiredIf?.some(holds(answers));

/** The rules that switch a question on. E.g. the boxes under "Bill of lading" are only answerable once it is ticked. */
export const activeRules = (f: Field) => f.activeIf ?? (f.requiredIf ?? []).filter(rule => !rule.not);

/** Applies now: it has no switching rules, or one of them holds. */
export const isActive = (f: Field, answers: Values) => {
  const rules = activeRules(f);
  return !rules.length || rules.some(holds(answers));
};

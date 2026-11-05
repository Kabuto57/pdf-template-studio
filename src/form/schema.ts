// THE FORM AS A JSON SCHEMA
// JSON Schema (json-schema.org, draft 2020-12) is the published standard for describing what valid JSON looks like.
// toSchema writes the form's rules in it: the answer types, the options, the formats, the lengths, which questions
// are mandatory (always, or only when another answer matches) and which only apply once something is ticked.
// Any system can then check an application with an off-the-shelf validator: Ajv here (validate.ts), and e.g.
// `jsonschema` in Python or networknt in Java on a back end, all from the same file (public/lc-application.schema.json).
// Each rule carries a "description": the message shown when an answer breaks it.
import { activeRules } from "./rules";
import { BAD_CHARS, FORMATS, type Field, type Rule, type Template } from "./types";

type Schema = Record<string, unknown>;

// DD/MM/YYYY with a real day for the month (29 Feb is checked for leap years in cross-checks.ts).
const DATE = "^$|^(0[1-9]|1\\d|2[0-9])/(0[1-9]|1[0-2])/\\d{4}$|^30/(0[13-9]|1[0-2])/\\d{4}$|^31/(0[13578]|1[02])/\\d{4}$";

/** "Bill of lading is ticked", "Drafts at is "Term"", in words, for the messages. */
const say = (rule: Rule, all: Field[]) => {
  const label = all.find(f => f.id === rule.field)?.label ?? rule.field;
  const by = label.length > 60 ? `${label.slice(0, 57).replace(/\s+\S*$/, "")}…` : label; // long tick-box wording, shortened
  const vs = rule.values.map(v => (v === "true" ? "ticked" : v === "false" ? "not ticked" : `"${v}"`)).join(" or ");
  return `${by} is ${rule.not ? "not " : ""}${vs}`;
};

/** The JSON Schema for one form. */
export function toSchema(t: Template): Schema {
  const all = t.sections.flatMap(s => s.fields);
  const kindOf = new Map(all.map(f => [f.id, f.kind]));

  // "This answer is filled in" and "this answer is blank", for each kind of question.
  const filled = (f: Field): Schema =>
    f.kind === "check" ? { const: true } : f.kind === "checks" ? { minItems: 1 } : { minLength: 1 };
  const blank = (f: Field): Schema =>
    f.kind === "check" ? { const: false } : f.kind === "checks" ? { maxItems: 0 } : { maxLength: 0 };

  // A rule as a schema: true when the answers match it (same meaning as `holds` in rules.ts).
  const matches = (rule: Rule): Schema => {
    const kind = kindOf.get(rule.field);
    const is: Schema =
      kind === "check" ? { enum: rule.values.map(v => v === "true") } :
      kind === "checks" ? { contains: { enum: rule.values } } :
      { enum: rule.values };
    return { required: [rule.field], properties: { [rule.field]: rule.not ? { not: is, minLength: 1 } : is } };
  };
  const anyOf = (rules: Rule[]) => (rules.length === 1 ? matches(rules[0]) : { anyOf: rules.map(matches) });

  const properties: Record<string, Schema> = {};
  const rules: Schema[] = [];
  for (const f of all) {
    // The answer itself: its type, options, format, length and characters.
    const p: Schema =
      f.kind === "check" ? { type: "boolean" } :
      f.kind === "checks" ? { type: "array", items: { enum: f.options ?? [] }, uniqueItems: true } :
      f.kind === "radio" || f.kind === "select" ? { enum: ["", ...(f.options ?? [])], description: "is not one of the options" } :
      { type: "string" };
    const checks: Schema[] = [];
    if (f.kind === "date") checks.push({ pattern: DATE, description: "is not a real DD/MM/YYYY date" });
    if (f.format) checks.push({ pattern: `^$|${FORMATS[f.format].ok.source}`, description: FORMATS[f.format].say });
    if (f.kind === "text" || f.kind === "long") {
      checks.push({ not: { pattern: BAD_CHARS }, description: "has characters the bank's SWIFT messages can't carry" });
      if (f.max) checks.push({ maxLength: f.max, description: `is longer than ${f.max} characters` });
    }
    if (f.required) checks.push({ ...filled(f), description: "is mandatory" });
    properties[f.id] = { title: f.label, ...p, ...(checks.length ? { allOf: checks } : {}) };

    // Mandatory only when another answer matches.
    if (f.requiredIf?.length)
      rules.push({
        if: anyOf(f.requiredIf),
        then: { required: [f.id], properties: { [f.id]: filled(f) }, description: `is mandatory because ${f.requiredIf.map(r => say(r, all)).join(" or ")}` },
      });
    // Only applies once something is ticked or picked: otherwise it must be left blank.
    const switches = activeRules(f);
    if (switches.length)
      rules.push({
        if: { not: anyOf(switches) },
        then: { properties: { [f.id]: blank(f) }, description: `only applies when ${switches.map(r => say(r, all)).join(" or ")}` },
      });
  }

  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: `https://kabuto57.github.io/pdf-template-studio/${t.title === "Irrevocable Documentary Credit Application" ? "lc-application" : "form"}.schema.json`,
    title: t.title,
    type: "object",
    required: all.filter(f => f.required).map(f => f.id),
    properties,
    allOf: rules,
  };
}

// Ops review: a first pass over the extracted answers before a person decides.
// Rule-based, so every flag can be explained; the reviewer (or an AI they paste into) makes the call.
import type { Row, Template, Value, Values } from "./pdf";

export type Status = "pass" | "check" | "fail"; // check = a person must look; fail = the form is wrong
export interface Check { name: string; status: Status; detail: string }

// ponytail: demo data only. Real screening uses the bank's list provider (World-Check, Dow Jones, the
// MAS / UN / OFAC lists); paste an export into the Review step to use it here.
export const DEMO_WATCHLIST = [
  "Shadow Harbour Shipping LLC", "Red Dune Trading FZE", "Northstar Arms Supply", "Zenith Dual-Use Technologies", "Ocean Pearl Front Co",
];
export const HIGH_RISK = ["North Korea", "Iran", "Myanmar", "Syria", "Cuba", "Russia", "Belarus", "Crimea"];
const RISKY = ["weapon", "arms", "ammunition", "military", "missile", "nuclear", "explosive", "dual-use", "dual use", "uranium", "narcotic", "crypto", "casino", "gambling", "cash"];
const COMPANY = /\b(pte|ltd|limited|llc|inc|co|corp|corporation|company|plc|gmbh|fze|sdn|bhd|the)\b/g;

export const text = (v: Value | undefined) => v === true ? "Yes" : v === false || v === undefined ? "" : Array.isArray(v) ? v.join(", ") : v.trim();
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(COMPANY, " ").replace(/\s+/g, " ").trim();
const bigrams = (s: string) => new Set([...s.replace(/ /g, "")].map((_, i, a) => a.slice(i, i + 2).join("")).slice(0, -1));
/** Same name, allowing for punctuation, company suffixes and small typos (Dice similarity on letter pairs). */
export function sameName(a: string, b: string) {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  if (x === y || (y.length > 5 && ` ${x} `.includes(` ${y} `))) return true;
  const p = bigrams(x), q = bigrams(y);
  return 2 * [...p].filter(g => q.has(g)).length / (p.size + q.size) >= 0.85;
}
const date = (s: string) => {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const d = m && new Date(+m[3], +m[2] - 1, +m[1]);
  return d && d.getDate() === +m![1] && d.getMonth() === +m![2] - 1 ? d : undefined;
};
const list = (xs: string[], n = 5) => xs.slice(0, n).join("; ") + (xs.length > n ? ` and ${xs.length - n} more` : "");

export function review(rows: Row[], watchlist: string[], today = new Date()): Check[] {
  const out: Check[] = [], filled = rows.filter(r => text(r.value));
  const add = (name: string, bad: string[], status: Status, ok: string, why: string) =>
    out.push(bad.length ? { name, status, detail: `${why}: ${list(bad)}` } : { name, status: "pass", detail: ok });

  const blank = rows.filter(r => r.required && !text(r.value) && r.value !== true);
  add("Mandatory questions", blank.map(r => r.label), "fail", `All ${rows.filter(r => r.required).length} answered`, `${blank.length} blank`);

  const dated = filled.filter(r => /date/i.test(r.label) || /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text(r.value)));
  const badDates = dated.filter(r => !date(text(r.value)));
  const when = (re: RegExp) => dated.map(r => re.test(r.label) ? date(text(r.value)) : undefined).find(Boolean);
  const start = when(/effective|issue/i), end = when(/expiry/i);
  if (start && end && end <= start) badDates.push({ ...dated[0], label: "expiry date is not after the effective date" });
  add("Dates", badDates.map(r => `${r.label} (${text(r.value)})`), "fail", `${dated.length} checked, all valid DD/MM/YYYY`, "Not valid");
  const past = dated.filter(r => /expiry/i.test(r.label) && (date(text(r.value)) ?? today) < today);
  if (past.length) out.push({ name: "Expiry", status: "check", detail: `Already passed: ${list(past.map(r => `${r.label} ${text(r.value)}`))}` });

  const amounts = filled.filter(r => /amount/i.test(r.label) && !/word/i.test(r.label));
  add("Amounts", amounts.filter(r => !(Number(text(r.value).replace(/[, ]|[A-Z]{3}/g, "")) > 0)).map(r => `${r.label} (${text(r.value)})`),
    "fail", `${amounts.length} checked, all numbers above zero`, "Not a number");

  const contacts = filled.filter(r => /e-?mail|tel|phone|fax/i.test(r.label));
  add("Contact details", contacts.filter(r => /mail/i.test(r.label) ? !/^\S+@\S+\.\S+$/.test(text(r.value)) : text(r.value).replace(/\D/g, "").length < 6)
    .map(r => `${r.label} (${text(r.value)})`), "fail", `${contacts.length} emails and phone numbers checked, all look valid`, "Check format");

  const names = filled.filter(r => /name|beneficiary|applicant|drawee|drawer|party|company|bank|consignee|shipper/i.test(r.label) && /[a-z]{3}/i.test(text(r.value)));
  const hits = names.flatMap(r => watchlist.filter(w => sameName(text(r.value), w)).map(w => `${r.label} "${text(r.value)}" looks like listed "${w}"`));
  add("Sanctions screening", hits, "check", `${names.length} names screened against ${watchlist.length} listed names, no match`, "Possible match, escalate to compliance");

  const risky = filled.flatMap(r => HIGH_RISK.filter(c => new RegExp(`\\b${c}\\b`, "i").test(text(r.value))).map(c => `${r.label}: ${c}`));
  add("High-risk countries", risky, "check", "No high-risk or sanctioned country mentioned", "Mentioned, needs enhanced due diligence");

  const words = filled.flatMap(r => RISKY.filter(w => new RegExp(`\\b${w}\\b`, "i").test(text(r.value))).map(w => `${r.label}: "${w}"`));
  add("Purpose and goods", words, "check", "No red-flag words in the answers", "Red-flag words, confirm the purpose is legitimate");
  return out;
}

/** A prompt to paste into the bank's approved AI assistant. Nothing is sent from the page itself. */
export function aiPrompt(title: string, rows: Row[], checks: Check[]) {
  return [
    `You are helping a bank trade operations officer review a "${title}".`,
    "Using only the answers below, list: (1) missing or inconsistent information, (2) anything that does not make commercial sense",
    "(amounts, dates, parties, goods, purpose), (3) sanctions, AML or trade-based money-laundering red flags, and (4) questions to ask the customer.",
    "Say clearly what you are unsure about. Do not approve or reject; the officer decides.",
    "", "Answers:", ...rows.filter(r => text(r.value)).map(r => `- ${r.section ? `${r.section} / ` : ""}${r.label}: ${text(r.value)}`),
    "", "Automatic checks already run:", ...checks.map(c => `- ${c.name}: ${c.status.toUpperCase()}, ${c.detail}`),
  ].join("\n");
}

export const DECISIONS = ["Accept", "Return to customer", "Escalate to compliance"];

/** The review report is itself a fillable form, so it can be filed, signed and extracted like any other. */
export function reportTemplate(title: string, file: string, rows: Row[], checks: Check[], decision: Values, today = new Date()): { template: Template; values: Values } {
  const values: Values = { ...decision };
  const long = (s: string) => (s.length > 70 ? "long" : "text") as "long" | "text";
  const bySection = new Map<string, Row[]>();
  for (const r of rows) bySection.set(r.section || "Answers", [...bySection.get(r.section || "Answers") ?? [], r]);
  checks.forEach((c, i) => values[`check_${i}`] = c.detail);
  rows.forEach((r, i) => values[`answer_${i}`] = text(r.value) || (r.required ? "(blank: required)" : "(blank)"));
  const n = (s: Status) => checks.filter(c => c.status === s).length;
  values.summary = `${n("fail")} failed, ${n("check")} to look at, ${n("pass")} passed`;
  return {
    values,
    template: {
      title: `Review: ${title}`,
      note: `Ops review of ${file}, prepared ${today.toLocaleDateString("en-GB")}. The automatic checks are a first pass; the reviewer makes the decision.`,
      sections: [
        { title: "Decision", fields: [
          { id: "summary", label: "Automatic checks", kind: "text" },
          { id: "decision", label: "Decision", kind: "radio", options: DECISIONS, required: true },
          { id: "reviewer", label: "Reviewed by", kind: "text", half: true, required: true },
          { id: "review_date", label: "Date", kind: "date", half: true },
          { id: "notes", label: "Notes and questions for the customer", kind: "long" },
        ] },
        { title: "Automatic checks", fields: checks.map((c, k) => ({ id: `check_${k}`, label: `${c.name}: ${c.status.toUpperCase()}`, kind: long(c.detail) })) },
        ...[...bySection].map(([section, rs]) => ({ title: `Answers: ${section}`, fields: rs.map(r => {
          const k = rows.indexOf(r);
          return { id: `answer_${k}`, label: r.label + (r.required ? " *" : ""), kind: long(String(values[`answer_${k}`])) };
        }) })),
      ],
    },
  };
}

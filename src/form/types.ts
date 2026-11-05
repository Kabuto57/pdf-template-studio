// THE VOCABULARY OF A FORM
// What a question, a rule, a section and a whole form ("template") look like, the answer formats
// (amount, phone, ...), and a few small text helpers used everywhere.

/** The kinds of question a form can have. */
export type Kind =
  | "text"    // one line of text
  | "long"    // a paragraph
  | "date"    // a date (DD/MM/YYYY)
  | "radio"   // pick one option
  | "checks"  // tick any of several options
  | "check"   // a single tick box
  | "select"; // a drop-down list

/** One question on the form. */
export interface Field {
  id: string;            // the key: the field's name in the PDF and in the extracted data, e.g. "applicant_name"
  label: string;         // the wording shown on the form
  kind: Kind;
  options?: string[];    // the choices, for radio / checks / select
  half?: boolean;        // half width: two half questions share a row
  required?: boolean;    // always mandatory
  requiredIf?: Rule[];   // mandatory only when another answer matches (any one rule is enough)
  activeIf?: Rule[];     // only answerable when one of these holds (default: the requiredIf rules); greyed and locked otherwise
  max?: number;          // the most characters allowed, as on the bank's form
  format?: Format;       // which keys the box accepts, and what a whole answer must look like
}

/**
 * A condition on another answer: "when FIELD is one of VALUES".
 * A tick box's values are "true" / "false". With `not`, it means "when FIELD is anything else (but not blank)".
 */
export interface Rule { field: string; values: string[]; not?: boolean }

export interface Section { title: string; fields: Field[] }

/** A whole form. */
export interface Template {
  title: string;
  note: string;          // the instructions under the title
  sections: Section[];
  base?: string;         // an uploaded PDF (base64) whose own fields are filled, instead of drawing a new layout
  design?: "new";        // the LC only: draw it in the new design instead of the bank's own layout
  issuer?: string;       // who issues the form, shown at the top of every page, e.g. "Demo Bank · Trade Services"
  formCode?: string;     // the form's reference and version, shown in the header and footer, e.g. "Form LC-01 · v1.0"
}

/** An answer: text, the ticked options of a "tick any" question, or a tick box's true / false. */
export type Value = string | string[] | boolean;
/** All the answers of a form, by question id. */
export type Values = Record<string, Value>;

/** One answer read back out of a filled PDF, with its question. */
export interface Row { section: string; id: string; label: string; value: Value; required?: boolean }
export interface Extracted { template?: Template; rows: Row[]; data: Record<string, unknown> }

/**
 * Answer formats.
 *   bad: the keys refused while typing (the same in the studio and in Acrobat)
 *   ok:  what a whole answer must look like
 *   say: what to tell the person when it doesn't
 */
export const FORMATS = {
  number:  { bad: "[^0-9]",      ok: /^\d+$/,                           say: "should be a whole number" },
  amount:  { bad: "[^0-9.,]",    ok: /^\d{1,3}(,?\d{3})*(\.\d{1,2})?$/,  say: "is not an amount" },
  phone:   { bad: "[^0-9+() -]", ok: /^\+?[\d ()-]*\d[\d ()-]*$/,        say: "is not a phone number (digits, spaces, + - ( ) only)" },
  account: { bad: "[^0-9-]",     ok: /^\d[\d-]*\d$|^\d$/,               say: "is not an account number (digits and - only)" },
};
export type Format = keyof typeof FORMATS;

/** "Funny characters": anything the bank's SWIFT messages can't carry (plus # & @ %, used in unit numbers and company names). */
export const BAD_CHARS = "[^A-Za-z0-9 .,\\-/()':?+#&@%\\r\\n]";

/** The names shown for each kind of question in the studio. */
export const KINDS: Record<Kind, string> = {
  text: "Text", long: "Paragraph", date: "Date", radio: "Pick one", checks: "Tick any", check: "Tick box", select: "Drop-down",
};
export const hasOptions = (k: Kind) => k === "radio" || k === "checks" || k === "select";

// ponytail: standard fonts only cover Latin-1. Embed a Unicode font (pdf-lib + fontkit) if names in other scripts matter.
const PLAIN: Record<string, string> = { "‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-", "…": "..." };
/** Text the PDF's standard font can draw: curly quotes and dashes become plain ones, anything else unknown becomes "?". */
export const safe = (s: string) => s.replace(/[^\n\x20-\x7e\xa0-\xff€]/g, c => PLAIN[c] ?? "?");

/** The PDF field name of option i of a "tick any" question: bencert_sent_by__0, bencert_sent_by__1, ... */
export const subId = (id: string, i: number) => `${id}__${i}`;

/** A safe field key from any text: "Applicant Name & Co" becomes "applicant_name_and_co". */
export const slug = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "field";

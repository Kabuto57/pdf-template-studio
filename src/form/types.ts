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
  at?: Spot;             // placed by hand in the studio's layout editor (otherwise arranged automatically)
  // The smart forms' layout options (lc-form's form files; the studio's canvas):
  cols?: number;         // how much of the row it takes, out of 12 (12 whole row, 6 half); otherwise from its label and max
  beside?: number;       // label beside a box this wide, even when the label is long
  words?: string[];      // filled in by the form: the amount in words, from these questions; read-only
  height?: number;       // paragraph boxes: the whole box this many points tall (default 50)
}

/** What a button a section adds can do (lc-form acrobat_js.py BUTTON_JS). */
export const BUTTONS = { "check-form": "Check form", "reset-form": "Reset form", "generate-qr": "Generate QR Code", "print-form": "Print Form" } as const;
export type ButtonName = keyof typeof BUTTONS;

/** Where a section sits on the page, in PDF points (the studio's layout editor). y is its TOP edge, counted from
 *  the page's bottom; h 0 = as tall as its questions need. */
export interface Frame { page: number; x: number; y: number; w: number; h: number }
/** Where a question sits inside its section: x from the section's left edge, y down from its top edge. h: paragraph
 *  boxes only (the whole question's height). */
export interface Spot { x: number; y: number; w: number; h?: number }

/**
 * A condition on another answer: "when FIELD is one of VALUES".
 * A tick box's values are "true" / "false". With `not`, it means "when FIELD is anything else (but not blank)".
 */
export interface Rule { field: string; values: string[]; not?: boolean }

export interface Section {
  title: string;
  fields: Field[];
  note?: string;       // a paragraph under the heading, e.g. the applicant's declaration
  signoff?: boolean;   // the PDF adds signature, date and company-stamp lines after the questions
  bankOnly?: boolean;  // filled in by the bank: drawn as a shaded "for bank use only" panel
  frame?: Frame;       // placed by hand on the page (otherwise the sections flow down the pages in order)
  cols?: number;       // questions in an even grid of this many columns, labels lined up (otherwise each takes the width it needs)
  width?: "full" | "half"; // smart forms: always the whole width / half the page (otherwise the layout decides)
  new_page?: boolean;  // smart forms: starts on a new page (spelt as in lc-form's form files)
  buttons?: ButtonName[]; // smart forms: a row of buttons at its bottom right
}

/** A check across two answers (lc-form's FORM["checks"]), each skipped while its answers are blank:
 *  order: a is not before b (s 0) or strictly after b (s 1); range: a is from lo to hi;
 *  lengths: account a has one of the lengths listed for currency b ("*": any other). */
export type Check =
  | { t: "order"; a: string; b: string; s: 0 | 1; m: string }
  | { t: "range"; a: string; lo: number; hi: number; m: string }
  | { t: "lengths"; a: string; b: string; by: Record<string, number[]>; m: string };

/** A whole form. */
export interface Template {
  title: string;
  note: string;          // the instructions under the title
  sections: Section[];
  base?: string;         // an uploaded PDF (base64) whose own fields are filled, instead of drawing a new layout
  design?: "new";        // the LC only: draw it in the new design instead of the bank's own layout
  issuer?: string;       // who issues the form, shown at the top of every page, e.g. "Demo Bank · Trade Services"
  formCode?: string;     // the form's reference and version, shown in the header and footer, e.g. "Form LC-01 · v1.0"
  pages?: number;        // at least this many pages (the layout editor's empty pages to draw on)
  checks?: Check[];      // smart forms: checks across answers
  file?: string;         // smart forms: the form file's name in lc-form/forms (e.g. "lc_form.py"), for the export
  pdfName?: string;      // smart forms: the PDF's file name when built (the form file's PDF_NAME)
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
  // the smart forms' own (lc-form layout.py FORMATS)
  cif:     { bad: "[^0-9]",       ok: /^\d{7}$/,                          say: "should be your 7-digit C.I.F. number" },
  ref12:   { bad: "[^0-9]",       ok: /^\d{12}$/,                         say: "should be a 12-digit reference number (e.g. 553010012345)" },
  fx8:     { bad: "[^0-9]",       ok: /^\d{8}$/,                          say: "should be an 8-digit FX contract number" },
  fx2:     { bad: "[^0-9]",       ok: /^\d{2}$/,                          say: "should be a 2-digit FX contract sequence" },
  swift:   { bad: "[^A-Za-z0-9]", ok: /^[A-Za-z0-9]{8}([A-Za-z0-9]{3})?$/, say: "is not a SWIFT address (8 or 11 letters and digits)" },
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

// The smart forms, copied from the lc-form project by scripts/smartforms.py (rerun it after the forms change there).
import DATA from "./smartforms.json";
import type { Template, Values } from "../pdf";

export interface SmartForm { file: string; form: Template; defaults: Values; pdfName: string | null }
const data = DATA as unknown as { lists: Record<"CURRENCIES" | "COUNTRIES", string[]>; forms: SmartForm[] };

export const SMART_FORMS = data.forms;
/** lc_form.py's shared lists: an exported form file names them instead of writing 160 currencies out again. */
export const LISTS = data.lists;

/** The dropdown's categories, as the old smart form's menu (lc-form build_all.py MENU). */
const CATEGORIES: [string, string[]][] = [
  ["Import", ["lc_form.py", "lc_pipe_form.py", "lc_amendment_form.py"]],
  ["Export", ["eblc_form.py", "bill_of_exchange_eblc_form.py", "obc_form.py", "bill_of_exchange_obc_form.py", "bill_of_exchange_form.py"]],
  ["Loans", ["import_financing_form.py", "export_financing_form.py"]],
  ["Guarantees", ["bg_form.py", "sblc_form.py", "bg_amendment_form.py", "sblc_amendment_form.py"]],
];

/** Smart forms grouped for the dropdown; a form in no category lands in a last "More smart forms" group, never dropped. */
export function groupSmartForms(forms: SmartForm[]): { label: string; forms: SmartForm[] }[] {
  const listed = new Set(CATEGORIES.flatMap(([, files]) => files));
  const groups = CATEGORIES.map(([label, files]) => ({
    label,
    forms: files.flatMap(file => forms.filter(f => f.file === file)),
  }));
  groups.push({ label: "More smart forms", forms: forms.filter(f => !listed.has(f.file)) });
  return groups.filter(g => g.forms.length);
}

/** Option text: the title, except the pipe-delimited LC shares its title with lc_form.py. */
export const smartFormLabel = (f: SmartForm) => (f.file === "lc_pipe_form.py" ? `${f.form.title} (pipe-delimited QR)` : f.form.title);

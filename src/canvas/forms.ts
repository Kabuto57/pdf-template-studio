// The smart forms, copied from the lc-form project by scripts/smartforms.py (rerun it after the forms change there).
import DATA from "./smartforms.json";
import type { Template, Values } from "../pdf";

export interface SmartForm { file: string; form: Template; defaults: Values; pdfName: string | null }
const data = DATA as unknown as { lists: Record<"CURRENCIES" | "COUNTRIES", string[]>; forms: SmartForm[] };

export const SMART_FORMS = data.forms;
/** lc_form.py's shared lists: an exported form file names them instead of writing 160 currencies out again. */
export const LISTS = data.lists;

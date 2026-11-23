// THE FORMS THE WORKBENCH KNOWS (Trade Ops workbench)
// A QR code carries only answers, plus the form code and version ({"form": "LC-01", "version": "1.0", ...}). To show
// those answers with their questions and checks, the workbench needs that form's description. It looks in order:
//   1. the registry folder forms/ in this repo (one JSON file per form version, e.g. forms/LC-02@1.0.json): published
//      with the site, the same for everyone;
//   2. forms added in this browser: drop the BLANK form PDF into the mailbox, it is read from the PDF itself
//      (every form PDF stores its own description, form/stored-template.ts) and kept in this browser only;
//   3. the LC built into the workbench (lc.ts).
// Old versions are kept side by side, so a customer still sending v1.0 is read with v1.0 after v1.1 is out.
import { formKey } from "./form/acrobat-script";
import type { Template } from "./form/types";
import { LC } from "./lc";

export type Source = "registry" | "this browser" | "built in";
export interface Known { key: string; template: Template; source: Source }

const STORE = "ops-forms"; // localStorage: { "LC-02@1.0": template, ... }
// ponytail: localStorage (~5 MB, about 100 forms); a server-side registry when this leaves the demo

export const keyOf = (t: Template) => { const { form, version } = formKey(t); return `${form}@${version}`; };

// The registry folder, bundled at build time: adding a file to forms/ on GitHub publishes it with the next deploy.
const published = import.meta.glob<Template>("../forms/*.json", { import: "default" });

function saved(): Record<string, Template> {
  try { return JSON.parse(localStorage.getItem(STORE) ?? "{}"); } catch { return {}; }
}

/** Every form the workbench knows, with where it came from (registry wins over this browser, this browser over built in). */
export async function knownForms(): Promise<Known[]> {
  const out = new Map<string, Known>();
  for (const load of Object.values(published)) { const t = await load(); out.set(keyOf(t), { key: keyOf(t), template: t, source: "registry" }); }
  for (const [key, t] of Object.entries(saved())) if (!out.has(key)) out.set(key, { key, template: t, source: "this browser" });
  if (!out.has(keyOf(LC.template))) out.set(keyOf(LC.template), { key: keyOf(LC.template), template: LC.template, source: "built in" });
  return [...out.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** The form a QR code names, or undefined when the workbench doesn't know that form and version. */
export async function findForm(form: string, version: string): Promise<Known | undefined> {
  return (await knownForms()).find(k => k.key === `${form}@${version}`);
}

/** Keeps a form in this browser. Returns its key. */
export function addForm(t: Template): string {
  const all = saved(), key = keyOf(t);
  all[key] = { ...t, base: undefined };
  localStorage.setItem(STORE, JSON.stringify(all));
  return key;
}

export function removeForm(key: string) {
  const all = saved();
  delete all[key];
  localStorage.setItem(STORE, JSON.stringify(all));
}

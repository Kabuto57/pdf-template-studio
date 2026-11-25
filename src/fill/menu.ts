// The main menu's one rule (build_all.py showForm): a form opens only once the Bank's terms are ticked.
import MENU from "./gen/menu.json";

export const MENU_TEXT = MENU;
/** What picking a form on the menu does: opens it, or says to tick the terms first (with build_all.py's own wording). */
export function choose(accepted: boolean, file: string): { open: string } | { message: string } {
  return accepted ? { open: file } : { message: MENU.notTicked };
}

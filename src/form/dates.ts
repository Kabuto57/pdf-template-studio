// DATES
// Each date is a drop-down of real dates ("15 Mar 2026"). It needs no JavaScript, and 31 Feb is simply not offered.
// Under it sits a hidden date box with Acrobat's own pop-up calendar. When Acrobat runs the form's JavaScript, the
// box is shown and the list hidden (lcDates in acrobat-script.ts). Whichever one is showing holds the answer.
import { PDFDocument, PDFFont, PDFHexString, PDFName, PDFNumber, PDFObject, PDFPage } from "pdf-lib";
import { safe } from "./types";

/** The PDF field name of a date's drop-down list. (The calendar box uses the question's own id.) */
export const dateIds = (id: string) => [`${id}__list`];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const PICK = "Pick a date"; // the list's first entry: nothing picked yet
const pad = (n: number) => String(n).padStart(2, "0");
const say = (d: Date) => `${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; // "15 Mar 2026"

/**
 * Every real date from a year before the form is made to two years after.
 * ponytail: the list is made fresh on each download, so it stays current.
 */
export function dateOptions(now = new Date()) {
  const dates: string[] = [];
  const first = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  const last = new Date(now.getFullYear() + 2, now.getMonth() + 1, 0);
  for (let d = first; d <= last; d.setDate(d.getDate() + 1)) dates.push(say(d));
  return dates;
}

type Box = { x: number; y: number; width: number; height: number };

/**
 * Adds one date question: the drop-down list and (if `js` is given) the hidden calendar box.
 * `answer` is "DD/MM/YYYY" or empty; `style` holds border colours etc.
 */
export function addDateLists(form: ReturnType<PDFDocument["getForm"]>, page: PDFPage, id: string, label: string, answer: unknown,
  box: Box, font: PDFFont, size: number, style: object = {}, js?: (code: string) => PDFObject) {
  // The answer as it appears in the list ("15 Mar 2026"), if there is one.
  const [d, m, y] = typeof answer === "string" ? answer.split("/").map(Number) : [];
  const picked = d && m && y ? say(new Date(y, m - 1, d)) : "";

  // 1. The drop-down of real dates.
  const dates = dateOptions();
  if (picked && !dates.includes(picked)) dates.unshift(picked); // an answer outside the range is kept
  const list = form.createDropdown(dateIds(id)[0]);
  list.addOptions([PICK, ...dates]);
  list.select(picked || PICK);
  list.acroField.dict.set(PDFName.of("TU"), PDFHexString.fromText(safe(label)));
  list.addToPage(page, { ...style, ...box, font });
  list.setFontSize(size);
  if (!js) return;

  // 2. The calendar box, in the same place, hidden until Acrobat's JavaScript shows it.
  const calendar = form.createTextField(id);
  if (typeof answer === "string" && answer) calendar.setText(answer);
  calendar.acroField.dict.set(PDFName.of("TU"), PDFHexString.fromText(`${safe(label)} (DD/MM/YYYY)`));
  // Formatted as a date: Acrobat shows its calendar, and refuses dates that don't exist (31/02).
  calendar.acroField.dict.set(PDFName.of("AA"), form.doc.context.obj({
    K: js('AFDate_KeystrokeEx("dd/mm/yyyy");'), // K = on each keystroke
    F: js('AFDate_FormatEx("dd/mm/yyyy");'),    // F = how to show it
  }));
  calendar.addToPage(page, { ...style, ...box, font });
  calendar.setFontSize(size);
  calendar.acroField.getWidgets()[0].dict.set(PDFName.of("F"), PDFNumber.of(2)); // 2 = hidden
}

/**
 * The picked date back to "DD/MM/YYYY" ("" if none).
 * Also reads forms made before 4 Nov 2026, which had three lists: DD, "MM Mon", YYYY.
 */
export function joinDate(parts: string[]) {
  if (parts.length === 3) {
    const p = parts.map((s, i) => s === ["DD", "MM", "YYYY"][i] ? "" : i === 1 ? s.slice(0, 2) : s);
    return p.join("") ? p.join("/") : "";
  }
  const match = /^(\d\d) (\w{3}) (\d{4})$/.exec(parts[0] ?? ""); // "15 Mar 2026"
  return match ? `${match[1]}/${pad(MONTHS.indexOf(match[2]) + 1)}/${match[3]}` : "";
}

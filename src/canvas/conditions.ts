// CONDITIONS IN PLAIN WORDS, AND THE POP-UP THAT ADDS ONE ON THE PAGE
// "Add a condition" on the canvas: click the question it waits on, and this pop-up opens beside it. It asks only
// what that question allows (ticked or not, which options, or any answer) and what the condition does
// (mandatory and unlocked, or only unlocked).
import { h } from "../dom";
import { hasOptions, type Field, type Rule } from "../pdf";

/** "13.3 Drafts at is Term or Date", "12.1 Back-to-back DC is ticked", "3.1 Applicant name has an answer". */
export function sayRule(r: Rule, trigger: Field | undefined, no: string) {
  const name = `${no} ${trigger?.label ?? r.field}`;
  if (r.not && r.values.length === 1 && r.values[0] === "") return `${name} has an answer`;
  if (!r.not && r.values.length === 1 && r.values[0] === "true") return `${name} is ticked`;
  if (!r.not && r.values.length === 1 && r.values[0] === "false") return `${name} is not ticked`;
  return `${name} ${r.not ? "is not" : "is"} ${r.values.map(v => `"${v}"`).join(" or ")}`;
}

export type Effect = "mandatory" | "unlock";

/** The pop-up for a condition on `trigger`, for question `target`. `done` gets the rule and what it does. */
export function conditionPopup(trigger: Field, target: Field, no: string, done: (rule: Rule, effect: Effect) => void, cancel: () => void): HTMLElement {
  let values: string[] = trigger.kind === "check" ? ["true"] : trigger.options?.length ? [trigger.options[0]] : [""];
  let any = !trigger.options?.length && trigger.kind !== "check";
  let effect: Effect = "mandatory";
  const add = h("button", { type: "button", className: "primary" }, "Add condition");

  const choices = trigger.kind === "check"
    ? choiceRow([["Ticked", "true"], ["Not ticked", "false"]], v => { values = [v]; }, "true")
    : hasOptions(trigger.kind)
      ? h("div", { className: "cv-chips", role: "group", "aria-label": "Options" },
        ...[...(trigger.options ?? []).map(o => [o, o] as const), ["Any answer", ""] as const].map(([name, v], i) => {
          const b = h("button", { type: "button", "aria-pressed": String(i === 0) }, name);
          b.onclick = () => {
            const chips = [...b.parentElement!.querySelectorAll("button")];
            if (v === "") { any = true; chips.forEach(c => c.setAttribute("aria-pressed", String(c === b))); }
            else {
              any = false;
              chips.at(-1)!.setAttribute("aria-pressed", "false");
              b.setAttribute("aria-pressed", String(b.getAttribute("aria-pressed") !== "true"));
            }
            values = chips.filter(c => c.getAttribute("aria-pressed") === "true" && c !== chips.at(-1)).map(c => c.textContent!);
            add.disabled = !any && !values.length;
          };
          return b;
        }))
      : h("p", { className: "cv-lead" }, "When it has any answer.");

  add.onclick = () => done(any ? { field: trigger.id, values: [""], not: true } : { field: trigger.id, values }, effect);
  return h("div", { className: "cv-pop", role: "dialog", "aria-label": "Add a condition" },
    h("p", { className: "cv-pop-title" }, `When ${no} ${trigger.label.length > 60 ? `${trigger.label.slice(0, 58)}…` : trigger.label}`),
    choices,
    h("p", { className: "cv-pop-sub" }, `then "${target.label.length > 40 ? `${target.label.slice(0, 38)}…` : target.label}"`),
    choiceRow([["is mandatory", "mandatory"], ["only unlocks", "unlock"]], v => { effect = v as Effect; }, "mandatory"),
    h("div", { className: "cv-pop-actions" }, h("button", { type: "button", onclick: cancel }, "Cancel"), add),
  );
}

/** A row of buttons, one pressed. */
function choiceRow(choices: [string, string][], set: (v: string) => void, start: string) {
  const row = h("div", { className: "cv-seg", role: "radiogroup" });
  for (const [name, v] of choices) {
    const b = h("button", { type: "button", role: "radio", "aria-checked": String(v === start) }, name);
    b.onclick = () => { row.querySelectorAll("button").forEach(x => x.setAttribute("aria-checked", String(x === b))); set(v); };
    row.append(b);
  }
  return row;
}

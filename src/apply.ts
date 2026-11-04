// DEMO BANK: FILL THE LC APPLICATION ONLINE (demo-bank/apply.html)
// The same LC as the PDF (lc.ts), filled in the browser, where every rule is checked as you type: the JSON Schema
// (checked by Ajv) and the checks across answers (form/validate.ts). Nothing needs switching on, unlike Acrobat's
// JavaScript. When there's nothing left to fix, it sends the filled PDF to Trade Ops and offers the PDF and JSON.
import "./bank.css";
import { $, download, h } from "./dom";
import { LC, LC_SAMPLE } from "./lc";
import { OPS_ADDRESS, sendMail } from "./mailbox";
import { buildPdf, isActive, isRequired, type Field, type Value, type Values } from "./pdf";
import { validateLc, type Issue } from "./form/validate";

const t = LC.template;
const all = t.sections.flatMap(s => s.fields);
const blankOf = (f: Field): Value => (f.kind === "check" ? false : f.kind === "checks" ? [] : "");
const today = () => new Date().toLocaleDateString("en-GB"); // DD/MM/YYYY

let values: Values = { ...LC.defaults, application_date: today() };
const touched = new Set<string>(); // questions the customer has been to: their messages show straight away
let showAll = false;                // after "Check" or "Submit": every message shows

/** Every question with an answer (blank if not given), as the PDF and the workbench would see it. */
const answers = () => Object.fromEntries(all.map(f => [f.id, values[f.id] ?? blankOf(f)])) as Values;

// Dates: the browser's date picker works in YYYY-MM-DD; the form in DD/MM/YYYY.
const toIso = (d: string) => d.split("/").reverse().join("-");
const fromIso = (d: string) => (d ? d.split("-").reverse().join("/") : "");

function set(f: Field, v: Value) {
  values[f.id] = v;
  touched.add(f.id);
  paint();
}

/** The input for one question. */
function input(f: Field): HTMLElement {
  const v = values[f.id] ?? blankOf(f);
  const text = (e: Event) => (e.target as HTMLInputElement).value;
  switch (f.kind) {
    case "check":
      return h("input", { id: f.id, type: "checkbox", checked: v === true, onchange: (e: Event) => set(f, (e.target as HTMLInputElement).checked) });
    case "date":
      return h("input", { id: f.id, type: "date", value: toIso(v as string), onchange: (e: Event) => set(f, fromIso(text(e))) });
    case "select":
      return h("select", { id: f.id, onchange: (e: Event) => set(f, text(e)) },
        h("option", { value: "" }, "Choose…"), ...(f.options ?? []).map(o => h("option", { value: o, selected: v === o }, o)));
    case "radio":
    case "checks":
      return h("div", { className: "choices", role: f.kind === "radio" ? "radiogroup" : "group", "aria-labelledby": `${f.id}-label` },
        ...(f.options ?? []).map(o => h("label", {},
          h("input", {
            type: f.kind === "radio" ? "radio" : "checkbox", name: f.id, value: o,
            checked: Array.isArray(v) ? v.includes(o) : v === o,
            onchange: () => set(f, f.kind === "radio" ? o
              : [...document.querySelectorAll<HTMLInputElement>(`input[name="${f.id}"]:checked`)].map(i => i.value)),
          }), " ", o)));
    case "long":
      return h("textarea", { id: f.id, rows: 3, value: v as string, ...(f.max ? { maxLength: f.max } : {}),
        oninput: (e: Event) => { values[f.id] = text(e); paint(); }, onblur: () => { touched.add(f.id); paint(); } });
    default:
      return h("input", { id: f.id, type: "text", value: v as string, ...(f.max ? { maxLength: f.max } : {}),
        ...(f.format === "amount" || f.format === "number" ? { inputMode: "decimal" } : f.format === "phone" ? { inputMode: "tel" } : {}),
        oninput: (e: Event) => { values[f.id] = text(e); paint(); }, onblur: () => { touched.add(f.id); paint(); } });
  }
}

/** One question: its label (with a * when mandatory), its input, and the line its message goes on. */
function question(f: Field) {
  const star = h("span", { className: "star" }, " *"), group = f.kind === "radio" || f.kind === "checks";
  const top = f.kind === "check"
    ? h("label", { className: "aq-tick" }, input(f), ` ${f.label}`, star)
    : h(group ? "span" : "label", { className: "aq-label", id: `${f.id}-label`, ...(group ? {} : { for: f.id }) }, f.label, star);
  return h("div", { className: f.half ? "aq half" : "aq", "data-q": f.id },
    top, f.kind === "check" ? null : input(f), h("p", { className: "aq-msg", "aria-live": "polite" }));
}

function render() {
  $("#app").replaceChildren(
    h("div", { className: "crumbs" }, h("a", { href: "./" }, "Trade Application Form"), "  ›  Fill online"),
    h("div", { className: "title" }, h("h1", {}, t.title), h("p", { className: "muted" },
      "Fill in the application here. Each answer is checked as you go, and you can only submit once nothing is left to fix. ",
      "Prefer a PDF? ", h("a", { href: "./" }, "Download the form"), " instead.")),
    h("div", { className: "apply" },
      h("form", { className: "apply-form", noValidate: true, onsubmit: (e: Event) => { e.preventDefault(); submit(); } },
        ...t.sections.map((s, si) => h("fieldset", { className: "apply-sec" },
          h("legend", {}, `${si + 1}. ${s.title}`),
          ...s.fields.map(question))),
      ),
      h("aside", { className: "apply-side" },
        h("div", { className: "box sticky" },
          h("h5", {}, "Your application"),
          h("p", { id: "status", className: "small" }),
          h("ul", { id: "fix", className: "fix" }),
          h("div", { className: "apply-btns" },
            h("button", { type: "button", className: "primary", onclick: submit }, "Submit to Demo Bank"),
            h("button", { type: "button", onclick: () => { showAll = true; paint(); } }, "Check my answers"),
            h("button", { type: "button", onclick: () => download(JSON.stringify(answers(), null, 2), "LC-application.json", "application/json") }, "Download JSON"),
            h("button", { type: "button", onclick: async () => download((await buildPdf(t, answers())) as BlobPart, "LC-application.pdf", "application/pdf") }, "Download PDF"),
            h("button", { type: "button", className: "link", onclick: () => { values = { ...LC_SAMPLE, application_date: today() }; touched.clear(); showAll = false; render(); } }, "Fill with sample answers (demo)"),
          ),
          h("p", { className: "small muted" }, "Checked against the bank's ",
            h("a", { href: "../lc-application.schema.json", target: "_blank" }, "LC JSON Schema"), " (json-schema.org standard), with Ajv."),
        ),
      ),
    ),
  );
  paint();
}

/** Shows what each question needs now: mandatory star, locked or not, its message. And the list of things to fix. */
function paint(): Issue[] {
  const data = answers(), issues = validateLc(data);
  for (const f of all) {
    const el = document.querySelector<HTMLElement>(`[data-q="${CSS.escape(f.id)}"]`);
    if (!el) continue;
    const on = isActive(f, data), mine = issues.filter(i => i.id === f.id), shown = showAll || touched.has(f.id);
    el.classList.toggle("off", !on);
    el.querySelectorAll<HTMLInputElement>("input, select, textarea").forEach(i => (i.disabled = !on));
    (el.querySelector(".star") as HTMLElement).hidden = !isRequired(f, data);
    el.classList.toggle("bad", shown && mine.length > 0);
    (el.querySelector(".aq-msg") as HTMLElement).textContent = shown ? mine.map(i => `${f.label} ${i.msg}.`).join(" ") : "";
  }
  const status = $("#status"), fix = $("#fix");
  status.textContent = issues.length
    ? `${issues.length} thing${issues.length === 1 ? "" : "s"} to fix before you can submit.`
    : "Everything is filled in correctly. You can submit.";
  status.className = issues.length ? "small err" : "small ok";
  fix.replaceChildren(...(showAll ? issues : []).map(i => h("li", {}, h("a", {
    href: `#${i.id}`, onclick: (e: Event) => { e.preventDefault(); goTo(i.id); },
  }, all.find(f => f.id === i.id)?.label ?? i.id), ` ${i.msg}`)));
  return issues;
}

const goTo = (id: string) => {
  const el = document.querySelector<HTMLElement>(`[data-q="${CSS.escape(id)}"]`);
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
  el?.querySelector<HTMLElement>("input:not(:disabled), select, textarea")?.focus({ preventScroll: true });
};

async function submit() {
  showAll = true;
  const issues = paint();
  if (issues.length) return goTo(issues[0].id);
  const data = answers(), pdf = await buildPdf(t, data);
  await sendMail({
    from: "applicant@customer.example", to: OPS_ADDRESS, subject: `LC application (online): ${data.applicant_name}`,
    body: "Submitted through Fill online. Every answer was checked before submitting.",
    file: { name: "LC-application.pdf", bytes: pdf },
  });
  $("#app").replaceChildren(h("div", { className: "sent-online" },
    h("h1", {}, "Application submitted"),
    h("p", {}, `Your application has been sent to Trade Operations (${OPS_ADDRESS}). Every answer was checked before it was sent.`),
    h("div", { className: "apply-btns" },
      h("button", { type: "button", onclick: () => download(pdf as BlobPart, "LC-application.pdf", "application/pdf") }, "Download your PDF copy"),
      h("button", { type: "button", onclick: () => download(JSON.stringify(data, null, 2), "LC-application.json", "application/json") }, "Download the answers (JSON)")),
    h("p", { className: "muted small" }, "Next in the demo: ", h("a", { href: "../trade-ops/" }, "open the Trade Ops workbench"), " to see it arrive."),
  ));
  scrollTo(0, 0);
}

render();

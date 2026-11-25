// DEMO BANK: THE TRADE FORMS, FILLED IN THE BROWSER (fill/index.html). No Adobe needed.
// The main menu of lc-form's build_all.py (tick the Bank's terms, pick a form), then the form drawn from lc-form's layout, checked by
// lc-form's own Acrobat scripts (engine.ts), with Generate QR Code and Print Form. The answers stay in this page: nothing is sent or saved.
import "./fill.css";
import { h } from "../dom";
import { openForm } from "./engine";
import { MENU_TEXT as MENU, choose } from "./menu";
import { say } from "./ui";
import { mountForm } from "./view";

const app = document.getElementById("app")!;
let accepted = false;

function menu() {
  document.title = "Trade Application Forms | Demo Bank";
  const accept = h("input", { type: "checkbox", id: "accept", checked: accepted, onchange: () => { accepted = accept.checked; } });
  app.replaceChildren(h("section", { className: "menu" },
    h("p", { className: "issuer" }, "DEMO BANK · TRADE SERVICES"),
    h("h1", {}, "Trade Application Forms"),
    h("p", { className: "lead" }, "Please select the form that you require. Fill it in here, in your browser, check it, then print it with its QR code. Nothing you type leaves this page."),
    h("label", { className: "terms", for: "accept" }, accept, MENU.terms),
    ...MENU.groups.map(g => h("div", { className: "group" },
      h("h2", {}, g.group),
      ...g.forms.map(f => h("button", { type: "button", className: "entry", onclick: () => open(f.file, f.title) },
        h("span", {}, f.title), h("small", {}, `Form ${f.formCode}`))))),
    h("p", { className: "note" }, "Demo Bank is a fictional bank. This website is a demonstration.")));
}

async function open(file: string, title: string) {
  const pick = choose(accepted, file);
  if ("message" in pick) { say(pick.message); return; }
  const eng = await openForm(pick.open);
  document.title = `${title} | Demo Bank`;
  mountForm(app, eng, MENU.back as [string, string], () => { menu(); scrollTo(0, 0); });
  scrollTo(0, 0);
}

menu();

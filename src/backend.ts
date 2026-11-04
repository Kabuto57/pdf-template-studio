// THE WORKFLOW BACK END (back-end/index.html), simulated
// What the next system receives when Trade Ops submits a case: the case details and the answers as JSON (with
// any corrections ops made). Ops never see this; it's the demo's view "behind" the workbench.
import "./backend.css";
import { $, download, h } from "./dom";
import { inbox, type Mail } from "./mailbox";

const when = (t?: number) => (t ? new Date(t).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "");

/** The message the workflow receives for one case. */
const payload = (m: Mail) => ({
  caseId: m.caseId,
  decision: m.decision,
  ...(m.reason ? { reason: m.reason } : {}),
  submittedAt: m.submittedAt ? new Date(m.submittedAt).toISOString() : undefined,
  source: { from: m.from, subject: m.subject, attachment: m.file.name },
  answers: m.submitted,
  correctedByOps: m.corrections ?? [],
});

async function show(selected?: string) {
  const cases = (await inbox()).filter(m => m.caseId).sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0));
  const open = cases.find(m => m.id === selected) ?? cases[0];
  $("#list").replaceChildren(
    h("div", { className: "list-head" }, `${cases.length} case${cases.length === 1 ? "" : "s"}`),
    ...cases.map(m => h("button", { type: "button", className: `item${m === open ? " on" : ""}`, onclick: () => show(m.id) },
      h("b", {}, m.caseId!), h("span", { className: `chip ${m.decision}` }, m.decision === "reject" ? "Rejected" : "Approved"),
      h("small", {}, String(m.submitted?.applicant_name ?? m.subject)), h("small", {}, when(m.submittedAt)))),
  );
  if (!open) {
    $("#case").replaceChildren(h("div", { className: "empty" }, h("h2", {}, "No cases yet"),
      h("p", {}, "Approve or reject an application in the ", h("a", { href: "../trade-ops/" }, "Trade Ops workbench"), " and submit it. It arrives here.")));
    return;
  }
  const json = JSON.stringify(payload(open), null, 2);
  $("#case").replaceChildren(
    h("div", { className: "case-head" },
      h("h2", {}, `Case ${open.caseId}`),
      h("button", { type: "button", onclick: () => download(json, `${open.caseId}.json`, "application/json") }, "Download JSON")),
    h("p", { className: "muted" }, `${open.decision === "reject" ? "Rejected" : "Approved"} by Trade Ops · ${when(open.submittedAt)} · from ${open.from}`,
      open.reason ? ` · Reason: ${open.reason}` : ""),
    h("p", {}, "This is the data the workflow received, as JSON: the application's answers (as corrected by ops, if they changed anything), the decision, and a record of each correction."),
    h("pre", { className: "json" }, json),
  );
}

show();

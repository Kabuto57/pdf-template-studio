// Message boxes, standing in for Acrobat's app.alert: one at a time, the next when the person closes the one showing.
import { h } from "../dom";

const dialog = h("dialog", { className: "msg", ariaLabel: "Message" });
const text = h("p", {});
const ok = h("button", { className: "primary", type: "button" }, "OK");
const no = h("button", { type: "button" }, "Cancel");
dialog.append(text, h("div", { className: "msg-btns" }, no, ok));

type Job = { message: string; ask: boolean; done: (yes: boolean) => void };
const queue: Job[] = [];
const afters: (() => void)[] = [];
let busy = false;
let current: Job | undefined;
let programmatic = 0; // dialog.close() calls whose (asynchronous) close event has not arrived yet

function next() {
  const job = queue.shift();
  if (!job) {
    busy = false;
    afters.splice(0).forEach(f => f());
    return;
  }
  busy = true;
  current = job;
  text.textContent = job.message; // CSS keeps its line breaks
  no.hidden = !job.ask;
  ok.onclick = () => finish(job, true);
  no.onclick = () => finish(job, false);
  if (!dialog.isConnected) document.body.append(dialog);
  dialog.showModal();
  ok.focus();
}
/** Closes the box showing `job` and shows the next. The close event of a box closed here arrives later, after the next box may
 *  already be up: it must not answer that one (counted in `programmatic`); only Escape, which closes the box itself, answers "no". */
function finish(job: Job, yes: boolean) {
  if (current !== job) return;
  current = undefined;
  programmatic++;
  dialog.close();
  job.done(yes);
  next();
}
dialog.addEventListener("close", () => {
  if (programmatic > 0) { programmatic--; return; }
  if (current) finish(current, false); // Escape
});
function add(job: Job) { queue.push(job); if (!busy) next(); }

/** A message with an OK button. */
export const say = (message: string) => add({ message, ask: false, done: () => {} });
/** A question: true for OK, false for Cancel. */
export const confirm = (message: string) => new Promise<boolean>(done => add({ message, ask: true, done }));
/** Runs when no message is showing (after Check form's list is closed: move the cursor to the first problem). */
export const whenQuiet = (f: () => void) => (busy ? afters.push(f) : f());

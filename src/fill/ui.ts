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

function next() {
  const job = queue.shift();
  if (!job) {
    busy = false;
    afters.splice(0).forEach(f => f());
    return;
  }
  busy = true;
  text.textContent = job.message; // CSS keeps its line breaks
  no.hidden = !job.ask;
  const close = (yes: boolean) => { dialog.close(); ok.onclick = no.onclick = dialog.onclose = null; job.done(yes); next(); };
  ok.onclick = () => close(true);
  no.onclick = () => close(false);
  dialog.onclose = () => close(false); // Escape
  if (!dialog.isConnected) document.body.append(dialog);
  dialog.showModal();
  ok.focus();
}
function add(job: Job) { queue.push(job); if (!busy) next(); }

/** A message with an OK button. */
export const say = (message: string) => add({ message, ask: false, done: () => {} });
/** A question: true for OK, false for Cancel. */
export const confirm = (message: string) => new Promise<boolean>(done => add({ message, ask: true, done }));
/** Runs when no message is showing (after Check form's list is closed: move the cursor to the first problem). */
export const whenQuiet = (f: () => void) => (busy ? afters.push(f) : f());

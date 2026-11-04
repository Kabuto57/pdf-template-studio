// A pretend email system for the demo: the customer site "sends" to Trade Ops and the ops workbench reads
// its inbox. It lives in this browser (IndexedDB), so the whole journey runs on one laptop; a PDF that came
// by real email can still be dropped into the workbench.
import type { Value } from "./pdf";

export interface Mail {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  sent: number;
  file: { name: string; bytes: Uint8Array };
  status: "new" | "processed";
  caseId?: string;
  decision?: "approve" | "reject";
  reason?: string; // what Trade Ops decided when submitting
  corrections?: { id: string; from: unknown; to: Value }[]; // answers Trade Ops corrected (the PDF stays as received)
}
export const OPS_ADDRESS = "trade.ops@demobank.example";

function store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return new Promise((ok, fail) => {
    const req = indexedDB.open("demo-mail", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("mail", { keyPath: "id" });
    req.onsuccess = () => ok(req.result.transaction("mail", mode).objectStore("mail"));
    req.onerror = () => fail(req.error);
  });
}
const run = <T>(req: IDBRequest<T>) =>
  new Promise<T>((ok, fail) => {
    req.onsuccess = () => ok(req.result);
    req.onerror = () => fail(req.error);
  });

export const sendMail = async (m: Omit<Mail, "id" | "sent" | "status">) =>
  run((await store("readwrite")).put({ ...m, id: crypto.randomUUID(), sent: Date.now(), status: "new" }));
export const saveMail = async (m: Mail) => run((await store("readwrite")).put(m));
export const inbox = async () =>
  (await run((await store("readonly")).getAll() as IDBRequest<Mail[]>)).sort((a, b) => b.sent - a.sent);
export const deleteMail = async (id: string) => run((await store("readwrite")).delete(id));
export const clearInbox = async () => run((await store("readwrite")).clear());

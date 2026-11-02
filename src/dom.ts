// Small DOM helpers shared by the pages.
type Kid = Node | string | false | undefined | null;
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...kids: Kid[]) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v as EventListener);
    else if (k.includes("-") || k === "for") el.setAttribute(k, String(v));
    else (el as unknown as Record<string, unknown>)[k] = v;
  }
  el.append(...kids.filter((k): k is Node | string => !!k));
  return el;
}
export const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T;

export function download(bytes: BlobPart, name: string, type: string) {
  const a = h("a", { href: URL.createObjectURL(new Blob([bytes], { type })), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// THE STUDIO'S COLUMNS: Form builder | Code | PDF, like Overleaf. Each pane has a title bar: its button collapses the
// pane to a thin strip (click the strip to open it again). Drag the line between two panes to change their widths.
// One pane always stays open.

/** Sets up every `.pane` in `main`. */
export function panes(main: HTMLElement) {
  const all = () => [...main.querySelectorAll<HTMLElement>(":scope > .pane:not([hidden])")];

  for (const pane of main.querySelectorAll<HTMLElement>(":scope > .pane")) {
    const toggle = pane.querySelector<HTMLButtonElement>(".pane-toggle")!;
    const flip = () => {
      const closing = !pane.classList.contains("collapsed");
      if (closing && all().filter(p => !p.classList.contains("collapsed")).length < 2) return; // keep one open
      pane.classList.toggle("collapsed", closing);
      toggle.setAttribute("aria-expanded", String(!closing));
      toggle.title = closing ? `Open ${pane.dataset.name}` : `Close ${pane.dataset.name}`;
      toggle.textContent = closing ? "›" : "‹";
      window.dispatchEvent(new Event("resize")); // the PDF redraws to its new width
    };
    toggle.onclick = flip;
    pane.querySelector(".pane-bar")!.addEventListener("click", e => { if (pane.classList.contains("collapsed") && e.target !== toggle) flip(); });
  }

  // Dragging a divider: the panes on either side share their combined width differently.
  for (const split of main.querySelectorAll<HTMLElement>(":scope > .split")) {
    split.addEventListener("pointerdown", e => {
      const left = prevPane(split), right = nextPane(split);
      if (!left || !right || left.classList.contains("collapsed") || right.classList.contains("collapsed")) return;
      split.setPointerCapture(e.pointerId);
      const start = e.clientX, lw = left.getBoundingClientRect().width, rw = right.getBoundingClientRect().width;
      const move = (m: PointerEvent) => {
        const d = Math.max(200 - lw, Math.min(rw - 200, m.clientX - start)); // each keeps at least 200 px
        left.style.flex = `0 0 ${lw + d}px`;
        right.style.flex = `1 1 ${rw - d}px`;
      };
      const up = () => {
        split.removeEventListener("pointermove", move);
        window.dispatchEvent(new Event("resize"));
      };
      split.addEventListener("pointermove", move);
      split.addEventListener("pointerup", up, { once: true });
    });
  }

  function prevPane(el: Element) { let p = el.previousElementSibling; while (p && !(p.classList.contains("pane") && !(p as HTMLElement).hidden)) p = p.previousElementSibling; return p as HTMLElement | null; }
  function nextPane(el: Element) { let p = el.nextElementSibling; while (p && !(p.classList.contains("pane") && !(p as HTMLElement).hidden)) p = p.nextElementSibling; return p as HTMLElement | null; }
}

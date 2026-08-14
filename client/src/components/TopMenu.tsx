import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export function TopMenu({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);

  function keyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      setOpen(false);
      root.current?.querySelector<HTMLButtonElement>(".menu-trigger")?.focus();
    }
    if (event.key === "ArrowDown" && !open) {
      event.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>(".menu-panel button")?.focus());
    }
  }

  return (
    <div
      ref={root}
      className={`menu hover-menu ${open ? "open" : ""}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => !root.current?.contains(document.activeElement) && setOpen(false)}
      onBlur={(event) => !event.currentTarget.contains(event.relatedTarget) && setOpen(false)}
      onKeyDown={keyDown}
    >
      <button
        className="menu-trigger"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(true)}
      >
        {label} <span aria-hidden="true">⌄</span>
      </button>
      <div id={id} className="menu-panel" hidden={!open}>
        {children}
      </div>
    </div>
  );
}

// ── useHotkey ──
//
// Registers a global keyboard shortcut on `document` or `window` and
// cleans it up when the owning component unmounts. Replaces component-local
// `document/window.addEventListener("keydown", …) +
// onCleanup(() => removeEventListener(…))` blocks in:
//   CommandPalette (Cmd/Ctrl+K, window, capture)
//   ChangesPanel   (Escape closes goal picker, document)
//
// Scope: keydown-only global listeners. Local element handlers
// (textarea onKeyDown, button onKeyDown) stay as JSX props — those
// are idiomatic Solid and don't benefit from the abstraction.
//
// `cmdOrCtrl: true` matches metaKey OR ctrlKey (cross-platform
// Cmd+/Ctrl+ shortcut).  It is mutually exclusive with the individual
// `meta`/`ctrl` modifiers; mixing them is a no-op.

import { onCleanup } from "solid-js"

export type HotkeySpec = {
  /** Key to match (e.key). Case-insensitive for single ASCII letters. */
  key: string
  /**
   * Shorthand for "metaKey OR ctrlKey".  Mutually exclusive with `meta`
   * and `ctrl` — when set, those two are ignored.
   */
  cmdOrCtrl?: boolean
  /** Require exact metaKey state. Ignored when `cmdOrCtrl` is set. */
  meta?: boolean
  /** Require exact ctrlKey state. Ignored when `cmdOrCtrl` is set. */
  ctrl?: boolean
  /** Require exact altKey state. */
  alt?: boolean
  /** Require exact shiftKey state. */
  shift?: boolean
  /** Global event target. Defaults to `document`. */
  target?: "window" | "document"
  /** Use capture phase. Defaults to `false`. */
  capture?: boolean
  /**
   * Optional guard — the handler is skipped when this returns `false`.
   * Useful for "only fire when the panel is open" checks without
   * exposing the open-state check inside the hook itself.
   */
  when?: () => boolean
  /** The action to run when all matchers pass. */
  run: (e: KeyboardEvent) => void
}

export function useHotkey(input: HotkeySpec | HotkeySpec[]): void {
  if (typeof document === "undefined") return
  const specs = Array.isArray(input) ? input : [input]
  for (const spec of specs) {
    const capture = spec.capture ?? false
    const target: EventTarget = spec.target === "window" ? window : document
    const listener = (e: KeyboardEvent) => {
      if (e.key !== spec.key && e.key.toLowerCase() !== spec.key.toLowerCase()) return
      if (spec.cmdOrCtrl !== undefined) {
        if (spec.cmdOrCtrl && !(e.metaKey || e.ctrlKey)) return
        if (!spec.cmdOrCtrl && (e.metaKey || e.ctrlKey)) return
      } else {
        if (spec.meta !== undefined && e.metaKey !== spec.meta) return
        if (spec.ctrl !== undefined && e.ctrlKey !== spec.ctrl) return
      }
      if (spec.alt !== undefined && e.altKey !== spec.alt) return
      if (spec.shift !== undefined && e.shiftKey !== spec.shift) return
      if (spec.when && !spec.when()) return
      spec.run(e)
    }
    target.addEventListener("keydown", listener, capture)
    onCleanup(() => target.removeEventListener("keydown", listener, capture))
  }
}

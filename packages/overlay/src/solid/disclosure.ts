// ── useDisclosure ──
//
// Single-source primitive for boolean open/close state. Replaces the
// 11 component-local `const [open, setOpen] = createSignal(false)`
// repetitions across CommandPalette / ChatComposer
// expand / Card trace / Board summary / ChangesPanel goal-picker /
// MemoryPanel search-mode / ProvidersPanel showAdd / SkillMarketPanel
// addSkill+addMcp / ConnectionBanner show.
//
// Why a hook (not just a signal helper): every disclosure surface needs
// the same trio of verbs (open / close / toggle) plus the read accessor.
// Inlining the trio at every callsite is what produced the previous
// "27 createSignal toggles" sprawl. The hook also gives us a single
// place to wire future cross-cutting behaviour (auto-close on
// `Escape`, focus restoration) without touching every callsite.
//
// Non-disclosure boolean state (busy / armed / loading / dragging /
// focused / submitting) deliberately stays as plain `createSignal` —
// those are transient flags driven by async actions, not user-toggled
// open/close. Forcing them through `useDisclosure` would rename the
// verbs (`run` vs `openIt`) without abstracting anything.

import { createSignal, type Accessor } from "solid-js"

export interface Disclosure {
  /** Reactive open/close accessor. */
  open: Accessor<boolean>
  /** Set the state explicitly. */
  set: (value: boolean) => void
  /** Flip the state. */
  toggle: () => void
  /** Force open. Idempotent — calling on an already-open disclosure
   * is a no-op rather than re-firing onChange. */
  openIt: () => void
  /** Force close. Same idempotence as openIt. */
  close: () => void
}

export function useDisclosure(initial = false): Disclosure {
  const [open, setOpen] = createSignal(initial)
  return {
    open,
    set: setOpen,
    toggle: () => setOpen((v) => !v),
    openIt: () => setOpen(true),
    close: () => setOpen(false),
  }
}

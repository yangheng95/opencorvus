// ── AutoGrowTextarea ──
//
// Behaviour-only primitive: a <textarea> that grows with its content up to
// `maxLines` visible lines, then scrolls (overflow-y: auto). Extracted from
// ChatComposer's `autoResizeTextarea` so the chat composer, the goal dialog,
// and the mission launcher share ONE auto-grow implementation (rule 8 — no
// dual source) instead of each re-deriving the message-box input.
//
// Text-entry chrome comes from the canonical TextField textarea slot; callers
// may add layout-only feature classes such as the Composer's height contract.
// The auto-grow effect tracks `value`, so callers must pass a reactive value.
// DOM assignment happens only when it differs from the native textarea;
// native input, including IME composition, already updated the DOM first.

import { createEffect, onMount, splitProps, type JSX } from "solid-js"
import { autoGrowHeight, DEFAULT_MAX_VISIBLE_LINES } from "./AutoGrowTextareaMetrics"
import { TextField } from "./TextField"

// Cap auto-grow at 10 visible lines by default; beyond that the textarea's
// own overflow-y:auto takes over. Single source for the line cap so every
// surface that adopts the primitive grows to the same ceiling.
export { autoGrowHeight, DEFAULT_MAX_VISIBLE_LINES } from "./AutoGrowTextareaMetrics"

export interface AutoGrowTextareaProps extends Omit<JSX.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "ref"> {
  /** Authoritative value. Must be reactive for external writes and auto-grow. */
  value: string
  /** Visible-line ceiling before the textarea starts scrolling. */
  maxLines?: number
  /** Ref forwarder so callers can read/clear the element imperatively. */
  ref?: (el: HTMLTextAreaElement) => void
  /** Canonical TextField surface recipe; composer removes nested field chrome. */
  surface?: "default" | "composer"
}

export function AutoGrowTextarea(props: AutoGrowTextareaProps) {
  const [local, rest] = splitProps(props, ["value", "maxLines", "ref", "class", "surface"])
  let el: HTMLTextAreaElement | undefined

  function resize() {
    if (!el) return
    // Reset to auto first so scrollHeight reflects the natural content height
    // rather than the previously-pinned height.
    el.style.height = "auto"
    const cs = getComputedStyle(el)
    const height = autoGrowHeight({
      scrollHeight: el.scrollHeight,
      lineHeight: parseFloat(cs.lineHeight) || 20,
      padTop: parseFloat(cs.paddingTop) || 0,
      padBottom: parseFloat(cs.paddingBottom) || 0,
      maxLines: local.maxLines ?? DEFAULT_MAX_VISIBLE_LINES,
    })
    el.style.height = `${height}px`
  }

  // queueMicrotask defers the measure until after Solid flushes the new value
  // into the DOM, so scrollHeight is read against the updated content.
  createEffect(() => {
    const value = local.value
    if (el && el.value !== value) el.value = value
    queueMicrotask(resize)
  })

  onMount(() => {
    queueMicrotask(resize)
  })

  return (
    <TextField.TextArea
      {...rest}
      data-autogrow=""
      surface={local.surface}
      class={local.class}
      ref={(node) => {
        el = node
        local.ref?.(node)
      }}
    />
  )
}

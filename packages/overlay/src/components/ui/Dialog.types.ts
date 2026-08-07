import type { JSX } from "solid-js"

export interface DialogProps {
  /** Controlled open state for the Kobalte dialog root. */
  open: boolean
  /** Dialog title rendered in the header bar. */
  title: JSX.Element
  /** Optional header action row rendered on the right side. */
  headerActions?: JSX.Element
  /** Optional footer action row rendered in .dialog-actions. */
  footer?: JSX.Element
  /** Optional class names applied to the header wrapper. */
  headerClass?: string
  /** Wider width variant for dense surfaces such as the log viewer. */
  wide?: boolean
  /** Widest width variant for dense multi-pane dialogs. */
  wider?: boolean
  /** Full-screen variant for workspace settings surfaces that should fill the shell. */
  fullscreen?: boolean
  /** Render title as `h2` by default, override only when semantics require it. */
  titleAs?: "div" | "h1" | "h2" | "span"
  /** Whether clicking outside the content closes the dialog. */
  backdropClose?: boolean
  /** Whether Kobalte traps focus and disables outside pointer events. */
  modal?: boolean
  /** Whether the header bar can drag the dialog inside the viewport. */
  draggable?: boolean
  /** Extra class names applied to the dialog content element. */
  class?: string
  /** Extra class names applied to the Kobalte overlay element. */
  overlayClass?: string
  /** Extra class names applied to .dialog-form. */
  formClass?: string
  /** Forwarded ref for imperative focus or metrics. */
  ref?: ((el: HTMLElement) => void) | HTMLElement
  /** Kobalte autofocus hook forwarded to dialog content. */
  onOpenAutoFocus?: (event: Event) => void
  /** Kobalte close autofocus hook forwarded to dialog content. */
  onCloseAutoFocus?: (event: Event) => void
  /** Close callback fired after Kobalte requests the controlled dialog to close. */
  onClose?: (dialog: HTMLElement) => void
  /** Dialog body content. */
  children: JSX.Element
  /** Optional DOM id for the dialog root. */
  id?: string
  [key: `data-${string}`]: string | boolean | undefined
}

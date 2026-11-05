import { createSignal } from "solid-js"
import type { Accessor } from "solid-js"
import { workLedgerSummaryAnchorRect } from "../utils/work-ledger-summary-anchor"

export function useTaskRowActionsKeyboard(hasActions: Accessor<boolean>) {
  const [actionsKeyboardOpen, setActionsKeyboardOpen] = createSignal(false)
  let rowRef: HTMLElement | undefined
  let mainButtonRef: HTMLButtonElement | undefined

  const actionButtonTabIndex = () => (actionsKeyboardOpen() ? undefined : -1)
  const actionsKeyboardOpenData = () => (actionsKeyboardOpen() ? "true" : undefined)

  function setRowRef(el: HTMLElement): void {
    rowRef = el
  }

  function setMainButtonRef(el: HTMLButtonElement): void {
    mainButtonRef = el
  }

  function getSummaryAnchorRect(): DOMRect | undefined {
    return workLedgerSummaryAnchorRect(rowRef)
  }

  function focusFirstAction(): void {
    rowRef?.querySelector<HTMLButtonElement>(".task-row-actions .oc-button:not(:disabled)")?.focus()
  }

  function openActionsFromKeyboard(event: KeyboardEvent): void {
    if (event.key !== "ArrowRight") return
    if (!hasActions()) return
    event.preventDefault()
    event.stopPropagation()
    setActionsKeyboardOpen(true)
    queueMicrotask(focusFirstAction)
  }

  function closeActionsFromKeyboard(): void {
    setActionsKeyboardOpen(false)
    queueMicrotask(() => mainButtonRef?.focus())
  }

  function closeActionsFromKeyboardEvent(event: KeyboardEvent): void {
    if (event.key !== "Escape" && event.key !== "ArrowLeft") return
    const container = event.currentTarget
    const target = event.target
    // Portaled menu keys belong to the menu, even when Solid bubbles through this row.
    if (!(container instanceof HTMLElement) || !(target instanceof Node) || !container.contains(target)) return
    event.preventDefault()
    event.stopPropagation()
    closeActionsFromKeyboard()
  }

  function closeActionsOnFocusOut(event: FocusEvent): void {
    if (
      event.currentTarget instanceof HTMLElement &&
      event.currentTarget.contains(event.relatedTarget as Node | null)
    ) {
      return
    }
    setActionsKeyboardOpen(false)
  }

  return {
    actionsKeyboardOpen,
    actionsKeyboardOpenData,
    actionButtonTabIndex,
    setRowRef,
    setMainButtonRef,
    getMainButton: () => mainButtonRef,
    getSummaryAnchorRect,
    openActionsFromKeyboard,
    closeActionsFromKeyboard,
    closeActionsFromKeyboardEvent,
    closeActionsOnFocusOut,
  }
}

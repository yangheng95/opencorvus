import {
  Content as KobalteDialogContent,
  Overlay as KobalteDialogOverlay,
  Portal as KobalteDialogPortal,
  Root as KobalteDialogRoot,
  Title as KobalteDialogTitle,
} from "@kobalte/core/dialog"
import { createEffect, createSignal, mergeProps, onCleanup, Show, splitProps, type JSX } from "solid-js"
import { createAnimationFrameScheduler } from "../../utils/animation-frame"
import type { DialogProps } from "./Dialog.types"

export type { DialogProps } from "./Dialog.types"

const DIALOG_VIEWPORT_MARGIN = 8
const DIALOG_DRAG_IGNORE_SELECTOR =
  'button, input, textarea, select, a, label, summary, [contenteditable="true"], [data-dialog-no-drag="true"]'

function isDialogDragIgnored(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(DIALOG_DRAG_IGNORE_SELECTOR))
}

function clampOffset(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function clampDialogOffset(form: HTMLElement, x: number, y: number): { x: number; y: number } {
  const rect = form.getBoundingClientRect()
  const viewport = document.documentElement
  const availableX = Math.max(0, (viewport.clientWidth - rect.width) / 2 - DIALOG_VIEWPORT_MARGIN)
  const availableY = Math.max(0, (viewport.clientHeight - rect.height) / 2 - DIALOG_VIEWPORT_MARGIN)
  return {
    x: clampOffset(x, -availableX, availableX),
    y: clampOffset(y, -availableY, availableY),
  }
}

export function Dialog(rawProps: DialogProps) {
  const merged = mergeProps(
    {
      wide: false,
      wider: false,
      fullscreen: false,
      titleAs: "h2" as const,
      backdropClose: true,
      modal: true,
      draggable: true,
    },
    rawProps,
  )
  const [local, rest] = splitProps(merged, [
    "open",
    "title",
    "headerActions",
    "footer",
    "headerClass",
    "wide",
    "wider",
    "fullscreen",
    "titleAs",
    "backdropClose",
    "modal",
    "draggable",
    "class",
    "overlayClass",
    "formClass",
    "ref",
    "onClose",
    "children",
  ])

  let dialogRef: HTMLElement | undefined
  let formRef: HTMLDivElement | undefined
  let removeDragListeners: (() => void) | undefined
  let dialogDragFrame = 0
  let pendingDialogDrag:
    | {
        clientX: number
        clientY: number
        form: HTMLElement
        origin: { x: number; y: number }
        startX: number
        startY: number
      }
    | undefined
  const [dialogOffset, setDialogOffset] = createSignal({ x: 0, y: 0 })
  const [dialogForm, setDialogForm] = createSignal<HTMLDivElement>()
  const [dragging, setDragging] = createSignal(false)

  function cancelPendingDialogDrag() {
    if (!dialogDragFrame) return
    cancelAnimationFrame(dialogDragFrame)
    dialogDragFrame = 0
  }

  function applyPendingDialogDrag() {
    dialogDragFrame = 0
    const pending = pendingDialogDrag
    pendingDialogDrag = undefined
    if (!pending) return
    setDialogOffset(
      clampDialogOffset(
        pending.form,
        pending.origin.x + pending.clientX - pending.startX,
        pending.origin.y + pending.clientY - pending.startY,
      ),
    )
  }

  function flushPendingDialogDrag() {
    cancelPendingDialogDrag()
    applyPendingDialogDrag()
  }

  function schedulePendingDialogDrag() {
    if (dialogDragFrame) return
    dialogDragFrame = requestAnimationFrame(applyPendingDialogDrag)
  }

  function applyDialogConstraint() {
    const form = formRef
    if (!form || !local.open || !dialogCanDrag()) return
    setDialogOffset((current) => {
      const next = clampDialogOffset(form, current.x, current.y)
      return next.x === current.x && next.y === current.y ? current : next
    })
  }

  const dialogCanDrag = () => local.draggable !== false && !local.fullscreen
  const dialogConstraintOnFrame = createAnimationFrameScheduler(applyDialogConstraint)

  function stopDragging() {
    flushPendingDialogDrag()
    setDragging(false)
    removeDragListeners?.()
    removeDragListeners = undefined
  }

  function startDialogDrag(event: PointerEvent) {
    const form = formRef
    if (!form || !dialogCanDrag() || event.button !== 0 || event.isPrimary === false) return
    if (isDialogDragIgnored(event.target)) return

    event.preventDefault()
    const origin = dialogOffset()
    const startX = event.clientX
    const startY = event.clientY

    const moveDialog = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault()
      pendingDialogDrag = {
        clientX: moveEvent.clientX,
        clientY: moveEvent.clientY,
        form,
        origin,
        startX,
        startY,
      }
      schedulePendingDialogDrag()
    }

    const finishDialogDrag = () => stopDragging()
    stopDragging()
    setDragging(true)
    window.addEventListener("pointermove", moveDialog)
    window.addEventListener("pointerup", finishDialogDrag, { once: true })
    window.addEventListener("pointercancel", finishDialogDrag, { once: true })
    removeDragListeners = () => {
      cancelPendingDialogDrag()
      pendingDialogDrag = undefined
      window.removeEventListener("pointermove", moveDialog)
      window.removeEventListener("pointerup", finishDialogDrag)
      window.removeEventListener("pointercancel", finishDialogDrag)
    }
  }

  const dialogFormStyle = (): JSX.CSSProperties =>
    ({
      "--dialog-drag-x": `${dialogOffset().x}px`,
      "--dialog-drag-y": `${dialogOffset().y}px`,
    }) as JSX.CSSProperties

  function closeFromKobalte(nextOpen: boolean) {
    if (nextOpen) return
    stopDragging()
    if (dialogRef) local.onClose?.(dialogRef)
  }

  function handleInteractOutside(event: Event) {
    if (local.backdropClose === false) event.preventDefault()
  }

  function handleBackdropPointerDown(event: PointerEvent) {
    if (local.backdropClose === false || event.button !== 0 || event.target !== event.currentTarget) return
    event.preventDefault()
    stopDragging()
    if (dialogRef) local.onClose?.(dialogRef)
  }

  const nonModalPointerPassthrough = () => !local.modal && !local.fullscreen

  const dialogContentStyle = (): JSX.CSSProperties | undefined =>
    nonModalPointerPassthrough() ? { "pointer-events": "none" } : undefined

  const dialogOverlayStyle = (): JSX.CSSProperties | undefined =>
    local.modal ? undefined : { "pointer-events": "none" }

  createEffect(() => {
    if (local.open) {
      setDialogOffset({ x: 0, y: 0 })
      return
    }
    stopDragging()
  })

  createEffect(() => {
    if (dialogCanDrag()) return
    stopDragging()
    setDialogOffset((current) => (current.x === 0 && current.y === 0 ? current : { x: 0, y: 0 }))
  })

  createEffect(() => {
    const form = dialogForm()
    if (!local.open || !dialogCanDrag() || !form) return
    const observer = new ResizeObserver(dialogConstraintOnFrame.schedule)
    observer.observe(form)
    window.addEventListener("resize", dialogConstraintOnFrame.schedule)
    dialogConstraintOnFrame.schedule()
    onCleanup(() => {
      observer.disconnect()
      window.removeEventListener("resize", dialogConstraintOnFrame.schedule)
      dialogConstraintOnFrame.cancel()
    })
  })

  onCleanup(() => {
    stopDragging()
    dialogConstraintOnFrame.cancel()
  })

  return (
    <KobalteDialogRoot open={local.open} onOpenChange={closeFromKobalte} modal={local.modal}>
      <KobalteDialogPortal>
        <KobalteDialogOverlay
          class={["dialog-overlay", local.overlayClass].filter(Boolean).join(" ")}
          data-dialog-modal={local.modal ? "true" : "false"}
          style={dialogOverlayStyle()}
        />
        <KobalteDialogContent
          {...rest}
          class={[
            "dialog",
            local.wide ? "dialog-wide" : "",
            local.wider ? "dialog-wider" : "",
            local.fullscreen ? "dialog-fullscreen" : "",
            local.class,
          ]
            .filter(Boolean)
            .join(" ")}
          aria-modal={local.modal ? "true" : undefined}
          ref={(el) => {
            dialogRef = el
            if (typeof local.ref === "function") local.ref(el)
          }}
          onInteractOutside={handleInteractOutside}
          onPointerDown={handleBackdropPointerDown}
          style={dialogContentStyle()}
        >
          <div
            class={["dialog-form", local.formClass].filter(Boolean).join(" ")}
            data-dialog-draggable={dialogCanDrag() ? "true" : undefined}
            data-dialog-dragging={dialogCanDrag() && dragging() ? "true" : undefined}
            ref={(el) => {
              formRef = el
              setDialogForm(el)
            }}
            style={dialogFormStyle()}
          >
            <div
              class={["dialog-header", local.headerClass].filter(Boolean).join(" ")}
              data-dialog-drag-handle={dialogCanDrag() ? "true" : undefined}
              onPointerDown={dialogCanDrag() ? startDialogDrag : undefined}
            >
              <KobalteDialogTitle as={local.titleAs} class="dialog-title">
                {local.title}
              </KobalteDialogTitle>
              <Show when={local.headerActions}>
                <div class="dialog-header-actions">{local.headerActions}</div>
              </Show>
            </div>
            {local.children}
            <Show when={local.footer}>
              <div class="dialog-actions">{local.footer}</div>
            </Show>
          </div>
        </KobalteDialogContent>
      </KobalteDialogPortal>
    </KobalteDialogRoot>
  )
}

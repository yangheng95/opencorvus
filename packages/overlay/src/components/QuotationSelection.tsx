import { Show, createSignal, onCleanup, onMount, type JSX } from "solid-js"
import { Portal } from "solid-js/web"
import type { Quotation } from "../services/quotation"
import { t } from "../utils/i18n"
import { Button } from "./ui/Button"
import { Icon } from "./ui/Icon"

export function QuotationSelection(props: {
  children: JSX.Element
  onQuote: (quotation: Quotation) => void
  onSideChat?: (quotation: Quotation) => void
}) {
  let root!: HTMLDivElement
  const [selection, setSelection] = createSignal<{ quote: Quotation; x: number; y: number }>()
  function readSelection() {
    const current = window.getSelection()
    if (!current || current.isCollapsed || !current.rangeCount || !current.toString().trim())
      return setSelection(undefined)
    const range = current.getRangeAt(0)
    const element = (node: Node) => (node instanceof Element ? node : node.parentElement)
    const start = element(range.startContainer)?.closest<HTMLElement>("[data-quotation-message]")
    const end = element(range.endContainer)?.closest<HTMLElement>("[data-quotation-message]")
    if (!start || start !== end || !root.contains(start)) return setSelection(undefined)
    const rect = range.getBoundingClientRect()
    const quote = {
      text: current.toString(),
      sessionID: start.dataset.quotationSession!,
      messageID: start.dataset.quotationMessage!,
    }
    if (!quote.sessionID || !quote.messageID) return setSelection(undefined)
    setSelection({
      quote,
      x: Math.max(12, Math.min(rect.left, window.innerWidth - 300)),
      y: Math.max(12, rect.top - 44),
    })
  }
  const clear = () => setSelection(undefined)
  function choose(side: boolean) {
    const value = selection()
    if (!value) return
    if (side) props.onSideChat?.(value.quote)
    else props.onQuote(value.quote)
    window.getSelection()?.removeAllRanges()
    clear()
  }
  onMount(() => {
    document.addEventListener("selectionchange", readSelection)
    window.addEventListener("scroll", clear, true)
    window.addEventListener("resize", clear)
  })
  onCleanup(() => {
    document.removeEventListener("selectionchange", readSelection)
    window.removeEventListener("scroll", clear, true)
    window.removeEventListener("resize", clear)
  })
  return (
    <div
      ref={root}
      class="quotation-scope"
      onKeyDown={(event) => {
        if (event.key === "Escape") clear()
      }}
    >
      {props.children}
      <Show when={selection()}>
        {(value) => (
          <Portal>
            <div
              class="quotation-toolbar"
              role="toolbar"
              aria-label={t("quotation.actions")}
              style={{ left: `${value().x}px`, top: `${value().y}px` }}
              onPointerDown={(event) => event.preventDefault()}
            >
              <Button variant="ghost" size="sm" tone="neutral" onClick={() => choose(false)}>
                <Icon name="quotation" />
                {t("quotation.quote")}
              </Button>
              <Show when={props.onSideChat}>
                <Button variant="ghost" size="sm" tone="neutral" onClick={() => choose(true)}>
                  <Icon name="side-chat" />
                  {t("side_chat.ask")}
                </Button>
              </Show>
            </div>
          </Portal>
        )}
      </Show>
    </div>
  )
}

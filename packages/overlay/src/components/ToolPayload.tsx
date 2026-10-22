import { createEffect, createMemo, createSignal, createUniqueId, For, on, onCleanup, Show, untrack } from "solid-js"
import { conversationUiStore, setToolPayloadDisplayState, toolPayloadDisplayState } from "../store/conversation-ui"
import { createAnimationFrameScheduler } from "../utils/animation-frame"
import { t } from "../utils/i18n"
import { Button } from "./ui/Button"
import { Icon } from "./ui/Icon"
import { Feedback } from "./ui/Feedback"
import { createClipboardCopy } from "./ui/clipboard-copy"

function PayloadValue(props: { value: unknown; depth: number; stateKey: string; path: string[] }) {
  const entries = createMemo(() =>
    props.value !== null && typeof props.value === "object" ? Object.entries(props.value) : null,
  )
  const key = () => JSON.stringify([props.stateKey, props.path])
  const open = () => toolPayloadDisplayState(key())?.expanded ?? props.depth < 1
  const limit = () => toolPayloadDisplayState(key())?.limit ?? 30
  return (
    <Show
      when={entries()}
      fallback={
        <span class="msg-tool-value" data-type={typeof props.value}>
          {props.value === null ? "null" : String(props.value)}
        </span>
      }
    >
      {(items) => (
        <details class="msg-tool-object" open={open()} onToggle={(event) => {
          if (open() !== event.currentTarget.open) setToolPayloadDisplayState(key(), { expanded: event.currentTarget.open })
        }}>
          <summary>{t(Array.isArray(props.value) ? "tool.items" : "tool.fields", { count: items().length })}</summary>
          <Show when={open()}>
            <dl>
              <For each={items().slice(0, limit())}>
                {([key, value]) => (
                  <div class="msg-tool-field">
                    <dt>{key}</dt>
                    <dd>
                      <PayloadValue value={value} depth={props.depth + 1} stateKey={props.stateKey} path={[...props.path, key]} />
                    </dd>
                  </div>
                )}
              </For>
            </dl>
            <Show when={items().length > limit()}>
              <Button variant="ghost" tone="neutral" size="mini" onClick={() => setToolPayloadDisplayState(key(), { limit: limit() + 100 })}>
                {t("tool.more_items", { count: items().length - limit() })}
              </Button>
            </Show>
          </Show>
        </details>
      )}
    </Show>
  )
}

/** Lossless output disclosure: JSON values preserve multiline strings; raw
 * bytes remain available for copying and inspection. Nested bodies mount on demand. */
export function ToolPayload(props: { stateKey: string; messageID: string; label: string; value: string; live?: boolean; collapsed?: boolean }) {
  const id = createUniqueId()
  const raw = () => toolPayloadDisplayState(props.stateKey)?.raw ?? false
  const expanded = () => toolPayloadDisplayState(props.stateKey)?.expanded ?? false
  const contentVisible = () => !props.collapsed || expanded()
  const [content, setContent] = createSignal<HTMLDivElement>()
  createEffect(on([content, () => props.stateKey, raw, expanded, () => props.live], ([element, stateKey, raw, expanded, live]) => {
    if (!element || (expanded && !live)) return
    const owner = untrack(() => conversationUiStore.activeKey)
    const field = raw ? "rawReadingTop" : "readingTop"
    const top = untrack(() => toolPayloadDisplayState(stateKey)?.[field]) ?? 0
    const current = () => conversationUiStore.activeKey === owner && props.stateKey === stateKey
    const visible = () => element.isConnected && element.clientHeight > 0 && !element.closest("[hidden], [inert]")
    let restoring = true
    const restore = createAnimationFrameScheduler(() => {
      if (!current() || !visible()) return
      restoring = false
      observer.disconnect()
      element.scrollTop = top
    })
    const observer = new ResizeObserver(() => restore.schedule())
    const read = () => {
      if (!restoring && current() && visible()) setToolPayloadDisplayState(stateKey, { [field]: element.scrollTop })
    }
    const takeOver = () => {
      restoring = false
      restore.cancel()
      observer.disconnect()
    }
    observer.observe(element)
    element.addEventListener("scroll", read)
    element.addEventListener("wheel", takeOver, { passive: true })
    element.addEventListener("pointerdown", takeOver)
    element.addEventListener("keydown", takeOver)
    restore.schedule()
    onCleanup(() => {
      restore.cancel()
      observer.disconnect()
      element.removeEventListener("scroll", read)
      element.removeEventListener("wheel", takeOver)
      element.removeEventListener("pointerdown", takeOver)
      element.removeEventListener("keydown", takeOver)
    })
  }))
  const formatLabel = () => t(raw() ? "tool.readable_payload" : "tool.raw_payload", { label: props.label })
  const expansionLabel = () => t(expanded() ? "tool.collapse_payload" : "tool.expand_payload", { label: props.label })
  const clipboard = createClipboardCopy({
    text: () => props.value,
    label: () => t("tool.copy_payload", { label: props.label }),
    diagnosticID: "tool-payload",
  })
  const parsed = createMemo(() => {
    if (props.live) return undefined
    try {
      return { value: JSON.parse(props.value) as unknown }
    } catch {
      return undefined
    }
  })
  return (
    <section
      class="msg-tool-payload"
      role="group"
      aria-labelledby={`${id}-label`}
      data-live={props.live ? "true" : undefined}
      data-expanded={expanded() ? "true" : undefined}
    >
      <div class="msg-tool-payload__toolbar">
        <span id={`${id}-label`} class="msg-tool-payload__label">{props.label}</span>
        <Show when={parsed()}>
          <Button
            variant="ghost"
            tone="neutral"
            size="mini"
            aria-label={formatLabel()}
            title={formatLabel()}
            aria-controls={contentVisible() ? `${id}-content` : undefined}
            onClick={() => {
              setToolPayloadDisplayState(props.stateKey, { raw: !raw(), ...(props.collapsed ? { expanded: true } : {}) })
            }}
          >
            {t(raw() ? "tool.readable" : "tool.raw")}
          </Button>
        </Show>
        <Button
          variant="ghost"
          tone="neutral"
          size="mini"
          aria-label={expansionLabel()}
          title={expansionLabel()}
          aria-expanded={expanded()}
          aria-controls={contentVisible() ? `${id}-content` : undefined}
          onClick={() => setToolPayloadDisplayState(props.stateKey, { expanded: !expanded() })}
        >
          {t(expanded() ? "tool.collapse_output" : "tool.expand_output")}
        </Button>
        <Button
          variant="ghost"
          tone="neutral"
          size="icon"
          title={clipboard.label()}
          aria-label={clipboard.label()}
          aria-disabled={clipboard.pending() || undefined}
          aria-busy={clipboard.pending() || undefined}
          onClick={() => void clipboard.copy()}
        >
          <Icon name={clipboard.copied() ? "check" : "copy"} size="compact" />
        </Button>
      </div>
      <Show when={clipboard.failure()}>
        {(failure) => <Feedback tone="error" title={t("clipboard.copy_failed")} details={failure().details}>{failure().message}</Feedback>}
      </Show>
      <Show when={contentVisible()}>
        <div
          ref={setContent}
          id={`${id}-content`}
          class="msg-tool-payload__content"
          data-tool-payload-identity={props.stateKey}
          data-tool-message-id={props.messageID}
        >
          <Show when={parsed() && !raw()} fallback={<pre>{props.value}</pre>}>
            <PayloadValue value={parsed()!.value} depth={0} stateKey={props.stateKey} path={[]} />
          </Show>
        </div>
      </Show>
    </section>
  )
}

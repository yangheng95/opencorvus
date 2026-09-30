/** @jsxImportSource solid-js */
import { For, Show, type JSX } from "solid-js"
import { t } from "../utils/i18n"
import { createStreamingTextPartModel } from "./text-part-model"

function isStandaloneSourceFileMarkup(html: string): boolean {
  return /^&lt;source-file\b[\s\S]*\/&gt;$/.test(html.trim())
}

/** Worker-backed Markdown with stable completed blocks and a raw live tail.
 * DOM insertion is spread across frames for both streaming and loaded text. */

export function TextPart(props: { text: string; streaming?: boolean; trailing?: JSX.Element }) {
  return <StreamingMarkdownPart text={props.text} streaming={props.streaming} trailing={props.trailing} />
}

export function StreamingMarkdownPart(props: {
  text: string
  streaming?: boolean
  className?: string
  activeTextClassName?: string
  trailing?: JSX.Element
}) {
  const { frozenHtml, activeText, pending, error } = createStreamingTextPartModel(props)

  return (
    <div class={props.className || "msg-text"}>
      <For each={frozenHtml()}>
        {(html) => (
          <div
            class={isStandaloneSourceFileMarkup(html) ? "md-frozen-block md-frozen-block--source-file" : "md-frozen-block"}
            innerHTML={html}
          />
        )}
      </For>
      <Show when={activeText()}>
        <div class={props.activeTextClassName || "md-active-text"}>{activeText()}</div>
      </Show>
      {props.trailing}
      <Show when={pending() && !activeText()}>
        <div class="msg-markdown-state" role="status">{t("markdown.rendering")}</div>
      </Show>
      <Show when={error()}>
        <div class="msg-tool-error" role="alert">{t("markdown.render_failed", { message: error() })}</div>
      </Show>
    </div>
  )
}

/** Static documents share the same asynchronous renderer as streamed prose. */
export function StaticTextPart(props: { text: string }) {
  return <StreamingMarkdownPart text={props.text} />
}

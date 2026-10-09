/** @jsxImportSource solid-js */
import { For, Show, type JSX } from "solid-js"
import { t } from "../utils/i18n"
import { createStreamingTextPartModel } from "./text-part-model"

function isStandaloneSourceFileMarkup(html: string): boolean {
  return /^&lt;source-file\b[\s\S]*\/&gt;$/.test(html.trim())
}

/** Worker-backed Markdown formats every accepted token, including a growing tail.
 * DOM insertion is spread across frames for both streaming and loaded text. */

export function TextPart(props: { text: string; streaming?: boolean; trailing?: JSX.Element }) {
  return <StreamingMarkdownPart text={props.text} streaming={props.streaming} trailing={props.trailing} />
}

export function StreamingMarkdownPart(props: {
  text: string
  streaming?: boolean
  className?: string
  trailing?: JSX.Element
}) {
  const { frozenHtml, pending, error } = createStreamingTextPartModel(props)

  return (
    <div class={props.className || "msg-text"} data-markdown-rendering={pending() ? "true" : undefined}>
      <For each={frozenHtml()}>
        {(html) => (
          <div
            class={
              isStandaloneSourceFileMarkup(html) ? "md-frozen-block md-frozen-block--source-file" : "md-frozen-block"
            }
            innerHTML={html}
          />
        )}
      </For>
      {props.trailing}
      <Show when={pending() && frozenHtml().length === 0}>
        <div class="msg-markdown-state" role="status">
          {t("markdown.rendering")}
        </div>
      </Show>
      <Show when={error()}>
        <div class="msg-tool-error" role="alert">
          {t("markdown.render_failed", { message: error() })}
        </div>
      </Show>
    </div>
  )
}

/** Static documents share the same asynchronous renderer as streamed prose. */
export function StaticTextPart(props: { text: string }) {
  return <StreamingMarkdownPart text={props.text} />
}

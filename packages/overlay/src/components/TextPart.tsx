/** @jsxImportSource solid-js */
import { For, Show, type JSX } from "solid-js"
import { t } from "../utils/i18n"
import { markdownSectionIndex } from "../utils/markdown-section"
import { createStreamingTextPartModel } from "./text-part-model"
import { MarkdownBlock, type MarkdownImageReader } from "./MarkdownDocumentImages"

function isStandaloneSourceFileMarkup(html: string): boolean {
  return /^&lt;source-file\b[\s\S]*\/&gt;$/.test(html.trim())
}

function headingLabel(node: Node): string {
  if (node instanceof Element && node.hasAttribute("data-document-image-alt"))
    return node.getAttribute("data-document-image-alt") ?? ""
  if (node instanceof HTMLImageElement) return node.alt
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue ?? ""
  return Array.from(node.childNodes, headingLabel).join("")
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
  images?: MarkdownImageReader
}) {
  const { frozenHtml, pending, error } = createStreamingTextPartModel(props)

  function navigateSection(event: MouseEvent & { currentTarget: HTMLDivElement }): void {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
    const target = event.target
    if (!(target instanceof Element) || target.closest("[data-image-preview-trigger]")) return
    const owner = event.currentTarget
    const anchor = target.closest<HTMLAnchorElement>("a[href]")
    if (!anchor || anchor.closest("[data-markdown-owner]") !== owner) return
    const href = anchor.getAttribute("href") ?? ""
    if (!href.startsWith("#") || href.length < 2) return
    event.preventDefault()
    const headings = Array.from(owner.querySelectorAll<HTMLElement>("[data-markdown-heading]"))
      .filter((heading) => heading.closest("[data-markdown-owner]") === owner)
    const index = markdownSectionIndex(headings.map(headingLabel), href.slice(1))
    if (index === undefined) return
    const heading = headings[index]!
    heading.scrollIntoView({ block: "start", inline: "nearest" })
    heading.focus({ preventScroll: true })
  }

  return (
    <div class={props.className || "msg-text"} data-markdown-owner="true" onClick={navigateSection}
      data-markdown-rendering={pending() ? "true" : undefined}>
      <For each={frozenHtml()}>
        {(html) => (
          <MarkdownBlock
            class={
              isStandaloneSourceFileMarkup(html) ? "md-frozen-block md-frozen-block--source-file" : "md-frozen-block"
            }
            html={html}
            images={props.images}
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
export function StaticTextPart(props: { text: string; images?: MarkdownImageReader }) {
  return <StreamingMarkdownPart text={props.text} images={props.images} />
}

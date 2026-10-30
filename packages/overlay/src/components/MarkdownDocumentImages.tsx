import { createEffect, createMemo, createResource, createSignal, For, onCleanup, onMount, Show } from "solid-js"
import { Portal } from "solid-js/web"
import { t } from "../utils/i18n"
import { formatErrorDetails } from "../utils/error-details"
import { PreviewableImage } from "./ImagePreview"
import { Button } from "./ui/Button"
import { Feedback } from "./ui/Feedback"

export interface MarkdownImageReader {
  read: (path: string, signal: AbortSignal) => Promise<string>
}

/** Only document-relative images become file-reader slots; other Markdown stays intact. */
function documentImageMarkup(html: string): string {
  const template = document.createElement("template")
  template.innerHTML = html
  for (const trigger of template.content.querySelectorAll("button[data-image-preview-trigger]")) {
    const image = trigger.querySelector("img")
    const src = image?.getAttribute("src")
    if (!src || /^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(src)) continue
    const slot = document.createElement("span")
    slot.className = "md-document-image-slot"
    slot.dataset.documentImagePath = src
    slot.dataset.documentImageAlt = image?.getAttribute("alt") ?? ""
    trigger.replaceWith(slot)
  }
  return template.innerHTML
}

function DocumentImage(props: { path: string; alt: string; reader?: MarkdownImageReader }) {
  let host!: HTMLSpanElement
  let controller: AbortController | undefined
  const [visible, setVisible] = createSignal(false)
  const [image, { refetch }] = createResource(
    () => visible() && props.reader ? { path: props.path, reader: props.reader } : false,
    async (source) => {
      controller?.abort()
      const current = new AbortController()
      controller = current
      try {
        return await source.reader.read(source.path, current.signal)
      } finally {
        if (controller === current) controller = undefined
      }
    },
  )
  onMount(() => {
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      setVisible(true)
      observer.disconnect()
    }, { rootMargin: "200px" })
    observer.observe(host)
    onCleanup(() => observer.disconnect())
  })
  onCleanup(() => controller?.abort())
  const name = () => props.alt || props.path
  return <span ref={host} class="md-document-image">
    <Show when={!image.error} fallback={
      <Feedback tone="error" details={formatErrorDetails(image.error)} actions={
        <Button type="button" variant="outline" size="sm" tone="neutral" onClick={() => void refetch()}>
          {t("file.retry_preview")}
        </Button>
      }>{t("file.load_failed", { name: name() })}</Feedback>
    }>
      <Show when={image.state === "ready" && image()} fallback={
        <span class="md-document-image-loading" role="status">{name()} · {t("common.loading")}</span>
      }>{(src) => <PreviewableImage src={src()} alt={props.alt} />}</Show>
    </Show>
  </span>
}

export function MarkdownBlock(props: { html: string; class: string; images?: MarkdownImageReader }) {
  let host!: HTMLDivElement
  const markup = createMemo(() => props.images ? documentImageMarkup(props.html) : props.html)
  const [slots, setSlots] = createSignal<HTMLElement[]>([])
  createEffect(() => {
    markup()
    setSlots(props.images ? Array.from(host.querySelectorAll<HTMLElement>("[data-document-image-path]")) : [])
  })
  return <>
    <div ref={host} class={props.class} innerHTML={markup()} />
    <For each={slots()}>{(slot) => <Portal mount={slot} ref={(element) => { element.style.display = "contents" }}>
      <DocumentImage path={slot.dataset.documentImagePath!} alt={slot.dataset.documentImageAlt ?? ""} reader={props.images} />
    </Portal>}</For>
  </>
}

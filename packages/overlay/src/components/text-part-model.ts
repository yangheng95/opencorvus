import { batch, createEffect, createSignal, onCleanup } from "solid-js"
import { createMarkdownRenderer } from "../services/markdown-render"
import { localeTag } from "../utils/i18n"
import { appStore } from "../store/app"

export const STREAMING_ACTIVE_TEXT_LIMIT = 12_000

export function visibleStreamingText(text: string, limit = STREAMING_ACTIVE_TEXT_LIMIT): string {
  const source = String(text || "")
  const n = Math.max(0, Math.floor(Number(limit) || 0))
  return source.length <= n ? source : `... ${source.slice(-n)}`
}

/** Restore finished artifacts before paint; parse/highlight misses off-thread
 * and commit bounded batches. Frozen strings retain their Solid For identity. */
export function createStreamingTextPartModel(props: { text: string; streaming?: boolean }) {
  const [frozenHtml, setFrozenHtml] = createSignal<string[]>([])
  const [activeText, setActiveText] = createSignal("")
  const [pending, setPending] = createSignal(false)
  const [error, setError] = createSignal("")
  let revision = 0
  let mountFrame = 0
  let target: string[] = []
  let complete = false
  let receivedRevision = 0
  let disposed = false
  let latestText = ""
  let latestLocale = ""
  let latestLocaleSeq = -1
  let latestStreaming = false

  const mount = () => {
    mountFrame = 0
    if (disposed) return
    const current = frozenHtml()
    let prefix = 0
    while (prefix < current.length && prefix < target.length && current[prefix] === target[prefix]) prefix++
    const next = current.slice(0, prefix)
    const deadline = performance.now() + 4
    for (let index = prefix; index < target.length && index < prefix + 16; index++) {
      next.push(target[index])
      setFrozenHtml(next.slice())
      if (performance.now() >= deadline) break
    }
    if (complete && prefix === target.length && current.length !== target.length) setFrozenHtml(target.slice())
    if (frozenHtml().length < target.length) mountFrame = requestAnimationFrame(mount)
    else if (complete) setPending(false)
  }
  const renderer = createMarkdownRenderer((reply, request) => {
    if (disposed) return
    const currentSource =
      request.locale === latestLocale &&
      request.localeSeq === latestLocaleSeq &&
      latestText.startsWith(request.text) &&
      request.streaming === latestStreaming
    if (reply.revision !== -1 && !currentSource) return
    if (reply.revision !== -1 && reply.revision < receivedRevision) return
    if (reply.error) {
      setError(reply.error)
      setPending(false)
      return
    }
    // Older append-only snapshots still contain valid completed blocks. Keep
    // displaying them while the coalesced latest request finishes off-thread.
    setError("")
    if (receivedRevision !== reply.revision) {
      target = []
      receivedRevision = reply.revision
    }
    target.splice(reply.start, target.length - reply.start, ...reply.html)
    complete = reply.done && reply.revision === revision
    setActiveText(visibleStreamingText(reply.activeText))
    if (!mountFrame) mountFrame = requestAnimationFrame(mount)
  })

  createEffect(() => {
    const text = props.text || ""
    const streaming = props.streaming === true
    const localeSeq = appStore.localeSeq
    const locale = localeTag()
    if (
      text === latestText &&
      streaming === latestStreaming &&
      locale === latestLocale &&
      localeSeq === latestLocaleSeq
    )
      return
    latestLocale = locale
    latestLocaleSeq = localeSeq
    latestStreaming = streaming
    const append = text.startsWith(latestText)
    latestText = text
    revision++
    complete = false
    if (!append && mountFrame) {
      cancelAnimationFrame(mountFrame)
      mountFrame = 0
    }
    batch(() => {
      setPending(Boolean(text))
      setError("")
      if (!text) {
        target = []
        setFrozenHtml([])
        setActiveText("")
      }
    })
    try {
      const artifact = renderer.render(text, streaming, revision, localeSeq)
      if (artifact) {
        if (mountFrame) cancelAnimationFrame(mountFrame)
        mountFrame = 0
        target = artifact.html.slice()
        receivedRevision = revision
        complete = true
        batch(() => {
          setFrozenHtml(target.slice())
          setActiveText("")
          setError("")
          setPending(false)
        })
      }
    } catch (reason) {
      setError(String(reason))
      setPending(false)
    }
  })

  onCleanup(() => {
    disposed = true
    cancelAnimationFrame(mountFrame)
    renderer.dispose()
  })
  return { frozenHtml, activeText, pending, error }
}

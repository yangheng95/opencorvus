import { lexMarkdown, renderMarkdownToken } from "../utils/markdown"
import { installIconHtmlRenderer } from "../utils/icon-html"
import { setLocale, setLocaleData } from "../utils/i18n"
import type { MarkdownRenderReply, MarkdownRenderRequest } from "./markdown-render"

const scope = self as unknown as {
  onmessage: (event: MessageEvent<MarkdownRenderRequest & { dispose?: boolean }>) => void
  postMessage: (reply: MarkdownRenderReply) => void
}
const latest = new Map<number, MarkdownRenderRequest>()
const cache = new Map<string, string>()
let working = false
let copyIcon = ""
installIconHtmlRenderer(() => copyIcon)
const yieldTask = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

async function drain() {
  if (working) return
  working = true
  try {
    while (latest.size) {
      const request = latest.values().next().value!
      try {
        setLocaleData(request.locale, { "markdown.copy_code": request.copyLabel })
        await setLocale(request.locale)
        copyIcon = request.copyIcon
        const tokens = lexMarkdown(request.text)
        const visible = tokens.filter((token) => token.type !== "space")
        const active = request.streaming ? visible.pop()?.raw || "" : ""
        const context = JSON.stringify([request.locale, request.copyLabel, request.copyIcon, tokens.links])
        let start = 0
        let html: string[] = []
        let sliceStart = performance.now()
        for (const token of visible) {
          if (latest.get(request.owner) !== request) break
          const key = `${context}\u0000${token.raw}`
          let rendered = cache.get(key)
          if (rendered === undefined) {
            rendered = renderMarkdownToken(token)
            cache.set(key, rendered)
            if (cache.size > 512) cache.delete(cache.keys().next().value!)
          }
          html.push(rendered)
          if (html.length >= 16 || performance.now() - sliceStart >= 8) {
            scope.postMessage({
              owner: request.owner,
              revision: request.revision,
              start,
              html,
              activeText: active,
              done: false,
            })
            start += html.length
            html = []
            await yieldTask()
            sliceStart = performance.now()
          }
        }
        if (latest.get(request.owner) === request) {
          scope.postMessage({
            owner: request.owner,
            revision: request.revision,
            start,
            html,
            activeText: active,
            done: true,
          })
          latest.delete(request.owner)
        }
      } catch (error) {
        if (latest.get(request.owner) === request) {
          scope.postMessage({
            owner: request.owner,
            revision: request.revision,
            start: 0,
            html: [],
            activeText: "",
            done: true,
            error: String(error),
          })
          latest.delete(request.owner)
        }
      }
      await yieldTask()
    }
  } finally {
    working = false
  }
}

scope.onmessage = (event) => {
  if (event.data.dispose) latest.delete(event.data.owner)
  else {
    latest.delete(event.data.owner)
    latest.set(event.data.owner, event.data)
  }
  void drain()
}

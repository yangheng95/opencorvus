import { iconHtml } from "../utils/icon-html"
import { localeTag, t } from "../utils/i18n"

export type MarkdownRenderRequest = {
  owner: number
  revision: number
  text: string
  streaming: boolean
  locale: string
  localeSeq: number
  copyLabel: string
  copyIcon: string
}

export type MarkdownRenderReply = {
  owner: number
  revision: number
  start: number
  html: string[]
  activeText: string
  done: boolean
  error?: string
}

let worker: Worker | undefined
let workerFailure = ""
let nextOwner = 0
const subscribers = new Map<number, (reply: MarkdownRenderReply) => void>()

function rendererWorker(): Worker {
  if (workerFailure) throw new Error(workerFailure)
  if (worker) return worker
  worker = new Worker(new URL("./markdown-render.worker.ts", import.meta.url), { type: "module" })
  worker.onmessage = (event: MessageEvent<MarkdownRenderReply>) => subscribers.get(event.data.owner)?.(event.data)
  worker.onerror = (event) => {
    workerFailure = event.message || "Markdown worker failed"
    for (const [owner, receive] of subscribers) {
      receive({ owner, revision: -1, start: 0, html: [], activeText: "", done: true, error: workerFailure })
    }
  }
  return worker
}

/** One worker and one latest request per mounted text owner. No synchronous
 * parser path is used when worker rendering fails. */
export function createMarkdownRenderer(receive: (reply: MarkdownRenderReply, request: MarkdownRenderRequest) => void) {
  const owner = ++nextOwner
  let inFlight: MarkdownRenderRequest | undefined
  let queued: MarkdownRenderRequest | undefined
  const send = (request: MarkdownRenderRequest) => {
    rendererWorker().postMessage(request)
    inFlight = request
  }
  subscribers.set(owner, (reply) => {
    if (!inFlight || (reply.revision !== inFlight.revision && reply.revision !== -1)) return
    receive(reply, inFlight)
    if (reply.done) {
      inFlight = undefined
      if (reply.revision === -1) queued = undefined
      if (queued) {
        const request = queued
        queued = undefined
        send(request)
      }
    }
  })
  return {
    render(text: string, streaming: boolean, revision: number, localeSeq: number) {
      const request: MarkdownRenderRequest = {
        owner,
        revision,
        text,
        streaming,
        locale: localeTag(),
        localeSeq,
        copyLabel: t("markdown.copy_code"),
        copyIcon: iconHtml("copy", "compact"),
      }
      // Finish accepted work while retaining only the newest queued update.
      // Continuous deltas cannot repeatedly cancel the same long document.
      if (inFlight) queued = request
      else send(request)
    },
    dispose() {
      subscribers.delete(owner)
      worker?.postMessage({ owner, dispose: true })
      if (subscribers.size === 0) {
        worker?.terminate()
        worker = undefined
        workerFailure = ""
      }
    },
  }
}

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
  done: boolean
  error?: string
}

export type MarkdownRenderArtifact = { readonly html: readonly string[] }

const COMPLETED_RESULT_LIMIT = { entries: 32, codeUnits: 4_000_000 }
const completedResults = new Map<string, { artifact: MarkdownRenderArtifact; codeUnits: number }>()
let completedCodeUnits = 0

function completedResultKey(request: MarkdownRenderRequest): string {
  return JSON.stringify([
    request.text, request.streaming, request.locale, request.localeSeq, request.copyLabel, request.copyIcon,
  ])
}

function retainCompletedResult(request: MarkdownRenderRequest, html: string[]): void {
  const key = completedResultKey(request)
  const codeUnits = key.length + html.reduce((size, block) => size + block.length, 0)
  const previous = completedResults.get(key)
  if (previous) completedCodeUnits -= previous.codeUnits
  completedResults.delete(key)
  if (codeUnits > COMPLETED_RESULT_LIMIT.codeUnits) return
  completedResults.set(key, { artifact: Object.freeze({ html: Object.freeze(html.slice()) }), codeUnits })
  completedCodeUnits += codeUnits
  while (completedResults.size > COMPLETED_RESULT_LIMIT.entries || completedCodeUnits > COMPLETED_RESULT_LIMIT.codeUnits) {
    const oldest = completedResults.keys().next().value!
    completedCodeUnits -= completedResults.get(oldest)!.codeUnits
    completedResults.delete(oldest)
  }
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
    completedResults.clear()
    completedCodeUnits = 0
    for (const [owner, receive] of subscribers) {
      receive({ owner, revision: -1, start: 0, html: [], done: true, error: workerFailure })
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
  let requestFrame = 0
  let scheduled: MarkdownRenderRequest | undefined
  let resultHtml: string[] = []
  const send = (request: MarkdownRenderRequest) => {
    resultHtml = []
    rendererWorker().postMessage(request)
    inFlight = request
  }
  const schedule = (request: MarkdownRenderRequest) => {
    scheduled = request
    if (requestFrame) return
    requestFrame = requestAnimationFrame(() => {
      requestFrame = 0
      const next = scheduled
      scheduled = undefined
      if (!next) return
      try {
        send(next)
      } catch (reason) {
        receive({ owner, revision: -1, start: 0, html: [], done: true, error: String(reason) }, next)
      }
    })
  }
  subscribers.set(owner, (reply) => {
    if (!inFlight || (reply.revision !== inFlight.revision && reply.revision !== -1)) return
    if (!inFlight.streaming && !reply.error && reply.revision !== -1) {
      resultHtml.splice(reply.start, resultHtml.length - reply.start, ...reply.html)
    }
    receive(reply, inFlight)
    if (reply.done) {
      if (!inFlight.streaming && !reply.error && reply.revision !== -1) retainCompletedResult(inFlight, resultHtml)
      inFlight = undefined
      if (reply.revision === -1) queued = undefined
      if (queued) {
        const request = queued
        queued = undefined
        schedule(request)
      }
    }
  })
  return {
    render(text: string, streaming: boolean, revision: number, localeSeq: number): MarkdownRenderArtifact | undefined {
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
      if (workerFailure) throw new Error(workerFailure)
      if (!streaming) {
        const key = completedResultKey(request)
        const result = completedResults.get(key)
        if (result) {
          completedResults.delete(key)
          completedResults.set(key, result)
          queued = undefined
          scheduled = undefined
          if (requestFrame) cancelAnimationFrame(requestFrame)
          requestFrame = 0
          return result.artifact
        }
      }
      // Finish accepted work while retaining only the newest queued update.
      // Continuous deltas cannot repeatedly cancel the same long document.
      if (inFlight) queued = request
      else schedule(request)
    },
    dispose() {
      if (requestFrame) cancelAnimationFrame(requestFrame)
      scheduled = undefined
      queued = undefined
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

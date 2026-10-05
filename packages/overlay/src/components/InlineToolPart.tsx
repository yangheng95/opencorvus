import { createMemo, createResource, For, Show } from "solid-js"
import { DiffView, changeStatusLabel } from "./DiffView"
import { describeToolCall, displayToolDetail, toolNameKey, stripAnsi } from "../utils/tool"
import { extToLang, renderCodeBlock } from "../utils/markdown"
import { boardStore, selectedTaskDirectory } from "../store/board"
import { TodoListPart, extractTodos } from "./TodoListPart"
import { StaticTextPart } from "./TextPart"
import { FilePart } from "./FilePart"
import { toolFileChangesFromState, type ToolFileChange } from "../utils/file-change-summary"
import { STREAMING_ACTIVE_TEXT_LIMIT, visibleStreamingText } from "./text-part-model"
import {
  apiJson,
  assertApiAuthorityCurrent,
  captureApiAuthority,
  fetchResourceAsObjectUrl,
  peekResourceObjectUrl,
  resolveResourceUrl,
  type ApiAuthority,
} from "../services/api"
import { directoryScopedPath } from "../services/task-path"
import { PreviewableImage } from "./ImagePreview"
import { Icon } from "./ui/Icon"
import { Button } from "./ui/Button"
import { t, tc } from "../utils/i18n"
import { ComputerControlSurface } from "./ComputerControlSurface"
import { ToolPayload } from "./ToolPayload"
import {
  conversationDeferredToolState,
  ToolFailureCause,
  renderToolFailureCause,
} from "@opencorvus-ai/transport-protocol"

// Same tool-kind sets used to drive code rendering below.
const FILE_WRITE_TOOLS = new Set(["write", "writefile"])
const FILE_EDIT_TOOLS = new Set(["edit", "editfile", "applypatch"])
const FILE_READ_TOOLS = new Set(["read", "readfile"])
const SHELL_TOOLS = new Set(["bash", "shellcommand", "runcommand"])
// Checklist tools render a structured list instead of
// raw JSON — the output is JSON.stringify of the todos array, which is
// unreadable and floods the card body. updateplan uses the same shape.
const TODO_TOOLS = new Set(["todo", "todoupdate", "updateplan"])
const DEFERRED_TOOL_PART_CACHE_LIMIT = 128
const deferredToolPartCache = new Map<string, Promise<any>>()

type DeferredToolPartSource = {
  authority: ApiAuthority
  sessionID: string
  messageID: string
  partID: string
  directory: string
  outputBytes: number
  stateBytes: number
  stateSha256: string
}

async function sha256Text(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

function deferredToolPartCacheKey(source: DeferredToolPartSource): string {
  return [
    source.authority.revision,
    source.directory,
    source.sessionID,
    source.messageID,
    source.partID,
    source.stateSha256,
  ].join("\u0000")
}

function readDeferredToolPart(source: DeferredToolPartSource): Promise<any> {
  assertApiAuthorityCurrent(source.authority)
  const key = deferredToolPartCacheKey(source)
  const cached = deferredToolPartCache.get(key)
  if (cached) return cached
  const request = apiJson(
    directoryScopedPath(
      `session/${encodeURIComponent(source.sessionID)}/message/${encodeURIComponent(source.messageID)}/part/${encodeURIComponent(source.partID)}`,
      source.directory,
      "deferred conversation Tool Part",
    ),
    { authority: source.authority },
  )
    .then(async (loaded) => {
      if (
        !loaded ||
        loaded.type !== "tool" ||
        String(loaded.id || "") !== source.partID ||
        String(loaded.sessionID || "") !== source.sessionID ||
        String(loaded.messageID || "") !== source.messageID
      ) {
        throw new Error(`Deferred Tool Part ${source.partID} returned drifted persisted identity`)
      }
      const serializedState = JSON.stringify(loaded.state)
      const stateBytes = new TextEncoder().encode(serializedState).byteLength
      if (stateBytes !== source.stateBytes || (await sha256Text(serializedState)) !== source.stateSha256) {
        throw new Error(`Deferred Tool Part ${source.partID} state changed during read`)
      }
      const output = loaded.state?.status === "completed" ? String(loaded.state.output || "") : ""
      if (new TextEncoder().encode(output).byteLength !== source.outputBytes) {
        throw new Error(`Deferred Tool Part ${source.partID} output changed during read`)
      }
      assertApiAuthorityCurrent(source.authority)
      return loaded
    })
    .catch((error) => {
      if (deferredToolPartCache.get(key) === request) deferredToolPartCache.delete(key)
      throw error
    })
  deferredToolPartCache.set(key, request)
  while (deferredToolPartCache.size > DEFERRED_TOOL_PART_CACHE_LIMIT) {
    const oldest = deferredToolPartCache.keys().next().value
    if (typeof oldest !== "string") break
    deferredToolPartCache.delete(oldest)
  }
  return request
}

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function toolPayloadText(value: unknown): string {
  if (typeof value === "string") return value
  if (value === undefined) return ""
  try {
    return JSON.stringify(value, null, 2) ?? String(value)
  } catch {
    return String(value)
  }
}

function toolFailureMessage(value: unknown): string {
  const parsed = ToolFailureCause.safeParse(value)
  if (parsed.success) return renderToolFailureCause(parsed.data)
  return toolPayloadText(value)
}

function hasToolPayloadValue(value: unknown): boolean {
  if (value === undefined) return false
  if (typeof value === "string") return Boolean(value.trim())
  if (Array.isArray(value)) return value.length > 0
  if (isRecord(value)) return Object.keys(value).length > 0
  return true
}

function BrowserEvidenceImage(props: { url: string; alt: string }) {
  const authed = () => props.url.startsWith("/")
  const [objectUrl] = createResource(
    () => (authed() ? { url: props.url, authority: captureApiAuthority() } : null),
    (source) => fetchResourceAsObjectUrl(source.url, { authority: source.authority }),
    { initialValue: authed() ? (peekResourceObjectUrl(props.url) ?? null) : null },
  )
  const resolved = () => (authed() ? !objectUrl.loading && objectUrl() : resolveResourceUrl(props.url))

  return (
    <Show when={!objectUrl.error}>
      <Show when={resolved()}>
        {(src) => (
          <PreviewableImage
            src={src()}
            resourceUrl={authed() ? props.url : undefined}
            imageClass="msg-browser-evidence__image"
            triggerClass="msg-browser-evidence__trigger"
            alt={props.alt}
          />
        )}
      </Show>
    </Show>
  )
}

function browserEvidenceAlt(evidence: { title: string; url: string; viewport: string }): string {
  const label = evidence.title || evidence.url || evidence.viewport
  return label ? t("tool.browser_observation_alt_with_label", { label }) : t("tool.browser_observation_alt")
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return ""
}

type ToolAttachment = {
  type: "file"
  url: string
  mime?: string
  mediaType?: string
  filename?: string
}

function browserEvidenceScreenshotUrlFromState(state: Record<string, any>): string {
  const metadata = isRecord(state.metadata) ? state.metadata : {}
  const browser = isRecord(metadata.browser) ? metadata.browser : {}
  const screenshot = isRecord(browser.screenshot) ? browser.screenshot : {}
  return firstString(screenshot.attachmentUrl)
}

function toolAttachments(part: any, state: Record<string, any>, browserScreenshotUrl = ""): ToolAttachment[] {
  const source = Array.isArray(state.attachments)
    ? state.attachments
    : Array.isArray(part?.attachments)
      ? part.attachments
      : []
  return source.flatMap((attachment: unknown): ToolAttachment[] => {
    if (!isRecord(attachment)) return []
    const url = firstString(attachment.url)
    if (!url) return []
    if (browserScreenshotUrl && url === browserScreenshotUrl) return []
    const mime = firstString(attachment.mime)
    const mediaType = firstString(attachment.mediaType)
    const filename = firstString(attachment.filename, attachment.name)
    return [
      {
        type: "file",
        url,
        ...(mime ? { mime } : {}),
        ...(mediaType ? { mediaType } : {}),
        ...(filename ? { filename } : {}),
      },
    ]
  })
}
const READ_NOTE_RE = /^\((?:Showing|End of file|Output capped at)/

interface ParsedReadOutput {
  kind: "file" | "directory"
  body: string
  note?: string
  reminder?: string
}

function isFileContentTool(key: string): boolean {
  return FILE_WRITE_TOOLS.has(key) || FILE_EDIT_TOOLS.has(key) || FILE_READ_TOOLS.has(key)
}

function extractFilePath(inp: any): string {
  return inp?.file_path ?? inp?.filePath ?? inp?.path ?? inp?.filename ?? ""
}

function extractCodeContent(key: string, inp: any, out: string): string {
  if (FILE_WRITE_TOOLS.has(key)) return inp?.content ?? inp?.text ?? ""
  if (FILE_EDIT_TOOLS.has(key)) {
    const oldStr = inp?.old_string ?? ""
    const newStr = inp?.new_string ?? ""
    if (oldStr && newStr) return `--- old\n${oldStr}\n--- new\n${newStr}`
    return newStr || (inp?.content ?? "")
  }
  if (FILE_READ_TOOLS.has(key)) return out
  return ""
}

function extractTaggedBlock(text: string, tag: string): string | null {
  const open = `<${tag}>`
  const close = `</${tag}>`
  const start = text.indexOf(open)
  if (start < 0) return null
  const end = text.indexOf(close, start + open.length)
  if (end < 0) return null
  let inner = text.slice(start + open.length, end)
  if (inner.startsWith("\n")) inner = inner.slice(1)
  if (inner.endsWith("\n")) inner = inner.slice(0, -1)
  return inner
}

function splitReadBody(block: string): { body: string; note?: string } {
  const lines = block.split("\n")
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop()
  const last = lines[lines.length - 1]?.trim() ?? ""
  if (!READ_NOTE_RE.test(last)) {
    return { body: lines.join("\n") }
  }
  lines.pop()
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop()
  return { body: lines.join("\n"), note: last }
}

function parseReadOutput(output: string): ParsedReadOutput | null {
  const type = extractTaggedBlock(output, "type")
  if (type !== "file" && type !== "directory") return null
  const block = extractTaggedBlock(output, type === "file" ? "content" : "entries")
  if (block === null) return null
  const { body, note } = splitReadBody(block)
  const reminder = extractTaggedBlock(output, "system-reminder")?.trim() || undefined
  return {
    kind: type,
    body,
    note,
    reminder,
  }
}

function ToolDiffList(props: { items: ToolFileChange[] }) {
  const totals = () => ({
    additions: props.items.reduce((sum, item) => sum + (item.additions ?? 0), 0),
    deletions: props.items.reduce((sum, item) => sum + (item.deletions ?? 0), 0),
  })

  return (
    <section class="msg-tool-diffs">
      <div class="msg-tool-diffs__summary">
        <span class="msg-tool-diffs__count">{tc("files.changed", props.items.length)}</span>
        <span class="msg-tool-diffs__meta">
          <span class="diff-dialog-stat" data-tone="add">
            +{totals().additions}
          </span>
          <span class="diff-dialog-stat" data-tone="del">
            -{totals().deletions}
          </span>
        </span>
      </div>
      <For each={props.items}>
        {(item) => (
          <section class="msg-tool-diff-card">
            <header class="msg-tool-diff-card__head">
              <div class="msg-tool-diff-card__copy">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  tone="accent"
                  data-ui="tool-diff-open-file"
                  data-file-path={item.openPath}
                  title={item.openPath}
                >
                  {item.displayPath}
                </Button>
                <span class="change-status" data-status={item.status}>
                  {changeStatusLabel(item.status)}
                </span>
              </div>
              <div class="msg-tool-diff-card__meta">
                <span class="diff-dialog-stat" data-tone="add">
                  +{item.additions}
                </span>
                <span class="diff-dialog-stat" data-tone="del">
                  -{item.deletions}
                </span>
              </div>
            </header>
            <div class="msg-tool-diff-card__body">
              <DiffView item={item} />
            </div>
          </section>
        )}
      </For>
    </section>
  )
}

/**
 * Render a tool invocation. Three visual modes:
 *  - mode="inline" (default): single-line chip only.
 *  - mode="block":            chip + full output body.
 *  - mode="body":             output body only (used when the caller already
 *                             rendered its own header, e.g. inside a tool Card).
 */
export function InlineToolPart(props: { part: any; mode?: "inline" | "block" | "body" }) {
  const mode = () => props.mode ?? "inline"
  const deferredSource = () => {
    const deferred = conversationDeferredToolState(props.part?.state?.metadata)
    if (!deferred) return null
    const sessionID = String(props.part?.sessionID || "").trim()
    const messageID = String(props.part?.messageID || "").trim()
    const partID = String(props.part?.id || "").trim()
    const directory = selectedTaskDirectory() || String(boardStore.board?.directory || "").trim()
    if (!sessionID || !messageID || !partID || !directory) {
      throw new Error(`Deferred Tool Part ${partID || "<missing>"} has incomplete persisted identity`)
    }
    return {
      authority: captureApiAuthority(),
      sessionID,
      messageID,
      partID,
      directory,
      outputBytes: deferred.outputBytes,
      stateBytes: deferred.stateBytes,
      stateSha256: deferred.stateSha256,
    }
  }
  const [persistedPart] = createResource(deferredSource, readDeferredToolPart)
  const part = () => (!persistedPart.loading && persistedPart()) || props.part
  const state = () => part().state || {}
  const toolName = () => part().tool || "unknown"
  const input = () => state().input || {}
  const display = createMemo(() => describeToolCall(toolName(), input(), state(), selectedTaskDirectory()))
  const status = () => display().status || "pending"
  const icon = () => display().icon
  const detail = () => {
    const raw = display().detail
    return raw && raw.toLowerCase() !== toolName().toLowerCase() ? raw : ""
  }
  const raw = () => {
    const st = state()
    const r = typeof st.raw === "string" ? (typeof part()._targetRaw === "string" ? part()._targetRaw : st.raw) : ""
    return status() === "completed" ? r : visibleStreamingText(r)
  }
  const output = () => stripAnsi(state().output || "")
  const error = () => stripAnsi(toolFailureMessage(state().failure) || state().error || "") || output()
  const key = () => toolNameKey(toolName())
  const readView = createMemo(() => {
    if (status() !== "completed") return null
    if (!FILE_READ_TOOLS.has(key())) return null
    return parseReadOutput(output())
  })

  // Code rendering for completed file-content tools — always full (no
  // truncation) because block mode lives inside its own <Card> body
  // which is only rendered when the user expanded it.
  const codeResult = createMemo(() => {
    const k = key()
    if (!isFileContentTool(k)) return null
    if (FILE_READ_TOOLS.has(k) && status() !== "completed") return null
    if (status() !== "completed" && status() !== "running" && status() !== "pending") return null
    const parsedRead = readView()
    const fullContent = FILE_READ_TOOLS.has(k)
      ? (parsedRead?.body ?? extractCodeContent(k, input(), output()))
      : extractCodeContent(k, input(), output())
    const content =
      status() === "completed" ? fullContent : visibleStreamingText(fullContent, STREAMING_ACTIVE_TEXT_LIMIT)
    if (!content) return null
    const lang = parsedRead?.kind === "directory" ? "plaintext" : extToLang(extractFilePath(input()))
    return renderCodeBlock(content, lang, Infinity)
  })

  // Structured todo list — populated during streaming from state.input.todos,
  // once committed from state.metadata.todos. Both shapes are handled by
  // extractTodos so a streaming or completed todo renders identically.
  const todoItems = createMemo(() => {
    if (!TODO_TOOLS.has(key())) return null
    return extractTodos(state())
  })
  const toolDiffs = createMemo(() => {
    if (status() !== "completed") return null
    const changes = toolFileChangesFromState(state(), selectedTaskDirectory())
    return changes.length > 0 ? changes : null
  })
  const browserEvidenceScreenshotUrl = createMemo(() =>
    status() === "completed" ? browserEvidenceScreenshotUrlFromState(state()) : "",
  )
  const attachments = createMemo(() =>
    status() === "completed" ? toolAttachments(part(), state(), browserEvidenceScreenshotUrl()) : [],
  )
  const showStructuredOutput = createMemo(() => (toolDiffs()?.length ?? 0) > 0)
  const browserEvidence = createMemo(() => {
    if (status() !== "completed") return null
    const metadata = isRecord(state().metadata) ? state().metadata : {}
    const browser = isRecord(metadata.browser) ? metadata.browser : null
    if (!browser) return null
    const viewport = isRecord(browser.viewport) ? browser.viewport : {}
    const diagnostics = isRecord(browser.diagnostics) ? browser.diagnostics : {}
    const diagnosticText = [
      ["console", diagnostics.consoleErrors],
      ["page", diagnostics.pageErrors],
      ["network", diagnostics.failedRequests],
      ["http", diagnostics.httpErrors],
    ]
      .flatMap(([label, value]) => (typeof value === "number" && value > 0 ? [`${label} ${value}`] : []))
      .join(" · ")
    return {
      url: typeof browser.url === "string" ? browser.url : "",
      title: typeof browser.title === "string" ? browser.title : "",
      viewport:
        typeof viewport.width === "number" && typeof viewport.height === "number"
          ? `${viewport.width}x${viewport.height}`
          : "",
      screenshotUrl: browserEvidenceScreenshotUrl(),
      diagnosticText,
    }
  })
  const computerControl = createMemo(() => {
    if (status() !== "completed" || key() !== "computersessioncreate") return null
    const metadata = isRecord(state().metadata) ? state().metadata : {}
    const computer = isRecord(metadata.computer) ? metadata.computer : {}
    const sessionID = firstString(part()?.sessionID)
    const computerID = firstString(computer.computerId)
    const displayID = firstString(computer.displayId)
    return sessionID && computerID && displayID ? { sessionID, computerID, displayID } : null
  })
  const showPlainOutput = createMemo(() => {
    if (status() !== "completed" || !output().trim() || readView()) return false
    if (showStructuredOutput()) return /<diagnostics\b/i.test(output())
    return !codeResult()
  })
  const visibleShellCommand = createMemo(() => {
    if (status() === "pending" || !SHELL_TOOLS.has(key())) return ""
    return detail()
  })
  const hasResultBody = createMemo(() =>
    Boolean(
      (todoItems()?.length ?? 0) > 0 ||
        showStructuredOutput() ||
        codeResult() ||
        readView()?.note ||
        readView()?.reminder ||
        browserEvidence() ||
        computerControl() ||
        attachments().length > 0 ||
        showPlainOutput() ||
        (status() === "error" && error()),
    ),
  )
  const bodyReady = () => !persistedPart.loading && !persistedPart.error && (!deferredSource() || !!persistedPart())
  const inputPayload = () => (status() === "pending" && raw() ? raw() : toolPayloadText(state().input))
  const hasReadOutputBody = () =>
    status() === "completed" &&
    FILE_READ_TOOLS.has(key()) &&
    Boolean((codeResult() && !showStructuredOutput()) || readView()?.note || readView()?.reminder)

  const showChip = () => mode() !== "body"
  const showBody = () => mode() === "block" || mode() === "body"

  return (
    <>
      <Show when={showChip()}>
        <div class="msg-tool" data-status={status()}>
          <span class="tool-icon" aria-hidden="true">
            <Icon name={icon()} />
          </span>
          <span class="tool-name">{toolName()}</span>
          <Show when={detail()}>
            <span class="tool-detail" title={detail()}>
              {detail()}
            </span>
          </Show>
        </div>
      </Show>
      <Show when={showBody()}>
        <Show when={persistedPart.loading}>
          <div class="loading-hint" role="status">
            {t("common.loading")}
          </div>
        </Show>
        <Show when={persistedPart.error}>
          <div class="msg-tool-error">{String(persistedPart.error?.message || persistedPart.error)}</div>
        </Show>
        <Show when={bodyReady()}>
          <Show
            when={hasToolPayloadValue(state().input) || raw()}
            fallback={<div class="msg-tool-state">{t("tool.no_arguments")}</div>}
          >
            <ToolPayload label={t("tool.input")} value={inputPayload()} live={status() === "pending"} collapsed />
          </Show>
          <Show when={status() === "pending" || status() === "running"}>
            <div class="msg-tool-state" role="status">
              {t(status() === "pending" ? "tool.receiving_input" : "tool.awaiting_result")}
            </div>
          </Show>
          <Show when={status() === "completed" && !hasResultBody()}>
            <div class="msg-tool-state">{t("tool.empty_result")}</div>
            <Show when={hasToolPayloadValue(state().metadata)}>
              <ToolPayload label={t("tool.metadata")} value={toolPayloadText(state().metadata)} collapsed />
            </Show>
          </Show>
        </Show>
        <Show
          when={todoItems() && todoItems()!.length > 0}
          fallback={
            <>
              <Show when={visibleShellCommand()}>
                {(command) => (
                  <div class="msg-tool-command">
                    <span class="msg-tool-command__prompt" aria-hidden="true">
                      $
                    </span>
                    <code>{command()}</code>
                  </div>
                )}
              </Show>
              <Show when={showStructuredOutput()}>
                <ToolDiffList items={toolDiffs()!} />
              </Show>
              <Show
                when={hasReadOutputBody()}
                fallback={
                  <Show when={codeResult() && !showStructuredOutput() && !FILE_READ_TOOLS.has(key())}>
                    <div class="msg-tool-code md-content" innerHTML={codeResult()!.html} />
                  </Show>
                }
              >
                <section class="msg-tool-payload" aria-label={t("tool.output")}>
                  <div class="msg-tool-payload__label">{t("tool.output")}</div>
                  <Show when={codeResult() && !showStructuredOutput()}>
                    <div class="msg-tool-code md-content" innerHTML={codeResult()!.html} />
                  </Show>
                  <Show when={readView()?.note}>
                    <div class="msg-read-meta">{readView()!.note}</div>
                  </Show>
                  <Show when={readView()?.reminder}>
                    <section class="msg-read-reminder">
                      <div class="msg-read-reminder__label">{t("tool.loaded_instructions")}</div>
                      <div class="msg-read-reminder__body">
                        <StaticTextPart text={readView()!.reminder!} />
                      </div>
                    </section>
                  </Show>
                </section>
              </Show>
              <Show when={browserEvidence()}>
                {(evidence) => (
                  <section class="msg-browser-evidence">
                    <Show when={evidence().screenshotUrl}>
                      <BrowserEvidenceImage url={evidence().screenshotUrl} alt={browserEvidenceAlt(evidence())} />
                    </Show>
                    <div class="msg-browser-evidence__meta">
                      <Show when={evidence().title || evidence().url}>
                        <div class="msg-browser-evidence__title">{evidence().title || evidence().url}</div>
                      </Show>
                      <Show when={evidence().url}>
                        <div class="msg-browser-evidence__url">{evidence().url}</div>
                      </Show>
                      <Show when={evidence().viewport || evidence().diagnosticText}>
                        <div class="msg-browser-evidence__facts">
                          {[evidence().viewport, evidence().diagnosticText].filter(Boolean).join(" · ")}
                        </div>
                      </Show>
                    </div>
                  </section>
                )}
              </Show>
              <Show when={computerControl()}>{(identity) => <ComputerControlSurface {...identity()} />}</Show>
              <Show when={attachments().length > 0}>
                <section class="msg-tool-attachments">
                  <For each={attachments()}>{(attachment) => <FilePart part={attachment} />}</For>
                </section>
              </Show>
              <Show when={showPlainOutput()}>
                <ToolPayload label={t("tool.output")} value={output()} />
              </Show>
            </>
          }
        >
          <TodoListPart todos={todoItems()!} variant={mode() === "body" ? "card" : "inline"} />
        </Show>
        <Show when={status() === "error" && error()}>
          <div class="msg-tool-error">
            <StaticTextPart text={error()} />
          </div>
        </Show>
      </Show>
    </>
  )
}

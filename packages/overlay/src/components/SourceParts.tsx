import { Key } from "@solid-primitives/keyed"
import type { SourceFilePart } from "@opencorvus-ai/sdk"
import { Match, Show, Switch, onCleanup, onMount, untrack } from "solid-js"
import { boardStore, selectedTaskDirectory } from "../store/board"
import { openFileReference, openSourceFileEditor } from "../services/file-workbench"
import { shortRelativePath } from "../utils/tool"
import { pathWithForwardSeparators } from "../utils/server-path"
import { localeTag, t } from "../utils/i18n"
import { Icon, type IconName } from "./ui/Icon"
import { Tooltip } from "./ui/Tooltip"
import { Disclosure } from "./ui/Disclosure"
import { Button } from "./ui/Button"
import { Feedback } from "./ui/Feedback"
import { createClipboardCopy } from "./ui/clipboard-copy"
import {
  cardExpanded,
  setCardExpanded,
  sourceExcerptReadingTop,
  setSourceExcerptReadingTop,
} from "../store/conversation-ui"
import { captureApiAuthority, isApiAuthorityCurrent } from "../services/api"
import { AppLog } from "../utils/log"
import { pauseAutoScrollForReading } from "../utils/dom-utils"
import { createAnimationFrameScheduler } from "../utils/animation-frame"

export type ConversationSourcePart = {
  type: "source-url" | "source-document" | "source-file"
  sourceId: string
  sessionID?: string
  messageID?: string
  title?: string
  provider?: string
  snippet?: string
  author?: string
  publishedAt?: string
  url?: string
  path?: string
  mediaType?: string
  filename?: string
  origin?: SourceFilePart["origin"]
  range?: SourceFilePart["range"]
}

export function isConversationSourcePart(part: any): part is ConversationSourcePart {
  return part?.type === "source-url" || part?.type === "source-document" || part?.type === "source-file"
}

function sourceIdentity(source: ConversationSourcePart): string {
  return JSON.stringify([source.type, source.sessionID ?? null, source.messageID ?? null, source.sourceId])
}

function sourceDirectory(): string {
  const source = boardStore.selectedSource
  return source?.directory?.trim() || selectedTaskDirectory().trim()
}

function fileSourceLocation(label: string, range: ConversationSourcePart["range"]): string {
  if (!range) return label
  const lines = range.startLine === range.endLine ? `${range.startLine}` : `${range.startLine}-${range.endLine}`
  return `${label}:${lines}${range.startColumn === undefined ? "" : `:${range.startColumn}`}`
}

/** Decode visible international URL text without changing encoded ASCII structure. */
function readableSourceUrlText(value: string): string {
  return value.replace(/(?:%[89a-f][0-9a-f])+/gi, (encoded) => {
    try {
      const decoded = decodeURIComponent(encoded)
      return /[\p{C}\p{Z}\p{Default_Ignorable_Code_Point}]/u.test(decoded) ? encoded : decoded
    } catch (error) {
      // An invalid UTF-8 sequence retains its exact visible URL representation.
      if (error instanceof URIError) return encoded
      throw error
    }
  })
}

function sourceFileTitle(source: ConversationSourcePart): string | undefined {
  if (source.origin === "attachment" && source.title) return source.title
  const title = source.title || ""
  const filePath = source.filename || source.path || title
  const syntax = source.path || sourceDirectory()
  const filename = pathWithForwardSeparators(filePath, syntax).split("/").filter(Boolean).at(-1)
  return title && !pathWithForwardSeparators(title, syntax).includes("/") ? title : filename
}

function sourceLabel(source: ConversationSourcePart): string {
  if (source.type === "source-file") {
    const title = sourceFileTitle(source)
    if (title) return fileSourceLocation(title, source.range)
  }
  if (source.type === "source-url" && source.url) {
    const title = source.title?.trim() || ""
    try {
      const url = new URL(source.url)
      if (title) {
        try {
          if (new URL(title).href !== url.href) return title
        } catch {
          return title
        }
      }
      return url.pathname === "/" && !url.search ? url.host : readableSourceUrlText(`${url.pathname}${url.search}`)
    } catch {
      return title || source.url
    }
  }
  if (source.title?.trim()) return source.title.trim()
  return source.filename || source.mediaType || t("chat.source_document")
}

function sourceDetail(source: ConversationSourcePart): string {
  if (source.type === "source-url") return source.url || ""
  if (source.type === "source-file") {
    if (source.origin === "attachment") return sourceLabel(source)
    const path = shortRelativePath(source.path || "", sourceDirectory())
    return fileSourceLocation(path, source.range)
  }
  return source.filename || source.mediaType || ""
}

function sourceFileCaption(source: ConversationSourcePart): { kind: "attachment" | "location" | "directory"; text: string } {
  if (source.origin === "attachment") return { kind: "attachment", text: t("chat.source_attachment") }
  const relative = shortRelativePath(source.path || "", sourceDirectory())
  const location = pathWithForwardSeparators(relative, source.path || sourceDirectory())
  const separator = location.lastIndexOf("/")
  const filename = location.slice(separator + 1)
  // Keep the actual filename visible when a publisher supplies a custom title.
  if (fileSourceLocation(filename, source.range) !== sourceLabel(source)) {
    return { kind: "location", text: sourceDetail(source) }
  }
  return { kind: "directory", text: location.slice(0, separator + 1) }
}

function repeatsFileDirectory(source: ConversationSourcePart, previous: ConversationSourcePart | undefined): boolean {
  if (source.type !== "source-file" || previous?.type !== "source-file" || !source.path || source.path !== previous.path) {
    return false
  }
  const caption = sourceFileCaption(source)
  const previousCaption = sourceFileCaption(previous)
  return caption.kind === "directory" && previousCaption.kind === "directory" && caption.text === previousCaption.text
}

function sourceIcon(source: ConversationSourcePart): IconName {
  return source.type === "source-url" ? "web-search" : source.type === "source-file" ? "file-document" : "channel-link"
}

async function openSourceFile(source: ConversationSourcePart): Promise<void> {
  const authority = captureApiAuthority()
  const epoch = boardStore.selectEpoch
  const directory = sourceDirectory()
  const path = source.path || ""
  if (!directory || !path) return
  try {
    if (source.origin === "attachment") {
      await openSourceFileEditor(path, { directory, authority }, source.range, source.title)
      return
    }
    await openFileReference(path, { directory, authority }, source.range)
  } catch (error) {
    if (!isApiAuthorityCurrent(authority) || boardStore.selectEpoch !== epoch) return
    if (error instanceof DOMException && error.name === "AbortError") return
    AppLog.error("source-file", "Opening the file source failed", {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/** Preserve the publisher's calendar day; authored date text carries its own precision. */
function sourcePublishedDate(value: string | undefined): string {
  if (!value) return ""
  const raw = value.trim()
  const day = /^(\d{4}-\d{2}-\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.exec(raw)?.[1]
  if (!day || !Number.isFinite(Date.parse(raw))) return raw
  const calendarDate = new Date(`${day}T00:00:00.000Z`)
  if (calendarDate.getUTCFullYear() < 1 || calendarDate.toISOString().slice(0, 10) !== day) return raw
  return new Intl.DateTimeFormat(localeTag(), { dateStyle: "medium", timeZone: "UTC" }).format(calendarDate)
}

function sourceProviderLabel(provider: string | undefined): string {
  if (provider === "opencorvus-webfetch") return t("chat.source_provider.webfetch")
  if (provider === "opencorvus-read") return t("chat.source_provider.read")
  if (provider === "opencorvus-search-code") return t("chat.source_provider.search_code")
  if (provider === "exa") return "Exa"
  return provider || ""
}

function SourceTooltipContent(props: { source: ConversationSourcePart }) {
  return (
    <Tooltip.Content class="msg-source-tooltip" data-ui="message-source-tooltip" data-source-type={props.source.type}>
      <strong>{sourceLabel(props.source)}</strong>
      <Show when={sourceDetail(props.source) !== sourceLabel(props.source)}>
        <span>{sourceDetail(props.source)}</span>
      </Show>
      <Show when={props.source.type === "source-file" && props.source.snippet}>
        {(snippet) => (
          <div class="msg-source-tooltip__preview">
            <span>{t("chat.source_excerpt")}</span>
            <pre>{snippet()}</pre>
          </div>
        )}
      </Show>
      <span title={[props.source.publishedAt, props.source.provider].filter(Boolean).join(" · ") || undefined}>
        {[props.source.author, sourcePublishedDate(props.source.publishedAt), sourceProviderLabel(props.source.provider)].filter(Boolean).join(" · ")}
      </span>
    </Tooltip.Content>
  )
}

function SourceChip(props: { source: ConversationSourcePart; index: number; showIndex: boolean; omitDirectoryCaption: boolean }) {
  const label = () => sourceLabel(props.source)
  const fileTitle = () => sourceFileTitle(props.source) || label()
  const fileRange = () => {
    const range = props.source.range
    if (!range) return ""
    if (range.startColumn !== undefined && range.startColumn > 1) {
      return t("chat.source_line_column", { line: range.startLine, column: range.startColumn })
    }
    return range.startLine === range.endLine
      ? t("chat.source_line", { line: range.startLine })
      : t("chat.source_lines", { start: range.startLine, end: range.endLine })
  }
  const detail = () => sourceDetail(props.source)
  const fileCaption = () => props.omitDirectoryCaption ? "" : sourceFileCaption(props.source).text
  const icon = () => sourceIcon(props.source)
  const location = () => {
    if (props.source.type !== "source-url" || !props.source.url) return ""
    try {
      const url = new URL(props.source.url)
      const fragment = readableSourceUrlText(url.hash)
      if (label() === url.host) return fragment
      return fragment ? `${url.host} · ${fragment}` : url.host
    } catch {
      return ""
    }
  }

  return (
    <Tooltip.Root openDelay={180} closeDelay={80} placement="top-start" gutter={7} fitViewport>
      <Switch>
        <Match when={props.source.type === "source-url" && props.source.url}>
          <Tooltip.Trigger
            as="a"
            class="msg-source-chip"
            href={props.source.url}
            data-browser-preview-url={props.source.url}
            aria-label={`${t("chat.source_open_web")}: ${[label(), location()].filter(Boolean).join(" · ")}`}
            onClick={(event) => pauseAutoScrollForReading(event.currentTarget)}
          >
            <Show when={props.showIndex}>
              <span class="msg-source-chip__index">{props.index + 1}</span>
            </Show>
            <Icon name={icon()} size="compact" />
            <span class="msg-source-chip__content">
              <span class="msg-source-chip__label">{label()}</span>
              <Show when={location()}>{(value) => <span class="msg-source-chip__detail msg-source-chip__location">{value()}</span>}</Show>
            </span>
          </Tooltip.Trigger>
        </Match>
        <Match when={props.source.type === "source-file" && props.source.path}>
          <Tooltip.Trigger
            as="button"
            type="button"
            class="msg-source-chip"
            onClick={(event) => {
              pauseAutoScrollForReading(event.currentTarget)
              void openSourceFile(props.source)
            }}
            aria-label={`${t("chat.source_open_file")}: ${detail()}`}
          >
            <Show when={props.showIndex}>
              <span class="msg-source-chip__index">{props.index + 1}</span>
            </Show>
            <Icon name={icon()} size="compact" />
            <span class="msg-source-chip__content">
              <span class="msg-source-chip__file-title">
                <span class="msg-source-chip__label msg-source-chip__filename">{fileTitle()}</span>
                <Show when={fileRange()}>{(range) => <span class="msg-source-chip__range">{range()}</span>}</Show>
              </span>
              <Show when={fileCaption()}>
                <span class="msg-source-chip__detail">{fileCaption()}</span>
              </Show>
            </span>
          </Tooltip.Trigger>
        </Match>
        <Match when={true}>
          <Tooltip.Trigger
            as="span"
            class="msg-source-chip"
            tabIndex={0}
            aria-label={label()}
          >
            <Show when={props.showIndex}>
              <span class="msg-source-chip__index">{props.index + 1}</span>
            </Show>
            <Icon name={icon()} size="compact" />
            <span class="msg-source-chip__label">{label()}</span>
          </Tooltip.Trigger>
        </Match>
      </Switch>
      <Tooltip.Portal>
        <SourceTooltipContent source={props.source} />
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

function SourceExcerptBody(props: { source: ConversationSourcePart }) {
  const authority = untrack(captureApiAuthority)
  const epoch = untrack(() => boardStore.selectEpoch)
  const identity = sourceIdentity(props.source)
  const readingKey = JSON.stringify([authority.revision, identity])
  let body: HTMLDivElement | undefined
  let pendingTop = untrack(() => sourceExcerptReadingTop(readingKey))
  let resizeObserver: ResizeObserver | undefined
  const current = () =>
    isApiAuthorityCurrent(authority) && boardStore.selectEpoch === epoch && sourceIdentity(props.source) === identity
  const visible = () => body?.isConnected && body.clientHeight > 0 && !body.closest("[inert], [hidden]")
  const saveReadingPosition = () => {
    if (pendingTop === undefined && current() && visible() && body) setSourceExcerptReadingTop(readingKey, body.scrollTop)
  }
  const finishRestore = () => {
    pendingTop = undefined
    resizeObserver?.disconnect()
    resizeObserver = undefined
  }
  const restore = createAnimationFrameScheduler(() => {
    if (!current()) {
      finishRestore()
      return
    }
    if (pendingTop === undefined || !visible() || !body) return
    const top = pendingTop
    finishRestore()
    body.scrollTop = top
    saveReadingPosition()
  })
  const cancelRestoreForReading = () => {
    restore.cancel()
    finishRestore()
    saveReadingPosition()
  }
  onMount(() => {
    if (pendingTop === undefined || !body) return
    resizeObserver = new ResizeObserver(() => restore.schedule())
    resizeObserver.observe(body)
    restore.schedule()
  })
  onCleanup(() => {
    restore.cancel()
    resizeObserver?.disconnect()
  })
  return (
    <Disclosure.Content
      ref={(element) => { body = element }}
      class="msg-source-excerpt__body"
      role="region"
      aria-label={`${t("chat.source_excerpt")}: ${sourceLabel(props.source)}`}
      tabIndex={0}
      onScroll={saveReadingPosition}
      onWheel={cancelRestoreForReading}
      onPointerDown={cancelRestoreForReading}
      onKeyDown={(event) => {
        if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) cancelRestoreForReading()
      }}
    >
      {props.source.snippet}
    </Disclosure.Content>
  )
}

function SourceEntry(props: { source: ConversationSourcePart; index: number; showIndex: boolean; omitDirectoryCaption: boolean }) {
  const expandableExcerpt = () => props.source.type !== "source-file" && Boolean(props.source.snippet)
  const excerptKey = () => `source-excerpt:${sourceIdentity(props.source)}`
  const expanded = () => cardExpanded(excerptKey(), false)
  const excerptLabel = () => `${t("chat.source_excerpt")}: ${sourceLabel(props.source)}`
  const location = () => props.source.type === "source-url"
    ? props.source.url || ""
    : props.source.type === "source-file" && props.source.path
      ? fileSourceLocation(props.source.path, props.source.range)
      : ""
  const clipboard = createClipboardCopy({
    text: location,
    label: () => t("chat.source_copy_location", {
      source: props.source.type === "source-file" && props.source.origin !== "attachment"
        ? sourceDetail(props.source)
        : sourceLabel(props.source),
    }),
    diagnosticID: "source-location",
  })

  return (
    <div class="msg-source-entry" data-has-excerpt={expandableExcerpt() ? "true" : undefined}>
      <div
        class="msg-source-entry__row"
        data-source-identity={sourceIdentity(props.source)}
        data-source-message-id={props.source.messageID}
      >
        <SourceChip source={props.source} index={props.index} showIndex={props.showIndex} omitDirectoryCaption={props.omitDirectoryCaption} />
        <Show when={location()}>
          <Button
            type="button"
            class="msg-source-copy"
            variant="ghost"
            size="icon"
            tone="neutral"
            title={clipboard.label()}
            aria-label={clipboard.label()}
            aria-disabled={clipboard.pending() || undefined}
            aria-busy={clipboard.pending() || undefined}
            data-copied={clipboard.copied() ? "true" : undefined}
            onClick={(event) => {
              event.stopPropagation()
              pauseAutoScrollForReading(event.currentTarget)
              void clipboard.copy()
            }}
          >
            <Icon name={clipboard.copied() ? "check" : "copy"} size="compact" />
          </Button>
        </Show>
      </div>
      <Show when={clipboard.failure()}>
        {(failure) => <Feedback tone="error" title={t("clipboard.copy_failed")} details={failure().details}>{failure().message}</Feedback>}
      </Show>
      <Show when={expandableExcerpt()}>
        <Disclosure.Root
          class="msg-source-excerpt"
          open={expanded()}
          onOpenChange={(open) => setCardExpanded(excerptKey(), open)}
        >
          <Disclosure.Trigger
            class="msg-source-excerpt__heading"
            aria-label={excerptLabel()}
            onClick={(event) => {
              if (!expanded()) pauseAutoScrollForReading(event.currentTarget)
            }}
          >
            {t("chat.source_excerpt")}
          </Disclosure.Trigger>
          <Show when={expanded()}>
            <SourceExcerptBody source={props.source} />
          </Show>
        </Disclosure.Root>
      </Show>
    </div>
  )
}

export function SourceParts(props: { sources: ConversationSourcePart[] }) {
  let group!: HTMLDivElement
  let trigger!: HTMLElement
  const key = () => {
    const first = props.sources[0]
    return `sources:${first?.sessionID || ""}:${first?.messageID || ""}:${first?.sourceId || ""}`
  }
  const expanded = () => cardExpanded(key(), false)
  const toggleLabel = () => {
    const singular = props.sources.length === 2
    const label = expanded()
      ? singular ? "chat.collapse_source_count" : "chat.collapse_sources_count"
      : singular ? "chat.more_source" : "chat.more_sources"
    return t(label, { count: props.sources.length - 1 })
  }
  return (
    <div ref={group} class="msg-sources" role="group" aria-label={t("chat.sources")} data-ui="message-sources">
      <Key each={props.sources.slice(0, 1)} by={sourceIdentity}>
        {(source) => <SourceEntry source={source()} index={0} showIndex={props.sources.length > 1} omitDirectoryCaption={false} />}
      </Key>
      <Show when={props.sources.length > 1}>
        <Disclosure.Root
          class="msg-sources__remaining"
          open={expanded()}
          onOpenChange={(open) => setCardExpanded(key(), open)}
        >
          <Disclosure.Trigger
            ref={trigger}
            class="msg-sources__heading"
            onClick={(event) => {
              if (!expanded()) pauseAutoScrollForReading(event.currentTarget)
            }}
            indicatorPosition="end"
          >
            {toggleLabel()}
          </Disclosure.Trigger>
          <Show when={expanded()}>
            <Disclosure.Content class="msg-sources__list">
              <Key each={props.sources.slice(1)} by={sourceIdentity}>
                {(source, index) => (
                  <SourceEntry
                    source={source()}
                    index={index() + 1}
                    showIndex
                    omitDirectoryCaption={repeatsFileDirectory(source(), props.sources[index()])}
                  />
                )}
              </Key>
            </Disclosure.Content>
            <Button
              type="button"
              class="msg-sources__collapse"
              variant="ghost"
              size="mini"
              tone="neutral"
              onClick={(event) => {
                pauseAutoScrollForReading(event.currentTarget)
                setCardExpanded(key(), false)
                trigger.focus({ preventScroll: true })
                group.scrollIntoView({ block: "nearest", inline: "nearest" })
              }}
            >
              <Icon name="chevron-up" size="compact" />
              {t("chat.collapse_sources")}
            </Button>
          </Show>
        </Disclosure.Root>
      </Show>
    </div>
  )
}

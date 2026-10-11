import { Key } from "@solid-primitives/keyed"
import { Match, Show, Switch, onCleanup, onMount, untrack } from "solid-js"
import { boardStore, selectedTaskDirectory } from "../store/board"
import { openFileEditor, openSourceFileEditor } from "../services/file-workbench"
import { relativePathFrom, shortRelativePath } from "../utils/tool"
import { localeTag, t } from "../utils/i18n"
import { Icon, type IconName } from "./ui/Icon"
import { Tooltip } from "./ui/Tooltip"
import { Disclosure } from "./ui/Disclosure"
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
  range?: { startLine: number; endLine: number }
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

function sourceLabel(source: ConversationSourcePart): string {
  if (source.type === "source-file") {
    const title = source.title?.trim() || ""
    const filePath = source.filename?.trim() || source.path || title
    const filename = filePath.split(/[\\/]/).filter(Boolean).at(-1)
    const label = title && !/[\\/]/.test(title) ? title : filename
    if (label) return source.range ? `${label}:${source.range.startLine}-${source.range.endLine}` : label
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
      return `${url.pathname}${url.search} · ${url.hostname}`
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
    const path = shortRelativePath(source.path || "", sourceDirectory())
    return source.range ? `${path}:${source.range.startLine}-${source.range.endLine}` : path
  }
  return source.filename || source.mediaType || ""
}

function sourceIcon(source: ConversationSourcePart): IconName {
  return source.type === "source-url" ? "web-search" : source.type === "source-file" ? "file-document" : "channel-link"
}

async function openSourceFile(source: ConversationSourcePart): Promise<void> {
  const authority = captureApiAuthority()
  const epoch = boardStore.selectEpoch
  const directory = sourceDirectory()
  const path = source.path?.trim() || ""
  if (!directory || !path) return
  const projectPath = relativePathFrom(directory, path)
  try {
    if (projectPath) {
      await openFileEditor(projectPath, { directory, authority }, source.range)
      return
    }
    await openSourceFileEditor(path, { directory, authority }, source.range)
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
  if (provider === "exa") return "Exa"
  return provider || ""
}

function SourceTooltipContent(props: { source: ConversationSourcePart }) {
  return (
    <Tooltip.Content class="msg-source-tooltip" data-ui="message-source-tooltip">
      <strong>{sourceLabel(props.source)}</strong>
      <Show when={sourceDetail(props.source) !== sourceLabel(props.source)}>
        <span>{sourceDetail(props.source)}</span>
      </Show>
      <span title={[props.source.publishedAt, props.source.provider].filter(Boolean).join(" · ") || undefined}>
        {[props.source.author, sourcePublishedDate(props.source.publishedAt), sourceProviderLabel(props.source.provider)].filter(Boolean).join(" · ")}
      </span>
    </Tooltip.Content>
  )
}

function SourceChip(props: { source: ConversationSourcePart; index: number; showIndex: boolean }) {
  const label = () => sourceLabel(props.source)
  const detail = () => sourceDetail(props.source)
  const icon = () => sourceIcon(props.source)
  const location = () => {
    if (props.source.type !== "source-url" || !props.source.url) return ""
    try {
      const url = new URL(props.source.url)
      return url.hash ? `${url.hash} · ${url.host}` : url.host
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
            aria-label={`${t("chat.source_open_web")}: ${label()} · ${location()}`}
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
              <span class="msg-source-chip__label">{label()}</span>
              <Show when={detail() !== label()}>
                <span class="msg-source-chip__detail">{detail()}</span>
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

function SourceEntry(props: { source: ConversationSourcePart; index: number; showIndex: boolean }) {
  const excerptKey = () => `source-excerpt:${sourceIdentity(props.source)}`
  const expanded = () => cardExpanded(excerptKey(), false)
  const excerptLabel = () => `${t("chat.source_excerpt")}: ${sourceLabel(props.source)}`

  return (
    <div class="msg-source-entry" data-has-excerpt={props.source.snippet ? "true" : undefined}>
      <SourceChip source={props.source} index={props.index} showIndex={props.showIndex} />
      <Show when={Boolean(props.source.snippet)}>
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
  const preview = () => (props.sources[0] ? sourceLabel(props.sources[0]) : "")
  const key = () => {
    const first = props.sources[0]
    return `sources:${first?.sessionID || ""}:${first?.messageID || ""}:${first?.sourceId || ""}`
  }
  const expanded = () => cardExpanded(key(), false)
  const entries = () => (
    <Key each={props.sources} by={sourceIdentity}>
      {(source, index) => <SourceEntry source={source()} index={index()} showIndex={props.sources.length > 1} />}
    </Key>
  )
  return (
    <Show
      when={props.sources.length === 1}
      fallback={
        <Disclosure.Root
          class="msg-sources"
          aria-label={t("chat.sources")}
          data-ui="message-sources"
          open={expanded()}
          onOpenChange={(open) => setCardExpanded(key(), open)}
        >
          <Disclosure.Trigger
            class="msg-sources__heading"
            onClick={(event) => {
              if (!expanded()) pauseAutoScrollForReading(event.currentTarget)
            }}
            aria-label={`${t("chat.sources")}: ${preview()} (${props.sources.length})`}
            title={preview()}
            indicatorPosition="end"
          >
            <Show when={props.sources[0]}>{(source) => <Icon name={sourceIcon(source())} size="compact" />}</Show>
            <Show when={preview()} fallback={<span class="msg-sources__preview">{t("chat.sources")}</span>}>
              <span class="msg-sources__preview">{preview()}</span>
            </Show>
            <span class="msg-sources__count">{props.sources.length}</span>
          </Disclosure.Trigger>
          <Show when={expanded()}>
            <Disclosure.Content class="msg-sources__list">{entries()}</Disclosure.Content>
          </Show>
        </Disclosure.Root>
      }
    >
      <div class="msg-sources" role="group" aria-label={t("chat.sources")} data-ui="message-sources">
        {entries()}
      </div>
    </Show>
  )
}

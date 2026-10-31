import { Key } from "@solid-primitives/keyed"
import { Match, Show, Switch, createSignal, onCleanup, onMount, untrack } from "solid-js"
import { boardStore, selectedTaskDirectory } from "../store/board"
import { openFileReference, openSourceFileEditor } from "../services/file-workbench"
import { shortRelativePath } from "../utils/tool"
import { pathWithForwardSeparators } from "../utils/server-path"
import { localeTag, t } from "../utils/i18n"
import { Icon, type IconName } from "./ui/Icon"
import { Tooltip } from "./ui/Tooltip"
import { Disclosure } from "./ui/Disclosure"
import { Button } from "./ui/Button"
import { Dialog } from "./ui/Dialog"
import { Feedback } from "./ui/Feedback"
import { createClipboardCopy } from "./ui/clipboard-copy"
import {
  cardExpanded,
  setCardExpanded,
  sourceExcerptReadingPosition,
  setSourceExcerptReadingPosition,
} from "../store/conversation-ui"
import { captureApiAuthority, isApiAuthorityCurrent } from "../services/api"
import { AppLog } from "../utils/log"
import { pauseAutoScrollForReading } from "../utils/dom-utils"
import { createAnimationFrameScheduler } from "../utils/animation-frame"
import { captureTextReadingAnchor, resolveTextReadingTop } from "../utils/conversation-reading-anchor"
import {
  type ConversationSourcePart,
  conversationSourceIdentity as sourceIdentity,
  conversationSourceExcerptKey,
  conversationSourceLocation as sourceLocation,
  fileSourceLocation,
} from "../utils/conversation-source"

function sourceDirectory(): string {
  const source = boardStore.selectedSource
  return source?.directory?.trim() || selectedTaskDirectory().trim()
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

export function sourceLabel(source: ConversationSourcePart): string {
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

/** A display annotation; the original path remains the open/copy resource. */
function sourceWhitespacePath(source: ConversationSourcePart): string {
  if (source.type !== "source-file") return ""
  const value =
    source.origin === "attachment"
      ? sourceFileTitle(source) || ""
      : pathWithForwardSeparators(shortRelativePath(source.path || "", sourceDirectory()), source.path || sourceDirectory())
  let annotated = false
  const readable = [...value]
    .map((character) => {
      if (character === " " || character.trim() !== "") return character
      annotated = true
      return `⟦U+${character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}⟧`
    })
    .join("")
  return annotated ? readable : ""
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

export function SourceSearchContext(props: { source: ConversationSourcePart }) {
  return (
    <span class="conversation-search-hit__source">
      <span class="conversation-search-hit__source-title">
        <Icon name={sourceIcon(props.source)} size="compact" />
        <strong>{sourceLabel(props.source)}</strong>
      </span>
      <Show when={sourceDetail(props.source) && sourceDetail(props.source) !== sourceLabel(props.source)}>
        <span class="conversation-search-hit__source-location">{sourceDetail(props.source)}</span>
      </Show>
    </span>
  )
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

function SourceTooltipContent(props: { source: ConversationSourcePart; attachmentCaption: string }) {
  return (
    <Tooltip.Content class="msg-source-tooltip" data-ui="message-source-tooltip" data-source-type={props.source.type}>
      <strong>{sourceLabel(props.source)}</strong>
      <Show when={props.attachmentCaption}>{(caption) => <span>{caption()}</span>}</Show>
      <Show when={sourceDetail(props.source) !== sourceLabel(props.source)}>
        <span>{sourceDetail(props.source)}</span>
      </Show>
      <Show when={sourceWhitespacePath(props.source)}>
        {(path) => <span>{t("chat.source_whitespace_details", { path: path() })}</span>}
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

function SourceChip(props: { source: ConversationSourcePart; index: number; showIndex: boolean; omitDirectoryCaption: boolean; attachmentCaption: string }) {
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
  const whitespacePath = () => sourceWhitespacePath(props.source)
  const fileCaption = () => props.omitDirectoryCaption ? "" : props.attachmentCaption || sourceFileCaption(props.source).text
  const fileCaptionParts = () => {
    const text = fileCaption()
    const normalized = pathWithForwardSeparators(text, props.source.path || sourceDirectory())
    const end = normalized.endsWith("/") ? normalized.length - 2 : normalized.length - 1
    const separator = normalized.lastIndexOf("/", end)
    return { prefix: text.slice(0, separator + 1), tail: text.slice(separator + 1) }
  }
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
              <Show when={location()}>{(value) => <span class="msg-source-chip__detail">{value()}</span>}</Show>
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
            aria-label={`${t("chat.source_open_file")}: ${[detail(), props.attachmentCaption, whitespacePath() && t("chat.source_whitespace_details", { path: whitespacePath() })].filter(Boolean).join(" · ")}`}
          >
            <Show when={props.showIndex}>
              <span class="msg-source-chip__index">{props.index + 1}</span>
            </Show>
            <Icon name={icon()} size="compact" />
            <span class="msg-source-chip__content">
              <span class="msg-source-chip__file-title">
                <span class="msg-source-chip__label msg-source-chip__filename">{fileTitle()}</span>
                <Show when={fileRange()}>{(range) => <span class="msg-source-chip__range">{range()}</span>}</Show>
                <Show when={whitespacePath()}>
                  <span class="msg-source-chip__whitespace" aria-hidden="true">{t("chat.source_whitespace_badge")}</span>
                </Show>
              </span>
              <Show when={fileCaption()}>
                <span class="msg-source-chip__detail msg-source-chip__file-location">
                  <Show when={fileCaptionParts().prefix}>
                    {(prefix) => <span class="msg-source-chip__path-prefix">{prefix()}</span>}
                  </Show>
                  <span class="msg-source-chip__path-tail">{fileCaptionParts().tail}</span>
                </span>
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
        <SourceTooltipContent source={props.source} attachmentCaption={props.attachmentCaption} />
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
  const position = () => untrack(() => sourceExcerptReadingPosition(readingKey))
  let restoring = true
  let width = 0
  let resizeObserver: ResizeObserver | undefined
  const current = () =>
    isApiAuthorityCurrent(authority) && boardStore.selectEpoch === epoch && sourceIdentity(props.source) === identity
  const visible = () => body?.isConnected && body.clientHeight > 0 && !body.closest("[inert], [hidden]")
  const saveReadingPosition = () => {
    if (restoring || !current() || !visible() || !body || body.clientWidth !== width) return
    setSourceExcerptReadingPosition(readingKey, {
      top: body.scrollTop,
      anchor: captureTextReadingAnchor(body, body.getBoundingClientRect(), position()?.anchor),
    })
  }
  const restore = createAnimationFrameScheduler(() => {
    if (!current() || !visible() || !body) return
    const saved = position()
    body.scrollTop = saved?.anchor ? resolveTextReadingTop(body, saved.anchor) ?? saved.top : saved?.top ?? 0
    width = body.clientWidth
    restoring = false
    saveReadingPosition()
  })
  const cancelRestoreForReading = () => {
    restore.cancel()
    restoring = false
    if (body) width = body.clientWidth
    saveReadingPosition()
  }
  onMount(() => {
    if (!body) return
    resizeObserver = new ResizeObserver(() => {
      if (!current() || !visible()) return
      restoring = true
      restore.schedule()
    })
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

function SourceEntry(props: { source: ConversationSourcePart; index: number; showIndex: boolean; omitDirectoryCaption: boolean; attachmentCaption: string }) {
  const [fileExcerptOpen, setFileExcerptOpen] = createSignal(false)
  const expandableExcerpt = () => props.source.type !== "source-file" && Boolean(props.source.snippet)
  const excerptKey = () => conversationSourceExcerptKey(props.source)
  const expanded = () => cardExpanded(excerptKey(), false)
  const displayLabel = () => [sourceLabel(props.source), props.attachmentCaption].filter(Boolean).join(" · ")
  const excerptLabel = () => `${t("chat.source_excerpt")}: ${displayLabel()}`
  const location = () => sourceLocation(props.source)
  const excerptClipboard = createClipboardCopy({
    text: () => props.source.snippet || "",
    label: () => t("chat.source_copy_excerpt_label", { source: displayLabel() }),
    diagnosticID: "source-excerpt",
  })
  const clipboard = createClipboardCopy({
    text: location,
    label: () => t("chat.source_copy_location", {
      source: [
        props.source.type === "source-file" && props.source.origin !== "attachment"
          ? sourceDetail(props.source)
          : sourceLabel(props.source),
        props.attachmentCaption,
        sourceWhitespacePath(props.source) && t("chat.source_whitespace_details", { path: sourceWhitespacePath(props.source) }),
      ].filter(Boolean).join(" · "),
    }),
    diagnosticID: "source-location",
  })
  const ExcerptCopyButton = () => (
    <Button
      type="button"
      variant="ghost"
      size="mini"
      tone="neutral"
      aria-label={excerptClipboard.label()}
      aria-disabled={excerptClipboard.pending() || undefined}
      aria-busy={excerptClipboard.pending() || undefined}
      onClick={(event) => {
        event.stopPropagation()
        pauseAutoScrollForReading(event.currentTarget)
        void excerptClipboard.copy()
      }}
    >
      <Icon name={excerptClipboard.copied() ? "check" : "copy"} size="compact" />
      {excerptClipboard.copied()
        ? t("clipboard.copy_confirmed", { action: t("chat.source_copy_excerpt") })
        : t("chat.source_copy_excerpt")}
    </Button>
  )

  return (
    <div class="msg-source-entry" data-has-excerpt={expandableExcerpt() ? "true" : undefined}>
      <div
        class="msg-source-entry__row"
        data-source-id={props.source.sourceId}
        data-source-identity={sourceIdentity(props.source)}
        data-source-message-id={props.source.messageID}
      >
        <SourceChip source={props.source} index={props.index} showIndex={props.showIndex} omitDirectoryCaption={props.omitDirectoryCaption} attachmentCaption={props.attachmentCaption} />
        <Show when={props.source.type === "source-file" && props.source.snippet}>
          <Button
            type="button"
            class="msg-source-excerpt-open"
            variant="ghost"
            size="icon"
            tone="neutral"
            title={t("chat.source_open_excerpt", { source: displayLabel() })}
            aria-label={t("chat.source_open_excerpt", { source: displayLabel() })}
            onClick={(event) => {
              event.stopPropagation()
              pauseAutoScrollForReading(event.currentTarget)
              setFileExcerptOpen(true)
            }}
          >
            <Icon name="quotation" size="compact" />
          </Button>
          <Dialog
            open={fileExcerptOpen()}
            onClose={() => setFileExcerptOpen(false)}
            title={t("chat.source_saved_excerpt_title", { source: displayLabel() })}
            footer={
              <>
                <ExcerptCopyButton />
                <Button type="button" variant="ghost" size="sm" tone="neutral" onClick={() => setFileExcerptOpen(false)}>
                  {t("common.close")}
                </Button>
              </>
            }
          >
            <p>{t("chat.source_saved_excerpt_hint")}</p>
            <p class="msg-source-excerpt__location">{location()}</p>
            <pre class="msg-source-excerpt__snapshot" role="region" aria-label={excerptLabel()} tabIndex={0}>
              {props.source.snippet}
            </pre>
            <Show when={excerptClipboard.failure()}>
              {(failure) => <Feedback tone="error" title={t("clipboard.copy_failed")} details={failure().details}>{failure().message}</Feedback>}
            </Show>
          </Dialog>
        </Show>
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
            <div class="msg-sources__actions">
              <ExcerptCopyButton />
            </div>
            <Show when={excerptClipboard.failure()}>
              {(failure) => <Feedback tone="error" title={t("clipboard.copy_failed")} details={failure().details}>{failure().message}</Feedback>}
            </Show>
            <SourceExcerptBody source={props.source} />
          </Show>
        </Disclosure.Root>
      </Show>
    </div>
  )
}

export function SourceParts(props: { sources: ConversationSourcePart[]; contextSources: ConversationSourcePart[] }) {
  let group!: HTMLDivElement
  let trigger!: HTMLElement
  const attachmentCaption = (source: ConversationSourcePart) => {
    if (source.type !== "source-file" || source.origin !== "attachment" || !source.path) return ""
    const paths = [...new Set(props.contextSources
      .filter((entry) => entry.type === "source-file" && entry.origin === "attachment" && sourceLabel(entry) === sourceLabel(source))
      .map((entry) => entry.path)
      .filter((path): path is string => Boolean(path)))]
    if (paths.length < 2) return ""
    return t("chat.source_attachment_reference", {
      number: new Intl.NumberFormat(localeTag()).format(paths.indexOf(source.path) + 1),
    })
  }
  const locations = () => props.sources.map(sourceLocation).filter(Boolean)
  const clipboard = createClipboardCopy({
    text: () => locations().join("\n"),
    label: () => t("chat.sources_copy_locations", { count: locations().length }),
    diagnosticID: "source-locations",
  })
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
    <div ref={group} class="msg-sources" role="group" aria-label={t("chat.sources")} data-ui="message-sources"
      data-source-group-key={key()} data-source-ids={JSON.stringify(props.sources.map(source => source.sourceId))}>
      <Key each={props.sources.slice(0, 1)} by={sourceIdentity}>
        {(source) => <SourceEntry source={source()} index={0} showIndex={props.sources.length > 1} omitDirectoryCaption={false} attachmentCaption={attachmentCaption(source())} />}
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
                    attachmentCaption={attachmentCaption(source())}
                  />
                )}
              </Key>
            </Disclosure.Content>
            <div class="msg-sources__actions">
              <Button
                type="button"
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
              <Show when={locations().length > 1}>
                <Button
                  type="button"
                  variant="ghost"
                  size="mini"
                  tone="neutral"
                  aria-disabled={clipboard.pending() || undefined}
                  aria-busy={clipboard.pending() || undefined}
                  onClick={(event) => {
                    event.stopPropagation()
                    pauseAutoScrollForReading(event.currentTarget)
                    void clipboard.copy()
                  }}
                >
                  <Icon name={clipboard.copied() ? "check" : "copy"} size="compact" />
                  {clipboard.label()}
                </Button>
              </Show>
            </div>
            <Show when={clipboard.failure()}>
              {(failure) => <Feedback tone="error" title={t("clipboard.copy_failed")} details={failure().details}>{failure().message}</Feedback>}
            </Show>
          </Show>
        </Disclosure.Root>
      </Show>
    </div>
  )
}

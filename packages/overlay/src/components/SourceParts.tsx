import { Key } from "@solid-primitives/keyed"
import { Match, Show, Switch } from "solid-js"
import { boardStore, selectedTaskDirectory } from "../store/board"
import { openFileEditor, openSourceFileEditor } from "../services/file-workbench"
import { relativePathFrom, shortRelativePath } from "../utils/tool"
import { t } from "../utils/i18n"
import { Icon, type IconName } from "./ui/Icon"
import { Tooltip } from "./ui/Tooltip"
import { Disclosure } from "./ui/Disclosure"
import { cardExpanded, setCardExpanded } from "../store/conversation-ui"
import { captureApiAuthority, isApiAuthorityCurrent } from "../services/api"
import { AppLog } from "../utils/log"
import { pauseAutoScrollForReading } from "../utils/dom-utils"

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

function SourceTooltipContent(props: { source: ConversationSourcePart }) {
  return (
    <Tooltip.Content class="msg-source-tooltip" data-ui="message-source-tooltip">
      <strong>{sourceLabel(props.source)}</strong>
      <span>{sourceDetail(props.source)}</span>
      <span>{props.source.snippet || ""}</span>
      <span>{[props.source.author, props.source.publishedAt, props.source.provider].filter(Boolean).join(" · ")}</span>
    </Tooltip.Content>
  )
}

function SourceChip(props: { source: ConversationSourcePart; index: number; showIndex: boolean }) {
  const label = () => sourceLabel(props.source)
  const detail = () => sourceDetail(props.source)
  const icon = () => sourceIcon(props.source)

  return (
    <Tooltip.Root openDelay={180} closeDelay={80} placement="top-start" gutter={7} fitViewport>
      <Switch>
        <Match when={props.source.type === "source-url" && props.source.url}>
          <Tooltip.Trigger
            as="a"
            class="msg-source-chip"
            href={props.source.url}
            data-browser-preview-url={props.source.url}
            onFocus={(event) => pauseAutoScrollForReading(event.currentTarget)}
            aria-label={`${t("chat.source_open_web")}: ${label()}`}
          >
            <Show when={props.showIndex}>
              <span class="msg-source-chip__index">{props.index + 1}</span>
            </Show>
            <Icon name={icon()} size="compact" />
            <span class="msg-source-chip__label">{label()}</span>
          </Tooltip.Trigger>
        </Match>
        <Match when={props.source.type === "source-file" && props.source.path}>
          <Tooltip.Trigger
            as="button"
            type="button"
            class="msg-source-chip"
            onFocus={(event) => pauseAutoScrollForReading(event.currentTarget)}
            onClick={() => void openSourceFile(props.source)}
            aria-label={`${t("chat.source_open_file")}: ${detail()}`}
          >
            <Show when={props.showIndex}>
              <span class="msg-source-chip__index">{props.index + 1}</span>
            </Show>
            <Icon name={icon()} size="compact" />
            <span class="msg-source-chip__label">{label()}</span>
          </Tooltip.Trigger>
        </Match>
        <Match when={true}>
          <Tooltip.Trigger
            as="span"
            class="msg-source-chip"
            tabIndex={0}
            onFocus={(event) => pauseAutoScrollForReading(event.currentTarget)}
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

export function SourceParts(props: { sources: ConversationSourcePart[] }) {
  const preview = () => (props.sources[0] ? sourceLabel(props.sources[0]) : "")
  const key = () => {
    const first = props.sources[0]
    return `sources:${first?.sessionID || ""}:${first?.messageID || ""}:${first?.sourceId || ""}`
  }
  const expanded = () => cardExpanded(key(), false)
  return (
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
        <Disclosure.Content class="msg-sources__list">
          <Key
            each={props.sources}
            by={(source) => JSON.stringify([source.type, source.sessionID ?? null, source.messageID ?? null, source.sourceId])}
          >
            {(source, index) => <SourceChip source={source()} index={index()} showIndex={props.sources.length > 1} />}
          </Key>
        </Disclosure.Content>
      </Show>
    </Disclosure.Root>
  )
}

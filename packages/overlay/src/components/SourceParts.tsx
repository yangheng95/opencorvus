import { For, Match, Switch } from "solid-js"
import { boardStore, selectedTaskDirectory } from "../store/board"
import { openFileEditor } from "../services/file-workbench"
import { relativePathFrom, shortRelativePath } from "../utils/tool"
import { t } from "../utils/i18n"
import { Icon } from "./ui/Icon"
import { Tooltip } from "./ui/Tooltip"

export type ConversationSourcePart = {
  type: "source-url" | "source-document" | "source-file"
  sourceId: string
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
  if (source.title?.trim()) return source.title.trim()
  if (source.type === "source-url" && source.url) {
    try {
      return new URL(source.url).hostname.replace(/^www\./, "")
    } catch {
      return source.url
    }
  }
  if (source.type === "source-file" && source.path) return shortRelativePath(source.path, sourceDirectory())
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

async function openSourceFile(source: ConversationSourcePart): Promise<void> {
  const directory = sourceDirectory()
  const path = source.path?.trim() || ""
  if (!directory || !path) return
  await openFileEditor(relativePathFrom(directory, path) || path, { directory })
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

function SourceChip(props: { source: ConversationSourcePart; index: number }) {
  const label = () => sourceLabel(props.source)
  const detail = () => sourceDetail(props.source)
  const icon = () =>
    props.source.type === "source-url"
      ? "web-search"
      : props.source.type === "source-file"
        ? "file-document"
        : "channel-link"

  return (
    <Tooltip.Root openDelay={180} closeDelay={80} placement="top-start" gutter={7} fitViewport>
      <Switch>
        <Match when={props.source.type === "source-url" && props.source.url}>
          <Tooltip.Trigger
            as="a"
            class="msg-source-chip"
            href={props.source.url}
            data-browser-preview-url={props.source.url}
            aria-label={`${t("chat.source_open_web")}: ${label()}`}
          >
            <span class="msg-source-chip__index">{props.index + 1}</span>
            <Icon name={icon()} size="compact" />
            <span class="msg-source-chip__label">{label()}</span>
          </Tooltip.Trigger>
        </Match>
        <Match when={props.source.type === "source-file" && props.source.path}>
          <Tooltip.Trigger
            as="button"
            type="button"
            class="msg-source-chip"
            onClick={() => void openSourceFile(props.source)}
            aria-label={`${t("chat.source_open_file")}: ${detail()}`}
          >
            <span class="msg-source-chip__index">{props.index + 1}</span>
            <Icon name={icon()} size="compact" />
            <span class="msg-source-chip__label">{detail()}</span>
          </Tooltip.Trigger>
        </Match>
        <Match when={true}>
          <Tooltip.Trigger as="span" class="msg-source-chip" tabIndex={0} aria-label={label()}>
            <span class="msg-source-chip__index">{props.index + 1}</span>
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
  return (
    <section class="msg-sources" aria-label={t("chat.sources")} data-ui="message-sources">
      <div class="msg-sources__heading">
        <Icon name="channel-link" size="compact" />
        <span>{t("chat.sources")}</span>
        <span class="msg-sources__count">{props.sources.length}</span>
      </div>
      <div class="msg-sources__list">
        <For each={props.sources}>{(source, index) => <SourceChip source={source} index={index()} />}</For>
      </div>
    </section>
  )
}

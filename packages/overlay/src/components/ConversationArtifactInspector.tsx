import {
  ErrorBoundary,
  For,
  Match,
  Show,
  Switch,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  lazy,
  onCleanup,
} from "solid-js"
import type {
  TaskArtifactRef,
  TaskArtifactSnapshotIdentity,
  TaskArtifactSnapshotFile,
  TaskArtifactSnapshotManifest,
} from "@opencorvus-ai/plugin/task-artifact"
import type { InteractiveArtifactPayload } from "../services/interactive-artifact"
import {
  loadConversationArtifactContent,
  type ArtifactReadLocator,
  type ConversationArtifactContent,
} from "../services/conversation-artifact"
import { t } from "../utils/i18n"
import { ArtifactFrame } from "./interactive-artifact/ArtifactFrame"
import { CodeArtifact, type ArtifactCodeLanguage } from "./interactive-artifact/CodeArtifact"
import { DocumentArtifact } from "./interactive-artifact/DocumentArtifact"
import { MediaArtifact } from "./interactive-artifact/MediaArtifact"
import { Button } from "./ui/Button"
import { Icon } from "./ui/Icon"
import { SearchField } from "./ui/SearchField"

const FilePreviewArtifact = lazy(async () => ({
  default: (await import("./interactive-artifact/FilePreviewArtifact")).FilePreviewArtifact,
}))
const TreeArtifact = lazy(async () => ({
  default: (await import("./interactive-artifact/TreeArtifact")).TreeArtifact,
}))

type TreePayload = Extract<InteractiveArtifactPayload, { renderer: "tree@1" }>
type CodePayload = Extract<InteractiveArtifactPayload, { renderer: "code@1" }>
type DocumentPayload = Extract<InteractiveArtifactPayload, { renderer: "document@1" }>
type MediaPayload = Extract<InteractiveArtifactPayload, { renderer: "media@1" }>
type FilePreviewPayload = Extract<InteractiveArtifactPayload, { renderer: "file-preview@1" }>

type ResourceSelection = {
  tree: string
  file: TaskArtifactSnapshotFile
  locator: ArtifactReadLocator
}

type ArtifactContentRequest = {
  taskID: string
  locator: ArtifactReadLocator
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function jsonDescription(value: unknown): string | undefined {
  if (value === null) return "null"
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return undefined
}

function jsonTreePayload(title: string, value: unknown): TreePayload {
  const nodes: TreePayload["nodes"] = []
  let sequence = 0
  const visit = (label: string, current: unknown, parentID?: string): void => {
    const id = `json-${sequence++}`
    nodes.push({
      id,
      label,
      ...(parentID ? { parentID } : {}),
      ...(jsonDescription(current) ? { description: jsonDescription(current) } : {}),
    })
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(`[${index}]`, item, id))
      return
    }
    if (isRecord(current)) {
      for (const [key, item] of Object.entries(current)) visit(key, item, id)
    }
  }
  visit(title, value)
  return { schemaVersion: "1", renderer: "tree@1", title, nodes, defaultExpandedDepth: 2 }
}

function codeLanguage(mediaType: string): ArtifactCodeLanguage | undefined {
  const normalized = mediaType.toLowerCase()
  if (normalized === "text/css") return "css"
  if (normalized === "text/html") return "html"
  if (normalized === "text/javascript" || normalized === "application/javascript") return "javascript"
  if (normalized === "text/typescript" || normalized === "application/typescript") return "typescript"
  if (normalized === "text/x-python") return "python"
  if (normalized.startsWith("text/")) return "plaintext"
  return undefined
}

function createArtifactContentResource(source: () => ArtifactContentRequest | undefined) {
  let activeController: AbortController | undefined
  const resource = createResource(source, async (request) => {
    activeController?.abort()
    const controller = new AbortController()
    activeController = controller
    try {
      return await loadConversationArtifactContent({ ...request, signal: controller.signal })
    } finally {
      if (activeController === controller) activeController = undefined
    }
  })
  createEffect(() => {
    if (!source()) activeController?.abort()
  })
  onCleanup(() => activeController?.abort())
  return resource
}

function useObjectURL(content: () => ConversationArtifactContent): () => string {
  const [url, setURL] = createSignal("")
  createEffect(() => {
    const value = content()
    if (!value.bytes) {
      setURL("")
      return
    }
    const next = URL.createObjectURL(new Blob([value.bytes], { type: value.mediaType }))
    setURL(next)
    onCleanup(() => URL.revokeObjectURL(next))
  })
  return url
}

function ArtifactContentView(props: { title: string; content: ConversationArtifactContent }) {
  const parsedJSON = createMemo(() => {
    if (props.content.mediaType !== "application/json" || props.content.text === undefined) return undefined
    return JSON.parse(props.content.text) as unknown
  })
  const language = createMemo(() => codeLanguage(props.content.mediaType))
  const objectURL = useObjectURL(() => props.content)
  const filename = () => props.content.filename ?? props.title
  const sharedSource = () => ({
    url: objectURL(),
    mime: props.content.mediaType,
    sha: props.content.sha256,
    size: props.content.totalBytes,
    filename: filename(),
  })

  return (
    <div class="conversation-artifact-inspector__content">
      <div class="conversation-artifact-inspector__metadata">
        <span>{props.content.mediaType}</span>
        <span>{t("chat.artifacts.byte_count", { count: props.content.totalBytes })}</span>
        <code title={props.content.sha256}>sha256:{props.content.sha256.slice(0, 12)}</code>
      </div>
      <Switch>
        <Match when={parsedJSON() !== undefined}>
          <TreeArtifact payload={jsonTreePayload(props.title, parsedJSON())} />
        </Match>
        <Match when={props.content.mediaType === "text/markdown" && props.content.text !== undefined}>
          <DocumentArtifact
            payload={
              {
                schemaVersion: "1",
                renderer: "document@1",
                title: props.title,
                markdown: props.content.text!,
              } satisfies DocumentPayload
            }
          />
        </Match>
        <Match when={language() && props.content.text !== undefined}>
          <CodeArtifact
            payload={
              {
                schemaVersion: "1",
                renderer: "code@1",
                title: props.title,
                filename: filename(),
                language: language()!,
                source: props.content.text!,
              } satisfies CodePayload
            }
          />
        </Match>
        <Match when={props.content.mediaType.startsWith("image/") && props.content.bytes}>
          <MediaArtifact
            payload={
              {
                schemaVersion: "1",
                renderer: "media@1",
                title: props.title,
                kind: "image",
                alt: props.title,
                source: sharedSource(),
              } satisfies MediaPayload
            }
          />
        </Match>
        <Match when={props.content.mediaType.startsWith("audio/") && props.content.bytes}>
          <MediaArtifact
            payload={
              {
                schemaVersion: "1",
                renderer: "media@1",
                title: props.title,
                kind: "audio",
                alt: props.title,
                source: sharedSource(),
              } satisfies MediaPayload
            }
          />
        </Match>
        <Match when={props.content.mediaType.startsWith("video/") && props.content.bytes}>
          <MediaArtifact
            payload={
              {
                schemaVersion: "1",
                renderer: "media@1",
                title: props.title,
                kind: "video",
                alt: props.title,
                source: sharedSource(),
              } satisfies MediaPayload
            }
          />
        </Match>
        <Match when={props.content.mediaType === "application/pdf" && props.content.bytes}>
          <FilePreviewArtifact
            payload={
              {
                schemaVersion: "1",
                renderer: "file-preview@1",
                title: props.title,
                kind: "pdf",
                source: sharedSource(),
              } satisfies FilePreviewPayload
            }
          />
        </Match>
        <Match when={props.content.bytes}>
          <ArtifactFrame title={props.title} kind={t("chat.artifacts.binary_kind")} expandable={false}>
            <div class="conversation-artifact-inspector__binary">
              <span>{props.content.mediaType}</span>
              <span>{t("chat.artifacts.byte_count", { count: props.content.totalBytes })}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                tone="neutral"
                onClick={() => {
                  const anchor = document.createElement("a")
                  anchor.href = objectURL()
                  anchor.download = filename()
                  anchor.click()
                }}
              >
                {t("chat.artifacts.download")}
              </Button>
            </div>
          </ArtifactFrame>
        </Match>
      </Switch>
    </div>
  )
}

function SnapshotArtifactView(props: {
  taskID: string
  title: string
  locator: ArtifactReadLocator
  content: ConversationArtifactContent
  onContentChanged?: () => void
}) {
  const manifest = createMemo(() => JSON.parse(props.content.text ?? "") as TaskArtifactSnapshotManifest)
  const snapshot = createMemo(() => props.locator.snapshot as TaskArtifactSnapshotIdentity)
  const [query, setQuery] = createSignal("")
  const [selection, setSelection] = createSignal<ResourceSelection>()
  const resources = createMemo(() =>
    Object.entries(manifest().trees).flatMap(([tree, value]) =>
      value.files.map((file) => ({
        tree,
        file,
        locator: {
          source: "task_artifact_resource",
          ref: { snapshot: snapshot(), tree, ...file } satisfies TaskArtifactRef,
        },
      })),
    ),
  )
  const filteredResources = createMemo(() => {
    const value = query().trim().toLowerCase()
    return value
      ? resources().filter((resource) =>
          `${resource.tree}/${resource.file.path} ${resource.file.media_type}`.toLowerCase().includes(value),
        )
      : resources()
  })
  const [resourceContent] = createArtifactContentResource(() => {
    const selected = selection()
    return selected ? { taskID: props.taskID, locator: selected.locator } : undefined
  })

  createEffect(() => {
    void selection()
    void resourceContent()
    props.onContentChanged?.()
  })

  return (
    <ArtifactFrame title={props.title} kind={t("chat.artifacts.snapshot_kind")} expandable={false}>
      <div class="conversation-artifact-inspector__snapshot">
        <div class="conversation-artifact-inspector__metadata">
          <span>{props.content.mediaType}</span>
          <span>{t("chat.artifacts.byte_count", { count: props.content.totalBytes })}</span>
          <code title={props.content.sha256}>sha256:{props.content.sha256.slice(0, 12)}</code>
        </div>
        <div class="conversation-artifact-inspector__toolbar">
          <SearchField
            value={query()}
            size="sm"
            placeholder={t("chat.artifacts.search_resources")}
            onValueChange={setQuery}
            onClear={() => setQuery("")}
          />
          <span>{t("chat.artifacts.resource_total", { count: filteredResources().length })}</span>
        </div>
        <div class="conversation-artifact-inspector__resources">
          <For
            each={filteredResources()}
            fallback={<div class="conversation-artifact-summary__empty">{t("chat.artifacts.no_resources")}</div>}
          >
            {(resource) => (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                tone="neutral"
                class="conversation-artifact-inspector__resource"
                data-selected={selection()?.locator === resource.locator ? "true" : undefined}
                onClick={() => setSelection(resource)}
              >
                <Icon name="file-document" size="compact" />
                <span class="conversation-artifact-inspector__resource-copy">
                  <strong>{resource.file.path}</strong>
                  <span>
                    {resource.tree} · {resource.file.media_type}
                  </span>
                </span>
                <span>{t("chat.artifacts.byte_count", { count: resource.file.bytes })}</span>
              </Button>
            )}
          </For>
        </div>
        <Show when={resourceContent.loading}>
          <div class="conversation-artifact-inspector__status" role="status">
            {t("chat.artifacts.loading")}
          </div>
        </Show>
        <Show when={resourceContent.error}>
          <div class="conversation-artifact-inspector__status" role="alert">
            {String(resourceContent.error)}
          </div>
        </Show>
        <Show when={selection() && resourceContent()}>
          {(content) => <ArtifactContentView title={selection()!.file.path} content={content()} />}
        </Show>
      </div>
    </ArtifactFrame>
  )
}

export function ConversationArtifactInspector(props: {
  taskID: string
  title: string
  locator: ArtifactReadLocator
  onContentChanged?: () => void
}) {
  const [content] = createArtifactContentResource(() => ({ taskID: props.taskID, locator: props.locator }))

  createEffect(() => {
    void content()
    props.onContentChanged?.()
  })

  return (
    <ErrorBoundary
      fallback={(error) => (
        <div class="conversation-artifact-inspector__status" role="alert">
          {String(error)}
        </div>
      )}
    >
      <div class="conversation-artifact-inspector" data-ui="conversation-artifact-inspector">
        <Show when={content.loading}>
          <div class="conversation-artifact-inspector__status" role="status">
            {t("chat.artifacts.loading")}
          </div>
        </Show>
        <Show when={content.error}>
          <div class="conversation-artifact-inspector__status" role="alert">
            {String(content.error)}
          </div>
        </Show>
        <Show when={content()}>
          {(loaded) => (
            <Show
              when={props.locator.source === "task_artifact_snapshot"}
              fallback={<ArtifactContentView title={props.title} content={loaded()} />}
            >
              <SnapshotArtifactView
                taskID={props.taskID}
                title={props.title}
                locator={props.locator}
                content={loaded()}
                onContentChanged={props.onContentChanged}
              />
            </Show>
          )}
        </Show>
      </div>
    </ErrorBoundary>
  )
}

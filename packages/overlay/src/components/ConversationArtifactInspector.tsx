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
import {
  artifactReadLocatorKey,
  type ArtifactReadLocator as CanonicalArtifactReadLocator,
} from "@opencorvus-ai/plugin/artifact-read-locator-key"
import type { InteractiveArtifactPayload } from "../services/interactive-artifact"
import {
  loadConversationArtifactContent,
  type ArtifactReadLocator,
  type ConversationArtifactContent,
} from "../services/conversation-artifact"
import { t } from "../utils/i18n"
import { ArtifactFrame } from "./interactive-artifact/ArtifactFrame"
import type { ArtifactCodeLanguage } from "./interactive-artifact/CodeArtifact"
import { Button } from "./ui/Button"
import { Icon } from "./ui/Icon"
import { SearchField } from "./ui/SearchField"
import { captureApiAuthority } from "../services/api"
import { activeProjectDirectory } from "../services/project-directory"

// Loaded with the artifact the inspector is actually opening; keeping these
// static held CodeMirror and its grammars in the startup bundle.
const CodeArtifact = lazy(async () => ({
  default: (await import("./interactive-artifact/CodeArtifact")).CodeArtifact,
}))
const DocumentArtifact = lazy(async () => ({
  default: (await import("./interactive-artifact/DocumentArtifact")).DocumentArtifact,
}))
const MediaArtifact = lazy(async () => ({
  default: (await import("./interactive-artifact/MediaArtifact")).MediaArtifact,
}))
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
  title: string
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
  const request = createMemo(
    () => {
      const input = source()
      if (!input) return undefined
      const authority = captureApiAuthority()
      const locatorKey = artifactReadLocatorKey(input.locator as CanonicalArtifactReadLocator)
      return {
        key: JSON.stringify([authority.revision, activeProjectDirectory(), input.taskID, locatorKey, input.title]),
        input: { ...input, locator: JSON.parse(locatorKey) as ArtifactReadLocator },
        authority,
      }
    },
    undefined,
    { equals: (previous, current) => previous?.key === current?.key },
  )
  let activeController: AbortController | undefined
  const [resource] = createResource(request, async (current) => {
    activeController?.abort()
    const controller = new AbortController()
    activeController = controller
    try {
      const content = await loadConversationArtifactContent({
        taskID: current.input.taskID,
        locator: current.input.locator,
        authority: current.authority,
        signal: controller.signal,
      })
      return { request: current, content }
    } finally {
      if (activeController === controller) activeController = undefined
    }
  })
  const ready = createMemo(() => {
    const current = request()
    if (!current || resource.loading || resource.error) return undefined
    const resolved = resource()
    return resolved?.request.key === current.key ? resolved : undefined
  })
  const error = createMemo(() => (request() && !resource.loading ? resource.error : undefined))
  createEffect(() => {
    if (!request()) activeController?.abort()
  })
  onCleanup(() => activeController?.abort())
  return [resource, ready, error] as const
}

function useObjectURL(content: () => ConversationArtifactContent): () => string {
  const [url, setURL] = createSignal("")
  createEffect(() => {
    const value = content()
    if (!value.bytes) {
      setURL("")
      return
    }
    const next = URL.createObjectURL(new Blob([new Uint8Array(value.bytes).buffer], { type: value.mediaType }))
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
  const originalTextExport = () => [{ filename: filename(), mime: props.content.mediaType, text: props.content.text! }]
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
          <TreeArtifact payload={jsonTreePayload(props.title, parsedJSON())} exportFiles={originalTextExport} />
        </Match>
        <Match when={props.content.mediaType === "text/markdown" && props.content.text !== undefined}>
          <DocumentArtifact
            exportFiles={originalTextExport}
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
  const [resourceContent, readyResource, resourceError] = createArtifactContentResource(() => {
    const selected = selection()
    return selected ? { taskID: props.taskID, title: selected.file.path, locator: selected.locator } : undefined
  })

  createEffect(() => {
    void selection()
    void readyResource()
    void resourceContent.loading
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
        <Show when={resourceError()}>
          <div class="conversation-artifact-inspector__status" role="alert">
            {String(resourceError())}
          </div>
        </Show>
        <Show when={readyResource()} keyed>
          {(resolved) => <ArtifactContentView title={resolved.request.input.title} content={resolved.content} />}
        </Show>
      </div>
    </ArtifactFrame>
  )
}

type ArtifactInspectorProps = {
  taskID: string
  title: string
  locator: ArtifactReadLocator
  onContentChanged?: () => void
}

function ArtifactInspectorContent(props: ArtifactInspectorProps) {
  const [content, ready, error] = createArtifactContentResource(() => ({
    taskID: props.taskID,
    title: props.title,
    locator: props.locator,
  }))

  createEffect(() => {
    void ready()
    void content.loading
    props.onContentChanged?.()
  })

  return (
    <div class="conversation-artifact-inspector" data-ui="conversation-artifact-inspector">
      <Show when={content.loading}>
        <div class="conversation-artifact-inspector__status" role="status">
          {t("chat.artifacts.loading")}
        </div>
      </Show>
      <Show when={error()}>
        <div class="conversation-artifact-inspector__status" role="alert">
          {String(error())}
        </div>
      </Show>
      <Show when={ready()} keyed>
        {(loaded) => (
          <Show
            when={loaded.request.input.locator.source === "task_artifact_snapshot"}
            fallback={<ArtifactContentView title={loaded.request.input.title} content={loaded.content} />}
          >
            <SnapshotArtifactView
              taskID={loaded.request.input.taskID}
              title={loaded.request.input.title}
              locator={loaded.request.input.locator}
              content={loaded.content}
              onContentChanged={props.onContentChanged}
            />
          </Show>
        )}
      </Show>
    </div>
  )
}

export function ConversationArtifactInspector(props: ArtifactInspectorProps) {
  return (
    <ErrorBoundary
      fallback={(error) => (
        <div class="conversation-artifact-inspector__status" role="alert">
          {String(error)}
        </div>
      )}
    >
      <ArtifactInspectorContent {...props} />
    </ErrorBoundary>
  )
}

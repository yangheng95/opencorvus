import { Match, Show, Switch, createMemo, createResource, lazy } from "solid-js"
import { parseConversationInteractiveArtifactMessagePart } from "@opencorvus-ai/transport-protocol"
import { activeProjectDirectory } from "../services/project-directory"
import { loadSessionInteractiveArtifact, type InteractiveArtifactPayload } from "../services/interactive-artifact"
import { t } from "../utils/i18n"
// Every renderer here loads on the first artifact that needs it. These seven
// used to be static, which put CodeMirror and its Lezer grammars (via the code
// and notebook renderers), the candlestick charting library, and the table core
// into the startup bundle of a window that may never show an artifact at all.
const DocumentArtifact = lazy(async () => ({
  default: (await import("./interactive-artifact/DocumentArtifact")).DocumentArtifact,
}))
const TableArtifact = lazy(async () => ({
  default: (await import("./interactive-artifact/TableArtifact")).TableArtifact,
}))
const CandlestickArtifact = lazy(async () => ({
  default: (await import("./interactive-artifact/CandlestickArtifact")).CandlestickArtifact,
}))
const McpAppArtifact = lazy(async () => ({
  default: (await import("./interactive-artifact/McpAppArtifact")).McpAppArtifact,
}))
const CodeArtifact = lazy(async () => ({
  default: (await import("./interactive-artifact/CodeArtifact")).CodeArtifact,
}))
const MediaArtifact = lazy(async () => ({
  default: (await import("./interactive-artifact/MediaArtifact")).MediaArtifact,
}))
const NotebookArtifact = lazy(async () => ({
  default: (await import("./interactive-artifact/NotebookArtifact")).NotebookArtifact,
}))
const ChartArtifact = lazy(async () => ({
  default: (await import("./interactive-artifact/ChartArtifact")).ChartArtifact,
}))
const DiagramArtifact = lazy(async () => ({
  default: (await import("./interactive-artifact/DiagramArtifact")).DiagramArtifact,
}))
const DiffArtifact = lazy(async () => ({ default: (await import("./interactive-artifact/DiffArtifact")).DiffArtifact }))
const FilePreviewArtifact = lazy(async () => ({
  default: (await import("./interactive-artifact/FilePreviewArtifact")).FilePreviewArtifact,
}))
const MapArtifact = lazy(async () => ({ default: (await import("./interactive-artifact/MapArtifact")).MapArtifact }))
const PresentationArtifact = lazy(async () => ({
  default: (await import("./interactive-artifact/PresentationArtifact")).PresentationArtifact,
}))
const SpreadsheetArtifact = lazy(async () => ({
  default: (await import("./interactive-artifact/SpreadsheetArtifact")).SpreadsheetArtifact,
}))
const DashboardArtifact = lazy(async () => ({
  default: (await import("./interactive-artifact/DashboardArtifact")).DashboardArtifact,
}))
const TimelineArtifact = lazy(async () => ({
  default: (await import("./interactive-artifact/TimelineArtifact")).TimelineArtifact,
}))
const NetworkArtifact = lazy(async () => ({
  default: (await import("./interactive-artifact/NetworkArtifact")).NetworkArtifact,
}))
const TreeArtifact = lazy(async () => ({
  default: (await import("./interactive-artifact/TreeArtifact")).TreeArtifact,
}))
const TerminalArtifact = lazy(async () => ({
  default: (await import("./interactive-artifact/TerminalArtifact")).TerminalArtifact,
}))
const Model3dArtifact = lazy(async () => ({
  default: (await import("./interactive-artifact/Model3dArtifact")).Model3dArtifact,
}))

type DocumentPayload = Extract<InteractiveArtifactPayload, { renderer: "document@1" }>
type TablePayload = Extract<InteractiveArtifactPayload, { renderer: "table@1" }>
type ChartPayload = Extract<InteractiveArtifactPayload, { renderer: "chart@1" }>
type DiagramPayload = Extract<InteractiveArtifactPayload, { renderer: "diagram@1" }>
type CodePayload = Extract<InteractiveArtifactPayload, { renderer: "code@1" }>
type DiffPayload = Extract<InteractiveArtifactPayload, { renderer: "diff@1" }>
type CandlestickPayload = Extract<InteractiveArtifactPayload, { renderer: "candlestick@1" }>
type MediaPayload = Extract<InteractiveArtifactPayload, { renderer: "media@1" }>
type FilePreviewPayload = Extract<InteractiveArtifactPayload, { renderer: "file-preview@1" }>
type MapPayload = Extract<InteractiveArtifactPayload, { renderer: "map@1" }>
type NotebookPayload = Extract<InteractiveArtifactPayload, { renderer: "notebook@1" }>
type PresentationPayload = Extract<InteractiveArtifactPayload, { renderer: "presentation@1" }>
type SpreadsheetPayload = Extract<InteractiveArtifactPayload, { renderer: "spreadsheet@1" }>
type DashboardPayload = Extract<InteractiveArtifactPayload, { renderer: "dashboard@1" }>
type TimelinePayload = Extract<InteractiveArtifactPayload, { renderer: "timeline@1" }>
type NetworkPayload = Extract<InteractiveArtifactPayload, { renderer: "network@1" }>
type TreePayload = Extract<InteractiveArtifactPayload, { renderer: "tree@1" }>
type TerminalPayload = Extract<InteractiveArtifactPayload, { renderer: "terminal@1" }>
type Model3dPayload = Extract<InteractiveArtifactPayload, { renderer: "model-3d@1" }>
type McpAppPayload = Extract<InteractiveArtifactPayload, { renderer: "mcp-app@1" }>

export function InteractiveArtifactPart(props: { part: unknown }) {
  const reference = createMemo(() => parseConversationInteractiveArtifactMessagePart(props.part))
  const source = createMemo(
    () => {
      const sessionID = String((props.part as { sessionID?: unknown })?.sessionID || "").trim()
      const directory = activeProjectDirectory().trim()
      if (!sessionID || !directory) return undefined
      return { sessionID, directory, artifactID: reference().artifactID }
    },
    undefined,
    {
      equals: (previous, current) =>
        previous?.sessionID === current?.sessionID &&
        previous?.directory === current?.directory &&
        previous?.artifactID === current?.artifactID,
    },
  )
  const [artifact] = createResource(source, loadSessionInteractiveArtifact)

  return (
    <Show
      when={source()}
      fallback={<div class="msg-artifact-state msg-tool-error">{t("artifact.scope_required")}</div>}
    >
      <Show
        when={!artifact.loading}
        fallback={
          <div class="msg-artifact-state" role="status">
            {t("artifact.loading")}
          </div>
        }
      >
        <Show
          when={!artifact.error && artifact()}
          fallback={
            <div class="msg-artifact-state msg-tool-error" role="alert">
              {t("artifact.load_failed")}
            </div>
          }
        >
          {(record) => (
            <Switch
              fallback={
                <div class="msg-artifact-state msg-tool-error" role="alert">
                  {t("artifact.renderer_unsupported")}
                </div>
              }
            >
              <Match when={record().payload.renderer === "document@1"}>
                <DocumentArtifact payload={record().payload as DocumentPayload} />
              </Match>
              <Match when={record().payload.renderer === "table@1"}>
                <TableArtifact payload={record().payload as TablePayload} />
              </Match>
              <Match when={record().payload.renderer === "chart@1"}>
                <ChartArtifact payload={record().payload as ChartPayload} />
              </Match>
              <Match when={record().payload.renderer === "diagram@1"}>
                <DiagramArtifact payload={record().payload as DiagramPayload} />
              </Match>
              <Match when={record().payload.renderer === "code@1"}>
                <CodeArtifact payload={record().payload as CodePayload} />
              </Match>
              <Match when={record().payload.renderer === "diff@1"}>
                <DiffArtifact payload={record().payload as DiffPayload} />
              </Match>
              <Match when={record().payload.renderer === "candlestick@1"}>
                <CandlestickArtifact payload={record().payload as CandlestickPayload} />
              </Match>
              <Match when={record().payload.renderer === "media@1"}>
                <MediaArtifact payload={record().payload as MediaPayload} />
              </Match>
              <Match when={record().payload.renderer === "file-preview@1"}>
                <FilePreviewArtifact payload={record().payload as FilePreviewPayload} />
              </Match>
              <Match when={record().payload.renderer === "map@1"}>
                <MapArtifact payload={record().payload as MapPayload} />
              </Match>
              <Match when={record().payload.renderer === "notebook@1"}>
                <NotebookArtifact payload={record().payload as NotebookPayload} />
              </Match>
              <Match when={record().payload.renderer === "presentation@1"}>
                <PresentationArtifact payload={record().payload as PresentationPayload} />
              </Match>
              <Match when={record().payload.renderer === "spreadsheet@1"}>
                <SpreadsheetArtifact payload={record().payload as SpreadsheetPayload} />
              </Match>
              <Match when={record().payload.renderer === "dashboard@1"}>
                <DashboardArtifact payload={record().payload as DashboardPayload} />
              </Match>
              <Match when={record().payload.renderer === "timeline@1"}>
                <TimelineArtifact payload={record().payload as TimelinePayload} />
              </Match>
              <Match when={record().payload.renderer === "network@1"}>
                <NetworkArtifact payload={record().payload as NetworkPayload} />
              </Match>
              <Match when={record().payload.renderer === "tree@1"}>
                <TreeArtifact payload={record().payload as TreePayload} />
              </Match>
              <Match when={record().payload.renderer === "terminal@1"}>
                <TerminalArtifact payload={record().payload as TerminalPayload} />
              </Match>
              <Match when={record().payload.renderer === "model-3d@1"}>
                <Model3dArtifact payload={record().payload as Model3dPayload} />
              </Match>
              <Match when={record().payload.renderer === "mcp-app@1"}>
                <McpAppArtifact
                  payload={record().payload as McpAppPayload}
                  sessionID={record().sessionID}
                  artifactID={record().id}
                  directory={source()!.directory}
                />
              </Match>
            </Switch>
          )}
        </Show>
      </Show>
    </Show>
  )
}

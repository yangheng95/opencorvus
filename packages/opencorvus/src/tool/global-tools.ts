import type { Tool } from "./tool"
import { Flag } from "@/flag/flag"
import { BATCH_TOOL_ID } from "./tool-id-catalog"
import { requireControlPlaneToolLoaders } from "./control-plane-tool-provider"
import { isSkillFamilyToolID } from "./skill"

export type BuiltInToolProviderState = "available" | "deferred" | "unavailable"

export interface BuiltInToolProviderEnvironment {
  batchToolEnabled: boolean
}

export function builtInToolProviderState(
  toolID: string,
  environment: BuiltInToolProviderEnvironment,
): BuiltInToolProviderState {
  if (isSkillFamilyToolID(toolID)) return "deferred"
  if (toolID === BATCH_TOOL_ID) return environment.batchToolEnabled ? "available" : "unavailable"
  if (toolID === "question") {
    return ["app", "cli", "desktop"].includes(Flag.OPENCORVUS_CLIENT) || Flag.OPENCORVUS_ENABLE_QUESTION_TOOL
      ? "available"
      : "unavailable"
  }
  if (toolID === "lsp") return Flag.OPENCORVUS_EXPERIMENTAL_LSP_TOOL ? "available" : "unavailable"
  return "available"
}

export function assertBuiltInToolProviderClosure(
  toolIDs: Iterable<string>,
  environment: BuiltInToolProviderEnvironment,
  context: string,
): void {
  const ids = new Set(toolIDs)
  if (!ids.has(BATCH_TOOL_ID)) return
  const targetCount = [...ids].filter(
    (toolID) => toolID !== BATCH_TOOL_ID && builtInToolProviderState(toolID, environment) === "available",
  ).length
  if (targetCount === 0) {
    throw new Error(`${context} cannot project batch without at least one materialized registry target tool`)
  }
}

let builtInGlobalToolLoad: Promise<readonly Tool.Info[]> | undefined

async function loadBuiltInGlobalTools(): Promise<readonly Tool.Info[]> {
  const controlPlaneToolLoaders = requireControlPlaneToolLoaders()
  const [
    { DelegateAgentTool },
    { QuestionTool },
    { BashTool },
    { BrowserPreviewTool },
    { BrowserPreviewCaptureTool },
    { BrowserPreviewCaptureInteractionStateTool },
    { ReadTool },
    { GlobTool },
    { SearchCodeTool },
    { ListTool },
    { EditTool },
    { WriteTool },
    { WebFetchTool },
    { TodoWriteTool, TodoReadTool },
    { WebSearchTool },
    { ExternalCodeSearchTool },
    { MissionSkillTool, SkillTool },
    { ApplyPatchTool },
    { MemoryTool },
    { PlannerTool },
    { MissionStateTool },
    { AnalyticsTool },
    { LspTool },
    { PublishInteractiveArtifactTool },
    { OfficeArtifactInspectTool, OfficeArtifactAuthorTool, OfficeArtifactValidateTool, OfficeArtifactDeliverTool },
    { ArtifactSearchTool, ArtifactReadTool, ArtifactSelectTool, ArtifactSnapshotTool, ArtifactPublishTool },
    { ExpertSquadAuthorTool },
    { CapabilitySearchTool },
  ] = await Promise.all([
    import("./delegate-agent"),
    import("./question"),
    import("./bash"),
    import("./browser-preview"),
    import("./browser-preview-capture"),
    import("./browser-preview-capture-interaction-state"),
    import("./read"),
    import("./glob"),
    import("./grep"),
    import("./ls"),
    import("./edit"),
    import("./write"),
    import("./webfetch"),
    import("./todo"),
    import("./websearch"),
    import("./codesearch"),
    import("./skill"),
    import("./apply_patch"),
    import("./memory"),
    import("./planner"),
    import("./mission-state"),
    import("./analytics"),
    import("./lsp"),
    import("./publish-interactive-artifact"),
    import("./office-artifact"),
    import("./artifact-catalog"),
    import("./expert-squad-author"),
    import("./capability-search"),
  ])
  const [ScheduleTool, PanelTool, WaitTool, RequestOrchestratorDecisionTool, SendMailboxMessageTool] =
    await Promise.all([
      controlPlaneToolLoaders.schedule(),
      controlPlaneToolLoaders.panel(),
      controlPlaneToolLoaders.wait(),
      controlPlaneToolLoaders.requestOrchestratorDecision(),
      controlPlaneToolLoaders.sendMailboxMessage(),
    ])

  return Object.freeze([
    DelegateAgentTool,
    QuestionTool,
    BashTool,
    BrowserPreviewTool,
    BrowserPreviewCaptureTool,
    BrowserPreviewCaptureInteractionStateTool,
    ReadTool,
    GlobTool,
    SearchCodeTool,
    ListTool,
    EditTool,
    WriteTool,
    WebFetchTool,
    TodoWriteTool,
    TodoReadTool,
    WebSearchTool,
    ExternalCodeSearchTool,
    SkillTool,
    MissionSkillTool,
    ApplyPatchTool,
    MemoryTool,
    ScheduleTool,
    PlannerTool,
    PanelTool,
    MissionStateTool,
    WaitTool,
    RequestOrchestratorDecisionTool,
    SendMailboxMessageTool,
    AnalyticsTool,
    ArtifactSearchTool,
    ArtifactReadTool,
    ArtifactSelectTool,
    ArtifactSnapshotTool,
    ArtifactPublishTool,
    ExpertSquadAuthorTool,
    CapabilitySearchTool,
    PublishInteractiveArtifactTool,
    OfficeArtifactInspectTool,
    OfficeArtifactAuthorTool,
    OfficeArtifactValidateTool,
    OfficeArtifactDeliverTool,
    LspTool,
  ])
}

export async function builtInGlobalTools(): Promise<readonly Tool.Info[]> {
  builtInGlobalToolLoad ??= loadBuiltInGlobalTools()
  return builtInGlobalToolLoad
}

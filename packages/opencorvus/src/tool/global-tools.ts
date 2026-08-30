import type { Tool } from "./tool"
import { Flag } from "@/flag/flag"
import { requireControlPlaneToolLoaders } from "./control-plane-tool-provider"
import { isSkillFamilyToolID } from "./skill"

export type BuiltInToolProviderState = "available" | "deferred" | "unavailable"

export interface BuiltInToolProviderEnvironment {}

export function builtInToolProviderState(
  toolID: string,
  _environment: BuiltInToolProviderEnvironment,
): BuiltInToolProviderState {
  if (isSkillFamilyToolID(toolID)) return "deferred"
  if (toolID === "question") {
    return ["app", "cli", "desktop"].includes(Flag.OPENCORVUS_CLIENT) || Flag.OPENCORVUS_ENABLE_QUESTION_TOOL
      ? "available"
      : "unavailable"
  }
  return "available"
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
    { SchedulerMessageTool },
    { AnalyticsTool },
    { PublishInteractiveArtifactTool },
    { WorkArtifactInspectTool, WorkArtifactAuthorTool, WorkArtifactValidateTool, WorkArtifactDeliverTool },
    { ArtifactSearchTool, ArtifactReadTool, ArtifactSelectTool, ArtifactSnapshotTool, ArtifactPublishTool },
    { ExpertSquadAuthorTool },
    { CapabilitySearchTool },
    { SkillMarketTool },
    { PanelLeafTools },
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
    import("./scheduler-message"),
    import("./analytics"),
    import("./publish-interactive-artifact"),
    import("./work-artifact"),
    import("./artifact-catalog"),
    import("./expert-squad-author"),
    import("./capability-search"),
    import("./skill-market"),
    import("./panel"),
  ])
  const [ScheduleTool, WaitTool, RequestOrchestratorDecisionTool, SendMailboxMessageTool] =
    await Promise.all([
      controlPlaneToolLoaders.schedule(),
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
    ...PanelLeafTools,
    MissionStateTool,
    SchedulerMessageTool,
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
    SkillMarketTool,
    PublishInteractiveArtifactTool,
    WorkArtifactInspectTool,
    WorkArtifactAuthorTool,
    WorkArtifactValidateTool,
    WorkArtifactDeliverTool,
  ])
}

export async function builtInGlobalTools(): Promise<readonly Tool.Info[]> {
  builtInGlobalToolLoad ??= loadBuiltInGlobalTools()
  return builtInGlobalToolLoad
}

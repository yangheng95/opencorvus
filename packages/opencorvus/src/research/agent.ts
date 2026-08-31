import fs from "node:fs/promises"
import path from "node:path"
import { createAiSdkToolFromInfo } from "@/tool/ai-sdk-adapter"
import { agentCoordinationHandoffResult, runAgentSession, type AgentCoordinationHandoffResult } from "@/agent/runner"
import { renderPromptSections } from "@/agent/prompt-projection"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import type { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { Instance } from "@/project/instance"
import { taskPrimaryProjectRoot } from "@/project/task-runtime-root"
import { requireTask } from "@/engine/store"
import { Log } from "@/util/log"
import { DispatchAdapterContractRegistry } from "@/agent/dispatch-adapter-contract"
import { Session } from "@/session"
import { renderUserRequestSection } from "@/intent/request-prompt"
import type { FactCheckItem } from "@/fact-check/schema"
import { clarificationTranscriptSection } from "@/engine/helpers"
import { WebpageCompileTool, WebpageExtractTool, WebpageRuntimeStateTool } from "@/frontend-design/tools"
import {
  buildResearchBriefFromDraft,
  createResearchOutputTools,
  researchBundleFromDraft,
  type ResearchCollector,
  type ResearchToolCallReplay,
} from "./output-tools"
import {
  RESEARCH_VOLATILE_STALE_AFTER_MS,
  researchRequestHash,
  type ResearchBrief,
  type ResearchBundle,
} from "./schema"
import { researchRequestHashInput } from "./staleness"
import {
  publishFrontendResearchArtifactResources,
  type FrontendResearchArtifactResourcePublication,
} from "./frontend-research-resources"

const log = Log.create({ service: "deep-research-agent" })
export type ResearchLikeAgentKind = "deep-research" | "frontend-research"

export interface ResearchSessionConfig {
  kind: ResearchLikeAgentKind
  sessionTitlePrefix: string
  bundlePathKind: "deep-research" | "frontend-research"
  retrievalTools: "readonly" | "none"
  delegation: string
}

export namespace DeepResearchAgent {
  export interface RunInput {
    title: string
    request: string
    targetDeliverable?: "prd" | "spec" | "research_report" | "implementation_input" | "mixed"
    sourceUrls?: string[]
    focus?: string
    reason?: string
    contextSections?: string[]
    agentID: string
    packageRevision: PromptProfileResolver.ResolvedPackageRevision
    taskID: string
    workScope: import("@/agent/projected-agent-work-scope").ProjectedAgentWorkScope
    parentSessionID?: string
    newSessionID?: string
    existingSessionID?: string
    continuationPrompt?: string
    dispatchTurn?: import("@/orchestrator/dispatch-turn-projection").DispatchTurn
    model?: { providerID: string; modelID: string }
    signal?: AbortSignal
    onStatus?: (summary: string) => void | Promise<void>
    onSessionCreated?: (sessionID: string) => void | Promise<void>
    onDispatchAuthorityCommit?: import("@/agent/runner").AgentDispatchAuthorityCommit
    onRuntimeReady?: (sessionID: string) => void | Promise<void>
  }

  export interface RunResult {
    outcome: "complete"
    brief: ResearchBrief
    bundle: ResearchBundle
    factCheckItems: FactCheckItem[]
    sessionID: string
    artifactResources?: FrontendResearchArtifactResourcePublication
  }

  export interface IncompleteRunResult {
    outcome: "incomplete"
    sessionID: string
    finalMessageID: string
    missing: string[]
    error?: string
    partialDraft: import("./output-tools").ResearchPartialDraft
  }

  export async function run(
    input: RunInput,
  ): Promise<RunResult | IncompleteRunResult | AgentCoordinationHandoffResult> {
    return runResearchSession(input, {
      kind: "deep-research",
      sessionTitlePrefix: "Deep Research",
      bundlePathKind: "deep-research",
      retrievalTools: "readonly",
      delegation:
        "Gather durable multi-source evidence and prepare PRD/SPEC/report input material. " +
        "Return source-backed evidence, problem statements, user needs, constraints, document outline, and open questions only. " +
        "Do not produce final REQ-N, acceptance specs, goal graph, implementation plan, or next-tool routing instructions.",
    })
  }
}

export async function runResearchSession(
  input: DeepResearchAgent.RunInput,
  config: ResearchSessionConfig,
): Promise<DeepResearchAgent.RunResult | DeepResearchAgent.IncompleteRunResult | AgentCoordinationHandoffResult> {
  const sessionTitle = `${input.agentID} (${config.sessionTitlePrefix}): ${input.title}`
  const expectedWebpageSourceUrl = config.kind === "frontend-research" ? input.sourceUrls?.[0] : undefined
  const outputToolKit = createResearchOutputTools({ expectedWebpageSourceUrl })
  const materializeExact = async (toolID: string) =>
    outputToolKit.materializeExact(toolID) ??
    (config.kind === "frontend-research"
      ? createResearchWebpageEvidenceToolExact(toolID, input.agentID, {
          taskID: input.taskID,
          signal: input.signal,
        })
      : undefined)
  log.info(`${config.kind} starting`, {
    title: input.title,
    targetDeliverable: input.targetDeliverable,
    hasFocus: Boolean(input.focus?.trim()),
  })

  const out = await runAgentSession<ResearchCollector>({
    agentID: input.agentID,
    packageRevision: input.packageRevision,
    sessionTitle,
    newSessionID: input.newSessionID,
    existingSessionID: input.existingSessionID,
    continuationPrompt: input.continuationPrompt,
    dispatchTurn: input.dispatchTurn,
    parentSessionID: input.parentSessionID,
    taskID: input.taskID,
    workScope: input.workScope,
    model: input.model,
    signal: input.signal,
    onStatus: input.onStatus,
    onSessionCreated: async (session) => {
      await input.onSessionCreated?.(session.id)
    },
    onDispatchAuthorityCommit: input.onDispatchAuthorityCommit
      ? (session, descriptor) => input.onDispatchAuthorityCommit!(session.id, descriptor)
      : undefined,
    onRuntimeReady: input.onRuntimeReady ? (session) => input.onRuntimeReady!(session.id) : undefined,
    toolKit: {
      stageOwnedToolIDs: DispatchAdapterContractRegistry.privateStageToolIDs(
        config.kind === "frontend-research" ? "frontend_research" : "deep_research",
      ),
      materializeExact,
      getCollector: () => outputToolKit.getCollector(),
    },
    buildUserPrompt: () => buildUserPrompt(input, config),
  })

  const coordinationHandoff = agentCoordinationHandoffResult(out)
  if (coordinationHandoff) return coordinationHandoff

  const collector = out.collector
  const snapshot = outputToolKit.snapshotDraft()
  if (!snapshot.ok) {
    return {
      outcome: "incomplete",
      sessionID: out.session.id,
      finalMessageID: out.finalMessage.info.id,
      missing: snapshot.missing,
      partialDraft: snapshot.draft,
      ...(snapshot.error ? { error: snapshot.error } : {}),
    }
  }

  const bundle = researchBundleFromDraft(snapshot.draft)
  const bundlePaths = await writeResearchBundle({
    taskID: input.taskID,
    sessionID: out.session.id,
    bundle,
    kind: config.bundlePathKind,
  })
  const createdAt = new Date()
  const requestHashInput = researchRequestHashInput({
    request: input.request,
    clarificationTranscript: input.taskID ? clarificationTranscriptSection(input.taskID) : undefined,
  })
  const brief = buildResearchBriefFromDraft({
    draft: snapshot.draft,
    metadata: {
      research_session_id: out.session.id,
      created_for_message_id: out.finalMessage.info.id,
      request_hash: researchRequestHash(requestHashInput),
      created_at: createdAt.toISOString(),
      stale_after: snapshot.draft.evidence_index.some((item) => item.volatile)
        ? new Date(createdAt.getTime() + RESEARCH_VOLATILE_STALE_AFTER_MS).toISOString()
        : undefined,
    },
    bundlePaths,
  })
  const factCheckItems: FactCheckItem[] = []
  const artifactResources =
    config.kind === "frontend-research"
      ? await publishFrontendResearchArtifactResources({
          projectID: requireTask(input.taskID).project_id,
          projectDirectory: researchTaskProjectRoot(input.taskID),
          taskID: input.taskID,
          sessionID: out.session.id,
          brief,
        })
      : undefined

  log.info(`${config.kind} finished`, {
    sessionID: out.session.id,
    sources: brief.evidence_index.length,
    facts: brief.facts.length,
    blockingOpenQuestions: brief.open_questions.filter((item) => item.blocking).length,
  })

  return {
    outcome: "complete",
    brief,
    bundle,
    factCheckItems,
    sessionID: out.session.id,
    ...(artifactResources ? { artifactResources } : {}),
  }
}

async function completedResearchOutputToolCalls(sessionID: string): Promise<ResearchToolCallReplay[]> {
  const messages = await Session.messages({ sessionID })
  const calls: ResearchToolCallReplay[] = []
  for (const message of messages) {
    if (message.info.role !== "assistant") continue
    for (const part of message.parts) {
      if (part.type !== "tool") continue
      if (part.state.status !== "completed") continue
      calls.push({ toolName: part.tool, input: part.state.input })
    }
  }
  return calls
}

export async function createResearchWebpageEvidenceToolExact(
  toolID: string,
  agentID: string,
  input: { taskID?: string; signal?: AbortSignal },
) {
  const info = [WebpageExtractTool, WebpageCompileTool, WebpageRuntimeStateTool].find(
    (candidate) => candidate.id === toolID,
  )
  return info
    ? createAiSdkToolFromInfo({ info, agent: agentID, taskID: input.taskID, signal: input.signal })
    : undefined
}

function buildUserPrompt(input: DeepResearchAgent.RunInput, config: ResearchSessionConfig): string {
  const sections: string[] = []
  sections.push(
    `# Delegation\n\nProjected agent "${input.agentID}" is asked through the ${config.kind} adapter. ${config.delegation}`,
  )
  sections.push(
    renderUserRequestSection({
      heading: "# Task",
      title: input.title,
      request: input.request,
      taskID: input.taskID,
    }),
  )
  if (input.reason?.trim()) sections.push(`# Why Research Was Requested\n\n${input.reason.trim()}`)
  if (input.targetDeliverable) sections.push(`# Target Deliverable\n\n${input.targetDeliverable}`)
  if (input.sourceUrls && input.sourceUrls.length > 0) {
    sections.push(`# Source URLs\n\n${input.sourceUrls.map((url) => `- ${url}`).join("\n")}`)
  }
  const contextSection = renderPromptSections(input.contextSections)
  if (contextSection) sections.push(contextSection)
  if (input.focus?.trim()) sections.push(`# Focus\n\n${input.focus.trim()}`)
  sections.push(
    "# Output Boundary\n\n" +
      "Build the research brief through small `update_*` fact tools. Use `inspect_research_result_status` to see missing fragments, then keep recording facts or leave the gaps visible. The Host snapshots the collected facts after the turn; no finalizer tool exists. " +
      "Never write `NEXT: call ...`, never recommend `publish_acceptance`, and never tell the orchestrator which tool must run next.",
  )
  return sections.join("\n\n")
}

async function writeResearchBundle(input: {
  taskID?: string
  sessionID: string
  bundle: ResearchBundle
  kind: ResearchSessionConfig["bundlePathKind"]
}): Promise<ResearchBrief["bundle"]> {
  if (!input.taskID) {
    throw new Error("research bundle persistence requires taskID")
  }
  const projectDir = researchTaskProjectRoot(input.taskID)
  const paths =
    input.kind === "frontend-research"
      ? ProjectRuntimePaths.frontendResearchPaths(projectDir, input.taskID, input.sessionID)
      : ProjectRuntimePaths.deepResearchPaths(projectDir, input.taskID, input.sessionID)
  await fs.mkdir(paths.absoluteDir, { recursive: true })
  await Promise.all([
    fs.writeFile(paths.fullMarkdownAbsolute, input.bundle.full_markdown, "utf8"),
    fs.writeFile(paths.evidenceJsonAbsolute, input.bundle.evidence_json, "utf8"),
    fs.writeFile(paths.citationMapAbsolute, input.bundle.citation_map_json, "utf8"),
  ])
  return {
    full_markdown_path: path.relative(projectDir, paths.fullMarkdownAbsolute).replaceAll("\\", "/"),
    evidence_json_path: path.relative(projectDir, paths.evidenceJsonAbsolute).replaceAll("\\", "/"),
    citation_map_path: path.relative(projectDir, paths.citationMapAbsolute).replaceAll("\\", "/"),
  }
}

function researchTaskProjectRoot(taskID: string): string {
  return taskPrimaryProjectRoot(taskID, { activeProjectID: Instance.project.id })
}

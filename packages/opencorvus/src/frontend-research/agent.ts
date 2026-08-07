import { DeepResearchAgent, runResearchSession, type ResearchSessionConfig } from "@/research/agent"
import type { AgentCoordinationHandoffResult } from "@/agent/runner"

export namespace FrontendResearchAgent {
  export type RunInput = DeepResearchAgent.RunInput
  export type RunResult = DeepResearchAgent.RunResult
  export type IncompleteRunResult = DeepResearchAgent.IncompleteRunResult

  export async function run(
    input: RunInput,
  ): Promise<RunResult | IncompleteRunResult | AgentCoordinationHandoffResult> {
    return runResearchSession(input, frontendResearchSessionConfig())
  }
}

function frontendResearchSessionConfig(): ResearchSessionConfig {
  return {
    kind: "frontend-research",
    sessionTitlePrefix: "Frontend Research",
    bundlePathKind: "frontend-research",
    retrievalTools: "readonly",
    delegation:
      "Publish webpage investigation work packets for projected consumers whose active-package contracts require source-backed interface evidence. " +
      "Use only the tools projected by the active expert-squad package; source acquisition is an explicit visible tool action, never an adapter precondition. " +
      "Include a source-backed interface-contract handoff for page interface verification and API adaptation documentation when the evidence shows page data or interface obligations. " +
      "Do not create the frontend implementation template, do not build source, do not produce final REQ-N, acceptance specs, goal graph, implementation plan, or next-tool routing instructions.",
  }
}

export const FrontendResearchTestHooks = {
  frontendResearchSessionConfig,
}

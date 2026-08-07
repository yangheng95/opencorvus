import ARCHITECT_CORE from "@/prompt/core/architect-core.txt"
import BUILD_CORE from "@/prompt/core/build-core.txt"
import DEEP_RESEARCH_CORE from "@/prompt/core/deep-research-core.txt"
import DELEGATED_WORKER_CORE from "@/prompt/core/delegated-worker-core.txt"
import FACT_CHECK_CORE from "@/prompt/core/fact-check-core.txt"
import FRONTEND_DESIGN_CORE from "@/prompt/core/frontend-design-core.txt"
import FRONTEND_RESEARCH_CORE from "@/prompt/core/frontend-research-core.txt"
import GOAL_WORKLOAD_ANALYST_CORE from "@/prompt/core/goal-workload-analyst-core.txt"
import INTEGRITY_CORE from "@/prompt/core/integrity-team-core.txt"
import INTENT_ANALYSIS_CORE from "@/prompt/core/intent-analysis-core.txt"
import REQUIREMENTS_CORE from "@/prompt/core/requirements-core.txt"
import VISUAL_QA_CORE from "@/prompt/core/visual-qa-core.txt"
import EXPLORE_CORE from "./prompt/explore.txt"
import ENGINEERING_CRAFT from "@/prompt/core/engineering-craft.txt"
import { BUILD_RUNTIME_DISCIPLINE } from "@/prompt/fragments/build-runtime-discipline"
import { withFactCheckRegistration } from "@/prompt/fragments/fact-check-registration"
import { withObservableWorkNarrative } from "@/prompt/fragments/observable-work-narrative"
import { DispatchAdapterContractRegistry, type AgentDispatchAdapterID } from "./dispatch-adapter-contract"
import { RuntimeTemplateID, type RuntimeTemplateID as RuntimeTemplateIDValue } from "./runtime-template-id"
import { AgentToolPool, type ToolPoolAssignment } from "./tool-pool-contract"

export interface RuntimeTemplateContract {
  readonly id: RuntimeTemplateIDValue
  /** Runtime-template Application Binary Interface (ABI) version. */
  readonly templateABIVersion: 1
  readonly dispatchAdapterID: AgentDispatchAdapterID
  readonly corePromptSeed: string
  readonly description: string
  readonly skillMountable: boolean
  readonly exactRuntimeContract: boolean
  readonly broadProjectSourceWork: boolean
  readonly baseToolPool: ToolPoolAssignment
}

interface RuntimeTemplateDefinition {
  adapterID: AgentDispatchAdapterID
  corePromptSeed: string
  description: string
  skillMountable: boolean
  exactRuntimeContract: boolean
  broadProjectSourceWork: boolean
}

const definitions = {
  "delegated-worker": {
    adapterID: "delegated_worker",
    corePromptSeed: DELEGATED_WORKER_CORE,
    description: "General development worker that returns visible facts and stable references.",
    skillMountable: true,
    exactRuntimeContract: false,
    broadProjectSourceWork: true,
  },
  "intent-analysis": {
    adapterID: "analyze_intent",
    corePromptSeed: withFactCheckRegistration(INTENT_ANALYSIS_CORE),
    description: "Structured request-intent and missing-input analysis runtime.",
    skillMountable: true,
    exactRuntimeContract: true,
    broadProjectSourceWork: false,
  },
  requirements: {
    adapterID: "requirements",
    corePromptSeed: withFactCheckRegistration(REQUIREMENTS_CORE),
    description: "Structured requirement and foundational-decision registration runtime.",
    skillMountable: true,
    exactRuntimeContract: true,
    broadProjectSourceWork: false,
  },
  architect: {
    adapterID: "architect",
    corePromptSeed: withFactCheckRegistration(ARCHITECT_CORE),
    description: "Typed goal graph, requirement-sourced acceptance, assembly, and contract registration runtime.",
    skillMountable: true,
    exactRuntimeContract: true,
    broadProjectSourceWork: false,
  },
  "goal-workload-analyst": {
    adapterID: "workload_analysis",
    corePromptSeed: withFactCheckRegistration(GOAL_WORKLOAD_ANALYST_CORE),
    description: "Structured workload sizing and execution-inventory review runtime.",
    skillMountable: true,
    exactRuntimeContract: true,
    broadProjectSourceWork: false,
  },
  build: {
    adapterID: "build",
    corePromptSeed: withFactCheckRegistration([BUILD_CORE, ENGINEERING_CRAFT, BUILD_RUNTIME_DISCIPLINE].join("\n\n")),
    description:
      "Scoped development execution runtime with durable Session references and Host-observed delivery facts.",
    skillMountable: true,
    exactRuntimeContract: false,
    broadProjectSourceWork: true,
  },
  explore: {
    adapterID: "explore",
    corePromptSeed: EXPLORE_CORE,
    description: "Read-oriented repository exploration runtime.",
    skillMountable: false,
    exactRuntimeContract: false,
    broadProjectSourceWork: false,
  },
  "deep-research": {
    adapterID: "deep_research",
    corePromptSeed: withFactCheckRegistration(DEEP_RESEARCH_CORE),
    description: "Durable multi-source evidence collection runtime.",
    skillMountable: true,
    exactRuntimeContract: true,
    broadProjectSourceWork: false,
  },
  "frontend-research": {
    adapterID: "frontend_research",
    corePromptSeed: withFactCheckRegistration(FRONTEND_RESEARCH_CORE),
    description: "Structured interface investigation and evidence handoff runtime.",
    skillMountable: true,
    exactRuntimeContract: true,
    broadProjectSourceWork: false,
  },
  "frontend-design": {
    adapterID: "frontend_design",
    corePromptSeed: withFactCheckRegistration(FRONTEND_DESIGN_CORE),
    description: "Structured interface design and implementation-handoff runtime.",
    skillMountable: true,
    exactRuntimeContract: true,
    broadProjectSourceWork: false,
  },
  "visual-qa": {
    adapterID: "visual_qa",
    corePromptSeed: withFactCheckRegistration(VISUAL_QA_CORE),
    description: "Rendered interface evidence and VisualReview runtime.",
    skillMountable: true,
    exactRuntimeContract: true,
    broadProjectSourceWork: true,
  },
  integrity: {
    adapterID: "integrity",
    corePromptSeed: withFactCheckRegistration(INTEGRITY_CORE),
    description: "Session-bound integrity evidence and consensus review runtime.",
    skillMountable: true,
    exactRuntimeContract: false,
    broadProjectSourceWork: true,
  },
  "fact-check": {
    adapterID: "fact_check",
    corePromptSeed: FACT_CHECK_CORE,
    description: "Evidence-backed factual claim verification runtime.",
    skillMountable: true,
    exactRuntimeContract: true,
    broadProjectSourceWork: false,
  },
} as const satisfies Record<RuntimeTemplateIDValue, RuntimeTemplateDefinition>

function createContract(id: RuntimeTemplateIDValue): RuntimeTemplateContract {
  const definition = definitions[id]
  return Object.freeze({
    id,
    templateABIVersion: 1,
    dispatchAdapterID: definition.adapterID,
    corePromptSeed: withObservableWorkNarrative(definition.corePromptSeed),
    description: definition.description,
    skillMountable: definition.skillMountable,
    exactRuntimeContract: definition.exactRuntimeContract,
    broadProjectSourceWork: definition.broadProjectSourceWork,
    baseToolPool: AgentToolPool.runtimeTemplateAssignment(id),
  })
}

const contracts = Object.freeze(
  Object.fromEntries(RuntimeTemplateID.ids.map((id) => [id, createContract(id)])) as Record<
    RuntimeTemplateIDValue,
    RuntimeTemplateContract
  >,
)

export const RuntimeTemplateRegistry = Object.freeze({
  ids: RuntimeTemplateID.ids,
  get(id: string): RuntimeTemplateContract {
    return contracts[RuntimeTemplateID.get(id)]
  },
  isWorkerSessionKind(kind: string): boolean {
    return DispatchAdapterContractRegistry.ids.some(
      (adapterID) => DispatchAdapterContractRegistry.get(adapterID).sessionKind === kind,
    )
  },
})

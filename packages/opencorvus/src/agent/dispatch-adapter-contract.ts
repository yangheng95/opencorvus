import type { SessionKind } from "@/session/session.sql"
import type { z } from "zod"
import { DispatchAdapterInputSchemas } from "./dispatch-adapter-input"
import { DispatchOutcomeSchema } from "./dispatch-outcome"

export interface DispatchAdapterContract {
  /** Core-owned Application Binary Interface version for worker projection evidence. */
  readonly abiVersion: 1
  readonly inputSchema: z.ZodObject<any>
  readonly sessionKind: SessionKind
  readonly privateStageToolIDs: readonly string[]
  readonly coordinationHandoffToolID: "request_orchestrator_decision"
}

const contracts = {
  delegated_worker: {
    abiVersion: 1,
    inputSchema: DispatchAdapterInputSchemas.delegated_worker,
    sessionKind: "delegated-worker",
    privateStageToolIDs: [],
    coordinationHandoffToolID: "request_orchestrator_decision",
  },
  requirements: {
    abiVersion: 1,
    inputSchema: DispatchAdapterInputSchemas.requirements,
    sessionKind: "requirements",
    privateStageToolIDs: ["register_requirement", "register_decision"],
    coordinationHandoffToolID: "request_orchestrator_decision",
  },
  architect: {
    abiVersion: 1,
    inputSchema: DispatchAdapterInputSchemas.architect,
    sessionKind: "architect",
    privateStageToolIDs: [
      "manage_goal",
      "view_architect_draft",
      "register_source_coverage",
      "register_reference_coverage",
      "register_assembly_owner",
      "register_contract",
    ],
    coordinationHandoffToolID: "request_orchestrator_decision",
  },
  frontend_design: {
    abiVersion: 1,
    inputSchema: DispatchAdapterInputSchemas.frontend_design,
    sessionKind: "frontend-design",
    privateStageToolIDs: [
      "read_attachment",
      "update_frontend_basics",
      "update_frontend_text",
      "update_frontend_item",
      "update_frontend_design_direction",
      "select_frontend_design_direction",
      "update_frontend_anti_slop_review",
      "update_frontend_material",
      "update_frontend_project",
      "update_frontend_component_reuse",
      "update_frontend_baseline",
      "update_frontend_phase",
      "capture_frontend_visual_evidence",
      "update_frontend_visual_evidence",
      "update_frontend_iteration_note",
      "update_frontend_reference",
      "update_frontend_visual_region_binding",
      "update_frontend_question",
      "inspect_frontend_result_status",
    ],
    coordinationHandoffToolID: "request_orchestrator_decision",
  },
  frontend_research: {
    abiVersion: 1,
    inputSchema: DispatchAdapterInputSchemas.frontend_research,
    sessionKind: "frontend-research",
    privateStageToolIDs: [
      "update_research_scope",
      "update_research_summary",
      "update_research_evidence",
      "update_research_fact",
      "update_research_inference",
      "update_research_problem",
      "update_research_need",
      "update_research_constraint",
      "update_research_document_section",
      "update_webpage_contract_source",
      "update_webpage_functional_surface",
      "update_webpage_visual_layout",
      "update_webpage_style_requirement",
      "update_webpage_interaction_state",
      "update_webpage_data_inventory",
      "update_webpage_fidelity_acceptance",
      "update_webpage_fidelity_risk",
      "update_subpage_research_task",
      "update_research_open_question",
      "update_research_bundle_section",
      "update_research_evidence_note",
      "update_research_citation",
      "inspect_research_result_status",
    ],
    coordinationHandoffToolID: "request_orchestrator_decision",
  },
  deep_research: {
    abiVersion: 1,
    inputSchema: DispatchAdapterInputSchemas.deep_research,
    sessionKind: "deep-research",
    privateStageToolIDs: [
      "update_research_scope",
      "update_research_summary",
      "update_research_evidence",
      "update_research_fact",
      "update_research_inference",
      "update_research_problem",
      "update_research_need",
      "update_research_constraint",
      "update_research_document_section",
      "update_webpage_contract_source",
      "update_webpage_functional_surface",
      "update_webpage_visual_layout",
      "update_webpage_style_requirement",
      "update_webpage_interaction_state",
      "update_webpage_data_inventory",
      "update_webpage_fidelity_acceptance",
      "update_webpage_fidelity_risk",
      "update_subpage_research_task",
      "update_research_open_question",
      "update_research_bundle_section",
      "update_research_evidence_note",
      "update_research_citation",
      "inspect_research_result_status",
    ],
    coordinationHandoffToolID: "request_orchestrator_decision",
  },
  visual_qa: {
    abiVersion: 1,
    inputSchema: DispatchAdapterInputSchemas.visual_qa,
    sessionKind: "visual-qa",
    privateStageToolIDs: [
      "register_visual_qa_check_item",
      "register_visual_qa_coverage",
      "register_visual_qa_evidence",
      "register_visual_qa_finding",
      "register_visual_qa_production_blocker",
      "register_visual_qa_problem_dom_region",
      "register_visual_qa_unresolved_code_module_problem",
      "register_visual_qa_open_question",
      "register_visual_qa_fact_check_item",
      "set_visual_qa_reference_parity",
      "update_visual_qa_judgment",
    ],
    coordinationHandoffToolID: "request_orchestrator_decision",
  },
  workload_analysis: {
    abiVersion: 1,
    inputSchema: DispatchAdapterInputSchemas.workload_analysis,
    sessionKind: "goal-workload-analyst",
    privateStageToolIDs: ["register_workload_brief"],
    coordinationHandoffToolID: "request_orchestrator_decision",
  },
  analyze_intent: {
    abiVersion: 1,
    inputSchema: DispatchAdapterInputSchemas.analyze_intent,
    sessionKind: "intent-analysis",
    privateStageToolIDs: ["extract_slot", "flag_missing_info", "ask_clarification", "record_intent_analysis"],
    coordinationHandoffToolID: "request_orchestrator_decision",
  },
  fact_check: {
    abiVersion: 1,
    inputSchema: DispatchAdapterInputSchemas.fact_check,
    sessionKind: "fact-check",
    privateStageToolIDs: ["record_fact_check_review"],
    coordinationHandoffToolID: "request_orchestrator_decision",
  },
  build: {
    abiVersion: 1,
    inputSchema: DispatchAdapterInputSchemas.build,
    sessionKind: "build",
    privateStageToolIDs: ["merge_back"],
    coordinationHandoffToolID: "request_orchestrator_decision",
  },
  explore: {
    abiVersion: 1,
    inputSchema: DispatchAdapterInputSchemas.explore,
    sessionKind: "explore",
    privateStageToolIDs: [],
    coordinationHandoffToolID: "request_orchestrator_decision",
  },
  integrity: {
    abiVersion: 1,
    inputSchema: DispatchAdapterInputSchemas.integrity,
    sessionKind: "integrity",
    privateStageToolIDs: [
      "read",
      "glob",
      "search_code",
      "list",
      "run_command",
      "inspect_integrity_evidence",
      "register_integrity_check_item",
      "register_integrity_reviewer_review",
      "register_integrity_coverage_audit",
      "register_integrity_uninspected_risk",
      "register_integrity_finding",
      "register_integrity_round",
      "register_integrity_required_repair",
      "register_integrity_unresolved_disagreement",
      "register_integrity_fact_check_item",
      "update_integrity_judgment",
    ],
    coordinationHandoffToolID: "request_orchestrator_decision",
  },
} as const satisfies Record<string, DispatchAdapterContract>

for (const [id, contract] of Object.entries(contracts)) {
  if (new Set(contract.privateStageToolIDs).size !== contract.privateStageToolIDs.length) {
    throw new Error(`Dispatch adapter ${id} repeats a private stage tool ID`)
  }
  if (contract.privateStageToolIDs.some((toolID) => toolID.trim().length === 0)) {
    throw new Error(`Dispatch adapter ${id} contains an empty private stage tool ID`)
  }
  Object.freeze(contract.privateStageToolIDs)
  Object.freeze(contract)
}
Object.freeze(contracts)

export type AgentDispatchAdapterID = keyof typeof contracts

export namespace DispatchAdapterContractRegistry {
  export const ids = Object.freeze(Object.keys(contracts) as AgentDispatchAdapterID[])
  const idSet = new Set<string>(ids)

  export function isID(id: string): id is AgentDispatchAdapterID {
    return idSet.has(id)
  }

  export function get(id: string): DispatchAdapterContract {
    if (!isID(id)) throw new Error(`Unknown dispatch adapter ${JSON.stringify(id)}`)
    return contracts[id]
  }

  export function privateStageToolIDs(id: string): string[] {
    return [...get(id).privateStageToolIDs]
  }

  export function inputSchema<ID extends AgentDispatchAdapterID>(id: ID): (typeof contracts)[ID]["inputSchema"] {
    if (!isID(id)) throw new Error(`Unknown dispatch adapter ${JSON.stringify(id)}`)
    return contracts[id].inputSchema
  }

  export function inputFieldNames(id: string): string[] {
    return Object.keys(get(id).inputSchema.shape).sort((left, right) => left.localeCompare(right))
  }

  export function outputSchema(id: string): typeof DispatchOutcomeSchema {
    get(id)
    return DispatchOutcomeSchema
  }

  export function privateStageToolIDSet(id: string): ReadonlySet<string> {
    return new Set(get(id).privateStageToolIDs)
  }

  export function coordinationHandoffToolID(id: string): "request_orchestrator_decision" {
    return get(id).coordinationHandoffToolID
  }
}

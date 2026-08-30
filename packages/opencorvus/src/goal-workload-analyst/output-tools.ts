/**
 * Zod-validated tool calls for the Goal Workload Analyst.
 *
 * Each `register_workload_brief` call records one independently readable
 * domain fact. The orchestrator snapshots the accumulated briefs when the
 * physical turn ends.
 *
 * index/lens enforcement (spec §2, rule 8): the brief REFERENCES surfaces and
 * contracts by id and ORIGINATES only the anti-underestimation fields. The
 * schema descriptions carry that discipline; the host cannot police prose, so
 * the core prompt + the §2 二次 review own the rest.
 */
import { tool } from "ai"
import { WorkloadBriefSchema, type WorkloadBrief } from "./types"
import { materializeExactTool } from "@/agent/exact-tool-factory"

export interface GoalWorkloadCollector {
  briefs: WorkloadBrief[]
}

/**
 * `knownContractIDs` used to be a second, optional parameter here, guarded by
 * `knownContracts.size > 0` so an absent set meant "do not complain". No
 * caller ever passed it, so the contract-reference check it fronted never ran
 * once — the tool description asked the model for discipline while the code
 * behind it was inert. Wiring it would mean loading each Goal's
 * `architect_contract_graph` artifact inside this projection, and Goals
 * without a contract graph would land right back on the empty set and the
 * same silent pass. The authoritative check on fabricated contract IDs lives
 * where contract_audit scorers are authored, in
 * `architect/reference-integrity.ts`; this one is gone rather than dormant.
 */
export function createGoalWorkloadOutputTools(input: { knownGoalIDs: string[]; onToolMaterialized?: (toolID: string) => void }) {
  const knownGoals = new Set(input.knownGoalIDs)

  function emptyCollector(): GoalWorkloadCollector {
    return { briefs: [] }
  }
  let collector = emptyCollector()

  const toolFactories = {
    register_workload_brief: () => tool({
      description:
        "Register one goal's workload brief. index/lens discipline: ORIGINATE why_not_smaller / traps / " +
        "execution_inventory / verification_inventory / decomposition_concern; REFERENCE surfaces and contracts " +
        "only with identities declared by completely read Artifacts (never restate them). Leave inapplicable " +
        "reference arrays empty; do not encode Artifact locators or JSON fragments as design_sections. " +
        "Every submission remains durable coverage evidence; repeated and unselected goal IDs are reported as errors.",
      inputSchema: WorkloadBriefSchema,
      execute: async (raw) => {
        const brief = WorkloadBriefSchema.parse(raw) as WorkloadBrief
        const repeated = collector.briefs.some((candidate) => candidate.goal_id === brief.goal_id)
        collector.briefs.push(brief)
        if (!knownGoals.has(brief.goal_id)) {
          return (
            `Error: goal_id "${brief.goal_id}" is not a registered plan goal. ` +
            `Known goals: ${[...knownGoals].join(", ") || "(none)"}. Submission retained as invalid coverage evidence.`
          )
        }
        if (repeated) {
          return `Error: goal_id "${brief.goal_id}" was submitted more than once. Submission retained as duplicate coverage evidence.`
        }
        return `OK: workload brief for "${brief.goal_id}" registered (${collector.briefs.length} total).`
      },
    }),
  }

  return {
    materializeExact: (toolID: string) =>
      materializeExactTool(toolFactories, toolID, input.onToolMaterialized),
    getCollector: () => collector,
    reset() {
      collector = emptyCollector()
      return collector
    },
  }
}

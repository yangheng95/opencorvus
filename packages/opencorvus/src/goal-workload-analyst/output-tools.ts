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

export interface GoalWorkloadCollector {
  briefs: WorkloadBrief[]
}

export function createGoalWorkloadOutputTools(input: { knownGoalIDs: string[]; knownContractIDs?: string[] }) {
  const knownGoals = new Set(input.knownGoalIDs)
  const knownContracts = new Set(input.knownContractIDs ?? [])

  function emptyCollector(): GoalWorkloadCollector {
    return { briefs: [] }
  }
  let collector = emptyCollector()

  const tools = {
    register_workload_brief: tool({
      description:
        "Register one goal's workload brief. index/lens discipline: ORIGINATE why_not_smaller / traps / " +
        "execution_inventory / verification_inventory / decomposition_concern; REFERENCE surfaces and contracts " +
        "only with identities declared by completely read Artifacts (never restate them). Leave inapplicable " +
        "reference arrays empty; do not encode Artifact locators or JSON fragments as design_sections. " +
        "Re-registering the same goal_id overwrites.",
      inputSchema: WorkloadBriefSchema,
      execute: async (raw) => {
        const brief = WorkloadBriefSchema.parse(raw) as WorkloadBrief
        if (!knownGoals.has(brief.goal_id)) {
          return (
            `Error: goal_id "${brief.goal_id}" is not a registered plan goal. ` +
            `Known goals: ${[...knownGoals].join(", ") || "(none)"}. Collector unchanged.`
          )
        }
        const unknownContracts =
          knownContracts.size > 0 ? brief.references.contract_ids.filter((id) => !knownContracts.has(id)) : []
        const warn =
          unknownContracts.length > 0
            ? `\nWarning: referenced contract id(s) not in the contract graph: ${unknownContracts.join(", ")}.`
            : ""
        const idx = collector.briefs.findIndex((b) => b.goal_id === brief.goal_id)
        if (idx >= 0) {
          collector.briefs[idx] = brief
          return `OK: workload brief for "${brief.goal_id}" updated (${collector.briefs.length} total).${warn}`
        }
        collector.briefs.push(brief)
        return `OK: workload brief for "${brief.goal_id}" registered (${collector.briefs.length} total).${warn}`
      },
    }),
  }

  return {
    tools,
    getCollector: () => collector,
    reset() {
      collector = emptyCollector()
      return collector
    },
  }
}

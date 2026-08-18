/**
 * A Task-root Turn that streams a Provider step without committing a decision
 * used to be answered with one more paragraph of English and nothing else. The
 * sampling parameters, the tool surface, and the model were identical on every
 * attempt, so a `semanticTurnLimit: 3` budget spent all three attempts drawing
 * from the same distribution and then settled `exhausted` having never once
 * constrained the request. `toolChoice: "required"` and the specific-tool form
 * were typed in `session/llm.ts` and handled in `ProviderTransform`, but no
 * production path ever passed either.
 *
 * These tests pin the escalation ladder itself: each rung must remove a degree
 * of freedom the previous rung left open.
 */
import { describe, expect, test } from "bun:test"
import { taskRootDecisionRepairRung } from "../src/session/loop"
import { ORCHESTRATOR_DECISION_TOOL_NAMES } from "../src/orchestrator/decision-tool-names"

describe("task-root decision repair ladder", () => {
  test("leaves the first attempt unconstrained", () => {
    expect(taskRootDecisionRepairRung(0)).toBeUndefined()
    expect(taskRootDecisionRepairRung(-1)).toBeUndefined()
  })

  test("forces a tool call once a step has ended without a decision receipt", () => {
    expect(taskRootDecisionRepairRung(1)).toEqual({ toolChoice: "required", restrictToDecisionTools: false })
  })

  test("also narrows the surface once forcing a tool call was not enough", () => {
    expect(taskRootDecisionRepairRung(2)).toEqual({ toolChoice: "required", restrictToDecisionTools: true })
    expect(taskRootDecisionRepairRung(3)).toEqual({ toolChoice: "required", restrictToDecisionTools: true })
  })

  test("escalates monotonically — a later rung never relaxes an earlier constraint", () => {
    const rungs = [1, 2, 3, 4].map((gap) => taskRootDecisionRepairRung(gap))
    expect(rungs.every((rung) => rung?.toolChoice === "required")).toBe(true)
    const restrictions = rungs.map((rung) => rung?.restrictToDecisionTools === true)
    expect(restrictions).toEqual([...restrictions].sort((left, right) => Number(left) - Number(right)))
  })

  test("the narrowed surface is the decision tool set the ingress reducer settles on", () => {
    // The restriction filters the resolved surface by this exact list, so a
    // decision the reducer would accept must remain callable on the last rung.
    expect([...ORCHESTRATOR_DECISION_TOOL_NAMES]).toEqual([
      "dispatch_agent",
      "respond_agent_coordination",
      "manage_task",
      "question",
      "wait",
      "no_action",
    ])
  })
})

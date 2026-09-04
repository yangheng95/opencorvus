import { describe, expect, test } from "bun:test"
import MISSION_CORE from "../src/prompt/core/mission-core.txt" with { type: "text" }
import ORCHESTRATOR_CORE from "../src/prompt/core/orchestrator-core.txt" with { type: "text" }
import { ORCHESTRATOR_SCHEDULER_ROLE_BASE_TOOL_IDS } from "../src/agent/tool-pool-data"

describe("scheduler Skill loading policy", () => {
  test("gives the Orchestrator an on-demand Skill decision contract", () => {
    expect(ORCHESTRATOR_CORE).toContain("Do not greedily load a Skill merely because it is mounted or available.")
    expect(ORCHESTRATOR_CORE).toContain(
      "only when the current scheduler decision genuinely requires that Skill's specific method or contract",
    )
    expect(ORCHESTRATOR_CORE).toContain(
      "the already-rendered prompt plus current Task context do not supply it",
    )
  })

  test("projects the exact worker Message reader required by the Orchestrator evidence contract", () => {
    expect(ORCHESTRATOR_SCHEDULER_ROLE_BASE_TOOL_IDS).toContain("read_agent_message")
    expect(ORCHESTRATOR_CORE).toContain(
      "Submit one collection together in one `read_agent_message` call",
    )
    expect(ORCHESTRATOR_CORE).toContain("submit consecutive ordered chunks of at most eight")
  })

  test("gives Mission the same on-demand contract after exact operator-selected directives", () => {
    const selectedDirective = MISSION_CORE.indexOf("An exact visible `@mission(\"<name>\")` directive")
    const onDemandPolicy = MISSION_CORE.indexOf(
      "Outside those exact operator-selected directives, do not greedily load a Skill merely because it is mounted or available.",
    )

    expect(selectedDirective).toBeGreaterThanOrEqual(0)
    expect(onDemandPolicy).toBeGreaterThan(selectedDirective)
    expect(MISSION_CORE).toContain(
      "only when the current Mission decision genuinely requires that Skill's specific method or contract",
    )
    expect(MISSION_CORE).toContain(
      "the already-rendered prompt, Mission state, and current facts do not supply it",
    )
  })
})

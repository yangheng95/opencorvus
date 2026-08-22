import { expect, test } from "bun:test"
import MISSION_CORE from "../src/prompt/core/mission-core.txt" with { type: "text" }

test("projects scope-first Expert Squad Task partitioning", () => {
  const requiredMissionClauses = [
    "Partition the complete requested scope by positive held-Squad ownership before authoring Task closures",
    "First enumerate every requested deliverable, operation, mutable resource, and acceptance obligation",
    "Only after this complete scope-to-Squad partition exists, derive coherent delivery closures inside each single-Squad partition",
    "Build the complete scope ownership matrix",
    "Different held Squads always mean different stages and different fixed-`promptProfile` Tasks",
    "Never assign the complete input wholesale to one Squad when another held Squad positively owns a distinct requested partition",
    "No Task spans scope partitions positively owned by different held Squads",
    "The operator's original request is the sole semantic authority for the Mission and its complete child-Task set",
    "the union of all Task assignments plus explicit unresolved boundaries must cover the complete request",
    "The original request may remain visible as authority context without making a child execute effects assigned to sibling Tasks",
  ]

  expect(requiredMissionClauses.map((clause) => MISSION_CORE.includes(clause))).toEqual(
    requiredMissionClauses.map(() => true),
  )
})

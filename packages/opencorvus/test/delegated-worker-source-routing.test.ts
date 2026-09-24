import { describe, expect, test } from "bun:test"
import { delegatedWorkerContextSections } from "../src/delegated-worker/context"
import { Identifier } from "../src/id/id"

describe("delegated worker source routing", () => {
  test("projects repository paths and durable Task Artifacts through their matching readers", () => {
    const sections = delegatedWorkerContextSections({
      reason: "Inspect evidence/risk.txt and compare it with retained Task evidence.",
      task: {
        id: Identifier.ascending("task"),
        title: "Assess the primary risk",
        request: "Read evidence/risk.txt and report the primary risk.",
        attachments: [{ url: "/attachment/project/risk-prd.md", mime: "text/markdown", filename: "risk-prd.md" }],
      } as never,
      workScope: {} as never,
      deliverySlices: [
        {
          id: "revision-source-routing",
          title: "Preserve source rows",
          objective: "Change eligible rows while retaining exempt source values",
          owned_paths: ["evidence/risk.txt"],
          acceptance_specs: [
            {
              id: "preservation",
              title: "Preserve original exempt cells",
              severity: "essential",
              scorers: [
                {
                  type: "llm_judge",
                  name: "audit",
                  criteria: "Compare before-state with mutation range and values",
                  rubric: [
                    { score: 0, label: "Changed", anchor: "An exempt source value changed", passes: false },
                    { score: 1, label: "Preserved", anchor: "Exempt cells preserve exact source values", passes: true },
                  ],
                },
              ],
            },
          ],
        },
      ] as never,
    })

    expect(sections[0]).toContain("For an explicit repository path, reveal and use the read Tool on that exact path.")
    expect(sections[0]).toContain(
      "For durable Task Artifact evidence, use artifact_search and then read every selected Artifact locator to complete=true.",
    )
    expect(sections[1]).toContain("Read evidence/risk.txt and report the primary risk.")
    expect(sections[2]).toContain("Preserve original exempt cells")
    expect(sections[2]).toContain("Compare before-state with mutation range and values")
    expect(sections[2]).toContain('"anchor": "Exempt cells preserve exact source values"')
    expect(sections[3]).toContain("risk-prd.md (text/markdown): /attachment/project/risk-prd.md")
  })
})

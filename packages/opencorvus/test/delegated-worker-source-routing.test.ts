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
      } as never,
      workScope: {} as never,
      deliverySliceRevisionIDs: ["revision-source-routing"],
    })

    expect(sections[0]).toContain("For an explicit repository path, reveal and use the read Tool on that exact path.")
    expect(sections[0]).toContain(
      "For durable Task Artifact evidence, use artifact_search and then read every selected Artifact locator to complete=true.",
    )
    expect(sections[1]).toContain("Read evidence/risk.txt and report the primary risk.")
  })
})

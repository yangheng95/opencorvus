import { describe, expect, test } from "bun:test"
import {
  assertProjectedWorkerContinuationCompatible,
  ProjectedWorkerContinuationIncompatibleError,
  sameProjectedWorkerIdentity,
  type ProjectedWorkerIdentity,
} from "@/agent/projected-worker-identity"

const previous: ProjectedWorkerIdentity = {
  agentID: "research-worker",
  baseRole: "delegated-worker",
  sessionKind: "delegated-worker",
  dispatchAdapterID: "delegated_worker",
  runtimeTemplateABIVersion: 1,
  dispatchAdapterABIVersion: 1,
  projectionHash: "a".repeat(64),
}

describe("projected worker continuation execution compatibility", () => {
  test("accepts a successor Turn with a new projection version while strict owner identity records the version change", () => {
    const current: ProjectedWorkerIdentity = {
      ...previous,
      projectionHash: "b".repeat(64),
    }

    expect(() =>
      assertProjectedWorkerContinuationCompatible({
        previous,
        current,
        subject: "dispatch continuation",
      }),
    ).not.toThrow()
    expect(sameProjectedWorkerIdentity(previous, current)).toBe(false)
  })

  test("returns a typed field-level incompatibility for a different stable worker", () => {
    const current: ProjectedWorkerIdentity = {
      ...previous,
      agentID: "fact-check-worker",
      projectionHash: "c".repeat(64),
    }

    let captured: unknown
    try {
      assertProjectedWorkerContinuationCompatible({
        previous,
        current,
        subject: "dispatch continuation art_source",
      })
    } catch (error) {
      captured = error
    }

    expect(captured).toBeInstanceOf(ProjectedWorkerContinuationIncompatibleError)
    expect(captured).toMatchObject({
      name: "ProjectedWorkerContinuationIncompatibleError",
      subject: "dispatch continuation art_source",
      differences: [{ field: "agentID", previous: "research-worker", current: "fact-check-worker" }],
    })
  })
})

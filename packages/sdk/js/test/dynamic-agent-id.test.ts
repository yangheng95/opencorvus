import { expect, test } from "bun:test"
import {
  ExpertSquadCapabilityProjectionSchema,
  ExpertSquadDynamicAgentIDSchema,
  ExpertSquadVirtualWorkflowNodeSchema,
} from "@opencorvus-ai/sdk/expert-squad-manifest-v2"

test("parses package workers and the existing maximum identity length", () => {
  for (const id of ["research-worker", "user-reviewer", "a".repeat(64)]) {
    expect(ExpertSquadDynamicAgentIDSchema.parse(id)).toBe(id)
  }
})

test.each(["user", "orchestrator", "shared", "universal-build"])(
  "returns the package reserved identity error for %s",
  (id) => {
    const result = ExpertSquadDynamicAgentIDSchema.safeParse(id)
    expect(result).toMatchObject({
      success: false,
      error: { issues: [{ code: "custom", path: [], message: `dynamic agent id "${id}" is reserved` }] },
    })
  },
)

test("returns the existing package length error above 64 characters", () => {
  expect(ExpertSquadDynamicAgentIDSchema.safeParse("a".repeat(65))).toMatchObject({
    success: false,
    error: { issues: [{ code: "too_big", origin: "string", maximum: 64, inclusive: true, path: [] }] },
  })
})

test("reports the human identity at the workflow agent field", () => {
  const result = ExpertSquadVirtualWorkflowNodeSchema.safeParse({
    agent_id: "user",
    description: "Review current evidence",
    depends_on: [],
  })
  expect(result).toMatchObject({
    success: false,
    error: { issues: [{ code: "custom", path: ["agent_id"], message: 'dynamic agent id "user" is reserved' }] },
  })
})

test("reports the human identity at the package projection key", () => {
  const result = ExpertSquadCapabilityProjectionSchema.safeParse({
    scheduler: { base_role: "orchestrator", capability_refs: [] },
    agents: { user: { label: "Review worker", base_role: "delegated-worker", capability_refs: [] } },
    virtual_workflows: {},
  })
  expect(result).toMatchObject({
    success: false,
    error: {
      issues: [
        {
          code: "invalid_key",
          path: ["agents", "user"],
          issues: [{ code: "custom", path: [], message: 'dynamic agent id "user" is reserved' }],
        },
      ],
    },
  })
})

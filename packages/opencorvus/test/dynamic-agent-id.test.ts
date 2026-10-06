import { expect, test } from "bun:test"
import { ProjectedWorkerIdentitySchema } from "@/agent/projected-worker-identity"
import { ExpertSquadRuntimeOverlaysSchema, ExpertSquadRuntimeOverridesSchema } from "@/agent/runtime-override"
import { SkillMountAgentIDSchema, SkillMountProjectConfigSchema } from "@/skill/mount-config"
import { ExpertSquadRegistry } from "@/expert-squad/registry"

const worker = {
  agentID: "research-worker",
  baseRole: "delegated-worker",
  sessionKind: "delegated-worker",
  dispatchAdapterID: "delegated_worker",
  runtimeTemplateABIVersion: 1,
  dispatchAdapterABIVersion: 1,
  projectionHash: "a".repeat(64),
}

test("parses package and platform projected worker identities", () => {
  expect(ProjectedWorkerIdentitySchema.parse(worker)).toEqual(worker)
  const platform = {
    ...worker,
    agentID: "universal-build",
    baseRole: "build",
    sessionKind: "build",
    dispatchAdapterID: "build",
  }
  expect(ProjectedWorkerIdentitySchema.parse(platform)).toEqual(platform)
})

test("reports the human identity at the projected worker field", () => {
  expect(ProjectedWorkerIdentitySchema.safeParse({ ...worker, agentID: "user" })).toMatchObject({
    success: false,
    error: { issues: [{ code: "custom", path: ["agentID"], message: 'dynamic agent id "user" is reserved' }] },
  })
})

test("parses a worker execution override and its nullable overlay", () => {
  const override = { example: { agents: { "user-reviewer": { runtime: { steps: 3 } } } } }
  expect(ExpertSquadRuntimeOverridesSchema.parse(override)).toEqual(override)
  const overlay = { example: { agents: { "user-reviewer": null } } }
  expect(ExpertSquadRuntimeOverlaysSchema.parse(overlay)).toEqual(overlay)
})

test("reports the human identity at both runtime configuration keys", () => {
  for (const result of [
    ExpertSquadRuntimeOverridesSchema.safeParse({ example: { agents: { user: { runtime: { steps: 3 } } } } }),
    ExpertSquadRuntimeOverlaysSchema.safeParse({ example: { agents: { user: null } } }),
  ]) {
    expect(result).toMatchObject({
      success: false,
      error: {
        issues: [
          {
            code: "invalid_key",
            path: ["example", "agents", "user"],
            issues: [{ code: "custom", path: [], message: 'dynamic agent id "user" is reserved' }],
          },
        ],
      },
    })
  }
})

test("parses the explicit scheduler skill owner and ordinary worker mount", () => {
  expect(SkillMountAgentIDSchema.parse("orchestrator")).toBe("orchestrator")
  const config = { example: { "research-worker": {} } }
  expect(SkillMountProjectConfigSchema.parse(config)).toEqual(config)
})

test("reports the human identity at the skill mount owner key", () => {
  expect(SkillMountProjectConfigSchema.safeParse({ example: { user: {} } })).toMatchObject({
    success: false,
    error: {
      issues: [
        {
          code: "invalid_key",
          path: ["example", "user"],
          issues: [{ code: "custom", path: [], message: 'dynamic agent id "user" is reserved' }],
        },
      ],
    },
  })
})

test("projects the canonical Base worker and returns Registry's reserved identity error", async () => {
  const source = await Bun.file(new URL("../src/expert-squad/builtin/base/expert-squad.jsonc", import.meta.url)).text()
  const manifest = ExpertSquadRegistry.ManifestSchema.parse(Bun.JSONC.parse(source))
  expect(ExpertSquadRegistry.agentProjectionForID(manifest, "base-researcher")).toMatchObject({
    agentID: "base-researcher",
    baseRole: "explore",
  })
  expect(() => ExpertSquadRegistry.agentProjectionForID(manifest, "user")).toThrow(
    'capability_projection.agents.user: invalid dynamic agent id "user"',
  )
  const result = ExpertSquadRegistry.ManifestSchema.safeParse({
    ...manifest,
    capability_projection: {
      ...manifest.capability_projection,
      agents: {
        ...manifest.capability_projection.agents,
        user: manifest.capability_projection.agents["base-researcher"],
      },
    },
  })
  expect(result).toMatchObject({
    success: false,
    error: {
      issues: [
        {
          code: "invalid_key",
          path: ["capability_projection", "agents", "user"],
          issues: [{ code: "custom", path: [], message: 'dynamic agent id "user" is reserved' }],
        },
      ],
    },
  })
})

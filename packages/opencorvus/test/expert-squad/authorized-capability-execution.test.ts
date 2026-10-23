import { afterAll, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { asSchema, jsonSchema, tool as aiTool } from "ai"
import Ajv from "ajv/dist/2020"
import { tool } from "@opencorvus-ai/plugin"
import publisher from "@squads/evolution-lab/tools/publish-evolution-artifact"
import { RuntimeTemplateRegistry } from "../../src/agent/runtime-template-registry"
import { AgentToolPool } from "../../src/agent/tool-pool-contract"
import {
  providerToolDefinitionChars,
  providerToolDefinitionTokens,
  CAPABILITY_REVEAL_MAX_ACTIVE_CHARS,
  CAPABILITY_REVEAL_MAX_ACTIVE_TOKENS,
} from "../../src/capability/reveal-receipt"
import { normalizedProviderToolDefinition } from "../../src/capability/reveal-owner"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { Instance } from "../../src/project/instance"
import type { Provider } from "../../src/provider/provider"
import { SessionLoop } from "../../src/session/loop"
import { materializeToolExecutionInput } from "../../src/provider/tool-execution-input"
import { ProviderSchema } from "../../src/provider/schema"
import { Config } from "../../src/config/config"
import { ExpertSquadPackageManager } from "../../src/expert-squad/manager"
import { PromptProfileResolver } from "../../src/expert-squad/prompt-profile-resolver"
import { sessionRuntimeFromProjectedTemplate } from "../../src/agent/session-agent-runtime"
import { SkillMount } from "../../src/skill/mounts"
import { SkillTool } from "../../src/tool/skill"
import { Tool } from "../../src/tool/tool"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterAll(resetMemoryDatabase)

test("Explore supplies the authorized Skill loader as a routine platform capability", () => {
  expect(RuntimeTemplateRegistry.get("explore").skillMountable).toBe(true)
  expect([...AgentToolPool.visibleToolIDs(AgentToolPool.runtimeTemplateAssignment("explore"))]).toContain("skill")
})

for (const npm of ["@ai-sdk/openai", "@ai-sdk/anthropic", "@ai-sdk/google"]) {
  test(`the complete Evolution publisher fits the actual ${npm} normalized leaf budget`, () => {
    const definition = publisher.introspect()
    const model = {
      id: "gpt-contract",
      providerID: npm === "@ai-sdk/google" ? "google" : "test",
      api: { id: "gpt-contract", npm },
    } as Provider.Model
    const prepared = SessionLoop.prepareProviderTool({
      name: "publisher",
      source: "extra",
      model,
      tool: aiTool({ description: definition.description, inputSchema: jsonSchema(definition.inputSchema) }),
    })
    const normalized = normalizedProviderToolDefinition("publisher", prepared)
    expect(providerToolDefinitionChars(normalized)).toBeLessThanOrEqual(CAPABILITY_REVEAL_MAX_ACTIVE_CHARS)
    expect(providerToolDefinitionTokens(normalized)).toBeLessThanOrEqual(CAPABILITY_REVEAL_MAX_ACTIVE_TOKENS)
    console.log(
      JSON.stringify({
        provider: npm,
        chars: providerToolDefinitionChars(normalized),
        tokens: providerToolDefinitionTokens(normalized),
      }),
    )
    const schema = asSchema(prepared.inputSchema).jsonSchema
    const validate = new Ajv({ strict: false, validateFormats: false }).compile(schema)
    validate({ artifact: { artifact_type: "unknown" } })
    expect(validate.errors).toEqual(expect.arrayContaining([expect.objectContaining({ keyword: "required" })]))
  })
}

test("shared schema references preserve optional-null materialization and strict canonical validation", () => {
  const item = tool.schema
    .object({
      name: tool.schema.string(),
      note: tool.schema.string().optional(),
      explicit: tool.schema.string().nullable(),
    })
    .strict()
  const definition = tool({
    description: "Shared records",
    args: { first: item, second: item },
    async execute(args) {
      return args.first.name
    },
  })
  const materialized = materializeToolExecutionInput(jsonSchema(definition.introspect().inputSchema), {
    first: { name: "first", note: null, explicit: null },
    second: { name: "second", note: "kept", explicit: "value" },
  })
  expect(definition.inputSchema.parse(materialized)).toEqual({
    first: { name: "first", explicit: null },
    second: { name: "second", note: "kept", explicit: "value" },
  })
  expect(
    definition.inputSchema.safeParse({ first: { name: 1 }, second: {} }).error?.issues.map((issue) => issue.code),
  ).toEqual(["invalid_type", "invalid_type", "invalid_type", "invalid_type"])
})

for (const npm of ["@ai-sdk/openai", "@ai-sdk/anthropic", "@ai-sdk/google"]) {
  test(`${npm} preserves valid shared object arrays in its provider schema`, () => {
    const record = tool.schema.object({ name: tool.schema.string(), note: tool.schema.string().optional() }).strict()
    const schema = tool.schema.object({ first: record, others: tool.schema.array(record) }).strict()
    const model = {
      id: "gpt-contract",
      providerID: npm === "@ai-sdk/google" ? "google" : "test",
      api: { id: "gpt-contract", npm },
    } as Provider.Model
    const raw = tool.schema.toJSONSchema(schema, { reused: "ref" })
    const input = { first: { name: "first", note: "first note" }, others: [{ name: "second", note: "second note" }] }
    const providerSchema = asSchema(ProviderSchema.input(model, jsonSchema(raw))).jsonSchema
    expect(new Ajv({ strict: false }).compile(providerSchema)(input)).toBe(true)
    expect(schema.parse(ProviderSchema.materializeInput(model, jsonSchema(raw), input))).toEqual(input)
  })
}

test("strict root union envelopes keep shared definitions at the JSON Pointer root", () => {
  const model = {
    id: "gpt-contract",
    providerID: "test",
    api: { id: "gpt-contract", npm: "@ai-sdk/openai" },
  } as Provider.Model
  const raw = {
    $defs: {
      item: {
        type: "object",
        properties: { name: { type: "string" }, note: { type: "string" } },
        required: ["name"],
        additionalProperties: false,
      },
    },
    anyOf: [
      {
        type: "object",
        properties: { action: { const: "inspect" }, item: { $ref: "#/$defs/item" } },
        required: ["action", "item"],
        additionalProperties: false,
      },
    ],
  }
  const provider = asSchema(ProviderSchema.input(model, jsonSchema(raw))).jsonSchema
  const input = { operation: { action: "inspect", item: { name: "observed", note: null } } }
  expect(new Ajv({ strict: false }).compile(provider)(input)).toBe(true)
  expect(ProviderSchema.materializeInput(model, jsonSchema(raw), input)).toEqual({
    action: "inspect",
    item: { name: "observed" },
  })
})

test("unresolved schema references produce the explicit input schema error", () => {
  expect(() =>
    materializeToolExecutionInput(jsonSchema({ type: "object", properties: { item: { $ref: "#/$defs/missing" } } }), {
      item: {},
    }),
  ).toThrow('Tool input schema reference "#/$defs/missing" does not resolve')
})

async function sourcePackage(root: string, requiredTools: string[], toolDescription?: string) {
  const directory = path.join(root, "source")
  const skillRef = "capability:skill:package:authorized-probe:authorized-probe%2Fshared%2Fmethod"
  const toolRef = "capability:tool:package:authorized-probe:authorized-probe%2Fshared%2Freport"
  await fs.mkdir(path.join(directory, "skills", "method"), { recursive: true })
  await fs.writeFile(
    path.join(directory, "skills", "method", "SKILL.md"),
    `---\nname: authorized-probe-method\ndescription: Read the exact probe method.\nrequired_tools: ${JSON.stringify(requiredTools)}\n---\nUse the exact evidence.\n`,
  )
  await fs.writeFile(path.join(directory, "README.md"), "# Authorized probe\n")
  await fs.writeFile(path.join(directory, "selector.md"), "Use for the authorized probe.\n")
  if (toolDescription) {
    await fs.mkdir(path.join(directory, "tools"), { recursive: true })
    await fs.writeFile(
      path.join(directory, "tools", "report.ts"),
      `import {tool} from "@opencorvus-ai/plugin"; export default tool({description:${JSON.stringify(toolDescription)},args:{value:tool.schema.string()},async execute(args){return args.value}})`,
    )
  }
  await fs.writeFile(
    path.join(directory, "expert-squad.jsonc"),
    JSON.stringify({
      schema_version: 2,
      namespace: "test",
      id: "authorized-probe",
      label: "Authorized probe",
      version: "2026.10.24.1",
      product_pillars: ["work"],
      readme: "README.md",
      selector: { summary: "Authorized probe", selection_guidance: "Only for the probe", instructions: "selector.md" },
      capability_sets: {},
      capability_projection: {
        scheduler: { base_role: "orchestrator", capability_refs: [] },
        agents: {
          observer: {
            label: "Observer",
            base_role: "explore",
            capability_refs: [
              "capability:capability_set:platform:tool-registry:explore-base",
              skillRef,
              ...(toolDescription ? [toolRef] : []),
            ].sort(),
          },
        },
        virtual_workflows: {},
      },
    }),
  )
  return directory
}

test("package admission reports the exact Skill dependency outside its declared projection", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const source = await sourcePackage(project.path, ["write"])
      await expect(ExpertSquadRegistry.loadSourcePackage(source)).rejects.toMatchObject({
        code: "skill_required_tool_unprojected",
        toolID: "write",
        capabilityRef: "authorized-probe/shared/method",
      })
    },
  })
})

test("package admission reports an explicitly granted Skill whose loader is outside its projection", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const source = await sourcePackage(project.path, [])
      const file = path.join(source, "expert-squad.jsonc")
      const manifest = JSON.parse(await fs.readFile(file, "utf8"))
      manifest.capability_projection.agents.observer.capability_refs =
        manifest.capability_projection.agents.observer.capability_refs.filter(
          (ref: string) => ref !== "capability:capability_set:platform:tool-registry:explore-base",
        )
      await fs.writeFile(file, JSON.stringify(manifest))
      await expect(ExpertSquadRegistry.loadSourcePackage(source)).rejects.toMatchObject({
        code: "skill_loader_unprojected",
        toolID: "skill",
        capabilityRef: "authorized-probe/shared/method",
      })
    },
  })
})

for (const description of ["Large canonical action. ".repeat(2000), "核".repeat(13000)])
  test(`package admission reports the ${description.startsWith("核") ? "dense-token" : "character"} budget of the frozen executable`, async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const source = await sourcePackage(project.path, [], description)
        await expect(ExpertSquadRegistry.loadSourcePackage(source)).rejects.toMatchObject({
          code: "capability_tool_definition_budget_exceeded",
          capabilityRef: "authorized-probe/shared/report",
        })
      },
    })
  })

test("default Skill dependencies use the same exact role projection contract", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const source = await sourcePackage(project.path, [])
      const file = path.join(source, "expert-squad.jsonc")
      const manifest = JSON.parse(await fs.readFile(file, "utf8"))
      manifest.capability_projection.agents.observer.capability_refs.push(
        "capability:skill:platform:skill-manager:default%2Fskill%2Fwork-artifacts",
      )
      manifest.capability_projection.agents.observer.capability_refs.sort()
      await fs.writeFile(file, JSON.stringify(manifest))
      await ExpertSquadPackageManager.importDirectory({
        projectDirectory: project.path,
        sourceDirectory: source,
        installationScope: "project",
      })
      await Config.updateProjectPatch({ prompt_profile: { active: "authorized-probe" } })
      await expect(
        PromptProfileResolver.resolveWorkerTurnProjection({
          projectDirectory: project.path,
          config: await Config.get(),
          agentID: "observer",
        }),
      ).rejects.toMatchObject({
        code: "skill_required_tool_unprojected",
        toolID: "work_artifact_inspect",
        capabilityRef: "default/skill/work-artifacts",
      })
    },
  })
})

test("package and role discovery descriptions come from the admitted executable definition", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const description = "Correlate orbital telemetry into a verified observation."
      const source = await sourcePackage(project.path, [], description)
      const loaded = await ExpertSquadRegistry.loadSourcePackage(source)
      expect(loaded.packageToolBundles.get("authorized-probe/shared/report")?.definition.description).toBe(description)
      await ExpertSquadPackageManager.importDirectory({
        projectDirectory: project.path,
        sourceDirectory: source,
        installationScope: "project",
      })
      await Config.updateProjectPatch({ prompt_profile: { active: "authorized-probe" } })
      const { workerCapability, skillProjection } = await PromptProfileResolver.resolveWorkerTurnProjection({
        projectDirectory: project.path,
        config: await Config.get(),
        agentID: "observer",
      })
      expect(
        skillProjection.projectedAgents.find((agent) => agent.identity.agentID === "observer")?.packageToolDescriptions,
      ).toEqual({ [workerCapability.packageTools[0]!.providerName]: description })
    },
  })
})

test("two independent projects load and execute their granted Explore Skill through the production resolver", async () => {
  for (const projectName of ["first", "second"]) {
    await using project = await memoryProject(projectName)
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const source = await sourcePackage(project.path, ["read"])
        await fs.appendFile(path.join(source, "skills/method/SKILL.md"), `Exact project marker: ${projectName}.\n`)
        await ExpertSquadPackageManager.importDirectory({
          projectDirectory: project.path,
          sourceDirectory: source,
          installationScope: "project",
        })
        await Config.updateProjectPatch({ prompt_profile: { active: "authorized-probe" } })
        const config = await Config.get()
        const { workerCapability, skillProjection } = await PromptProfileResolver.resolveWorkerTurnProjection({
          projectDirectory: project.path,
          config,
          agentID: "observer",
        })
        const runtime = sessionRuntimeFromProjectedTemplate({ template: RuntimeTemplateRegistry.get("explore") })
        const surface = await SkillMount.resolve({
          identity: { ...workerCapability.identity, expertSquadID: workerCapability.expertSquadID },
          runtime,
          scope: "project",
          projectDirectory: project.path,
          skillProjection,
        })
        expect(
          surface.skills.map((entry) => ({
            name: entry.name,
            actualName: entry.skill.name,
            enabled: entry.enabled,
            reason: entry.reason,
          })),
        ).toEqual([
          { name: "authorized-probe-method", actualName: "authorized-probe-method", enabled: true, reason: undefined },
        ])
        expect(surface.tool_available).toBe(true)
        const loader = await SkillTool.init({ config, skillSurface: surface })
        expect(loader.description).toContain("Current agent: observer")
        const loaded = await loader.execute(
          { name: "authorized-probe-method" },
          {
            sessionID: "local-contract",
            messageID: "local-contract",
            agent: "observer",
            abort: new AbortController().signal,
            messages: [],
            metadata() {},
            executionSurface: Tool.executionSurface(workerCapability.builtInToolIDs, []),
          },
        )
        expect(loaded.metadata.name).toBe("authorized-probe-method")
        expect(loaded.output).toContain(`Exact project marker: ${projectName}.`)
        const matrix = await SkillMount.matrix({ expertSquadID: "authorized-probe" })
        expect(matrix.agents.find((agent) => agent.agent_id === "observer")).toMatchObject({
          skill_mountable: true,
          skill_tool_available: true,
        })
      },
    })
  }
})

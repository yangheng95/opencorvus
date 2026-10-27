import { afterAll, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { RuntimeTemplateRegistry } from "../../src/agent/runtime-template-registry"
import { sessionRuntimeFromProjectedTemplate } from "../../src/agent/session-agent-runtime"
import { Config } from "../../src/config/config"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { PromptProfileResolver } from "../../src/expert-squad/prompt-profile-resolver"
import { Instance } from "../../src/project/instance"
import { Skill } from "../../src/skill/skill"
import { defaultSkillNameFromRef } from "../../src/skill/default-skill-ref"
import { SkillMount } from "../../src/skill/mounts"
import { SkillTool } from "../../src/tool/skill"
import { Tool } from "../../src/tool/tool"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import { agentCapabilityGrants, schedulerCapabilityGrants } from "./capability-grant-fixture"

afterAll(resetMemoryDatabase)

const builtinRoot = path.resolve(import.meta.dir, "../../../../expert-squads/builtin")
const loadNames = (prompt: string) => [...prompt.matchAll(/\bLoad(?:\s+only)?\s+`([^`]+)`/gi)].map((match) => match[1]!)

function context(agent: string): Tool.Context {
  return {
    sessionID: "prompt-skill-contract",
    messageID: "prompt-skill-contract",
    agent,
    abort: new AbortController().signal,
    messages: [],
    metadata() {},
    executionSurface: Tool.executionSurface(["skill"], []),
  }
}

test("every explicit built-in Agent Skill instruction executes its granted loader and returns the complete Skill", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const loadedInstructions: Array<{ packageID: string; agent: string; name: string }> = []
      const directories = (await fs.readdir(builtinRoot, { withFileTypes: true })).filter((entry) =>
        entry.isDirectory(),
      )
      for (const directory of directories) {
        const pkg = await ExpertSquadRegistry.loadSourcePackage(path.join(builtinRoot, directory.name))
        for (const [agent, prompt] of Object.entries(pkg.promptProfile.agents)) {
          const names = loadNames(prompt)
          if (names.length === 0) continue
          const grants =
            agent === "orchestrator"
              ? schedulerCapabilityGrants(pkg.manifest)
              : agentCapabilityGrants(pkg.manifest, agent)
          const skills = grants.packageSkillRefs.map((ref) => {
            const prepared = pkg.packageSkills.get(ref)!
            const skill = Skill.Info.parse({
              ...prepared.definition,
              content: prepared.content,
              location: `opencorvus-expert-squad-skill://${pkg.namespace}/${ref}`,
              bundle: {
                key: prepared.snapshot.sha256,
                skill: prepared.bundle.skill,
                files: prepared.bundle.files,
              },
            })
            return { ...skill, enabled: true, skill }
          })
          for (const ref of grants.defaultSkillRefs) {
            const name = defaultSkillNameFromRef(ref)
            const skill = await Skill.get(name)
            if (!skill) throw new Error(`Declared default Skill ${name} is missing from the real catalog`)
            skills.push({ ...skill, enabled: true, skill })
          }
          const loader = await SkillTool.init({
            skillSurface: {
              family: "production",
              tool_id: "skill",
              agent,
              base_role:
                agent === "orchestrator" ? "orchestrator" : pkg.manifest.capability_projection.agents[agent]!.base_role,
              scope: "project",
              tool_available: true,
              unmounted_pool_count: 0,
              skills,
            },
          })
          for (const name of names) {
            const loaded = await loader.execute({ name }, context(agent))
            const original = skills.find((row) => row.name === name)!.skill
            expect(loaded.metadata).toMatchObject({ name, names: [name], agent, count: 1 })
            expect(loaded.output).toContain(original.content.trim())
            loadedInstructions.push({ packageID: pkg.id, agent, name })
          }
        }
      }
      expect(loadedInstructions).toEqual(
        expect.arrayContaining([
          { packageID: "dynamic", agent: "dynamic-builder", name: "dynamic-team-method" },
          { packageID: "dynamic", agent: "dynamic-generalist", name: "dynamic-team-method" },
        ]),
      )
    },
  })
}, 180_000)

test("Dynamic production worker projections mount and load the exact Skill named by each worker prompt", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const config = await Config.get()
      for (const agentID of ["dynamic-builder", "dynamic-generalist"]) {
        const { workerCapability, skillProjection } = await PromptProfileResolver.resolveWorkerTurnProjection({
          projectDirectory: project.path,
          config,
          agentID,
        })
        const runtime = sessionRuntimeFromProjectedTemplate({
          template: RuntimeTemplateRegistry.get(workerCapability.identity.baseRole),
        })
        const surface = await SkillMount.resolve({
          identity: { ...workerCapability.identity, expertSquadID: workerCapability.expertSquadID },
          runtime,
          scope: "project",
          projectDirectory: project.path,
          skillProjection,
        })
        const loader = await SkillTool.init({ config, skillSurface: surface })
        const [name] = loadNames(workerCapability.promptOverlay)
        const loaded = await loader.execute({ name }, context(agentID))
        expect(loaded.metadata).toMatchObject({
          name: "dynamic-team-method",
          names: ["dynamic-team-method"],
          agent: agentID,
        })
        expect(loaded.output).toContain("# Dynamic Team Method")
      }
    },
  })
}, 60_000)

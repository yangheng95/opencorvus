import { afterEach, beforeEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Config } from "@/config/config"
import { ConfigPaths } from "@/config/paths"
import { Global } from "@/global"
import { Instance } from "@/project/instance"
import { Skill } from "@/skill/skill"
import { ConversationCapability } from "@/conversation/capability"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const globalFile = path.join(Global.Path.config, ConfigPaths.CANONICAL_FILE_NAME)
const baseline = { prompt_profile: { active: "base" }, permission_mode: "ask" }
const previousInline = process.env.OPENCORVUS_CONFIG_CONTENT

beforeEach(async () => {
  delete process.env.OPENCORVUS_CONFIG_CONTENT
  await fs.mkdir(Global.Path.config, { recursive: true })
  await fs.writeFile(globalFile, JSON.stringify(baseline))
  Config.global.reset()
  await Config.state.resetAll()
  await Skill.state.resetAll()
})
afterEach(async () => {
  if (previousInline === undefined) delete process.env.OPENCORVUS_CONFIG_CONTENT
  else process.env.OPENCORVUS_CONFIG_CONTENT = previousInline
  await resetMemoryDatabase()
})

async function skill(root: string, name: string) {
  const directory = path.join(root, name)
  await fs.mkdir(directory, { recursive: true })
  await fs.writeFile(
    path.join(directory, "SKILL.md"),
    `---\nname: ${name}\ndescription: Candidate source contract\n---\n\nUse the declared candidate source.\n`,
  )
  return directory
}
const assignment = (name: string) => ({ chat: { skill_refs: [name], mcp_server_refs: [] } })
async function projectSource(directory: string, source: Record<string, unknown>) {
  const file = path.join(directory, ".opencorvus", ConfigPaths.CANONICAL_FILE_NAME)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify(source))
  await Instance.provideProjectIdentity({ directory, fn: () => undefined })
}

test("a global username save retains each project's own configured Skill assignment", async () => {
  await using first = await memoryProject()
  await using second = await memoryProject()
  for (const [project, name] of [
    [first, "candidate-first"],
    [second, "candidate-second"],
  ] as const) {
    await skill(project.path, name)
    await projectSource(project.path, { skills: { paths: [name] }, primary_assistant_capabilities: assignment(name) })
  }
  const saved = await Config.updateGlobalPatch({ username: "project-sources-retained" })
  const selected = await Promise.all(
    [first, second].map((project) =>
      Instance.provideProjectIdentity({
        directory: project.path,
        fn: async () => ConversationCapability.assignment(await Config.get(), "chat").skill_refs,
      }),
    ),
  )
  expect({ username: saved.username, selected }).toEqual({
    username: "project-sources-retained",
    selected: [["candidate-first"], ["candidate-second"]],
  })
})

test("a global source removal retains a Skill still configured by its Project", async () => {
  await using project = await memoryProject()
  const retained = await skill(project.path, "candidate-retained")
  const removed = await skill(project.path, "candidate-removed")
  await fs.writeFile(globalFile, JSON.stringify({ ...baseline, skills: { paths: [removed, retained] } }))
  Config.global.reset()
  await projectSource(project.path, {
    skills: { paths: [retained] },
    primary_assistant_capabilities: assignment("candidate-retained"),
  })
  const saved = await Config.updateGlobalPatch({ skills: { paths: [] } })
  const actual = await Instance.provideProjectIdentity({ directory: project.path, fn: () => Config.get() })
  expect({
    globalPaths: saved.skills?.paths,
    projectPaths: actual.skills?.paths,
    assigned: ConversationCapability.assignment(actual, "chat").skill_refs,
  }).toEqual({ globalPaths: [], projectPaths: [retained], assigned: ["candidate-retained"] })
})

test("an implicit Project Skill remains assigned when an unrelated global field changes", async () => {
  await using project = await memoryProject()
  await skill(path.join(project.path, ".opencorvus", "skills"), "candidate-implicit")
  await projectSource(project.path, { primary_assistant_capabilities: assignment("candidate-implicit") })
  const saved = await Config.updateGlobalPatch({ username: "implicit-source-retained" })
  expect(saved.username).toBe("implicit-source-retained")
})

test("a removed sole Skill source returns the assignment error and retains its complete canonical source", async () => {
  await using project = await memoryProject()
  const source = await skill(project.path, "candidate-sole")
  await fs.writeFile(globalFile, JSON.stringify({ ...baseline, skills: { paths: [source] } }))
  Config.global.reset()
  await projectSource(project.path, { primary_assistant_capabilities: assignment("candidate-sole") })
  await Instance.provideProjectIdentity({ directory: project.path, fn: () => Config.get() })
  const original = JSON.parse(await fs.readFile(globalFile, "utf8"))
  const failure = await Config.updateGlobalPatch({ skills: { paths: [] } }).catch((error) => error)
  expect({
    typed: ConversationCapability.InvalidAssignmentError.isInstance(failure),
    canonical: JSON.parse(await fs.readFile(globalFile, "utf8")),
  }).toEqual({ typed: true, canonical: original })
})

test("a Project candidate adds its Skill source and assignment in one canonical mutation", async () => {
  await using project = await memoryProject()
  const source = await skill(project.path, "candidate-added")
  const saved = await Instance.provideProjectIdentity({
    directory: project.path,
    fn: () =>
      Config.updateProjectPatch({
        skills: { paths: [source] },
        primary_assistant_capabilities: assignment("candidate-added"),
      }),
  })
  expect({ paths: saved.skills?.paths, assigned: ConversationCapability.assignment(saved, "chat").skill_refs }).toEqual(
    { paths: [source], assigned: ["candidate-added"] },
  )
})

test("a global candidate repairs a Project assignment by adding its actual Skill source", async () => {
  await using project = await memoryProject()
  const source = await skill(project.path, "candidate-global-added")
  await projectSource(project.path, { primary_assistant_capabilities: assignment("candidate-global-added") })
  const saved = await Config.updateGlobalPatch({ skills: { paths: [source] } })
  const current = await Instance.provideProjectIdentity({
    directory: project.path,
    fn: () => Skill.get("candidate-global-added"),
  })
  expect({ paths: saved.skills?.paths, skill: current && { name: current.name, location: current.location } }).toEqual({
    paths: [source],
    skill: { name: "candidate-global-added", location: path.join(source, "SKILL.md") },
  })
})

test("a candidate catalog resolves its own source while the runtime retains its current definition", async () => {
  await using project = await memoryProject()
  const currentSource = await skill(project.path, "candidate-current")
  const nextSource = await skill(project.path, "candidate-next")
  await projectSource(project.path, { skills: { paths: [currentSource] } })
  const result = await Instance.provideProjectIdentity({
    directory: project.path,
    fn: async () => {
      const config = await Config.get()
      const current = await Skill.get("candidate-current")
      const candidate = await Skill.snapshotForConfig({ ...config, skills: { paths: [nextSource] } })
      const retained = await Skill.get("candidate-current")
      return {
        current: current?.location,
        candidate: candidate.skills["candidate-next"]?.location,
        retained: retained?.location,
      }
    },
  })
  expect(result).toEqual({
    current: path.join(currentSource, "SKILL.md"),
    candidate: path.join(nextSource, "SKILL.md"),
    retained: path.join(currentSource, "SKILL.md"),
  })
})

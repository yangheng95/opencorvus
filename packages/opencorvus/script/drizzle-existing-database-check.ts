/**
 * Existing-file ORM upgrade qualification. No server, scheduler or Provider execution.
 * Run from packages/opencorvus after installing patched beta20:
 *   bun run script/drizzle-existing-database-check.ts apply <baseline.json> <receipt.json>
 *   bun run script/drizzle-existing-database-check.ts verify <baseline.json> <receipt.json>
 * The second command is a fresh process and creates <receipt.json>.reopen.json.
 * The baseline is the preserved real Sol04 receipt, not an exported/rebuilt database.
 */
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import path from "node:path"
import { createRequire } from "node:module"
import { readExistingDatabaseFacts } from "../test/fixture/drizzle-existing-database-facts"

const [mode, baselineArgument, receiptArgument] = process.argv.slice(2)
assert(mode === "apply" || mode === "verify", "Expected apply or verify, followed by baseline and receipt paths")
assert(baselineArgument && receiptArgument, "Explicit baseline and output paths are required")
const baselinePath = path.resolve(baselineArgument)
const receiptPath = path.resolve(receiptArgument)
const outputPath = mode === "apply" ? receiptPath : `${receiptPath}.reopen.json`
const baseline = JSON.parse(await fs.readFile(baselinePath, "utf8"))
assert.equal(baseline.status, "preserved")
assert.equal(baseline.installedOrm, "1.0.0-beta.12-a5629fb")
const databasePath = path.resolve(baseline.sourceDatabase)
const runtime = path.dirname(path.dirname(databasePath))
assert.equal(path.basename(databasePath), "opencorvus.db")
assert.equal(path.basename(path.dirname(databasePath)), "data")
assert.equal(path.basename(path.dirname(runtime)).startsWith("opencorvus-automation-target-real-"), true)
const exists = async (file: string) =>
  fs.stat(file).then(
    () => true,
    (error) => {
      if (error.code === "ENOENT") return false
      throw error
    },
  )
assert.equal(await exists(databasePath), true)
assert.equal(await exists(outputPath), false, "Choose a new output receipt; existing acceptance history is immutable")
assert.deepEqual(
  await Promise.all(["auth.json", "models.json"].map((name) => exists(path.join(runtime, "data", name)))),
  [false, false],
)

const require = createRequire(import.meta.url)
const ormEntry = require.resolve("drizzle-orm")
const ormVersion = JSON.parse(await fs.readFile(path.join(path.dirname(ormEntry), "package.json"), "utf8")).version
assert.equal(ormVersion, "1.0.0-beta.20", "This checker mutates only the approved upgraded graph")
for (const key of [
  "OPENCORVUS_CONFIG",
  "OPENCORVUS_CONFIG_DIR",
  "OPENCORVUS_CONFIG_CONTENT",
  "OPENCORVUS_MODELS_PATH",
  "OPENCORVUS_MODELS_URL",
  "OPENCORVUS_TEST_MANAGED_CONFIG_DIR",
  "OPENCORVUS_API_KEY",
  "OPENCORVUS_EMBEDDED_DASHSCOPE_KEY",
  "OPENCORVUS_SERVER_PASSWORD",
  "OPENCORVUS_SERVER_USERNAME",
])
  delete process.env[key]
Object.assign(process.env, {
  OPENCORVUS_HOME: runtime,
  OPENCORVUS_TEST_HOME: runtime,
  OPENCORVUS_TEST_PROCESS_ROOT: path.dirname(runtime),
  OPENCORVUS_CONFIG_CONTENT: "{}",
})

const [{ Database }, { Project }, { Session }, { AutomationService }, { Instance }] = await Promise.all([
  import("../src/storage/db"),
  import("../src/project/project"),
  import("../src/session"),
  import("../src/scheduler/automation-service"),
  import("../src/project/instance"),
])
const receipt: Record<string, any> = {
  mode,
  status: "running",
  baselinePath,
  databasePath,
  ormVersion,
  ormEntry,
  pid: process.pid,
  qualification:
    "Original beta12 file through canonical Database.Client validation, domain reads and paused conditional model-default update; immutable real-model history retained. No new Provider execution.",
}
try {
  Database.Client()
  assert.equal(path.resolve(Database.Path()), databasePath)
  const read = () => readExistingDatabaseFacts(databasePath, baseline.facts)
  const before = read()
  const earlier = mode === "verify" ? JSON.parse(await fs.readFile(receiptPath, "utf8")) : undefined
  if (earlier) {
    assert.equal(earlier.status, "passed")
    assert.equal(earlier.databasePath, databasePath)
    assert.equal(earlier.databaseClosed, true)
    assert.equal(new Set([earlier.pid, process.pid]).size, 2)
    receipt.previousProcessID = earlier.pid
    assert.deepEqual(before, earlier.afterFacts)
  } else {
    assert.deepEqual(before, baseline.facts)
  }
  const owners: Array<{
    projectID: string
    sessionID: string
    automationID: string
    revisionID: string
    target: { scope: "project"; projectIds: string[] }
  }> = []
  for (const project of baseline.facts.projects) {
    const current = Project.get(project.id)
    assert(current)
    assert.deepEqual({ id: current.id, worktree: current.worktree }, { id: project.id, worktree: project.worktree })
  }
  for (const item of baseline.facts.cases) {
    const session = await Session.get(item.session.id)
    assert.deepEqual(
      { id: session.id, project_id: session.projectID, directory: session.directory, kind: session.kind },
      item.session,
    )
    const transcript = await Session.messages({ sessionID: session.id })
    const baselineMessageIDs = item.messages.map((message: any) => message.id).sort()
    assert.deepEqual(transcript.map((message) => message.info.id).sort(), baselineMessageIDs)
    const readRequests = transcript
      .flatMap((message) => message.parts)
      .filter((part) => part.type === "tool" && part.tool === "read" && part.state.status === "completed")
    assert.equal(readRequests.length, item.toolParts.filter((part: any) => part.request.tool === "read").length)
    const automation = AutomationService.list().find((definition) => definition.id === item.automationID)
    assert(automation)
    const old = item.definitions.at(-1)
    const target = { scope: "project" as const, projectIds: old.projectTargets.map((row: any) => row.project_id) }
    assert.deepEqual(automation.target, target)
    assert.equal(automation.status, "paused")
    owners.push({
      projectID: session.projectID,
      sessionID: session.id,
      automationID: automation.id,
      revisionID: automation.revisionId,
      target,
    })
    if (mode === "apply") {
      assert.equal(automation.revisionId, old.id)
      const updated = await AutomationService.update({
        id: automation.id,
        expectedRevisionId: old.id,
        name: `ORM beta20 existing-file ${item.label}`,
        model: null,
        reasoningEffort: null,
      })
      assert.deepEqual(
        {
          name: updated.name,
          status: updated.status,
          model: updated.model,
          reasoningEffort: updated.reasoningEffort,
          target: updated.target,
        },
        {
          name: `ORM beta20 existing-file ${item.label}`,
          status: "paused",
          model: null,
          reasoningEffort: null,
          target,
        },
      )
    }
  }
  await Database.awaitEffectIdle(20_000)
  const after = read()
  for (const [index, item] of after.cases.entries()) {
    const old = baseline.facts.cases[index]
    const { definitions, ...history } = item
    const { definitions: oldDefinitions, ...oldHistory } = old
    assert.deepEqual(history, oldHistory)
    assert.deepEqual(definitions.slice(0, 3), oldDefinitions)
    assert.equal(definitions.length, 4)
    const latest = definitions[3]!
    assert.deepEqual(
      {
        revision: latest.revision,
        name: latest.name,
        model: latest.model_id,
        provider: latest.model_provider_id,
        reasoning: latest.reasoning_effort,
        status: latest.status,
        targets: latest.projectTargets.map((target) => target.project_id),
      },
      {
        revision: 4,
        name: `ORM beta20 existing-file ${item.label}`,
        model: null,
        provider: null,
        reasoning: null,
        status: "paused",
        targets: oldDefinitions[2].projectTargets.map((target: any) => target.project_id),
      },
    )
    const listed = AutomationService.list().find((definition) => definition.id === item.automationID)
    assert.equal(listed?.revisionId, latest.id)
  }
  assert.deepEqual(after.projects, baseline.facts.projects)
  assert.deepEqual(after.schema, baseline.facts.schema)
  assert.deepEqual(after.quickCheck, [{ quick_check: "ok" }])
  Object.assign(receipt, { status: "passed", owners, afterFacts: after })
} catch (error) {
  Object.assign(receipt, {
    status: "failed",
    error: { name: error instanceof Error ? error.name : "Error", message: String(error) },
  })
  process.exitCode = 1
} finally {
  try {
    await Instance.disposeAll()
    await Database.awaitEffectIdle(20_000)
    Database.close()
    receipt.databaseClosed = true
  } catch (error) {
    Object.assign(receipt, { status: "failed", cleanupError: String(error) })
    process.exitCode = 1
  }
  await fs.writeFile(outputPath, JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" })
}
console.log(JSON.stringify({ status: receipt.status, mode, outputPath, databaseClosed: receipt.databaseClosed }))

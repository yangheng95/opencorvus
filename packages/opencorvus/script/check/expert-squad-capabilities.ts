import path from "node:path"
import { bootstrapIsolatedTestRuntime, removeIsolatedTestRuntime } from "@opencorvus-ai/util/test-runtime-environment"
import { prepareTestProcessSupervisor } from "../prepare-test-process-supervisor"

const supervisor = prepareTestProcessSupervisor()
const runtime = await bootstrapIsolatedTestRuntime("test")
if (supervisor) process.env.OPENCORVUS_PROCESS_SUPERVISOR = supervisor
const repository = path.resolve(import.meta.dir, "../../../..")
const selected = new Set(process.argv.slice(2))
try {
  const { ExpertSquadRegistry } = await import("../../src/expert-squad/registry")
  const { Instance } = await import("../../src/project/instance")
  const { declareNativeTaskProcessDeployment } = await import("../../src/runtime/task-process-deployment")
  const { Database } = await import("../../src/storage/db")
  declareNativeTaskProcessDeployment()
  const manifests = [
    ...new Bun.Glob("expert-squads/builtin/*/expert-squad.jsonc").scanSync({ cwd: repository, absolute: true }),
    ...new Bun.Glob("packages/opencorvus/src/expert-squad/builtin/*/expert-squad.jsonc").scanSync({
      cwd: repository,
      absolute: true,
    }),
  ]
    .filter((file) => selected.size === 0 || selected.has(path.basename(path.dirname(file))))
    .sort()
  if (manifests.length === 0) throw new Error("No exact Expert Squad IDs selected")
  const results: Array<Record<string, unknown>> = []
  await Instance.provide({
    directory: repository,
    fn: async () => {
      for (const file of manifests) {
        const id = path.basename(path.dirname(file))
        try {
          const loaded = await ExpertSquadRegistry.loadSourcePackage(path.dirname(file))
          const result = {
            id,
            status: "validated",
            agents: Object.keys(loaded.manifest.capability_projection.agents).length,
            skills: loaded.packageSkills.size,
            tools: loaded.packageToolBundles.size,
          }
          results.push(result)
          console.log(JSON.stringify(result))
        } catch (error) {
          const failure = error as Error & {
            code?: string
            capabilityRef?: string
            toolID?: string
            chars?: number
            tokens?: number
          }
          const result = {
            id,
            status: "invalid",
            name: failure.name,
            code: failure.code,
            capabilityRef: failure.capabilityRef,
            toolID: failure.toolID,
            chars: failure.chars,
            tokens: failure.tokens,
            message: failure.message,
          }
          results.push(result)
          console.error(JSON.stringify(result))
        }
      }
    },
  })
  await Instance.disposeAll()
  await Database.awaitEffectIdle(30_000)
  Database.close()
  const invalid = results.filter((row) => row.status === "invalid")
  console.log(
    JSON.stringify({ packages: results.length, validated: results.length - invalid.length, invalid: invalid.length }),
  )
  if (invalid.length) process.exitCode = 1
} finally {
  await removeIsolatedTestRuntime(runtime)
}

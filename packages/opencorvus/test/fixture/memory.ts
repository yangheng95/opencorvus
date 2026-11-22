import path from "node:path"
import fs from "node:fs/promises"
import { createManagedTemporaryDirectory, removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"
import { Instance } from "../../src/project/instance"
import { Database } from "../../src/storage/db"
import { hostGit as git } from "../../src/util/git"
import { declareNativeTaskProcessDeployment } from "../../src/runtime/task-process-deployment"

async function runGit(directory: string, args: string[]) {
  const result = await git(args, { cwd: directory, timeoutProfile: "default" })
  if (result.exitCode !== 0) throw new Error(result.stderr.toString().trim() || `git ${args.join(" ")} failed`)
}

async function settleMemoryInstances() {
  const { Bus } = await import("../../src/bus")
  const { RuntimeExecutionSettlement } = await import("../../src/runtime/execution-settlement")
  using execution = RuntimeExecutionSettlement.acquireSettlementGate()
  execution.closeAdmission(["protocol_publication"])
  using publications = Bus.acquireProcessSettlementGate()
  execution.requestCancellation(["protocol_publication"], new Error("Memory fixture runtime is being retired"))
  await execution.waitForIdle(["protocol_publication"], 60_000)
  await Instance.disposeAll()
  await execution.waitForIdle(["protocol_publication"], 60_000)
  publications.commit()
  execution.commit()
}

export async function memoryProject(identitySeed?: string) {
  declareNativeTaskProcessDeployment()
  const root = process.env.OPENCORVUS_TEST_PROCESS_ROOT
  if (!root) throw new Error("Memory tests require the repository test preload")
  const directory = await createManagedTemporaryDirectory(path.join(root, "fixtures"), "memory-")
  await runGit(directory, ["init"])
  await runGit(directory, ["config", "user.name", "OpenCorvus Test"])
  await runGit(directory, ["config", "user.email", "opencorvus-test@example.invalid"])
  if (identitySeed) {
    await fs.writeFile(path.join(directory, ".opencorvus-test-project-identity"), identitySeed)
    await runGit(directory, ["add", ".opencorvus-test-project-identity"])
  }
  await runGit(directory, ["commit", "--allow-empty", "-m", "root"])
  const physicalDirectory = await fs.realpath(directory)
  return {
    path: physicalDirectory,
    async [Symbol.asyncDispose]() {
      await settleMemoryInstances()
      const { ProcessSupervisor } = await import("../../src/shell/process-supervisor")
      await ProcessSupervisor.disposeLiveProcessesUnder(physicalDirectory)
      await removeManagedDirectoryTree(physicalDirectory)
    },
  }
}

export async function resetMemoryDatabase() {
  await settleMemoryInstances()
  const root = process.env.OPENCORVUS_TEST_PROCESS_ROOT
  const databasePath = Database.Path()
  if (!root || !path.resolve(databasePath).startsWith(path.resolve(root))) {
    throw new Error(`Refusing to reset non-test database ${databasePath}`)
  }
  await Database.resetFiles(databasePath)
}

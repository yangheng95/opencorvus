import path from "node:path"
import fs from "node:fs/promises"
import { createManagedTemporaryDirectory, removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"
import { Instance } from "../../src/project/instance"
import { Database } from "../../src/storage/db"
import { hostGit as git } from "../../src/util/git"
import { declareNativeTaskProcessDeployment } from "../../src/engine/task-execution-capsule-binding"

async function runGit(directory: string, args: string[]) {
  const result = await git(args, { cwd: directory, timeoutProfile: "default" })
  if (result.exitCode !== 0) throw new Error(result.stderr.toString().trim() || `git ${args.join(" ")} failed`)
}

export async function memoryProject() {
  declareNativeTaskProcessDeployment()
  const root = process.env.OPENCORVUS_TEST_PROCESS_ROOT
  if (!root) throw new Error("Memory tests require the repository test preload")
  const directory = await createManagedTemporaryDirectory(path.join(root, "fixtures"), "memory-")
  await runGit(directory, ["init"])
  await runGit(directory, ["config", "user.name", "OpenCorvus Test"])
  await runGit(directory, ["config", "user.email", "opencorvus-test@example.invalid"])
  await runGit(directory, ["commit", "--allow-empty", "--no-verify", "-m", "root"])
  return {
    path: await fs.realpath(directory),
    async [Symbol.asyncDispose]() {
      await Instance.disposeAll()
      await removeManagedDirectoryTree(directory)
    },
  }
}

export async function resetMemoryDatabase() {
  await Instance.disposeAll()
  const root = process.env.OPENCORVUS_TEST_PROCESS_ROOT
  const databasePath = Database.Path()
  if (!root || !path.resolve(databasePath).startsWith(path.resolve(root))) {
    throw new Error(`Refusing to reset non-test database ${databasePath}`)
  }
  await Database.resetFiles(databasePath)
  Database.Client()
  Database.close()
}

import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { createManagedTemporaryDirectory, removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"
import { markConversationCapabilityTransactionalInit } from "@/conversation/capability-transaction"
import { Instance } from "@/project/instance"
import { Project } from "@/project/project"
import { declareNativeTaskProcessDeployment } from "@/runtime/task-process-deployment"
import { hostGit } from "@/util/git"
import { resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test("a non-Git to Git refresh revalidates capability authority before admitting a peer lease", async () => {
  declareNativeTaskProcessDeployment()
  const processRoot = process.env.OPENCORVUS_TEST_PROCESS_ROOT
  if (!processRoot) throw new Error("Project refresh tests require the repository test preload")
  const directory = await createManagedTemporaryDirectory(path.join(processRoot, "fixtures"), "instance-refresh-")
  let releaseOuter!: () => void
  const outerReleased = new Promise<void>((resolve) => {
    releaseOuter = resolve
  })
  let markRefreshed!: () => void
  const refreshed = new Promise<void>((resolve) => {
    markRefreshed = resolve
  })
  const preflightGitContexts: boolean[] = []
  let initializerRuns = 0
  const init = markConversationCapabilityTransactionalInit(
    async () => {
      initializerRuns += 1
    },
    async () => {
      preflightGitContexts.push(Project.isGitRepo(Instance.worktree))
    },
  )
  let outer: Promise<void> | undefined
  let peer: Promise<string> | undefined
  try {
    outer = Instance.provide({
      directory,
      init,
      fn: async () => {
        const result = await hostGit(["init"], { cwd: directory, timeoutProfile: "default" })
        if (result.exitCode !== 0) throw new Error(result.stderr.toString().trim() || "git init failed")
        await Instance.provide({ directory, init, fn: () => undefined })
        markRefreshed()
        await outerReleased
      },
    })
    await Promise.race([refreshed, outer])

    peer = Instance.provide({ directory, init, fn: () => "peer-ready" })
    const outcome = await Promise.race([
      peer.then((value) => ({ status: "completed" as const, value })),
      new Promise<{ status: "timeout" }>((resolve) => {
        setTimeout(() => resolve({ status: "timeout" }), 1_000)
      }),
    ])

    expect({
      outcome,
      preflightGitContexts,
      initializerRuns,
    }).toEqual({
      outcome: { status: "completed", value: "peer-ready" },
      preflightGitContexts: [false, true],
      initializerRuns: 2,
    })
  } finally {
    releaseOuter()
    await Promise.allSettled([outer, peer].filter((value): value is Promise<unknown> => value !== undefined))
    await Instance.disposeAll()
    await fs.chmod(directory, 0o700).catch(() => undefined)
    await removeManagedDirectoryTree(directory)
  }
})

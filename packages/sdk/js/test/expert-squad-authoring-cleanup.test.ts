import { afterAll, expect, mock, test } from "bun:test"
import * as filesystemModule from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import type { ExpertSquadPackageDefinition } from "../src/expert-squad-authoring"

const runCleanupFailureCase = process.env.OPENCORVUS_SDK_AUTHORING_CLEANUP_FAILURE === "1"
const originalWriteFile = filesystemModule.writeFile.bind(filesystemModule)
const originalRm = filesystemModule.rm.bind(filesystemModule)
let cleanupFailureParent: string | undefined

if (runCleanupFailureCase) {
  mock.module("node:fs/promises", () => ({
    ...filesystemModule,
    writeFile: async (
      target: Parameters<typeof filesystemModule.writeFile>[0],
      data: Parameters<typeof filesystemModule.writeFile>[1],
    ) => {
      if (path.basename(String(target)) === "zz-write-failure.md") {
        throw new Error("forced expert squad package write failure")
      }
      return originalWriteFile(target, data)
    },
    rm: async (
      target: Parameters<typeof filesystemModule.rm>[0],
      options?: Parameters<typeof filesystemModule.rm>[1],
    ) => {
      const resolved = path.resolve(String(target))
      if (
        cleanupFailureParent &&
        path.dirname(resolved) === cleanupFailureParent &&
        path.basename(resolved).startsWith(".source.staging-")
      ) {
        throw new Error("forced expert squad package cleanup failure")
      }
      return originalRm(target, options)
    },
  }))
}

afterAll(() => {
  if (runCleanupFailureCase) mock.restore()
})

if (!runCleanupFailureCase) {
  test("runs SDK package write cleanup-evidence coverage in an isolated Bun process", { timeout: 0 }, async () => {
    const child = Bun.spawn([process.execPath, "test", "--timeout=0", path.join(import.meta.dir, "expert-squad-authoring-cleanup.test.ts")], {
      cwd: import.meta.dir,
      env: {
        ...process.env,
        OPENCORVUS_SDK_AUTHORING_CLEANUP_FAILURE: "1",
      },
      stdout: "pipe",
      stderr: "pipe",
    })
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    expect(exitCode, `${stdout}\n${stderr}`).toBe(0)
    expect(`${stdout}\n${stderr}`).toContain("1 pass")
  })
} else {
  const { writeExpertSquadPackage } = await import("../src/expert-squad-authoring")

  test("preserves both package write and destination cleanup failures", async () => {
    const parent = await filesystemModule.mkdtemp(path.join(os.tmpdir(), "opencorvus-sdk-cleanup-failure-"))
    const directory = path.join(parent, "source")
    cleanupFailureParent = path.resolve(parent)
    const definition = {
      manifest: {
        product_pillars: ["code", "work"],
        schema_version: 2,
        namespace: "example",
        id: "cleanup-evidence",
        name: "Cleanup evidence",
        label: "Cleanup evidence",
        version: "2026.07.25.1",
        readme: "README.md",
        selector: {
          summary: "Cleanup evidence selection summary",
          selection_guidance: "Select only for the cleanup evidence test.",
          instructions: "selector.md",
        },
        capability_sets: {},
        capability_projection: {
          scheduler: {
            capability_refs: [],
            base_role: "orchestrator",
          },
          agents: {},
          virtual_workflows: {},
        },
      },
      files: {
        "README.md": "# Cleanup evidence\n",
        "selector.md": "# Selector\n",
        "00-written-first.md": "written",
        "zz-write-failure.md": "not written",
      },
    } satisfies ExpertSquadPackageDefinition

    try {
      const error = await writeExpertSquadPackage({ directory, definition }).catch((cause) => cause)
      expect(error).toBeInstanceOf(AggregateError)
      expect(error).toMatchObject({
        message: "Expert squad package publication failed and staging cleanup also failed",
        cause: expect.objectContaining({ message: "forced expert squad package write failure" }),
      })
      expect(
        (error as AggregateError).errors.map((entry) => (entry instanceof Error ? entry.message : String(entry))),
      ).toEqual(["forced expert squad package write failure", "forced expert squad package cleanup failure"])
      const stagingEntries = await filesystemModule.readdir(parent)
      expect(stagingEntries.filter((entry) => entry.startsWith(".source.staging-"))).toHaveLength(1)
    } finally {
      cleanupFailureParent = undefined
      await originalRm(parent, { recursive: true, force: true })
    }
  })
}

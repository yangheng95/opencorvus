import { afterAll, expect, mock, test } from "bun:test"
import * as filesystemModule from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import type { ExpertSquadPackageDefinition } from "../src/expert-squad-authoring"
import { runIsolatedBunTest } from "../../../opencorvus/test/harness/isolated-bun-runner"

const runCleanupFailureCase = process.env.OPENCORVUS_SDK_AUTHORING_CLEANUP_FAILURE === "1"
const originalWriteFile = filesystemModule.writeFile.bind(filesystemModule)
const originalRm = filesystemModule.rm.bind(filesystemModule)
let cleanupFailureRoot: string | undefined

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
      if (cleanupFailureRoot && path.resolve(String(target)) === cleanupFailureRoot) {
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
    await runIsolatedBunTest({
      suiteName: "Expert Squad SDK package write cleanup evidence",
      isolatedFile: path.join(import.meta.dir, "expert-squad-authoring-cleanup.test.ts"),
      temporaryPrefix: "opencorvus-sdk-authoring-cleanup-",
      expectedPassCount: 1,
      inactivityTimeoutMilliseconds: 30_000,
      env: {
        OPENCORVUS_SDK_AUTHORING_CLEANUP_FAILURE: "1",
      },
      forbiddenOutput: ["killed "],
    })
  })
} else {
  const { writeExpertSquadPackage } = await import("../src/expert-squad-authoring")

  test("preserves both package write and destination cleanup failures", async () => {
    const parent = await filesystemModule.mkdtemp(path.join(os.tmpdir(), "opencorvus-sdk-cleanup-failure-"))
    const directory = path.join(parent, "source")
    cleanupFailureRoot = path.resolve(directory)
    const definition = {
      manifest: {
        product_pillars: ["code", "work"],
        schema_version: 1,
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
        capability_projection: {
          scheduler: {
            inherit_base_tools: false,
            built_in_tool_ids: [],
            default_skill_refs: [],
            package_skill_refs: [],
            default_tool_refs: [],
            package_tool_refs: [],
            default_mcp_server_refs: [],
            package_mcp_server_refs: [],
            default_mcp_tool_refs: [],
            package_mcp_tool_refs: [],
            default_mcp_prompt_refs: [],
            package_mcp_prompt_refs: [],
            default_mcp_resource_refs: [],
            package_mcp_resource_refs: [],
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
        message: "Expert squad package writing failed and destination cleanup also failed",
        cause: expect.objectContaining({ message: "forced expert squad package write failure" }),
      })
      expect(
        (error as AggregateError).errors.map((entry) => (entry instanceof Error ? entry.message : String(entry))),
      ).toEqual(["forced expert squad package write failure", "forced expert squad package cleanup failure"])
      expect(await filesystemModule.stat(directory)).toBeDefined()
    } finally {
      cleanupFailureRoot = undefined
      await originalRm(parent, { recursive: true, force: true })
    }
  })
}

import { afterEach, expect, test } from "bun:test"
import path from "node:path"
import { permissionDescriptor } from "@/permission/invocation"
import { Instance } from "@/project/instance"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)

test.each([
  { toolName: "artifact_snapshot", args: { files: [{ path: "docs/goal.md", media_type: "text/markdown" }] } },
  { toolName: "artifact_snapshot", args: { source_commit: "a".repeat(40), files: [{ path: "docs/result.md" }] } },
  { toolName: "memory", args: { action: "update", content: "Remember the actual result" } },
  { toolName: "work_artifact_validate", args: { artifact_id: "artifact_actual" } },
])("describes the complete structured local operation: %j", async ({ toolName, args }) => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const descriptor = (await permissionDescriptor({
        providerKind: "builtin",
        providerID: "builtin",
        toolName,
        args,
      }))!
      expect(descriptor).toMatchObject({ effectClass: "write_local", projectGrantEligible: false })
      expect(descriptor.scope.resource).toEqual({
        scope_type: "provider",
        operation: toolName,
        arguments: args,
        arguments_sha256: expect.any(String),
      })
    },
  })
})

test("describes an ordinary file write with its actual absolute resource", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const filePath = path.join(project.path, "result.md")
      const descriptor = (await permissionDescriptor({
        providerKind: "builtin",
        providerID: "builtin",
        toolName: "write",
        args: { filePath, content: "Actual result\n" },
      }))!
      expect(descriptor.scope.resource).toMatchObject({
        scope_type: "filesystem",
        operation: "write",
        paths: [filePath],
        working_directory: project.path,
      })
    },
  })
})

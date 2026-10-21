import { afterEach, expect, test } from "bun:test"
import path from "node:path"
import fs from "node:fs/promises"
import { ApplyPatchTool } from "@/tool/apply_patch"
import { Tool } from "@/tool/tool"
import { Instance } from "@/project/instance"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)

test.each([
  ["", 0],
  ["one", 1],
  ["one\n", 1],
  ["one\ntwo\n", 2],
] as const)("reports the actual deleted text lines for %j", async (before, deletions) => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const filePath = path.join(project.path, "deleted.txt")
      await fs.writeFile(filePath, before)
      const tool = await ApplyPatchTool.init()
      const result = await tool.execute(
        { patchText: "*** Begin Patch\n*** Delete File: deleted.txt\n*** End Patch" },
        {
          sessionID: "ses_patch_counts",
          messageID: "msg_patch_counts",
          agent: "coding",
          messages: [],
          abort: new AbortController().signal,
          metadata() {},
          executionAuthority: {
            kind: "conversation",
            sessionID: "ses_patch_counts",
            projectID: Instance.project.id,
            directory: project.path,
          },
          executionSurface: Tool.executionSurface(["apply_patch"], []),
        },
      )
      expect(result.metadata.files).toMatchObject([
        { filePath, type: "delete", before, after: "", additions: 0, deletions },
      ])
      expect(result.output).toBe("Success. Updated the following files:\nD deleted.txt")
    },
  })
})

import z from "zod"
import * as path from "path"
import { Tool } from "./tool"
import { createTwoFilesPatch } from "diff"
import DESCRIPTION from "./write.txt"
import { Bus } from "../bus"
import { File } from "../file"
import { FileWatcher } from "../file/watcher"
import { FileTime } from "../file/time"
import { Instance } from "../project/instance"
import { trimDiff } from "./edit"
import { assertBuildWriteDirectory, assertExternalDirectory } from "./external-directory"
import { executionFiles, executionProcessAuthority } from "./execution-files"

export const WriteTool = Tool.define("write", {
  description: DESCRIPTION,
  parameters: z.object({
    content: z.string().describe("The content to write to the file"),
    filePath: z.string().describe("The absolute path to the file to write (must be absolute, not relative)"),
  }),
  async execute(params, ctx) {
    const processAuthority = executionProcessAuthority(ctx)
    const filepath = path.isAbsolute(params.filePath) ? params.filePath : path.join(Instance.directory, params.filePath)
    await assertBuildWriteDirectory(ctx, filepath)
    await assertExternalDirectory(ctx, filepath)

    const files = executionFiles(ctx)
    const stat = await files.stat(filepath).catch(() => undefined)
    const exists = Boolean(stat)
    const contentOld = exists ? await files.readFile(filepath, "utf8") : ""
    if (exists) await FileTime.assert(ctx.sessionID, filepath)

    const diff = trimDiff(createTwoFilesPatch(filepath, filepath, contentOld, params.content))
    await ctx.ask({
      permission: "edit",
      patterns: [path.relative(Instance.worktree, filepath)],
      always: ["*"],
      metadata: {
        filepath,
        diff,
      },
    })

    await files.mkdir(path.dirname(filepath), { recursive: true })
    await files.writeFile(filepath, params.content)
    await Bus.publish(File.Event.Edited, {
      file: filepath,
      processAuthority,
    })
    await Bus.publish(FileWatcher.Event.Updated, {
      file: filepath,
      event: exists ? "change" : "add",
    })
    FileTime.read(ctx.sessionID, filepath)

    return {
      title: path.relative(Instance.worktree, filepath),
      metadata: {
        filepath,
        exists: exists,
      },
      output: "Wrote file successfully.",
    }
  },
})

import z from "zod"
import * as path from "path"
import { Tool } from "./tool"
import { createTwoFilesPatch, diffLines } from "diff"
import DESCRIPTION from "./write.txt"
import { Bus } from "../bus"
import { File } from "../file"
import { FileWatcher } from "../file/watcher"
import { FileTime } from "../file/time"
import { Instance } from "../project/instance"
import { trimDiff } from "./edit"
import { assertBuildWriteDirectory, assertExternalDirectory } from "./external-directory"
import { executionFiles, executionProcessAuthority } from "./execution-files"
import { AttachmentStore } from "../storage/attachment-store"
import type { FileDiff } from "../snapshot/types"

export const WriteTool = Tool.define("write", {
  description: DESCRIPTION,
  parameters: z.union([
    z
      .object({
        content: z.string().describe("The text content to write to the file"),
        filePath: z.string().describe("The absolute destination file path"),
      })
      .strict(),
    z
      .object({
        attachmentUrl: z
          .string()
          .regex(/^\/attachment\/[^/\\?#]+\/[^/\\?#]+$/)
          .describe("The exact canonical attachment URL to save as a new local file, preserving its bytes"),
        filePath: z
          .string()
          .describe("The absolute destination path for a new file; an existing entry returns FileConflictError"),
      })
      .strict(),
  ]),
  async execute(params, ctx) {
    const processAuthority = executionProcessAuthority(ctx)
    const filepath = path.isAbsolute(params.filePath) ? params.filePath : path.join(Instance.directory, params.filePath)
    await assertBuildWriteDirectory(ctx, filepath)
    await assertExternalDirectory(ctx, filepath)

    return FileTime.withLock(filepath, async () => {
      ctx.abort.throwIfAborted()
      const files = executionFiles(ctx)
      const stat = await files.stat(filepath).catch(() => undefined)
      const exists = Boolean(stat)
      let attachment: AttachmentStore.Reference | undefined
      let textChange: { diff: string; filediff: FileDiff } | undefined
      if ("attachmentUrl" in params) {
        const conflict = () => new File.ConflictError({ path: filepath, message: `File already exists: ${filepath}` })
        if (exists) throw conflict()
        const snapshot = await AttachmentStore.readVerifiedReference({
          projectID: Tool.requireExecutionAuthority(ctx).projectID,
          url: params.attachmentUrl,
        })
        ctx.abort.throwIfAborted()
        await files.mkdir(path.dirname(filepath), { recursive: true })
        try {
          await files.writeFile(filepath, snapshot.bytes, { flag: "wx" })
        } catch (error) {
          if ((error as NodeJS.ErrnoException)?.code === "EEXIST") throw conflict()
          throw error
        }
        attachment = snapshot.reference
      } else {
        const contentOld = exists ? await files.readFile(filepath, "utf8") : ""
        if (exists) await FileTime.assert(ctx.sessionID, filepath)

        await files.mkdir(path.dirname(filepath), { recursive: true })
        await files.writeFile(filepath, params.content)
        const contentNew = await files.readFile(filepath, "utf8")
        const filediff: FileDiff = {
          file: filepath,
          before: contentOld,
          after: contentNew,
          status: exists ? "modified" : "added",
          additions: 0,
          deletions: 0,
        }
        for (const change of diffLines(contentOld, contentNew)) {
          if (change.added) filediff.additions += change.count || 0
          if (change.removed) filediff.deletions += change.count || 0
        }
        textChange = { diff: trimDiff(createTwoFilesPatch(filepath, filepath, contentOld, contentNew)), filediff }
      }
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
          ...(attachment ? { source: attachment, bytes: attachment.size } : {}),
          ...textChange,
        },
        output: attachment ? "Wrote attachment file successfully." : "Wrote file successfully.",
      }
    })
  },
})

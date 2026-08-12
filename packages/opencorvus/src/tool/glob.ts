import z from "zod"
import path from "path"
import { Tool } from "./tool"
import { Filesystem } from "../util/filesystem"
import DESCRIPTION from "./glob.txt"
import { Ripgrep } from "../file/ripgrep"
import { Instance } from "../project/instance"
import { assertExternalDirectory } from "./external-directory"

export const GlobTool = Tool.define("glob", {
  description: DESCRIPTION,
  parameters: z.object({
    pattern: z.string().describe("The glob pattern to match files against"),
    path: z
      .string()
      .optional()
      .describe(
        `The directory to search in. If not specified, the current working directory will be used. IMPORTANT: Omit this field to use the default directory. DO NOT enter "undefined" or "null" - simply omit it for the default behavior. Must be a valid directory path if provided.`,
      ),
  }),
  async execute(params, ctx) {

    let search = params.path ?? Instance.directory
    // On win32, translate Git Bash / Cygwin / WSL mount paths
    // (`/c/...`, `/mnt/c/...`) to native Windows form BEFORE path.isAbsolute
    // / path.resolve / fs.stat see it. path.isAbsolute("/mnt/c/...") returns
    // false on Windows, which would silently re-root the search at
    // Instance.directory and the assertExternalDirectory check would never
    // see the LLM-supplied path. Reuses the same Filesystem.windowsPath
    // translator the bash tool uses (rule 8 single source).
    if (process.platform === "win32") search = Filesystem.windowsPath(search)
    search = path.isAbsolute(search) ? search : path.resolve(Instance.directory, search)
    await assertExternalDirectory(ctx, search, { kind: "directory" })

    const limit = 100
    const files: Array<{ path: string; mtime: number }> = []
    let truncated = false
    const executionAuthority = Tool.requireExecutionAuthority(ctx)
    const matches = executionAuthority.kind === "task"
      ? Ripgrep.filesForTask({
          cwd: search,
          glob: [params.pattern],
          signal: ctx.abort,
          taskID: executionAuthority.taskID,
        })
      : Ripgrep.filesForHost({ cwd: search, glob: [params.pattern], signal: ctx.abort })
    for await (const file of matches) {
      if (files.length >= limit) {
        truncated = true
        break
      }
      const full = path.resolve(search, file)
      const stats = Filesystem.stat(full)?.mtime.getTime() ?? 0
      files.push({
        path: full,
        mtime: stats,
      })
    }
    files.sort((a, b) => b.mtime - a.mtime)

    const output: string[] = []
    if (files.length === 0) output.push("No files found")
    if (files.length > 0) {
      output.push(...files.map((f) => f.path))
      if (truncated) {
        output.push("")
        output.push(
          `(Results are truncated: showing first ${limit} results. Consider using a more specific path or pattern.)`,
        )
      }
    }

    return {
      title: path.relative(Instance.worktree, search),
      metadata: {
        count: files.length,
        truncated,
      },
      output: output.join("\n"),
    }
  },
})

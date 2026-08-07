import fs from "fs/promises"
import path from "path"
import { Identifier } from "../id/id"
import { PermissionNext } from "../permission/next"
import { Scheduler } from "../scheduler"
import { Filesystem } from "../util/filesystem"
import { Glob } from "../util/glob"
import { Instance } from "@/project/instance"
import { Project } from "@/project/project"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { taskPrimaryProjectRoot } from "@/project/task-runtime-root"
import type { SessionExecutionAuthority } from "@/engine/task-session-lineage"
import type { ToolExecutionSurface } from "./execution-surface"

export namespace Truncate {
  export const MAX_LINES = 2000
  export const MAX_BYTES = 50 * 1024
  const RETENTION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
  const HOUR_MS = 60 * 60 * 1000

  export type Result = { content: string; truncated: false } | { content: string; truncated: true; outputPath: string }

  export interface Options {
    maxLines?: number
    maxBytes?: number
    direction?: "head" | "tail"
    sessionID?: string
    executionAuthority?: SessionExecutionAuthority
  }

  export function init() {
    Scheduler.register({
      id: "tool.truncation.cleanup",
      interval: HOUR_MS,
      runAtStart: true,
      run: cleanup,
      scope: "global",
    })
  }

  function isMissingFile(error: unknown): boolean {
    return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT"
  }

  async function statExistingFile(filepath: string) {
    try {
      return await fs.stat(filepath)
    } catch (error) {
      if (isMissingFile(error)) return undefined
      throw error
    }
  }

  async function unlinkExistingFile(filepath: string) {
    try {
      await fs.unlink(filepath)
    } catch (error) {
      if (isMissingFile(error)) return
      throw error
    }
  }

  function registeredRuntimeRoots() {
    return [...new Set(Project.list().map((project) => ProjectRuntimePaths.projectRuntimeRoot(project.worktree)))]
  }

  async function cleanupRoot(root: string, cutoff: number) {
    const entries = [
      ...(await Glob.scan("s/*/*/tool-output/tool_*", { cwd: root, include: "file" })),
      ...(await Glob.scan("sx/*/*/tool-output/tool_*", { cwd: root, include: "file" })),
    ]
    for (const entry of entries) {
      const filepath = path.join(root, entry)
      const stat = await statExistingFile(filepath)
      if (!stat || stat.mtimeMs >= cutoff) continue
      await unlinkExistingFile(filepath)
    }
  }

  export async function cleanup() {
    const cutoff = Date.now() - RETENTION_MS
    for (const root of registeredRuntimeRoots()) {
      await cleanupRoot(root, cutoff)
    }
  }

  function hasRecoveryTool(surface?: ToolExecutionSurface): boolean {
    return surface?.toolIDs.includes("read") === true
  }

  /**
   * Tool output too large for the prompt is shipped to disk and replaced with
   * a preview + recovery hint. The recovery hint is an active contract: the
   * receiving execution surface MUST be able to read the saved file via Read.
   * When that surface lacks the tool we throw rather than silently lose data.
   *
   * `direction` defaults to "tail" because the most useful piece of a long
   * tool output (build log, test failure, error trace) is almost always at
   * the END. Callers that genuinely want the head can override.
   */
  export async function output(
    text: string,
    options: Options = {},
    surface?: ToolExecutionSurface,
  ): Promise<Result> {
    const maxLines = options.maxLines ?? MAX_LINES
    const maxBytes = options.maxBytes ?? MAX_BYTES
    const direction = options.direction ?? "tail"
    const lines = text.split("\n")
    const totalBytes = Buffer.byteLength(text, "utf-8")

    if (lines.length <= maxLines && totalBytes <= maxBytes) {
      return { content: text, truncated: false }
    }

    if (!surface || !hasRecoveryTool(surface)) {
      // No recovery path → truncating would lose information silently.
      // Surface the failure so the caller can react (split the request,
      // route through an execution surface that owns Read, or fail the task).
      throw new Error(
        `Truncate.output: tool result is ${totalBytes} bytes / ${lines.length} lines ` +
          `(limit ${maxBytes}/${maxLines}). The active execution surface does not have the 'read' tool needed to ` +
          `re-read a saved copy. Truncating here would silently lose data — denying the call instead.`,
      )
    }

    const out: string[] = []
    let i = 0
    let bytes = 0
    let hitBytes = false

    if (direction === "head") {
      for (i = 0; i < lines.length && i < maxLines; i++) {
        const size = Buffer.byteLength(lines[i], "utf-8") + (i > 0 ? 1 : 0)
        if (bytes + size > maxBytes) {
          hitBytes = true
          break
        }
        out.push(lines[i])
        bytes += size
      }
    } else {
      for (i = lines.length - 1; i >= 0 && out.length < maxLines; i--) {
        const size = Buffer.byteLength(lines[i], "utf-8") + (out.length > 0 ? 1 : 0)
        if (bytes + size > maxBytes) {
          hitBytes = true
          break
        }
        out.unshift(lines[i])
        bytes += size
      }
    }

    const removed = hitBytes ? totalBytes - bytes : lines.length - out.length
    const unit = hitBytes ? "bytes" : "lines"
    const preview = out.join("\n")

    const id = Identifier.ascending("tool")
    const sessionID = options.sessionID
    if (!sessionID) {
      throw new Error("Truncate.output: sessionID is required for runtime-scoped tool output")
    }
    const executionAuthority = options.executionAuthority
    if (!executionAuthority) {
      throw new Error("Truncate.output: executionAuthority is required before persisted output can be selected")
    }
    if (executionAuthority.sessionID !== sessionID) {
      throw new Error("Truncate.output: execution authority does not own the requested Session output")
    }
    const taskID = executionAuthority.kind === "task" ? executionAuthority.taskID : undefined
    const projectRoot = taskID
      ? taskPrimaryProjectRoot(taskID, { activeProjectID: Instance.project.id })
      : Instance.project.worktree
    const outputDir = taskID
      ? ProjectRuntimePaths.toolOutputDir(projectRoot, taskID, sessionID)
      : ProjectRuntimePaths.rootSessionToolOutputDir(projectRoot, sessionID)
    const filepath = path.join(outputDir, id)
    if (PermissionNext.evaluate("read", filepath, surface.permission).action === "deny") {
      throw new Error(
        `Truncate.output: the active execution surface denies reading the saved output path ${filepath}; ` +
          "truncating here would silently lose data.",
      )
    }
    await Filesystem.write(filepath, text)

    const hint = `The tool call succeeded but the output was truncated. Full output saved to: ${filepath}\nUse Read with offset/limit to view the required sections.`
    const message =
      direction === "head"
        ? `${preview}\n\n...${removed} ${unit} truncated...\n\n${hint}`
        : `...${removed} ${unit} truncated...\n\n${hint}\n\n${preview}`

    return { content: message, truncated: true, outputPath: filepath }
  }
}

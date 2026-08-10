// ── IntentBundle ──
//
// Materializes the user's task request as a stable, on-disk bundle that
// downstream agents (architect / build executor / integrity) can
// reference by path.
//
// Why this exists:
//
// Several stage prompts (architect-core.txt, session
// system.txt) tell the LLM that the executor "has the intent bundle at
// the task-scoped runtime intent bundle and explicitly point at its request.md
// as the canonical source for the user's original request. Architect-generated
// goal contracts then reference paths like "see the runtime intent request
// §3 for the full entity list" verbatim. Without this writer, those paths
// resolved to nothing on disk — the architect was producing references to a
// path the project never created. Either the executor would silently miss the
// reference (and lean on the goal contract's paraphrase, leaking architect
// intent into build), or it would search the workspace and hallucinate.
//
// Single source of truth: `<project.worktree>/.opencorvus/.r/tasks/<task-id>/intent/request.md`.
// Mirrors AttachmentStore's resolution path (Project.get(projectID).worktree
// — NOT Instance.directory, which can drift) so writers and readers always
// agree on the location.
//
// Bundle is written before `persistQueuedTask` runs so it is on disk by the
// time the orchestrator wakes the pipeline agents. The contents are deterministic
// from {request, attachments}; rerunning is idempotent.

import { Project } from "@/project/project"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { Log } from "@/util/log"
import type { AttachmentStore } from "@/storage/attachment-store"
import { Filesystem } from "@/util/filesystem"

const log = Log.create({ service: "intent-bundle" })

export namespace IntentBundle {
  export type WriteInput = {
    projectID: string
    taskID: string
    request: string
    attachments?: AttachmentStore.Reference[]
    source?: string
    createdAt?: number
  }

  /** Relative path used by agents whose file tools resolve against the
   *  project directory (in-process OpenCorvus `read` tool — tool/read.ts). */
  export const RELATIVE_PATH_TEMPLATE = ".opencorvus/.r/tasks/<task-id>/intent/request.md"

  export function relativePath(taskID: string): string {
    return ProjectRuntimePaths.intentPaths("", taskID).relative
  }

  /**
   * Resolve the request.md paths for a project. `relative` is for in-process
   * consumers (OpenCorvus `read` resolves against the project dir);
   * `absolute` is for consumers whose current working directory is an isolated Task dispatch worktree — a relative
   * `.opencorvus/...` would not resolve there. `absolute` points at the real
   * write location (`<project.worktree>/.opencorvus/.r/tasks/<task-id>/intent/request.md`) so
   * writer and reader agree (same resolution as `write`). Throws on unknown
   * project (rule 7 — load-bearing, no silent fallback).
   */
  export function paths(projectID: string, taskID: string): { relative: string; absolute: string } {
    const project = Project.get(projectID)
    if (!project) {
      throw new Error(`IntentBundle.paths: unknown project ${projectID}`)
    }
    return ProjectRuntimePaths.intentPaths(project.worktree, taskID)
  }

  /**
   * Prompt-text pointer to the materialized intent bundle. `pathMode` selects
   * the path form for the consumer's file-tool resolution model. The user
   * request (task row) is the source; this file is a deterministic projection.
   */
  export function reference(input: { projectID: string; taskID: string; pathMode: "relative" | "absolute" }): string {
    const resolved = paths(input.projectID, input.taskID)
    const p = input.pathMode === "absolute" ? resolved.absolute : resolved.relative
    return [
      "## Original User Request (intent bundle)",
      "",
      `The verbatim user request and attachment manifest for this task are at: ${p}`,
      "Read it before implementing or decomposing — do not paraphrase from upstream summaries.",
    ].join("\n")
  }

  function renderRequest(input: WriteInput): string {
    const created = new Date(input.createdAt ?? Date.now()).toISOString()
    const lines: string[] = []
    lines.push("---")
    lines.push(`taskID: ${input.taskID}`)
    lines.push(`projectID: ${input.projectID}`)
    if (input.source) lines.push(`source: ${input.source}`)
    lines.push(`createdAt: ${created}`)
    lines.push("---")
    lines.push("")
    lines.push("# User request")
    lines.push("")
    lines.push(input.request.replace(/\r\n/g, "\n").trimEnd())
    lines.push("")

    if (input.attachments && input.attachments.length > 0) {
      lines.push("## Attachments")
      lines.push("")
      lines.push("| sha (short) | filename | mime | input kind | source | url |")
      lines.push("|---|---|---|---|---|---|")
      for (const att of input.attachments) {
        const shortSha = att.sha.slice(0, 12)
        lines.push(
          `| \`${shortSha}\` | ${att.filename ?? "—"} | ${att.mime} | ${att.intent ?? "—"} | ${att.source ?? "—"} | \`${att.url}\` |`,
        )
      }
      lines.push("")
    }

    return lines.join("\n")
  }

  /**
   * Write the bundle for a task. Returns the absolute path of request.md.
   * Throws if the project cannot be resolved — callers should treat the bundle
   * as load-bearing for downstream agents.
   */
  export async function write(input: WriteInput): Promise<string> {
    const project = Project.get(input.projectID)
    if (!project) {
      throw new Error(`IntentBundle.write: unknown project ${input.projectID}`)
    }
    const abs = paths(input.projectID, input.taskID).absolute
    const body = renderRequest(input)
    await Filesystem.writeAtomic(abs, body)
    log.info("intent bundle written", {
      taskID: input.taskID,
      projectID: input.projectID,
      path: abs,
      bytes: body.length,
      attachments: input.attachments?.length ?? 0,
    })
    return abs
  }
}

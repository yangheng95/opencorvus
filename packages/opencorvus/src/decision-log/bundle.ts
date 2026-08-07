// ── DecisionLogBundle ──
//
// Materializes the COMPLETE decision log for a task as a stable, on-disk file
// that downstream agents can reference by path.
//
// Why this exists:
//
// The decision log lives in the `decision_log` SQLite table and is injected
// into agent prompts via `toPromptSection` / `phasePromptSection` — but those
// renders are TRUNCATED (per-entry value cap, per-phase entry limit) to bound
// prompt bytes. The full WHY behind a truncated decision was only reachable
// via `readByKey()`, a TS function no LLM/shell agent can call. This writer
// projects the full, untruncated log to disk so an agent can `read` it.
//
// Single source of truth: the `decision_log` table. This file is a
// regenerated, read-only PROJECTION — never authored by an agent, never read
// back by host code as authority. (Mirrors the frontend-design materialized
// frontend template and the intent bundle: same "materialize a DB/context surface to
// `.opencorvus/` for agent consumption" pattern.)
//
// Path resolution invariant (see artifacts/2026-05-18-decision-log-
// materialization §8): the OpenCorvus `read` tool resolves a relative path
// against `Instance.directory` (tool/read.ts), so in-process build / review
// agents reach the task-scoped runtime decision-log projection by RELATIVE path.
// Consumers rooted in an isolated worktree need the ABSOLUTE project-runtime path. `paths()` returns both;
// callers pick the form via the consumer's resolution model.

import { createDecisionLog } from "./index"
import { Log } from "@/util/log"
import { ProjectRuntimePaths } from "@/project/runtime-paths"
import { Filesystem } from "@/util/filesystem"

const log = Log.create({ service: "decision-log-bundle" })

export namespace DecisionLogBundle {
  /** Relative path used by agents whose file tools resolve against the
   *  project directory (in-process OpenCorvus `read` tool). */
  export const RELATIVE_PATH_TEMPLATE = ".opencorvus/.r/t/<task-key>/decision-log.md"

  /**
   * Resolve the bundle paths for a project directory. `relative` is for
   * consumers resolving against `Instance.directory`; `absolute` is for
   * consumers rooted in an isolated worktree.
   */
  export function paths(projectDir: string, taskID: string): { relative: string; absolute: string } {
    return ProjectRuntimePaths.decisionLogPaths(projectDir, taskID)
  }

  /**
   * Render the complete decision log and write it to
   * `<projectDir>/.opencorvus/.r/t/<task-key>/decision-log.md`. Returns the absolute path.
   *
   * HARD FAIL (rule 7 — no fallback): a write failure throws. The caller must
   * not swallow it and continue on the truncated prompt — a stale or missing
   * "complete" projection that silently degrades is worse than a loud failure.
   * An empty log writes an empty document (an honest projection of "no
   * decisions yet" — not a fallback).
   */
  export async function write(projectDir: string, taskID: string): Promise<string> {
    const { absolute } = paths(projectDir, taskID)
    const body = createDecisionLog(taskID).toFullDocument()
    await Filesystem.writeAtomic(absolute, body)
    log.info("decision log bundle written", {
      taskID,
      projectDir,
      path: absolute,
      bytes: body.length,
    })
    return absolute
  }

  /**
   * Prompt-text pointer telling an agent the complete decision log is on disk
   * and where. `mode` selects the path form for the consumer's file-tool
   * resolution model (see the path-resolution invariant in the module header).
   * This is NOT the canonical decision log — it points at a materialized
   * read-only projection; the `decision_log` table remains the source of truth.
   */
  export function reference(input: { projectDir: string; taskID: string; mode: "relative" | "absolute" }): string {
    const p =
      input.mode === "absolute"
        ? paths(input.projectDir, input.taskID).absolute
        : paths(input.projectDir, input.taskID).relative
    return [
      "## Decision Log (complete, on disk)",
      "",
      `The complete decision log for this task — every recorded decision with ` +
        `its full untruncated WHY — is materialized at: ${p}`,
      "",
      "It is a regenerated, read-only projection of the decision_log table " +
        "(the source of truth). When an inline Decision Log summary truncates " +
        "a value you need in full, read this file.",
    ].join("\n")
  }
}

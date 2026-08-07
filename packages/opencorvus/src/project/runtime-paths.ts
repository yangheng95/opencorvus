import path from "node:path"
import { Identifier } from "@/id/id"

type BranchInput = { taskID: string; sessionID: string }

function safeSegment(input: string): string {
  const value = input
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
  if (!value) throw new Error("ProjectRuntimePaths: empty path segment")
  return value
}

function idSegment(input: string): string {
  return safeSegment(Identifier.directoryKey(input))
}

function idFanout(input: string): [string, string] {
  const key = idSegment(input)
  return [key.slice(0, 2), key.slice(2)]
}

function scopedKey(scope: string, input: string): string {
  return safeSegment(Identifier.scopedDirectoryKey(scope, input))
}

function scopedFanout(scope: string, input: string): [string, string] {
  const key = scopedKey(scope, input)
  return [key.slice(0, 2), key.slice(2)]
}

function taskSessionKey(taskID: string, sessionID: string): string {
  return `${taskID}:${sessionID}`
}

export namespace ProjectRuntimePaths {
  export function projectConfigRoot(projectDir: string): string {
    return path.join(projectDir, ".opencorvus")
  }

  export function projectRuntimeRoot(projectDir: string): string {
    return path.join(projectConfigRoot(projectDir), ".r")
  }

  export function relativeRuntimeRoot(): string {
    return path.posix.join(".opencorvus", ".r")
  }

  export function isInternalRuntimeRelativePath(input: string): boolean {
    const normalized = input.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/+$/, "")
    return (
      normalized === ".opencorvus-meta.json" ||
      normalized === ".opencorvus/.r" ||
      normalized.startsWith(".opencorvus/.r/") ||
      normalized === ".opencorvus/runtime" ||
      normalized.startsWith(".opencorvus/runtime/") ||
      normalized === ".opencorvus/worktrees" ||
      normalized.startsWith(".opencorvus/worktrees/") ||
      normalized === ".opencorvus-worktrees" ||
      normalized.startsWith(".opencorvus-worktrees/")
    )
  }

  export function internalRuntimeRelativePaths(inputs: readonly string[]): string[] {
    return inputs.filter((input) => isInternalRuntimeRelativePath(input))
  }

  export function isSourceEnumerationAllowed(relativePath: string): boolean {
    return !isInternalRuntimeRelativePath(relativePath)
  }

  export function isSourceArchiveAllowed(relativePath: string): boolean {
    return isSourceEnumerationAllowed(relativePath)
  }

  export function taskRoot(projectDir: string, taskID: string): string {
    return path.join(projectRuntimeRoot(projectDir), "t", ...idFanout(taskID))
  }

  export function taskRootFromRuntimeRoot(runtimeRoot: string, taskID: string): string {
    return path.join(runtimeRoot, "t", ...idFanout(taskID))
  }

  export function taskRootReadCandidatesFromRuntimeRoot(runtimeRoot: string, taskID: string): string[] {
    return [taskRootFromRuntimeRoot(runtimeRoot, taskID)]
  }

  export function taskRelative(taskID: string, ...parts: string[]): string {
    return path.posix.join(relativeRuntimeRoot(), "t", ...idFanout(taskID), ...parts)
  }

  export function taskAbsolute(projectDir: string, taskID: string, ...parts: string[]): string {
    return path.join(taskRoot(projectDir, taskID), ...parts)
  }

  export function taskAbsoluteFromRuntimeRoot(runtimeRoot: string, taskID: string, ...parts: string[]): string {
    return path.join(taskRootFromRuntimeRoot(runtimeRoot, taskID), ...parts)
  }

  export function taskArtifactRoot(projectDir: string, taskID: string): string {
    return taskAbsolute(projectDir, taskID, "ta")
  }

  export function taskArtifactStageRoot(projectDir: string, taskID: string, snapshotID: string): string {
    return path.join(taskArtifactRoot(projectDir, taskID), ".stage", safeSegment(snapshotID))
  }

  export function taskArtifactSnapshotRoot(projectDir: string, taskID: string, snapshotID: string): string {
    return path.join(taskArtifactRoot(projectDir, taskID), "s", safeSegment(snapshotID))
  }

  export function taskArtifactPublicationSequenceRoot(projectDir: string, taskID: string): string {
    return path.join(taskArtifactRoot(projectDir, taskID), "q")
  }

  export function taskArtifactMaterializationRoot(
    projectDir: string,
    taskID: string,
    materializationID: string,
  ): string {
    return path.join(taskArtifactRoot(projectDir, taskID), "m", safeSegment(materializationID))
  }

  export function taskAbsoluteReadCandidatesFromRuntimeRoot(
    runtimeRoot: string,
    taskID: string,
    ...parts: string[]
  ): string[] {
    return taskRootReadCandidatesFromRuntimeRoot(runtimeRoot, taskID).map((root) => path.join(root, ...parts))
  }

  export function sessionRoot(projectDir: string, taskID: string, sessionID: string): string {
    return path.join(
      projectRuntimeRoot(projectDir),
      "s",
      ...scopedFanout("task-session", taskSessionKey(taskID, sessionID)),
    )
  }

  export function sessionRootFromRuntimeRoot(runtimeRoot: string, taskID: string, sessionID: string): string {
    return path.join(runtimeRoot, "s", ...scopedFanout("task-session", taskSessionKey(taskID, sessionID)))
  }

  export function sessionRootReadCandidatesFromRuntimeRoot(
    runtimeRoot: string,
    taskID: string,
    sessionID: string,
  ): string[] {
    return [sessionRootFromRuntimeRoot(runtimeRoot, taskID, sessionID)]
  }

  export function tracePath(projectDir: string, taskID: string, sessionID: string): string {
    return path.join(sessionRoot(projectDir, taskID, sessionID), "trace.jsonl")
  }

  export function tracePathFromRuntimeRoot(runtimeRoot: string, taskID: string, sessionID: string): string {
    return path.join(sessionRootFromRuntimeRoot(runtimeRoot, taskID, sessionID), "trace.jsonl")
  }

  export function tracePathReadCandidatesFromRuntimeRoot(
    runtimeRoot: string,
    taskID: string,
    sessionID: string,
  ): string[] {
    return sessionRootReadCandidatesFromRuntimeRoot(runtimeRoot, taskID, sessionID).map((root) =>
      path.join(root, "trace.jsonl"),
    )
  }

  export function toolOutputDir(projectDir: string, taskID: string, sessionID: string): string {
    return path.join(sessionRoot(projectDir, taskID, sessionID), "tool-output")
  }

  export function sessionTraceIndexPathFromRuntimeRoot(runtimeRoot: string, sessionID: string): string {
    return path.join(runtimeRoot, "sx", ...idFanout(sessionID), "index.json")
  }

  export function rootSessionToolOutputDir(projectDir: string, sessionID: string): string {
    return path.join(projectRuntimeRoot(projectDir), "sx", ...idFanout(sessionID), "tool-output")
  }

  export function intentPaths(projectDir: string, taskID: string): { relative: string; absolute: string } {
    return {
      relative: taskRelative(taskID, "intent", "request.md"),
      absolute: taskAbsolute(projectDir, taskID, "intent", "request.md"),
    }
  }

  export function decisionLogPaths(projectDir: string, taskID: string): { relative: string; absolute: string } {
    return {
      relative: taskRelative(taskID, "decision-log.md"),
      absolute: taskAbsolute(projectDir, taskID, "decision-log.md"),
    }
  }

  export function frontendDesignPaths(
    projectDir: string,
    taskID: string,
  ): {
    relativeDir: string
    absoluteDir: string
  } {
    return {
      relativeDir: taskRelative(taskID, "fd"),
      absoluteDir: taskAbsolute(projectDir, taskID, "fd"),
    }
  }

  export function webpageEvidencePaths(projectDir: string, taskID: string): { relative: string; absolute: string } {
    return {
      relative: taskRelative(taskID, "webpage-evidence"),
      absolute: taskAbsolute(projectDir, taskID, "webpage-evidence"),
    }
  }

  export function deepResearchPaths(
    projectDir: string,
    taskID: string,
    sessionID: string,
  ): {
    relativeDir: string
    absoluteDir: string
    fullMarkdownAbsolute: string
    evidenceJsonAbsolute: string
    citationMapAbsolute: string
  } {
    const relativeDir = taskRelative(taskID, "dr", ...idFanout(sessionID))
    const absoluteDir = taskAbsolute(projectDir, taskID, "dr", ...idFanout(sessionID))
    return {
      relativeDir,
      absoluteDir,
      fullMarkdownAbsolute: path.join(absoluteDir, "research-bundle.md"),
      evidenceJsonAbsolute: path.join(absoluteDir, "evidence.json"),
      citationMapAbsolute: path.join(absoluteDir, "citation-map.json"),
    }
  }

  export function frontendResearchPaths(
    projectDir: string,
    taskID: string,
    sessionID: string,
  ): {
    relativeDir: string
    absoluteDir: string
    fullMarkdownAbsolute: string
    evidenceJsonAbsolute: string
    citationMapAbsolute: string
  } {
    const relativeDir = taskRelative(taskID, "fr", ...idFanout(sessionID))
    const absoluteDir = taskAbsolute(projectDir, taskID, "fr", ...idFanout(sessionID))
    return {
      relativeDir,
      absoluteDir,
      fullMarkdownAbsolute: path.join(absoluteDir, "research-bundle.md"),
      evidenceJsonAbsolute: path.join(absoluteDir, "evidence.json"),
      citationMapAbsolute: path.join(absoluteDir, "citation-map.json"),
    }
  }

  export function acceptancePaths(
    projectDir: string,
    taskID: string,
  ): {
    root: string
    screenshots: string
    checkWorkspaces: string
  } {
    const root = taskAbsolute(projectDir, taskID, "a")
    return {
      root,
      screenshots: path.join(root, "screenshots"),
      checkWorkspaces: path.join(root, "check-workspaces"),
    }
  }

  export function browserPreviewJobRoot(projectDir: string, taskID: string, jobID: string): string {
    return taskAbsolute(projectDir, taskID, "bp", ...idFanout(jobID))
  }

  export function browserPreviewJobRelative(taskID: string, jobID: string, ...parts: string[]): string {
    return taskRelative(taskID, "bp", ...idFanout(jobID), ...parts)
  }

  export function tasklessAcceptancePaths(projectDir: string): {
    root: string
    checkWorkspaces: string
  } {
    const root = path.join(projectRuntimeRoot(projectDir), "a", "no-task")
    return {
      root,
      checkWorkspaces: path.join(root, "check-workspaces"),
    }
  }

  export function docsRoot(projectDir: string, taskID: string): string {
    return taskAbsolute(projectDir, taskID, "docs")
  }

  export function docsPaths(
    projectDir: string,
    taskID: string,
  ): Record<"prds" | "plans" | "goals" | "evaluations", string> {
    const root = docsRoot(projectDir, taskID)
    return {
      prds: path.join(root, "prds"),
      plans: path.join(root, "plans"),
      goals: path.join(root, "goals"),
      evaluations: path.join(root, "evaluations"),
    }
  }

  export function eventLogPath(projectDir: string, taskID: string): { ndjson: string; timeline: string } {
    const dir = taskAbsolute(projectDir, taskID, "logs")
    return {
      ndjson: path.join(dir, "events.ndjson"),
      timeline: path.join(dir, "timeline.log"),
    }
  }

  export function missionRoot(projectDir: string, missionID: string): string {
    return path.join(projectRuntimeRoot(projectDir), "m", ...scopedFanout("mission", missionID))
  }

  export function attachmentBlobRoot(projectDir: string): string {
    return path.join(projectRuntimeRoot(projectDir), "b", "a")
  }

  export function snapshotCacheRoot(projectDir: string, projectID: string): string {
    return path.join(projectRuntimeRoot(projectDir), "c", "snap", safeSegment(projectID))
  }

  export function sessionDiffRoot(projectDir: string, projectID: string): string {
    return path.join(projectRuntimeRoot(projectDir), "c", "sdiff", safeSegment(projectID))
  }

  export function sessionDiffPath(projectDir: string, projectID: string, sessionID: string): string {
    return path.join(sessionDiffRoot(projectDir, projectID), `${idSegment(sessionID)}.json`)
  }

  export function worktreesRoot(projectDir: string): string {
    return path.join(projectRuntimeRoot(projectDir), "w")
  }

  export function worktreeDir(projectDir: string, taskID: string, sessionID: string): string {
    return path.join(
      worktreesRoot(projectDir),
      ...scopedFanout("task-session", taskSessionKey(taskID, sessionID)),
      "worktree",
    )
  }

  export function worktreeBranch(input: BranchInput): string {
    return `opencorvus/s/${scopedKey("task-session", taskSessionKey(input.taskID, input.sessionID))}`
  }

  export function ownershipRoot(projectDir: string): string {
    return path.join(projectRuntimeRoot(projectDir), "o")
  }

  export function ownershipPaths(
    projectDir: string,
    taskID: string,
    sessionID: string,
  ): {
    worktreeMarkerDir: string
    processMarkerDir: string
    worktreeMarkerName: string
    processMarkerPrefix: string
  } {
    const task = idSegment(taskID)
    const session = idSegment(sessionID)
    return {
      worktreeMarkerDir: path.join(ownershipRoot(projectDir), "w", ...idFanout(taskID)),
      processMarkerDir: path.join(ownershipRoot(projectDir), "p", ...idFanout(taskID)),
      worktreeMarkerName: `${session}.json`,
      processMarkerPrefix: `${session}-`,
    }
  }

  export function projectGitLock(projectDir: string): string {
    return path.join(projectRuntimeRoot(projectDir), "l", "project-git.lock")
  }

  export const legacyRuntimeRelativePaths = [
    path.posix.join(".opencorvus", "runtime"),
    path.posix.join(".opencorvus", "intent"),
    path.posix.join(".opencorvus", "frontend-design"),
    path.posix.join(".opencorvus", "decision-log.md"),
    path.posix.join(".opencorvus", "worktrees"),
    path.posix.join(".opencorvus", "ownership"),
    path.posix.join(".opencorvus", "trace"),
  ] as const
}

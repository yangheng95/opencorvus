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

function scopedKey(scope: string, input: string): string {
  return safeSegment(Identifier.scopedDirectoryKey(scope, input))
}

function identitySegment(input: string): string {
  const segment = safeSegment(input)
  const upper = segment.toUpperCase()
  if (
    segment !== input ||
    segment === "." ||
    segment === ".." ||
    segment.endsWith(".") ||
    /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/.test(upper)
  ) {
    throw new Error(`ProjectRuntimePaths: invalid identity segment ${input}`)
  }
  return segment
}

function typedIdentitySegment(kind: "task" | "session", input: string): string {
  const segment = identitySegment(input)
  if (!Identifier.isCanonical(kind, segment)) {
    throw new Error(`ProjectRuntimePaths: invalid ${kind} identity ${input}`)
  }
  return segment
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
    return path.join(taskCollectionRoot(projectDir), typedIdentitySegment("task", taskID))
  }

  export function taskRootFromRuntimeRoot(runtimeRoot: string, taskID: string): string {
    return path.join(runtimeRoot, "tasks", typedIdentitySegment("task", taskID))
  }

  export function taskCollectionRoot(projectDir: string): string {
    return path.join(projectRuntimeRoot(projectDir), "tasks")
  }

  export function taskRootReadCandidatesFromRuntimeRoot(runtimeRoot: string, taskID: string): string[] {
    return [taskRootFromRuntimeRoot(runtimeRoot, taskID)]
  }

  export function taskRelative(taskID: string, ...parts: string[]): string {
    return path.posix.join(relativeRuntimeRoot(), "tasks", typedIdentitySegment("task", taskID), ...parts)
  }

  export function taskAbsolute(projectDir: string, taskID: string, ...parts: string[]): string {
    return path.join(taskRoot(projectDir, taskID), ...parts)
  }

  export function taskAbsoluteFromRuntimeRoot(runtimeRoot: string, taskID: string, ...parts: string[]): string {
    return path.join(taskRootFromRuntimeRoot(runtimeRoot, taskID), ...parts)
  }

  export function taskArtifactRoot(projectDir: string, taskID: string): string {
    return taskAbsolute(projectDir, taskID, "artifacts")
  }

  export function taskArtifactStageRoot(projectDir: string, taskID: string, snapshotID: string): string {
    return path.join(taskArtifactRoot(projectDir, taskID), ".stage", safeSegment(snapshotID))
  }

  export function taskArtifactSnapshotRoot(projectDir: string, taskID: string, snapshotID: string): string {
    return path.join(taskArtifactRoot(projectDir, taskID), "snapshots", safeSegment(snapshotID))
  }

  export function taskArtifactPublicationSequenceRoot(projectDir: string, taskID: string): string {
    return path.join(taskArtifactRoot(projectDir, taskID), "publication-sequence")
  }

  export function taskArtifactMaterializationRoot(
    projectDir: string,
    taskID: string,
    materializationID: string,
  ): string {
    return path.join(taskArtifactRoot(projectDir, taskID), "materializations", safeSegment(materializationID))
  }

  export function taskArtifactReadMaterializationRoot(projectDir: string, taskID: string): string {
    return path.join(taskArtifactRoot(projectDir, taskID), "materializations", "reads")
  }

  export function taskAbsoluteReadCandidatesFromRuntimeRoot(
    runtimeRoot: string,
    taskID: string,
    ...parts: string[]
  ): string[] {
    return taskRootReadCandidatesFromRuntimeRoot(runtimeRoot, taskID).map((root) => path.join(root, ...parts))
  }

  export function sessionRoot(projectDir: string, taskID: string, sessionID: string): string {
    return taskAbsolute(projectDir, taskID, "sessions", typedIdentitySegment("session", sessionID))
  }

  export function sessionRootFromRuntimeRoot(runtimeRoot: string, taskID: string, sessionID: string): string {
    return path.join(
      taskRootFromRuntimeRoot(runtimeRoot, taskID),
      "sessions",
      typedIdentitySegment("session", sessionID),
    )
  }

  export function sessionRootReadCandidatesFromRuntimeRoot(
    runtimeRoot: string,
    taskID: string,
    sessionID: string,
  ): string[] {
    return [sessionRootFromRuntimeRoot(runtimeRoot, taskID, sessionID)]
  }

  export function toolOutputDir(projectDir: string, taskID: string, sessionID: string): string {
    return path.join(sessionRoot(projectDir, taskID, sessionID), "tool-output")
  }

  /** Short, Task-owned root for ephemeral Work Artifact runtime workspaces.
   * Office runtimes also place their isolated HOME/cache/temp directories
   * below this root, so it intentionally omits the Session segment that makes
   * ordinary retained tool-output paths exceed Windows runtime path limits. */
  export function taskWorkArtifactRuntimeRoot(projectDir: string, taskID: string): string {
    return taskAbsolute(projectDir, taskID, "work-artifacts")
  }

  export function sessionTraceIndexPathFromRuntimeRoot(runtimeRoot: string, sessionID: string): string {
    return path.join(
      runtimeRoot,
      "project",
      "indexes",
      "task-sessions",
      typedIdentitySegment("session", sessionID),
      "index.json",
    )
  }

  export function rootSessionToolOutputDir(projectDir: string, sessionID: string): string {
    return path.join(
      projectRuntimeRoot(projectDir),
      "conversations",
      typedIdentitySegment("session", sessionID),
      "tool-output",
    )
  }

  export function rootSessionWorkArtifactRuntimeRoot(projectDir: string, sessionID: string): string {
    return path.join(
      projectRuntimeRoot(projectDir),
      "conversations",
      typedIdentitySegment("session", sessionID),
      "work-artifacts",
    )
  }

  /** Current runtime-layout file patterns owned by tool-output retention. */
  export function toolOutputFilePatterns(): readonly string[] {
    return ["tasks/*/sessions/*/tool-output/tool_*", "conversations/*/tool-output/tool_*"]
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
      relativeDir: taskRelative(taskID, "frontend-design"),
      absoluteDir: taskAbsolute(projectDir, taskID, "frontend-design"),
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
    const session = typedIdentitySegment("session", sessionID)
    const relativeDir = taskRelative(taskID, "research", "deep", session)
    const absoluteDir = taskAbsolute(projectDir, taskID, "research", "deep", session)
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
    const session = typedIdentitySegment("session", sessionID)
    const relativeDir = taskRelative(taskID, "research", "frontend", session)
    const absoluteDir = taskAbsolute(projectDir, taskID, "research", "frontend", session)
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
    const root = taskAbsolute(projectDir, taskID, "acceptance")
    return {
      root,
      screenshots: path.join(root, "screenshots"),
      checkWorkspaces: path.join(root, "check-workspaces"),
    }
  }

  export function browserPreviewJobRoot(projectDir: string, taskID: string, jobID: string): string {
    return taskAbsolute(projectDir, taskID, "browser-preview", identitySegment(jobID))
  }

  export function browserPreviewJobRelative(taskID: string, jobID: string, ...parts: string[]): string {
    return taskRelative(taskID, "browser-preview", identitySegment(jobID), ...parts)
  }

  export function tasklessAcceptancePaths(projectDir: string): {
    root: string
    checkWorkspaces: string
  } {
    const root = path.join(projectRuntimeRoot(projectDir), "acceptance", "no-task")
    return {
      root,
      checkWorkspaces: path.join(root, "check-workspaces"),
    }
  }

  export function docsRoot(projectDir: string, taskID: string): string {
    return taskAbsolute(projectDir, taskID, "documents")
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
    return path.join(projectRuntimeRoot(projectDir), "missions", identitySegment(missionID))
  }

  export function attachmentBlobRoot(projectDir: string): string {
    return path.join(projectRuntimeRoot(projectDir), "project", "attachments")
  }

  export function snapshotCacheRoot(projectDir: string, projectID: string): string {
    return path.join(projectRuntimeRoot(projectDir), "project", "cache", "snapshots", safeSegment(projectID))
  }

  export function sessionDiffRoot(projectDir: string, projectID: string): string {
    return path.join(projectRuntimeRoot(projectDir), "project", "cache", "session-diffs", safeSegment(projectID))
  }

  export function sessionDiffPath(projectDir: string, projectID: string, sessionID: string): string {
    return path.join(
      sessionDiffRoot(projectDir, projectID),
      `${idSegment(typedIdentitySegment("session", sessionID))}.json`,
    )
  }

  export function worktreesRoot(projectDir: string): string {
    return path.join(projectRuntimeRoot(projectDir), "project", "worktrees")
  }

  export function worktreeDir(projectDir: string, taskID: string, sessionID: string): string {
    return path.join(sessionRoot(projectDir, taskID, sessionID), "worktree")
  }

  export function isManagedWorktreePath(projectDir: string, candidate: string): boolean {
    const relative = path.relative(projectRuntimeRoot(projectDir), candidate)
    if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return false
    const parts = relative.split(path.sep)
    if (parts[0] === "project" && parts[1] === "worktrees" && parts.length >= 3) return true
    return (
      parts.length === 5 &&
      parts[0] === "tasks" &&
      Identifier.isCanonical("task", parts[1]!) &&
      parts[2] === "sessions" &&
      Identifier.isCanonical("session", parts[3]!) &&
      parts[4] === "worktree"
    )
  }

  export function worktreeBranch(input: BranchInput): string {
    const taskID = typedIdentitySegment("task", input.taskID)
    const sessionID = typedIdentitySegment("session", input.sessionID)
    return `opencorvus/s/${scopedKey("task-session", taskSessionKey(taskID, sessionID))}`
  }

  export function ownershipRoot(projectDir: string): string {
    return taskCollectionRoot(projectDir)
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
    const session = typedIdentitySegment("session", sessionID)
    const root = path.join(sessionRoot(projectDir, taskID, sessionID), "ownership")
    return {
      worktreeMarkerDir: path.join(root, "worktrees"),
      processMarkerDir: path.join(root, "processes"),
      worktreeMarkerName: `${session}.ownership.json`,
      processMarkerPrefix: `${session}-`,
    }
  }

  export function projectGitLock(projectDir: string): string {
    return path.join(projectRuntimeRoot(projectDir), "project", "locks", "project-git.lock")
  }

  export const legacyRuntimeRelativePaths = [
    path.posix.join(".opencorvus", ".r", "t"),
    path.posix.join(".opencorvus", ".r", "s"),
    path.posix.join(".opencorvus", ".r", "sx"),
    path.posix.join(".opencorvus", ".r", "b"),
    path.posix.join(".opencorvus", ".r", "m"),
    path.posix.join(".opencorvus", ".r", "w"),
    path.posix.join(".opencorvus", ".r", "o"),
    path.posix.join(".opencorvus", ".r", "c"),
    path.posix.join(".opencorvus", ".r", "l"),
    path.posix.join(".opencorvus", ".r", "a"),
    path.posix.join(".opencorvus", "runtime"),
    path.posix.join(".opencorvus", "intent"),
    path.posix.join(".opencorvus", "frontend-design"),
    path.posix.join(".opencorvus", "decision-log.md"),
    path.posix.join(".opencorvus", "worktrees"),
    path.posix.join(".opencorvus", "ownership"),
    path.posix.join(".opencorvus", "trace"),
  ] as const
}

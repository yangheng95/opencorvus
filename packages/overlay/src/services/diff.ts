// Task change projection from immutable Build Host observations.
// Session and Artifact identities own physical execution provenance; Delivery
// Slice subjects never own a diff or a runtime lifecycle.

import { boardStore } from "../store/board"
import type { FileChange } from "../components/DiffView"
import { apiRequest, ApiError } from "./api"
import { taskScopedPath } from "./task-path"
import { taskOwningDirectory } from "./task-directory"

const BUILD_OBSERVATION_CONTENT_CHUNK_BYTES = 256 * 1024

export interface DiffTarget {
  filePath: string
  groupID?: string
  sessionID?: string
  agentID?: string
}

export interface ChangeGroup {
  id: string
  taskID?: string
  artifactID?: string
  sessionID?: string
  agentID?: string
  commitRef?: string
  publishedCommitRef?: string
  diffBaseRef?: string
  diffHeadRef?: string
  additions: number
  deletions: number
  changes: FileChange[]
}

export interface ChangeSummary {
  files: number
  additions: number
  deletions: number
}

function sumAdditions(changes: readonly FileChange[]): number {
  return changes.reduce((sum, item) => sum + (item.additions ?? 0), 0)
}

function sumDeletions(changes: readonly FileChange[]): number {
  return changes.reduce((sum, item) => sum + (item.deletions ?? 0), 0)
}

export function summarizeChangeGroups(groups: readonly ChangeGroup[]): ChangeSummary {
  const changes = groups.flatMap((group) => group.changes)
  return {
    files: changes.length,
    additions: sumAdditions(changes),
    deletions: sumDeletions(changes),
  }
}

export function changeGroupsRevisionKey(groups: ChangeGroup[]): string {
  return groups
    .map((group) =>
      [
        group.id,
        group.artifactID ?? "",
        group.sessionID ?? "",
        group.agentID ?? "",
        group.commitRef ?? "",
        group.publishedCommitRef ?? "",
        group.diffBaseRef ?? "",
        group.diffHeadRef ?? "",
        ...group.changes.map((change) =>
          [change.file, change.status, change.additions ?? 0, change.deletions ?? 0].join(","),
        ),
      ].join(":"),
    )
    .join("|")
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function artifactChangeGroups(): ChangeGroup[] {
  const board = boardStore.board as any
  const artifacts = Array.isArray(board?.artifacts) ? board.artifacts : []
  const nodes = Array.isArray(board?.sessionInvocationTopology?.nodes) ? board.sessionInvocationTopology.nodes : []
  return artifacts
    .filter((artifact: any) => artifact?.kind === "build_host_observation")
    .map((artifact: any) => {
      const payload = artifact?.payload && typeof artifact.payload === "object" ? artifact.payload : {}
      const sessionID = text(payload.session_id)
      const node = sessionID
        ? nodes.find((candidate: any) => String(candidate?.sessionID || "") === sessionID)
        : undefined
      const changes = (Array.isArray(payload.diffs) ? payload.diffs : [])
        .filter((item: any) => item && typeof item.file === "string")
        .map(
          (item: any): FileChange => ({
            file: String(item.file).replace(/^[ab]\//, ""),
            status:
              item.status === "added" || item.status === "deleted" || item.status === "modified"
                ? item.status
                : "modified",
            additions: Number.isFinite(Number(item.additions)) ? Number(item.additions) : 0,
            deletions: Number.isFinite(Number(item.deletions)) ? Number(item.deletions) : 0,
            isText: item.is_binary !== true,
            beforeObject:
              item.before && typeof item.before.oid === "string" && Number.isInteger(item.before.bytes)
                ? { oid: item.before.oid, bytes: item.before.bytes }
                : null,
            afterObject:
              item.after && typeof item.after.oid === "string" && Number.isInteger(item.after.bytes)
                ? { oid: item.after.oid, bytes: item.after.bytes }
                : null,
          }),
        )
        .sort((left: FileChange, right: FileChange) => left.file.localeCompare(right.file))
      return {
        id: `artifact:${String(artifact.id)}`,
        taskID: text(payload.task_id) ?? text(board?.task?.id),
        artifactID: String(artifact.id),
        sessionID,
        agentID: text(node?.agent),
        commitRef: text(payload.contribution_commit_ref),
        publishedCommitRef: text(payload.published_commit_ref),
        diffBaseRef: text(payload.diff_base_ref),
        diffHeadRef: text(payload.diff_head_ref),
        additions: sumAdditions(changes),
        deletions: sumDeletions(changes),
        changes,
      } satisfies ChangeGroup
    })
    .filter((group: ChangeGroup) => group.changes.length > 0)
}

export function currentChangeGroups(): ChangeGroup[] {
  const artifactGroups = artifactChangeGroups()
  if (artifactGroups.length > 0) return artifactGroups
  if (Array.isArray(boardStore.changes) && boardStore.changes.length > 0) {
    const changes = boardStore.changes as FileChange[]
    return [{ id: "store-changes", additions: sumAdditions(changes), deletions: sumDeletions(changes), changes }]
  }
  const raw = (boardStore.board as any)?.changes
  if (!Array.isArray(raw) || raw.length === 0) return []
  const changes = raw as FileChange[]
  return [{ id: "board-changes", additions: sumAdditions(changes), deletions: sumDeletions(changes), changes }]
}

export async function resolveCurrentChangeGroups(): Promise<ChangeGroup[]> {
  return currentChangeGroups()
}

export function hasDiffBody(change: FileChange | null | undefined): boolean {
  return !!change && (change.before !== undefined || change.after !== undefined)
}

export function isKnownTextDiff(change: FileChange | null | undefined): boolean {
  return change?.isText !== false
}

export async function resolveDiff(
  target: DiffTarget,
  groups: readonly ChangeGroup[] = currentChangeGroups(),
): Promise<FileChange | null> {
  const group = target.groupID
    ? groups.find((candidate) => candidate.id === target.groupID)
    : target.sessionID
      ? groups.find((candidate) => candidate.sessionID === target.sessionID)
      : target.agentID
        ? groups.find((candidate) => candidate.agentID === target.agentID)
        : groups.find((candidate) => candidate.changes.some((change) => change.file === target.filePath))
  const change = group?.changes.find((candidate) => candidate.file === target.filePath) ?? null
  if (!change || hasDiffBody(change) || !group?.artifactID || !group.taskID || change.isText === false) return change
  const [before, after] = await Promise.all([
    readObservedTextSide({
      taskID: group.taskID,
      artifactID: group.artifactID,
      file: change.file,
      side: "before",
      object: change.beforeObject,
    }),
    readObservedTextSide({
      taskID: group.taskID,
      artifactID: group.artifactID,
      file: change.file,
      side: "after",
      object: change.afterObject,
    }),
  ])
  return { ...change, before, after }
}

async function readObservedTextSide(input: {
  taskID: string
  artifactID: string
  file: string
  side: "before" | "after"
  object: { oid: string; bytes: number } | null | undefined
}): Promise<string> {
  if (!input.object) return ""
  const decoder = new TextDecoder("utf-8", { fatal: true })
  const textChunks: string[] = []
  let offset = 0
  while (offset < input.object.bytes) {
    const length = Math.min(BUILD_OBSERVATION_CONTENT_CHUNK_BYTES, input.object.bytes - offset)
    const query = new URLSearchParams({
      file: input.file,
      side: input.side,
      offset: String(offset),
      length: String(length),
    })
    const response = await apiRequest<Uint8Array>(
      taskScopedPath(
        input.taskID,
        taskOwningDirectory(input.taskID),
        `/build-observation/${encodeURIComponent(input.artifactID)}/content?${query.toString()}`,
      ),
      { responseKind: "binary" },
    )
    if (!response.ok) throw new ApiError(response.status, "build observation content", response.body)
    const bytes = response.body
    textChunks.push(decoder.decode(bytes, { stream: offset + bytes.byteLength < input.object.bytes }))
    offset += bytes.byteLength
    if (bytes.byteLength !== length) {
      throw new Error(
        `Build observation ${input.artifactID} returned ${bytes.byteLength} bytes for requested ${length}-byte range`,
      )
    }
  }
  return textChunks.join("")
}

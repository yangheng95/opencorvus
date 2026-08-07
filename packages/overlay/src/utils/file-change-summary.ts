import { cardTreeStore, type CardNode } from "../store/card-tree"
import { boardStore } from "../store/board"
import type { FileChange } from "../components/DiffView"
import type { ChangeGroup } from "../services/diff"
import { relativePathFrom } from "./tool"

export interface ToolFileChange extends FileChange {
  openPath: string
  displayPath: string
}

export interface AgentFileChange extends ToolFileChange {
  agentID: string
  sources: number
}

export interface ArtifactFileRow {
  groupID: string
  targetPath: string
  file: string
  additions: number
  deletions: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function asText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}

function asCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function displayPath(path: string, base: string): string {
  const normalized = path.replace(/\\/g, "/")
  const normalizedBase = base.replace(/\\/g, "/").replace(/\/+$/, "")
  const rel = relativePathFrom(normalizedBase, normalized)
  return rel || normalized
}

function diffStatus(raw: unknown, before?: string, after?: string): FileChange["status"] {
  const value = String(raw || "")
    .trim()
    .toLowerCase()
  if (value === "add" || value === "added") return "added"
  if (value === "delete" || value === "deleted" || value === "remove" || value === "removed") return "deleted"
  if (before === "" && typeof after === "string" && after.length > 0) return "added"
  if (after === "" && typeof before === "string" && before.length > 0) return "deleted"
  return "modified"
}

function normalizeToolDiff(raw: unknown, base: string): ToolFileChange | null {
  if (!isRecord(raw)) return null
  const before = asString(raw.before) ?? asString(raw.oldContent)
  const after = asString(raw.after) ?? asString(raw.newContent)
  const sourcePath = asText(raw.file) ?? asText(raw.filePath) ?? asText(raw.path)
  const targetPath = asText(raw.movePath) ?? sourcePath
  if (!targetPath) return null

  const sourceDisplay = sourcePath ? displayPath(sourcePath, base) : ""
  const targetDisplay = asText(raw.relativePath) ?? displayPath(targetPath, base)
  const renderedPath =
    sourcePath && targetPath !== sourcePath ? `${sourceDisplay || sourcePath} -> ${targetDisplay}` : targetDisplay

  return {
    file: renderedPath,
    status: diffStatus(raw.type, before, after),
    additions: asCount(raw.additions),
    deletions: asCount(raw.deletions),
    before,
    after,
    openPath: targetPath,
    displayPath: renderedPath,
  }
}

export function toolFileChangesFromState(state: unknown, base: string): ToolFileChange[] {
  if (!isRecord(state)) return []
  const meta = isRecord(state.metadata) ? state.metadata : {}
  const files = Array.isArray(meta.files)
    ? meta.files.map((item) => normalizeToolDiff(item, base)).filter((item): item is ToolFileChange => !!item)
    : []
  if (files.length > 0) return files

  const single = normalizeToolDiff(meta.filediff, base)
  return single ? [single] : []
}

function toolPartFileChanges(part: unknown, base: string): ToolFileChange[] {
  if (!isRecord(part)) return []
  const state = isRecord(part.state) ? part.state : {}
  if (String(state.status || "").toLowerCase() !== "completed") return []
  return toolFileChangesFromState(state, base)
}

function patchPartFileChanges(part: unknown, base: string): ToolFileChange[] {
  if (!isRecord(part) || part.type !== "patch" || !Array.isArray(part.files)) return []
  return part.files.map((file) => normalizeToolDiff(file, base)).filter((change): change is ToolFileChange => !!change)
}

function mergeFileChange(map: Map<string, AgentFileChange>, change: ToolFileChange, agentID: string): void {
  const key = `${agentID}\0${change.openPath.replace(/\\/g, "/")}`
  const current = map.get(key)
  if (!current) {
    map.set(key, { ...change, agentID, sources: 1 })
    return
  }
  current.sources += 1
  current.additions += change.additions
  current.deletions += change.deletions
  if (current.status === "modified") current.status = change.status
  if (current.before === undefined && change.before !== undefined) current.before = change.before
  if (current.after === undefined && change.after !== undefined) current.after = change.after
}

function collectFromNode(node: CardNode, base: string, out: Map<string, AgentFileChange>, seen: Set<string>): void {
  if (seen.has(node.id)) return
  seen.add(node.id)
  const agentID = asText(node.agentID)
  for (const part of node.parts ?? []) {
    if (isRecord(part) && part.type === "tool") {
      for (const change of toolPartFileChanges(part, base)) {
        if (!agentID) throw new Error(`file-change-summary: card ${node.id} produced changes without exact agentID`)
        mergeFileChange(out, change, agentID)
      }
    }
    for (const change of patchPartFileChanges(part, base)) {
      if (!agentID) throw new Error(`file-change-summary: card ${node.id} produced changes without exact agentID`)
      mergeFileChange(out, change, agentID)
    }
  }
  for (const childID of node.childIDs ?? []) {
    const child = cardTreeStore.cards[childID]
    if (!child) throw new Error(`file-change-summary: card ${node.id} references missing child ${childID}`)
    collectFromNode(child, base, out, seen)
  }
}

export function collectAgentFileChanges(node: CardNode, base: string): AgentFileChange[] {
  const out = new Map<string, AgentFileChange>()
  collectFromNode(node, base, out, new Set())
  return [...out.values()].sort((a, b) => a.displayPath.localeCompare(b.displayPath))
}

function groupMergeKey(group: ChangeGroup): string {
  const agent = group.agentID ? `:agent:${group.agentID}` : ""
  if (group.sessionID) return `session:${group.sessionID}${agent}`
  if (group.artifactID) return `artifact:${group.artifactID}${agent}`
  return group.id
}

function changeMergeKey(change: FileChange): string {
  return change.file.replace(/\\/g, "/")
}

function mergeChange(left: FileChange, right: FileChange): FileChange {
  return {
    ...left,
    ...right,
    status: left.status === "modified" ? right.status : left.status,
    additions: Math.max(left.additions ?? 0, right.additions ?? 0),
    deletions: Math.max(left.deletions ?? 0, right.deletions ?? 0),
    before: left.before !== undefined ? left.before : right.before,
    after: left.after !== undefined ? left.after : right.after,
  }
}

function mergeGroup(left: ChangeGroup, right: ChangeGroup): ChangeGroup {
  const changes = new Map<string, FileChange>()
  for (const change of [...left.changes, ...right.changes]) {
    const key = changeMergeKey(change)
    const current = changes.get(key)
    changes.set(key, current ? mergeChange(current, change) : change)
  }
  const mergedChanges = [...changes.values()].sort((a, b) => a.file.localeCompare(b.file))
  return {
    ...left,
    ...right,
    additions: mergedChanges.reduce((sum, item) => sum + (item.additions ?? 0), 0),
    deletions: mergedChanges.reduce((sum, item) => sum + (item.deletions ?? 0), 0),
    changes: mergedChanges,
  }
}

export function mergeChangeGroups(groups: ChangeGroup[]): ChangeGroup[] {
  const merged = new Map<string, ChangeGroup>()
  for (const group of groups) {
    const key = groupMergeKey(group)
    const current = merged.get(key)
    merged.set(key, current ? mergeGroup(current, group) : group)
  }
  return [...merged.values()]
    .filter((group) => group.changes.length > 0)
    .sort((left, right) => left.id.localeCompare(right.id))
}

export function collectAgentFileChangeGroups(node: CardNode, base: string, goals: unknown): ChangeGroup[] {
  return collectAgentFileChangeGroupsFromNodes([node], base, goals)
}

export function collectAgentFileChangeGroupsFromNodes(nodes: CardNode[], base: string, goals: unknown): ChangeGroup[] {
  void goals
  const grouped = new Map<string, { agentID: string; changes: AgentFileChange[] }>()
  const changes = new Map<string, AgentFileChange>()
  const seen = new Set<string>()
  for (const node of nodes) {
    collectFromNode(node, base, changes, seen)
  }
  for (const change of [...changes.values()].sort((a, b) => a.displayPath.localeCompare(b.displayPath))) {
    const groupID = change.agentID
    const bucket = grouped.get(groupID) ?? { agentID: change.agentID, changes: [] }
    bucket.changes.push(change)
    grouped.set(groupID, bucket)
  }
  return [...grouped.values()]
    .map((bucket) => {
      const changes = bucket.changes
      return {
        id: `agent:${bucket.agentID}`,
        agentID: bucket.agentID,
        additions: changes.reduce((sum, item) => sum + (item.additions ?? 0), 0),
        deletions: changes.reduce((sum, item) => sum + (item.deletions ?? 0), 0),
        changes,
      } satisfies ChangeGroup
    })
    .sort((left, right) => left.id.localeCompare(right.id))
}

/** Collect live structured file-change evidence for the selected conversation.
 * Persisted Chat/Mission evidence remains board-owned and is merged by each
 * presentation surface through the shared ChangeGroup merger. */
export function currentConversationAgentChangeGroups(): ChangeGroup[] {
  const board = boardStore.board as any
  const roots = cardTreeStore.order.map((id) => cardTreeStore.cards[id]).filter((node): node is CardNode => !!node)
  const base = String(board?.task?.directory || board?.directory || "")
  return collectAgentFileChangeGroupsFromNodes(roots, base, board?.goals)
}

/** Flatten canonical change groups without discarding the exact group/path
 * target needed by Review. A path changed by two groups remains two truthful
 * rows because an aggregated row would not identify one resolvable diff. */
export function conversationArtifactFileRows(groups: readonly ChangeGroup[]): ArtifactFileRow[] {
  const rows: ArtifactFileRow[] = []
  for (const group of groups) {
    for (const change of group.changes) {
      const key = String(change.file || "")
        .replace(/\\/g, "/")
        .replace(/^\.?\//, "")
      if (!key) continue
      rows.push({
        groupID: group.id,
        targetPath: change.file,
        file: key,
        additions: change.additions ?? 0,
        deletions: change.deletions ?? 0,
      })
    }
  }
  return rows.sort((left, right) => left.file.localeCompare(right.file) || left.groupID.localeCompare(right.groupID))
}

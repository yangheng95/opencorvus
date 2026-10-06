import { cardTreeStore, publishedCardTreeVersion, type CardNode } from "../store/card-tree"
import { boardStore } from "../store/board"
import type { FileChange, FileChangeReceipt, FileChangeIncompleteReason } from "../components/DiffView"
import { summarizeFileChanges, textComparisonCounts, type ChangeGroup } from "../services/diff"
import { relativePathFrom } from "./tool"
import { projectedConversationMessageFacts, type ProjectedMessageFacts } from "../services/tree-writer"
import { conversationDeferredToolState } from "@opencorvus-ai/transport-protocol"

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
  additions: number | null
  deletions: number | null
  isText?: boolean
}
export interface ToolReceiptContext {
  sessionID: string
  messageID: string
  partID: string
}
export interface FileChangeInput {
  part: unknown
  agentID: string
  sessionID?: string
}
function record(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}
function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined
}
function displayPath(path: string, base: string): string {
  return relativePathFrom(base.replaceAll("\\", "/").replace(/\/+$/, ""), path.replaceAll("\\", "/")) || path
}
function receiptsUnique(receipts: readonly FileChangeReceipt[]): FileChangeReceipt[] {
  return [...new Map(receipts.map((receipt) => [JSON.stringify(receipt), receipt])).values()]
}
function unavailable(
  change: ToolFileChange,
  reason: FileChangeIncompleteReason,
  receipts = change.evidence.receipts,
): ToolFileChange {
  return {
    file: change.file,
    openPath: change.openPath,
    displayPath: change.displayPath,
    status: change.status,
    additions: null,
    deletions: null,
    evidence: { kind: "incomplete", reason, receipts: receiptsUnique(receipts) },
  }
}
function comparison(
  raw: Record<string, any>,
  base: string,
  kind: "edit" | "patch",
  receipts: FileChangeReceipt[],
): ToolFileChange | null {
  const source = text(kind === "edit" ? raw.file : raw.filePath)
  if (!source) return null
  const target = kind === "patch" ? (text(raw.movePath) ?? source) : source
  const file =
    target !== source ? `${displayPath(source, base)} -> ${displayPath(target, base)}` : displayPath(target, base)
  const status =
    kind === "patch"
      ? raw.type === "add"
        ? "added"
        : raw.type === "delete"
          ? "deleted"
          : raw.type === "update" || raw.type === "move"
            ? "modified"
            : undefined
      : undefined
  const change: ToolFileChange = {
    file,
    openPath: target,
    displayPath: file,
    status,
    additions: null,
    deletions: null,
    evidence: { kind: "incomplete", reason: "missing_endpoints", receipts },
  }
  if (typeof raw.before !== "string" || typeof raw.after !== "string") return change
  return {
    ...change,
    isText: true,
    before: raw.before,
    after: raw.after,
    ...textComparisonCounts(raw.before, raw.after),
    evidence: { kind: "complete", receipts },
  }
}
export function toolFileChangesFromState(state: unknown, base: string, context?: ToolReceiptContext): ToolFileChange[] {
  if (!record(state) || state.status !== "completed" || !record(state.metadata)) return []
  const receipt = (fileIndex: number): FileChangeReceipt[] => (context ? [{ ...context, fileIndex }] : [])
  const meta = state.metadata
  if (Array.isArray(meta.files))
    return meta.files.flatMap((raw, index) => {
      const change = record(raw) ? comparison(raw, base, "patch", receipt(index)) : null
      return change ? [change] : []
    })
  const change = record(meta.filediff) ? comparison(meta.filediff, base, "edit", receipt(0)) : null
  return change ? [change] : []
}
function context(part: Record<string, any>): ToolReceiptContext | undefined {
  return text(part.sessionID) && text(part.messageID) && text(part.id)
    ? { sessionID: part.sessionID, messageID: part.messageID, partID: part.id }
    : undefined
}
function receiptKey(change: ToolFileChange): string | undefined {
  return change.evidence.receipts.length ? JSON.stringify(change.evidence.receipts) : undefined
}
function equalBatch(left: ProjectedMessageFacts, right: ProjectedMessageFacts): boolean {
  return (
    Array.isArray(left.acceptedInputMessageIDs) &&
    left.acceptedInputMessageIDs.length > 0 &&
    JSON.stringify(left.acceptedInputMessageIDs) === JSON.stringify(right.acceptedInputMessageIDs)
  )
}
function normalRelation(
  left: Record<string, any>,
  right: Record<string, any>,
  facts: readonly ProjectedMessageFacts[],
  actor: string,
): FileChangeIncompleteReason | undefined {
  const timeline = facts
    .filter((fact) => fact.sessionID === left.sessionID)
    .sort((a, b) => a.orderKey.localeCompare(b.orderKey))
  const a = timeline.findIndex((fact) => fact.id === left.messageID),
    b = timeline.findIndex((fact) => fact.id === right.messageID)
  if (a < 0 || b < 0) return "missing_message_facts"
  if (a >= b) return "ambiguous_tool_step"
  const first = timeline[a],
    last = timeline[b]
  if (first.agentID !== actor || first.agentID !== last.agentID || first.sessionAgentID !== last.sessionAgentID)
    return "non_normal_step"
  if (!equalBatch(first, last)) return "changed_input_batch"
  let priorCompletion: number | undefined
  for (const fact of timeline.slice(a, b + 1)) {
    if (
      fact.role !== "assistant" ||
      fact.agentID !== first.agentID ||
      fact.sessionAgentID !== first.sessionAgentID ||
      fact.hasError !== false ||
      typeof fact.completed !== "number" ||
      fact.finish !== "tool-calls"
    )
      return "non_normal_step"
    if (!equalBatch(first, fact)) return "changed_input_batch"
    if (!fact.stepParts || !fact.toolParts) return "missing_message_facts"
    const starts = fact.stepParts.filter((part) => part.type === "step-start"),
      finishes = fact.stepParts.filter((part) => part.type === "step-finish")
    if (starts.length !== 1 || finishes.length !== 1 || finishes[0].reason !== "tool-calls") return "non_normal_step"
    if (fact.toolParts.length !== 1) return "ambiguous_tool_step"
    const tool = fact.toolParts[0]
    if (tool.tool !== "edit" && tool.tool !== "read") return "non_normal_step"
    if (
      tool.status !== "completed" ||
      typeof tool.start !== "number" ||
      typeof tool.end !== "number" ||
      tool.start > tool.end ||
      tool.end > fact.completed ||
      (priorCompletion !== undefined && tool.start < priorCompletion)
    )
      return "non_normal_step"
    if (!(starts[0].orderKey < tool.orderKey && tool.orderKey < finishes[0].orderKey)) return "non_normal_step"
    if ((fact.id === left.messageID && tool.id !== left.id) || (fact.id === right.messageID && tool.id !== right.id))
      return "missing_message_facts"
    const endpointPart = fact.id === left.messageID ? left : fact.id === right.messageID ? right : undefined
    if (endpointPart && (tool.start !== endpointPart.state?.time?.start || tool.end !== endpointPart.state?.time?.end))
      return "non_normal_step"
    priorCompletion = fact.completed
  }
  return undefined
}
export function reduceToolFileChangeGroups(
  inputs: readonly FileChangeInput[],
  facts: readonly ProjectedMessageFacts[],
  base: string,
): ChangeGroup[] {
  type Entry = {
    part: Record<string, any>
    agentID: string
    sessionID: string
    change: ToolFileChange
    edit: boolean
    coverage: boolean
  }
  const entries: Entry[] = []
  const unavailableGroups = new Map<string, ChangeGroup>()
  for (const input of inputs) {
    const part = input.part
    if (!record(part)) continue
    const sessionID = text(part.sessionID) ?? input.sessionID ?? ""
    const actor = input.agentID
    const add = (change: ToolFileChange, edit: boolean, coverage: boolean) =>
      entries.push({ part, sessionID, agentID: actor, change, edit, coverage })
    if (part.type === "patch" && Array.isArray(part.files)) {
      for (const [fileIndex, file] of part.files.entries()) {
        if (!text(file)) continue
        const ctx = context(part)
        const receipts: FileChangeReceipt[] = ctx ? [{ ...ctx, fileIndex }] : []
        add(
          {
            file: displayPath(file, base),
            openPath: file,
            displayPath: displayPath(file, base),
            additions: null,
            deletions: null,
            evidence: { kind: "incomplete", reason: "path_only", receipts },
          },
          false,
          true,
        )
      }
    }
    if (part.type !== "tool") continue
    if (conversationDeferredToolState(part.state?.metadata)) {
      if (part.tool === "edit" || part.tool === "apply_patch" || part.tool === "write") {
        const known = toolFileChangesFromState(part.state, base, context(part))
        if (part.tool === "write" && text(part.state.metadata.filepath)) {
          const path = part.state.metadata.filepath,
            ctx = context(part)
          known.push({
            file: displayPath(path, base),
            openPath: path,
            displayPath: displayPath(path, base),
            additions: null,
            deletions: null,
            evidence: { kind: "incomplete", reason: "deferred", receipts: ctx ? [ctx] : [] },
          })
        }
        for (const change of known) add(unavailable(change, "deferred"), false, true)
        if (!known.length) {
          const ctx = context(part)
          if (ctx) {
            const id = `path_coverage:${sessionID}:${actor}:unavailable`
            const group = unavailableGroups.get(id) ?? {
              id,
              sessionID,
              agentID: actor,
              observationKind: "path_coverage",
              changes: [],
              additions: null,
              deletions: null,
            }
            group.unavailableReceipts = receiptsUnique([...(group.unavailableReceipts ?? []), ctx])
            unavailableGroups.set(id, group)
          }
        }
      }
      continue
    }
    for (const change of toolFileChangesFromState(part.state, base, context(part)))
      add(change, part.tool === "edit", false)
  }
  const originalReceipts = new Map<string, Entry>()
  for (const entry of entries) {
    const key = receiptKey(entry.change)
    if (!key) continue
    const previous = originalReceipts.get(key)
    if (
      previous &&
      (JSON.stringify(previous.change) !== JSON.stringify(entry.change) || previous.agentID !== entry.agentID)
    ) {
      previous.change = unavailable(previous.change, "conflicting_receipt")
      entry.change = unavailable(entry.change, "conflicting_receipt")
    } else if (!previous) originalReceipts.set(key, entry)
  }
  const buckets = new Map<string, Entry[]>()
  for (const entry of entries) {
    const key = JSON.stringify([entry.coverage, entry.sessionID, entry.agentID, entry.change.openPath])
    buckets.set(key, [...(buckets.get(key) ?? []), entry])
  }
  const groups = new Map<string, ChangeGroup>()
  for (const bucket of buckets.values()) {
    const replay = new Map<string, Entry>()
    const deduplicated: Entry[] = []
    let conflict = false
    for (const entry of bucket) {
      const key = receiptKey(entry.change)
      if (!key) {
        deduplicated.push(entry)
        continue
      }
      const old = replay.get(key)
      if (old) {
        if (JSON.stringify(old.change) !== JSON.stringify(entry.change)) conflict = true
        continue
      }
      replay.set(key, entry)
      deduplicated.push(entry)
    }
    const timeline = facts
      .filter((fact) => fact.sessionID === bucket[0].sessionID)
      .sort((a, b) => a.orderKey.localeCompare(b.orderKey))
    const located = (part: Record<string, any>) => timeline.findIndex((fact) => fact.id === part.messageID)
    deduplicated.sort((a, b) => located(a.part) - located(b.part))
    const first = deduplicated[0]
    let change = first.change
    const receipts = receiptsUnique(bucket.flatMap((entry) => entry.change.evidence.receipts))
    if (conflict) change = unavailable(change, "conflicting_receipt", receipts)
    else if (deduplicated.length > 1 && !first.coverage) {
      let reason: FileChangeIncompleteReason | undefined
      for (let index = 1; index < deduplicated.length; index++) {
        const previous = deduplicated[index - 1],
          next = deduplicated[index]
        if (previous.change.evidence.kind === "incomplete" || next.change.evidence.kind === "incomplete") {
          reason =
            previous.change.evidence.kind === "incomplete"
              ? previous.change.evidence.reason
              : next.change.evidence.kind === "incomplete"
                ? next.change.evidence.reason
                : "missing_endpoints"
          break
        }
        if (!previous.edit || !next.edit || previous.change.status !== undefined || next.change.status !== undefined) {
          reason = "unsupported_lifecycle"
          break
        }
        reason = normalRelation(previous.part, next.part, facts, previous.agentID)
        if (reason) break
        if (previous.change.after !== next.change.before) {
          reason = "endpoint_discontinuity"
          break
        }
      }
      change = reason
        ? unavailable(change, reason, receipts)
        : {
            ...change,
            after: deduplicated.at(-1)!.change.after,
            ...textComparisonCounts(change.before!, deduplicated.at(-1)!.change.after!),
            evidence: { kind: "complete", receipts },
          }
    } else change = { ...change, evidence: { ...change.evidence, receipts } }
    const kind = first.coverage ? "path_coverage" : "tool_interval"
    const id = `${kind}:${first.sessionID}:${first.agentID}`
    const group = groups.get(id) ?? {
      id,
      observationKind: kind,
      sessionID: first.sessionID || undefined,
      agentID: first.agentID,
      additions: null,
      deletions: null,
      changes: [],
    }
    group.changes.push(change)
    groups.set(id, group)
  }
  return [
    ...[...groups.values()].map((group) => ({ ...group, ...summarizeFileChanges(group.changes) })),
    ...unavailableGroups.values(),
  ]
}
function treeInputs(nodes: readonly CardNode[]): FileChangeInput[] {
  const inputs: FileChangeInput[] = []
  const seen = new Set<string>()
  const visit = (node: CardNode) => {
    if (seen.has(node.id)) return
    seen.add(node.id)
    for (const part of [...(node.parts ?? []), ...(node.toolPart ? [node.toolPart] : [])]) {
      if (!node.agentID && record(part) && (part.type === "tool" || part.type === "patch"))
        throw new Error(`File change Card ${node.id} lacks its actual agent owner`)
      inputs.push({ part, agentID: node.agentID ?? "", sessionID: node.sessionID })
    }
    for (const id of node.childIDs ?? []) {
      const child = cardTreeStore.cards[id]
      if (!child) throw new Error(`File change Card ${id} is missing`)
      visit(child)
    }
  }
  nodes.forEach(visit)
  return inputs
}
export function collectAgentFileChanges(node: CardNode, base: string): AgentFileChange[] {
  const inputs = treeInputs([node])
  const facts = projectedConversationMessageFacts([
    ...new Set(
      inputs.flatMap((input) => (record(input.part) && text(input.part.sessionID) ? [input.part.sessionID] : [])),
    ),
  ])
  return reduceToolFileChangeGroups(inputs, facts, base).flatMap((group) =>
    group.changes.map((change) => ({
      ...change,
      openPath: (change as ToolFileChange).openPath,
      displayPath: (change as ToolFileChange).displayPath,
      agentID: group.agentID!,
      sources: change.evidence.receipts.length,
    })),
  )
}
export function mergeChangeGroups(groups: ChangeGroup[]): ChangeGroup[] {
  const map = new Map<string, ChangeGroup>()
  for (const group of groups) {
    const key = JSON.stringify([
      group.observationKind,
      group.id,
      group.taskID,
      group.artifactID,
      group.sessionID,
      group.agentID,
      group.diffBaseRef,
      group.diffHeadRef,
      group.commitRef,
      group.publishedCommitRef,
    ])
    const old = map.get(key)
    if (!old) {
      map.set(key, group)
      continue
    }
    const changes = new Map(old.changes.map((change) => [change.file, change]))
    for (const change of group.changes) {
      const previous = changes.get(change.file)
      if (!previous) {
        changes.set(change.file, change)
        continue
      }
      if (JSON.stringify(previous) === JSON.stringify(change)) continue
      changes.set(change.file, {
        file: change.file,
        status: change.status,
        additions: null,
        deletions: null,
        evidence: {
          kind: "incomplete",
          reason: "conflicting_receipt",
          receipts: receiptsUnique([...previous.evidence.receipts, ...change.evidence.receipts]),
        },
      })
    }
    const list = [...changes.values()],
      unavailableReceipts = receiptsUnique([...(old.unavailableReceipts ?? []), ...(group.unavailableReceipts ?? [])])
    map.set(key, {
      ...group,
      changes: list,
      ...summarizeFileChanges(list),
      ...(unavailableReceipts.length ? { unavailableReceipts, additions: null, deletions: null } : {}),
    })
  }
  return [...map.values()]
}
export function collectAgentFileChangeGroups(node: CardNode, base: string, goals: unknown): ChangeGroup[] {
  return collectAgentFileChangeGroupsFromNodes([node], base, goals)
}
export function collectAgentFileChangeGroupsFromNodes(nodes: CardNode[], base: string, _goals: unknown): ChangeGroup[] {
  const inputs = treeInputs(nodes)
  const sessionIDs = [
    ...new Set(
      inputs.flatMap((input) =>
        record(input.part) && text(input.part.sessionID)
          ? [input.part.sessionID]
          : input.sessionID
            ? [input.sessionID]
            : [],
      ),
    ),
  ]
  return reduceToolFileChangeGroups(inputs, projectedConversationMessageFacts(sessionIDs), base)
}
export function currentConversationAgentChangeGroups(): ChangeGroup[] {
  publishedCardTreeVersion()
  const board = boardStore.board as any
  const roots = cardTreeStore.order.map((id) => cardTreeStore.cards[id]).filter((node): node is CardNode => !!node)
  return collectAgentFileChangeGroupsFromNodes(
    roots,
    String(board?.task?.directory || board?.directory || ""),
    board?.goals,
  )
}
export function conversationArtifactFileRows(groups: readonly ChangeGroup[]): ArtifactFileRow[] {
  return groups
    .flatMap((group) =>
      group.changes.map((change) => ({
        groupID: group.id,
        targetPath: change.file,
        file: change.file.replaceAll("\\", "/").replace(/^\.\//, ""),
        additions: change.additions,
        deletions: change.deletions,
        isText: change.isText,
      })),
    )
    .sort((a, b) => a.file.localeCompare(b.file) || a.groupID.localeCompare(b.groupID))
}

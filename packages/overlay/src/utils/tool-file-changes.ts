import type { FileChange, FileChangeReceipt } from "../components/DiffView"
import { conversationDeferredToolState, conversationToolFileChanges } from "@opencorvus-ai/transport-protocol"
import { relativePathFrom } from "./tool"
import { textComparisonCounts } from "./text-comparison"

export interface ToolFileChange extends FileChange {
  openPath: string
  displayPath: string
}
export type ToolReceiptContext = Extract<FileChangeReceipt, { partID: string }>

function record(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}
function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined
}
function displayPath(path: string, base: string): string {
  return relativePathFrom(base, path) || path
}
function identity(source: string, target: string, base: string) {
  const file =
    target !== source ? `${displayPath(source, base)} -> ${displayPath(target, base)}` : displayPath(target, base)
  return { file, openPath: target, displayPath: file }
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
    ...identity(source, target, base),
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

/** Full and bounded transport views describe the same original Tool comparison. */
export function toolFileChangesFromState(state: unknown, base: string, context?: ToolReceiptContext): ToolFileChange[] {
  if (!record(state) || state.status !== "completed" || !record(state.metadata)) return []
  const receipt = (fileIndex: number): FileChangeReceipt[] => (context ? [{ ...context, fileIndex }] : [])
  const meta = state.metadata
  const deferred = conversationDeferredToolState(meta)
  const observations = deferred && conversationToolFileChanges(meta)
  if (observations)
    return observations.map((row) => ({
      ...identity(row.filePath, row.movePath ?? row.filePath, base),
      status: row.status,
      isText: true,
      additions: row.additions,
      deletions: row.deletions,
      evidence: { kind: "complete", receipts: receipt(row.fileIndex) },
    }))
  if (Array.isArray(meta.files))
    return meta.files.flatMap((raw, index) => {
      const change = record(raw) ? comparison(raw, base, "patch", receipt(index)) : null
      return change ? [change] : []
    })
  const change = record(meta.filediff) ? comparison(meta.filediff, base, "edit", receipt(0)) : null
  return change ? [change] : []
}

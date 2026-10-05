// ── DiffView ──
// Shared side-by-side diff renderer (jsdiff + collapsed context). Extracted from
// ChangesPanel so both the inline file list and the workspace diff preview
// render the same visuals from a single source.

import { diffLines } from "diff"
import { createMemo, For, Show } from "solid-js"
import { t, tc } from "../utils/i18n"

// ── Types ──

export type FileChangeReceipt =
  | { sessionID: string; messageID: string; partID: string; fileIndex?: number }
  | { artifactID: string; fileIndex: number }
  | { sessionID: string; fileIndex: number }

export type FileChangeIncompleteReason =
  | "missing_endpoints"
  | "saved_session_flags_missing"
  | "path_only"
  | "deferred"
  | "missing_message_facts"
  | "ambiguous_tool_step"
  | "non_normal_step"
  | "changed_input_batch"
  | "endpoint_discontinuity"
  | "unsupported_lifecycle"
  | "conflicting_receipt"
  | "unknown_resource"

export type FileChangeEvidence =
  | { kind: "complete"; receipts: readonly FileChangeReceipt[] }
  | { kind: "incomplete"; reason: FileChangeIncompleteReason; receipts: readonly FileChangeReceipt[] }

export interface FileChange {
  file: string
  status?: "added" | "deleted" | "modified"
  additions: number | null
  deletions: number | null
  evidence: FileChangeEvidence
  before?: string
  after?: string
  isText?: boolean
  beforeObject?: { oid: string; bytes: number } | null
  afterObject?: { oid: string; bytes: number } | null
}

interface DiffOp {
  kind: "context" | "add" | "del" | "skip"
  left?: number | ""
  right?: number | ""
  text?: string
  count?: number
}

// ── Diff helpers ──

function splitDiffLines(text: string): string[] {
  const value = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  if (!value) return []
  const lines = value.split("\n")
  if (lines[lines.length - 1] === "") lines.pop()
  return lines
}

function buildDiffOps(before: string, after: string): DiffOp[] {
  const ops: DiffOp[] = []
  let leftLine = 1
  let rightLine = 1

  for (const part of diffLines(before, after)) {
    const lines = splitDiffLines(part.value)
    if (part.added) {
      for (const text of lines) {
        ops.push({ kind: "add", left: "", right: rightLine, text })
        rightLine += 1
      }
      continue
    }
    if (part.removed) {
      for (const text of lines) {
        ops.push({ kind: "del", left: leftLine, right: "", text })
        leftLine += 1
      }
      continue
    }
    for (const text of lines) {
      ops.push({ kind: "context", left: leftLine, right: rightLine, text })
      leftLine += 1
      rightLine += 1
    }
  }

  return ops
}

function collapseDiffOps(ops: DiffOp[]): DiffOp[] {
  const next: DiffOp[] = []
  let index = 0
  while (index < ops.length) {
    if (ops[index].kind !== "context") {
      next.push(ops[index])
      index += 1
      continue
    }
    let end = index
    while (end < ops.length && ops[end].kind === "context") {
      end += 1
    }
    const chunk = ops.slice(index, end)
    if (chunk.length <= 8) {
      next.push(...chunk)
    } else {
      next.push(...chunk.slice(0, 3))
      next.push({ kind: "skip", count: chunk.length - 6 })
      next.push(...chunk.slice(-3))
    }
    index = end
  }
  return next
}

// ── Status label helper ──

export function changeStatusLabel(status: FileChange["status"]): string {
  if (status === "added") return t("files.status.added")
  if (status === "deleted") return t("files.status.deleted")
  if (status === "modified") return t("files.status.modified")
  return t("files.status.changed")
}

export function ChangeLineStats(props: { additions: number | null; deletions: number | null; isText?: boolean }) {
  return (
    <Show
      when={props.additions !== null && props.deletions !== null}
      fallback={
        <span
          class="diff-dialog-stat"
          title={props.isText === false ? t("diff.non_text") : t("diff.counts_unavailable_detail")}
        >
          {props.isText === false ? t("diff.non_text_short") : t("diff.counts_unavailable")}
        </span>
      }
    >
      <span class="diff-dialog-stat" data-tone="add">
        +{props.additions?.toLocaleString()}
      </span>
      <span class="diff-dialog-stat" data-tone="del">
        -{props.deletions?.toLocaleString()}
      </span>
    </Show>
  )
}

// ── DiffView component ──

interface DiffViewProps {
  item: FileChange
}

export function DiffView(props: DiffViewProps) {
  const ops = createMemo(() => {
    const item = props.item
    if (
      item.evidence.kind !== "complete" ||
      item.isText !== true ||
      typeof item.before !== "string" ||
      typeof item.after !== "string"
    )
      return []
    return collapseDiffOps(buildDiffOps(item.before, item.after))
  })
  const hasChanges = createMemo(() => ops().some((op) => op.kind === "add" || op.kind === "del"))
  const emptyMessage = createMemo(() => {
    const it = props.item
    if (it.evidence.kind === "incomplete") return t(`diff.incomplete.${it.evidence.reason}`)
    if (it.isText === false) return t("diff.non_text")
    if (typeof it.before === "string" && typeof it.after === "string" && it.before === it.after) {
      return t("diff.empty_unchanged")
    }
    return t("diff.no_preview")
  })

  return (
    <Show
      when={hasChanges()}
      fallback={
        <div class="diff-empty">
          <p class="empty-hint">{emptyMessage()}</p>
        </div>
      }
    >
      <div class="diff-lines">
        <For each={ops()}>
          {(line) => (
            <Show
              when={line.kind !== "skip"}
              fallback={
                <div class="diff-row" data-kind="skip">
                  <div class="diff-gutter">...</div>
                  <div class="diff-num" />
                  <div class="diff-num" />
                  <div class="diff-code">{tc("diff.unchanged_hidden", line.count ?? 0)}</div>
                </div>
              }
            >
              <div class="diff-row" data-kind={line.kind}>
                <div class="diff-gutter">{line.kind === "add" ? "+" : line.kind === "del" ? "-" : " "}</div>
                <div class="diff-num">{line.left ?? ""}</div>
                <div class="diff-num">{line.right ?? ""}</div>
                <div class="diff-code">{line.text ?? " "}</div>
              </div>
            </Show>
          )}
        </For>
      </div>
    </Show>
  )
}

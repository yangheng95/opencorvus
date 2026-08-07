// ── DiffView ──
// Shared side-by-side diff renderer (jsdiff + collapsed context). Extracted from
// ChangesPanel so both the inline file list and the workspace diff preview
// render the same visuals from a single source.

import { diffLines } from "diff"
import { createMemo, For, Show } from "solid-js"
import { t, tc } from "../utils/i18n"

// ── Types ──

export interface FileChange {
  file: string
  status: "added" | "deleted" | "modified"
  additions: number
  deletions: number
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

function splitDiffLines(text: string | undefined): string[] {
  const value = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
  if (!value) return []
  const lines = value.split("\n")
  if (lines[lines.length - 1] === "") lines.pop()
  return lines
}

function buildDiffOps(before: string | undefined, after: string | undefined): DiffOp[] {
  const ops: DiffOp[] = []
  let leftLine = 1
  let rightLine = 1

  for (const part of diffLines(String(before || ""), String(after || ""))) {
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

export function changeStatusLabel(status: "added" | "deleted" | "modified" | string): string {
  if (status === "added") return t("files.status.added")
  if (status === "deleted") return t("files.status.deleted")
  return t("files.status.modified")
}

// ── DiffView component ──

interface DiffViewProps {
  item: FileChange
}

export function DiffView(props: DiffViewProps) {
  const ops = createMemo(() => collapseDiffOps(buildDiffOps(props.item.before, props.item.after)))

  const hasChanges = createMemo(() => {
    if (props.item.before == null && props.item.after == null) return false
    if (!props.item.before && !props.item.after) return false
    return ops().some((op) => op.kind === "add" || op.kind === "del")
  })

  // Differentiate the "no preview" cause so the operator knows whether
  // the file was deleted, intentionally empty, or just missing a server
  // payload. Keep the translation keys explicit at the decision points.
  const emptyMessage = createMemo(() => {
    const it = props.item
    if (it.isText === false) return t("diff.non_text")
    if (it.status === "deleted" && !it.after) return t("diff.empty_deleted")
    if (it.status === "added" && it.before === undefined && it.after === undefined) return t("diff.empty_added")
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

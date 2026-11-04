// ── DiffView ──
// Shared unified diff renderer (jsdiff + revealable context). Extracted from
// ChangesPanel so both the inline file list and the workspace diff preview
// render the same visuals from a single source.

import { diffLines } from "diff"
import { createMemo, createSignal, For, Show } from "solid-js"
import { localeTag, t, tc } from "../utils/i18n"
import type { ConversationDeferredToolState } from "@opencorvus-ai/transport-protocol"
import { Disclosure } from "./ui/Disclosure"
import { OriginalFileDownload } from "./OriginalFileDownload"

// ── Types ──

export type FileChangeReceipt =
  | {
      sessionID: string
      messageID: string
      partID: string
      fileIndex?: number
      directory?: string
      deferredState?: ConversationDeferredToolState
    }
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
  /** Comparison identity; a rename includes both original and target labels. */
  file: string
  /** Actual current-file destination, resolved within the owning project. */
  openPath: string
  /** Recorded source path when the Tool moved this file. */
  previousPath?: string
  status?: "added" | "deleted" | "modified"
  additions: number | null
  deletions: number | null
  evidence: FileChangeEvidence
  before?: string
  after?: string
  isText?: boolean
  beforeObject?: { oid: string; bytes: number } | null
  afterObject?: { oid: string; bytes: number } | null
  /** Exact immutable bytes recorded by a single attachment-backed creation. */
  afterAttachment?: { url: string; name: string }
}

interface DiffLine {
  kind: "context" | "add" | "del"
  left: number | ""
  right: number | ""
  text: string
}

type DiffOp = DiffLine | { kind: "skip"; lines: DiffLine[] }

// ── Diff helpers ──

function splitDiffLines(text: string): string[] {
  const value = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  if (!value) return []
  const lines = value.split("\n")
  if (lines[lines.length - 1] === "") lines.pop()
  return lines
}

function buildDiffOps(before: string, after: string): DiffLine[] {
  const ops: DiffLine[] = []
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

function collapseDiffOps(ops: DiffLine[]): DiffOp[] {
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
      next.push({ kind: "skip", lines: chunk.slice(3, -3) })
      next.push(...chunk.slice(-3))
    }
    index = end
  }
  return next
}

function DiffLineRow(props: { line: DiffLine }) {
  return (
    <div class="diff-row" data-kind={props.line.kind}>
      <div class="diff-gutter">{props.line.kind === "add" ? "+" : props.line.kind === "del" ? "-" : " "}</div>
      <div class="diff-num">{props.line.left}</div>
      <div class="diff-num">{props.line.right}</div>
      <div class="diff-code">{props.line.text || " "}</div>
    </div>
  )
}

function DiffContext(props: { lines: DiffLine[] }) {
  const [expanded, setExpanded] = createSignal(false)
  return (
    <Disclosure.Root class="diff-context" open={expanded()} onOpenChange={setExpanded}>
      <Disclosure.Trigger class="diff-context__trigger">
        <span>{tc(expanded() ? "diff.hide_unchanged" : "diff.show_unchanged", props.lines.length)}</span>
      </Disclosure.Trigger>
      <Disclosure.Content class="diff-context__lines">
        <Show when={expanded()}>
          <For each={props.lines}>{(line) => <DiffLineRow line={line} />}</For>
        </Show>
      </Disclosure.Content>
    </Disclosure.Root>
  )
}

// ── Status label helper ──

export function changeStatusLabel(status: FileChange["status"], previousPath?: string): string {
  if (previousPath) return t("files.status.renamed")
  if (status === "added") return t("files.status.added")
  if (status === "deleted") return t("files.status.deleted")
  if (status === "modified") return t("files.status.modified")
  return t("files.status.changed")
}

export function ChangeLineStats(props: { additions: number | null; deletions: number | null; isText?: boolean; labelled?: boolean }) {
  const number = (value: number | null) => value?.toLocaleString(localeTag()) ?? ""
  const addedLabel = () => tc("diff.lines_added", props.additions!, { count: number(props.additions) })
  const deletedLabel = () => tc("diff.lines_deleted", props.deletions!, { count: number(props.deletions) })
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
      <span class="diff-dialog-stat" data-tone="add" title={addedLabel()} aria-label={addedLabel()}>
        {props.labelled ? addedLabel() : `+${number(props.additions)}`}
      </span>
      <span class="diff-dialog-stat" data-tone="del" title={deletedLabel()} aria-label={deletedLabel()}>
        {props.labelled ? deletedLabel() : `-${number(props.deletions)}`}
      </span>
    </Show>
  )
}

// ── DiffView component ──

interface DiffViewProps {
  item: FileChange
}

export function DiffView(props: DiffViewProps) {
  const text = createMemo(() => {
    const item = props.item
    return item.evidence.kind === "complete" && item.isText === true &&
      typeof item.before === "string" && typeof item.after === "string"
      ? { before: item.before, after: item.after }
      : undefined
  })
  const emptyMessage = createMemo(() => {
    const it = props.item
    if (it.evidence.kind === "incomplete") return t(`diff.incomplete.${it.evidence.reason}`)
    if (it.isText === false) return t("diff.non_text")
    if (typeof it.before === "string" && typeof it.after === "string" && it.before === it.after) {
      return t("diff.empty_unchanged")
    }
    return t("diff.no_preview")
  })
  const recordedFile = createMemo(() =>
    props.item.evidence.kind === "complete" ? props.item.afterAttachment : undefined,
  )

  return (
    <Show
      when={text()}
      fallback={
        <Show when={recordedFile()} fallback={<div class="diff-empty"><p class="empty-hint">{emptyMessage()}</p></div>}>
          {(file) => (
            <section class="diff-recorded-file" aria-label={t("diff.recorded_file_title")}>
              <strong>{t("diff.recorded_file_title")}</strong>
              <span class="diff-recorded-file__name">{file().name}</span>
              <p class="empty-hint">{t("diff.recorded_file_detail")}</p>
              <OriginalFileDownload url={file().url} name={file().name}
                displayLabel={`${file().name} · ${t("diff.recorded_file_title")}`} />
            </section>
          )}
        </Show>
      }
    >
      {(value) => (
        <div class="diff-comparison">
          <div class="diff-row diff-columns">
            <div class="diff-gutter" aria-hidden="true" />
            <div class="diff-num" title={t("diff.before_line_hint")}>{t("diff.before_line")}</div>
            <div class="diff-num" title={t("diff.after_line_hint")}>{t("diff.after_line")}</div>
            <div class="diff-code diff-columns__legend">
              <span data-tone="del">− {t("files.status.deleted")}</span>
              <span data-tone="add">+ {t("files.status.added")}</span>
            </div>
          </div>
          <TextDiffView before={value().before} after={value().after} />
        </div>
      )}
    </Show>
  )
}

/** Read-only comparison of actual text values, independent of persisted change receipts. */
export function TextDiffView(props: { before: string; after: string }) {
  const ops = createMemo(() => collapseDiffOps(buildDiffOps(props.before, props.after)))
  const hasChanges = createMemo(() => ops().some((op) => op.kind === "add" || op.kind === "del"))
  return (
    <Show when={hasChanges()} fallback={<div class="diff-empty"><p class="empty-hint">{t("diff.empty_unchanged")}</p></div>}>
      <div class="diff-lines">
        <For each={ops()}>
          {(line) => (line.kind === "skip" ? <DiffContext lines={line.lines} /> : <DiffLineRow line={line} />)}
        </For>
      </div>
    </Show>
  )
}

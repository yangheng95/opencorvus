import { For, Show, createEffect, createMemo, createSignal } from "solid-js"

import { activeTaskID, boardStore, isTaskTerminal } from "../store/board"
import {
  currentChangeGroups,
  savedSessionChangeGroups,
  summarizeChangeGroups,
  type ChangeGroup,
} from "../services/diff"
import { requestReviewFocus, requestReviewPanel } from "../services/review-focus"
import {
  conversationArtifactFileRows,
  currentConversationAgentChangeGroups,
  mergeChangeGroups,
} from "../utils/file-change-summary"
import { t, tc } from "../utils/i18n"
import { Button } from "./ui/Button"
import { Icon } from "./ui/Icon"
import { FileRowContent } from "./ui/FileRow"
import { ChangeLineStats } from "./DiffView"

const DEFAULT_VISIBLE_FILE_COUNT = 3

function persistedSourceGroups(): ChangeGroup[] {
  const board = boardStore.board as any
  if (board?.kind === "session") {
    return savedSessionChangeGroups(board.changes, String(board.sessionID || ""))
  }
  return currentChangeGroups()
}

function conversationSettled(): boolean {
  const board = boardStore.board as any
  if (board?.kind === "session") return board.status !== "active"
  return isTaskTerminal()
}

/** Conversation-level summary now owns file changes only. Artifact ownership is
 * turn-scoped and rendered by ConversationTurnArtifactSummary on its card. */
export function ConversationArtifactSummary(props: { onContentChanged?: () => void }) {
  const [expanded, setExpanded] = createSignal(false)
  const groups = createMemo(() => {
    const persisted = persistedSourceGroups()
    return mergeChangeGroups([...currentConversationAgentChangeGroups(), ...persisted])
  })
  const fileRows = createMemo(() => conversationArtifactFileRows(groups()))
  const visibleFiles = createMemo(() => (expanded() ? fileRows() : fileRows().slice(0, DEFAULT_VISIBLE_FILE_COUNT)))
  const remaining = createMemo(() => Math.max(0, fileRows().length - DEFAULT_VISIBLE_FILE_COUNT))
  const totals = createMemo(() => summarizeChangeGroups(groups()))

  createEffect(() => {
    void boardStore.selectedSource?.id
    setExpanded(false)
  })
  createEffect(() => {
    void fileRows().length
    void totals().hasUnresolvedChanges
    void expanded()
    props.onContentChanged?.()
  })

  return (
    <Show when={conversationSettled() && (fileRows().length > 0 || totals().hasUnresolvedChanges)}>
      <section class="conversation-artifact-summary" data-ui="conversation-file-change-summary">
        <header class="conversation-artifact-summary__header">
          <span class="conversation-artifact-summary__icon" aria-hidden="true">
            <Icon name="edit" size="medium" />
          </span>
          <div class="conversation-artifact-summary__identity">
            <span class="conversation-artifact-summary__eyebrow">{t("chat.artifacts.files")}</span>
            <strong>{totals().files > 0 ? tc("files.changed", totals().files) : t("diff.unresolved_title")}</strong>
            <span
              class="conversation-artifact-summary__totals"
              aria-label={
                totals().additions === null || totals().deletions === null
                  ? t("diff.counts_unavailable_detail")
                  : t("chat.artifacts.totals", { additions: totals().additions, deletions: totals().deletions })
              }
            >
              <ChangeLineStats additions={totals().additions} deletions={totals().deletions} />
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            tone="neutral"
            data-ui="conversation-artifact-review"
            onClick={requestReviewPanel}
          >
            {t("chat.artifacts.review")}
          </Button>
        </header>
        <Show when={totals().hasUnresolvedChanges}>
          <p class="empty-hint">{t("diff.unresolved_changes")}</p>
        </Show>
        <div class="conversation-artifact-summary__section">
          <div class="conversation-artifact-summary__files">
            <For each={visibleFiles()}>
              {(row) => (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  tone="neutral"
                  class="conversation-artifact-summary__file oc-file-row"
                  title={row.file}
                  onClick={() => {
                    requestReviewFocus({
                      taskID: activeTaskID(),
                      groupID: row.groupID,
                      filePath: row.targetPath,
                    })
                  }}
                >
                  <FileRowContent
                    name={row.file}
                    icon="file-document"
                    trailing={
                      <span class="conversation-artifact-summary__file-stats">
                        <ChangeLineStats additions={row.additions} deletions={row.deletions} isText={row.isText} />
                      </span>
                    }
                  />
                </Button>
              )}
            </For>
          </div>
        </div>
        <Show when={remaining() > 0}>
          <Button
            type="button"
            variant="ghost"
            size="mini"
            tone="neutral"
            class="conversation-artifact-summary__disclosure"
            aria-expanded={expanded()}
            onClick={() => setExpanded((value) => !value)}
          >
            <span>
              {expanded() ? t("chat.artifacts.show_less") : t("chat.artifacts.show_more", { count: remaining() })}
            </span>
            <Icon name={expanded() ? "chevron-down" : "chevron"} size="compact" />
          </Button>
        </Show>
      </section>
    </Show>
  )
}

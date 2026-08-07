import { For, Show, createEffect, createMemo, createSignal } from "solid-js"

import { activeTaskID, boardStore, isTaskTerminal } from "../store/board"
import { currentChangeGroups, type ChangeGroup } from "../services/diff"
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
import type { FileChange } from "./DiffView"

const DEFAULT_VISIBLE_FILE_COUNT = 3

function persistedSourceGroups(): ChangeGroup[] {
  const board = boardStore.board as any
  if (board?.kind === "session") {
    const changes = Array.isArray(board.changes) ? (board.changes as FileChange[]) : []
    return changes.length
      ? [
          {
            id: `session:${String(board.sessionID || "")}`,
            additions: changes.reduce((sum, change) => sum + (change.additions ?? 0), 0),
            deletions: changes.reduce((sum, change) => sum + (change.deletions ?? 0), 0),
            changes,
          },
        ]
      : []
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
    const sessionOwnsCompleteDiff = (boardStore.board as any)?.kind === "session" && persisted.length > 0
    if (sessionOwnsCompleteDiff) return persisted
    return mergeChangeGroups([...currentConversationAgentChangeGroups(), ...persisted])
  })
  const fileRows = createMemo(() => conversationArtifactFileRows(groups()))
  const visibleFiles = createMemo(() => (expanded() ? fileRows() : fileRows().slice(0, DEFAULT_VISIBLE_FILE_COUNT)))
  const remaining = createMemo(() => Math.max(0, fileRows().length - DEFAULT_VISIBLE_FILE_COUNT))
  const additions = createMemo(() => fileRows().reduce((sum, row) => sum + row.additions, 0))
  const deletions = createMemo(() => fileRows().reduce((sum, row) => sum + row.deletions, 0))

  createEffect(() => {
    void boardStore.selectedSource?.id
    setExpanded(false)
  })
  createEffect(() => {
    void fileRows().length
    void expanded()
    props.onContentChanged?.()
  })

  return (
    <Show when={conversationSettled() && fileRows().length > 0}>
      <section class="conversation-artifact-summary" data-ui="conversation-file-change-summary">
        <header class="conversation-artifact-summary__header">
          <span class="conversation-artifact-summary__icon" aria-hidden="true">
            <Icon name="edit" size="medium" />
          </span>
          <div class="conversation-artifact-summary__identity">
            <span class="conversation-artifact-summary__eyebrow">{t("chat.artifacts.files")}</span>
            <strong>{tc("files.changed", fileRows().length)}</strong>
            <span
              class="conversation-artifact-summary__totals"
              aria-label={t("chat.artifacts.totals", {
                additions: additions(),
                deletions: deletions(),
              })}
            >
              <Show when={additions() > 0}>
                <span data-tone="add">+{additions()}</span>
              </Show>
              <Show when={deletions() > 0}>
                <span data-tone="del">-{deletions()}</span>
              </Show>
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
                        <Show when={row.additions > 0}>
                          <span data-tone="add">+{row.additions}</span>
                        </Show>
                        <Show when={row.deletions > 0}>
                          <span data-tone="del">-{row.deletions}</span>
                        </Show>
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

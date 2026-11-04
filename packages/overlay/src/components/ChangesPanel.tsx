// ── ChangesPanel Component ──
// Shows changed files for the selected task. Clicking a row resolves the same
// shared diff data that the workspace preview uses; FileChangesView renders the
// result inline below the row.

import { createMemo, createResource, Show } from "solid-js"
import { activeTaskID, boardStore, selectedTaskDirectory } from "../store/board"
import {
  changeGroupsRevisionKey,
  currentChangeGroups,
  resolveCurrentChangeGroups,
  type ChangeGroup,
} from "../services/diff"
import {
  currentConversationFileChangeSource,
  reduceToolFileChangeGroups,
  resolveConversationFileChangeSource,
  mergeChangeGroups,
} from "../utils/file-change-summary"
import { FileChangesView } from "./FileChangesView"
import { captureApiAuthority } from "../services/api"
import { Feedback } from "./ui/Feedback"
import { Button } from "./ui/Button"
import { t } from "../utils/i18n"

// ── ChangesPanel ──

export interface ChangesPanelProps {
  /** Whether a task is currently selected (affects empty-state messaging). */
  hasSelectedTask?: boolean
  /** Whether the file changes surface is visible enough to run broad card-tree projections. */
  active?: () => boolean
}

export function ChangesPanel(props: ChangesPanelProps) {
  const panelActive = () => props.active?.() ?? true
  const conversationSource = createMemo(() => (panelActive() ? currentConversationFileChangeSource() : undefined))

  const agentGroups = createMemo<ChangeGroup[]>(() => {
    const source = conversationSource()
    return source ? reduceToolFileChangeGroups(source.inputs, source.facts, source.directory) : []
  })

  const sourceGroups = createMemo<ChangeGroup[]>(() => {
    if (!panelActive()) return []
    return currentChangeGroups()
  })

  const requestKey = createMemo(() => {
    if (!panelActive()) return false
    const groups = sourceGroups()
    const agentKey = changeGroupsRevisionKey(agentGroups())
    return JSON.stringify([
      captureApiAuthority().revision,
      boardStore.selectedSource?.kind,
      boardStore.selectedSource?.id,
      conversationSource()?.directory,
      activeTaskID(),
      agentKey,
      changeGroupsRevisionKey(groups),
    ])
  })

  const [resolvedGroups, { refetch }] = createResource(requestKey, async (key) => {
    const source = conversationSource()!
    const authority = captureApiAuthority()
    const [agents, persisted] = await Promise.all([
      resolveConversationFileChangeSource(source, authority),
      resolveCurrentChangeGroups(),
    ])
    return { key, groups: mergeChangeGroups([...agents, ...persisted]) }
  })

  const groups = createMemo<ChangeGroup[]>(() => {
    if (!panelActive()) return []
    const resolved = resolvedGroups.error ? undefined : resolvedGroups()
    return resolved?.key === requestKey() ? resolved.groups : mergeChangeGroups([...agentGroups(), ...sourceGroups()])
  })

  return (
    <>
      <Show when={panelActive() && resolvedGroups.loading}>
        <p class="empty-hint" role="status">
          {t("diff.loading")}
        </p>
      </Show>
      <Show when={panelActive() && resolvedGroups.error}>
        <Feedback
          tone="error"
          actions={
            <Button type="button" variant="outline" size="sm" tone="neutral" onClick={() => refetch()}>
              {t("common.retry")}
            </Button>
          }
        >
          {t("diff.load_failed")}
        </Feedback>
      </Show>
      <FileChangesView
        groups={groups()}
        directory={boardStore.selectedSource?.directory?.trim() || selectedTaskDirectory().trim()}
        scopeKey={activeTaskID()}
        hasSelectedTask={props.hasSelectedTask}
        focusEvent="acceptance:focus-changes"
        groupsSettled={panelActive() && !resolvedGroups.loading}
      />
    </>
  )
}

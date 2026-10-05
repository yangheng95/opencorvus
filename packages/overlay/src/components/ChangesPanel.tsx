// ── ChangesPanel Component ──
// Shows changed files for the selected task. Clicking a row resolves the same
// shared diff data that the workspace preview uses; FileChangesView renders the
// result inline below the row.

import { createMemo, createResource } from "solid-js"
import { activeTaskID } from "../store/board"
import {
  changeGroupsRevisionKey,
  currentChangeGroups,
  resolveCurrentChangeGroups,
  type ChangeGroup,
} from "../services/diff"
import { currentConversationAgentChangeGroups, mergeChangeGroups } from "../utils/file-change-summary"
import { FileChangesView } from "./FileChangesView"

// ── ChangesPanel ──

export interface ChangesPanelProps {
  /** Whether a task is currently selected (affects empty-state messaging). */
  hasSelectedTask?: boolean
  /** Whether the file changes surface is visible enough to run broad card-tree projections. */
  active?: () => boolean
}

export function ChangesPanel(props: ChangesPanelProps) {
  const panelActive = () => props.active?.() ?? true

  const agentGroups = createMemo<ChangeGroup[]>(() => {
    if (!panelActive()) return []
    return currentConversationAgentChangeGroups()
  })

  const sourceGroups = createMemo<ChangeGroup[]>(() => {
    if (!panelActive()) return []
    return currentChangeGroups()
  })

  const requestKey = createMemo(() => {
    if (!panelActive()) return false
    const groups = sourceGroups()
    const agentKey = changeGroupsRevisionKey(agentGroups())
    return `${activeTaskID()}:${agentKey}:${changeGroupsRevisionKey(groups)}`
  })

  const [resolvedGroups] = createResource(requestKey, async (key) => ({
    key,
    groups: await resolveCurrentChangeGroups(),
  }))

  const groups = createMemo<ChangeGroup[]>(() => {
    if (!panelActive()) return []
    const resolved = resolvedGroups()
    const source = resolved?.key === requestKey() ? resolved.groups : sourceGroups()
    return mergeChangeGroups([...agentGroups(), ...source])
  })

  return (
    <FileChangesView
      groups={groups()}
      scopeKey={activeTaskID()}
      hasSelectedTask={props.hasSelectedTask}
      focusEvent="acceptance:focus-changes"
      groupsSettled={panelActive() && !resolvedGroups.loading}
    />
  )
}

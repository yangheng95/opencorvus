// ── Task-scope panel components ──
// Solid.js components that render requirements, architect contracts, goals,
// acceptance evidence, and status badges.
// Data is read from boardStore (store/board.ts); no direct DOM manipulation.

import { createMemo, Show } from "solid-js"
import { boardStore } from "../store/board"
import { t } from "../utils/i18n"
import { taskLifecycleStatusOrIdleLabel } from "../utils/status-labels"
import { activeTone, verdictTone } from "../utils/verdict-tone"
import { GoalList } from "./GoalGroup"
import { RequirementsPanel } from "./RequirementsPanel"
import { ArchitectPanel } from "./ArchitectPanel"
import { SurfaceHeader } from "./ui/SurfaceHeader"
import { StatusIndicator } from "./ui/StatusIndicator"

// ── StatusBadge ──
// General-purpose status badge with an icon + label.

interface StatusBadgeProps {
  status: string
  class?: string
}

export function StatusBadge(props: StatusBadgeProps) {
  const label = () => taskLifecycleStatusOrIdleLabel(props.status)
  return (
    <span class={`status-badge ${props.class || ""}`}>
      <StatusIndicator status={props.status} label={label()} />
      <span class="status-label">{label()}</span>
    </span>
  )
}

// Pending-interaction rendering is delegated to the shared <InteractionCard>
// component, which is also used inline in the conversation timeline. The
// component owns its own busy / error state and dispatches replies through
// the per-id-mutex'd interaction-reply service — Board no longer needs to
// pipe callbacks down for this surface.

// ── Right Dock task scope panels ──
// Requirements, Architect, and Goals are mounted as separate Right Dock
// panels. They share the boardStore projection; no panel owns its own copy of
// task-scope data.

type TaskScopePanelID = "requirements" | "architect" | "goals"

interface TaskScopePanelShellProps {
  panelID: TaskScopePanelID
  badgeId?: string
  badgeText?: string
  badgeTone?: string
  badgeVariant?: "status" | "metric"
  children: any
}

function TaskScopePanelShell(props: TaskScopePanelShellProps) {
  const badge = () => (
    <span
      id={props.badgeId}
      class="task-scope-panel__badge"
      data-tone={props.badgeTone || undefined}
      data-variant={props.badgeVariant || "status"}
    >
      {props.badgeText}
    </span>
  )

  return (
    <div class="task-scope-panel" data-task-scope-panel={props.panelID}>
      <Show when={props.badgeText}>
        <SurfaceHeader variant="panel" data-ui="task-scope-toolbar" title={badge()} />
      </Show>
      <div
        class="task-scope-panel__body right-dock-panel-body"
        data-right-dock-panel={props.panelID}
        data-active="true"
      >
        <div class="sections-stack task-scope-section-stack task-scope-panel__stack" data-ui="task-scope-section-stack">
          {props.children}
        </div>
      </div>
    </div>
  )
}

function createTaskScopeProjection() {
  const board = () => boardStore.board

  const requirements = () => board()?.requirements
  const architect = () => board()?.architect
  const goals = () => board()?.goals || []

  return {
    requirements,
    architect,
    goals,
  }
}

export function RequirementsBoardPanel() {
  const scope = createTaskScopeProjection()
  const badgeText = createMemo(() => {
    const rs = scope.requirements() ?? []
    if (rs.length > 0) {
      const passed = rs.filter((r: any) => r.acceptance?.accepted === true).length
      return `${passed}/${rs.length}`
    }
    return ""
  })
  const badgeTone = createMemo(() => {
    const rs = scope.requirements() ?? []
    if (rs.length === 0) return ""
    const passed = rs.filter((r: any) => r.acceptance?.accepted === true).length
    return verdictTone({ passed, failed: 0, total: rs.length })
  })

  return (
    <TaskScopePanelShell
      panelID="requirements"
      badgeId="requirementsBadge"
      badgeText={badgeText()}
      badgeTone={badgeTone()}
    >
      <div id="requirementsSection" class="task-scope-panel__content" data-task-scope-content="requirements">
        <RequirementsPanel requirements={scope.requirements()} />
      </div>
    </TaskScopePanelShell>
  )
}

export function ArchitectBoardPanel() {
  const scope = createTaskScopeProjection()
  const badgeText = createMemo(() => {
    if (scope.architect()) return String(scope.architect()!.contractCount)
    return ""
  })
  const badgeTone = createMemo(() => activeTone(Boolean(scope.architect())))

  return (
    <TaskScopePanelShell panelID="architect" badgeId="architectBadge" badgeText={badgeText()} badgeTone={badgeTone()}>
      <div id="architectSection" class="task-scope-panel__content" data-task-scope-content="architect">
        <ArchitectPanel architect={scope.architect()} />
      </div>
    </TaskScopePanelShell>
  )
}

export function GoalsBoardPanel() {
  const scope = createTaskScopeProjection()
  const badgeText = createMemo(() => {
    const goals = scope.goals()
    const passed = goals.filter((goal) => goal.acceptance.accepted).length
    return goals.length > 0 ? `${passed}/${goals.length}` : ""
  })
  const badgeTone = createMemo(() => {
    const goals = scope.goals()
    if (goals.length === 0) return ""
    const passed = goals.filter((goal) => goal.acceptance.accepted).length
    return verdictTone({ passed, failed: 0, total: goals.length })
  })

  return (
    <TaskScopePanelShell
      panelID="goals"
      badgeId="goalsBadge"
      badgeText={badgeText()}
      badgeTone={badgeTone()}
      badgeVariant="metric"
    >
      <div
        id="goalsSection"
        class="task-scope-panel__content task-scope-panel__content--goals"
        data-task-scope-content="goals"
      >
        <Show
          when={scope.goals().length > 0}
          fallback={<p class="empty-hint empty-hint--card">{t("task_scope.goals_pending")}</p>}
        >
          <GoalList goals={scope.goals()} />
        </Show>
      </div>
    </TaskScopePanelShell>
  )
}

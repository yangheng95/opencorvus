// Embedded Goals progress section owned by Environment Information.
// Reads the canonical TaskBoard goal projection and does not keep a local copy.

import { For, Show, createMemo, createSignal } from "solid-js"
import { boardStore } from "../store/board"
import { t } from "../utils/i18n"
import { goalCompactLabelForBoardGoal } from "../utils/goal-label"
import { goalState, goalStateIconName, type GoalState } from "../utils/goal-state"
import { Icon } from "./ui/Icon"
import { Button } from "./ui/Button"

interface GoalPill {
  deliverySliceID: string
  label: string
  title: string
  state: GoalState
}

export interface TaskProgressBarProps {
  onOpenGoals: () => void
  onOpenGoal: (deliverySliceID: string) => void
}

function pillStateLabel(state: GoalState, title: string): string {
  return t(`progress.goal.${state}`, { title })
}

export function TaskProgressBar(props: TaskProgressBarProps) {
  const goals = createMemo<GoalPill[]>(() => {
    const list = (boardStore.board as any)?.goals
    if (!Array.isArray(list) || list.length === 0) return []
    return list.map(
      (goal: any, index: number): GoalPill => ({
        deliverySliceID: String(goal?.deliverySliceID || goal?.goalID || `goal-${index}`),
        label: goalCompactLabelForBoardGoal(goal, index),
        title: String(goal?.goalTitle || "").trim() || `Goal ${index + 1}`,
        state: goalState(goal),
      }),
    )
  })
  const acceptedCount = createMemo(() => goals().filter((goal) => goal.state === "accepted").length)
  const [folded, setFolded] = createSignal(false)

  return (
    <Show when={goals().length > 0} fallback={null}>
      <section
        class="task-progress project-runtime-goals-category"
        aria-label={t("progress.heading")}
        data-ui="project-runtime-category-goals"
        data-folded={String(folded())}
      >
        <div class="task-progress__header">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            tone="neutral"
            class="task-progress__heading"
            data-ui="project-runtime-tool-goals"
            onClick={props.onOpenGoals}
          >
            <span class="project-runtime-section-title oc-section-heading">{t("progress.heading")}</span>
          </Button>
          <span class="task-progress__summary">
            {acceptedCount()}/{goals().length}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            tone="neutral"
            data-ui="task-progress-fold"
            aria-expanded={!folded()}
            aria-controls="projectRuntimeGoalsPills"
            title={folded() ? t("progress.expand_card") : t("progress.collapse_card")}
            aria-label={folded() ? t("progress.expand_card") : t("progress.collapse_card")}
            onClick={() => setFolded((value) => !value)}
          >
            <Icon name={folded() ? "chevron" : "chevron-down"} size="compact" />
          </Button>
        </div>
        <div class="task-progress__body">
          <div
            id="projectRuntimeGoalsPills"
            class="task-progress__pills project-runtime-bounded-list"
            data-runtime-list="goals"
          >
            <For each={goals()}>
              {(goal) => (
                <Button
                  type="button"
                  variant="ghost"
                  size="mini"
                  tone="neutral"
                  data-ui="task-progress-pill"
                  data-delivery-slice-id={goal.deliverySliceID}
                  data-state={goal.state}
                  title={pillStateLabel(goal.state, goal.title)}
                  aria-label={pillStateLabel(goal.state, goal.title)}
                  onClick={() => props.onOpenGoal(goal.deliverySliceID)}
                >
                  <span class="task-progress__pill-icon" aria-hidden="true">
                    <Icon name={goalStateIconName(goal.state)} size="compact" />
                  </span>
                  <span class="task-progress__pill-id">{goal.label}</span>
                  <span class="task-progress__pill-title">{goal.title}</span>
                </Button>
              )}
            </For>
          </div>
        </div>
      </section>
    </Show>
  )
}

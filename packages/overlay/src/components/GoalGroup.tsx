/**
 * GoalGroup — per-Slice expandable summary card for the sidebar.
 *
 * The right-side Goal panel stays Slice-scoped: title, objective,
 * acceptance, and independent activity/review facts. Step-by-step executor detail belongs in
 * the conversation timeline, not duplicated here as a second Executor pane.
 */
import { Show } from "solid-js"
import { t } from "../utils/i18n"
import { cardExpanded, setCardExpanded } from "../store/conversation-ui"
import { goalCompactLabelForBoardGoal } from "../utils/goal-label"
import { goalState, goalStateIconName } from "../utils/goal-state"
import { StaticTextPart } from "./TextPart"
import { Icon } from "./ui/Icon"
import { Disclosure } from "./ui/Disclosure"
import { ProgressiveList } from "./ui/ProgressiveList"

// ── Types ──

interface AcceptanceScorerLike {
  type?: string
  name?: string
  criteria?: string
  spec?: { kind?: string; cmd?: string; path?: string }
}

interface AcceptanceSpecLike {
  id?: string
  title?: string
  severity?: string
  scorers?: AcceptanceScorerLike[]
}

interface GoalProjection {
  goalID: string
  deliverySliceID: string
  deliverySliceRevisionID: string
  priorRevisionID?: string
  goalTitle: string
  orderIndex?: number
  /** Architect-authored 1–2 sentence execution directive for this goal.
   *  The real goal summary — acceptance_specs are the pass/fail contract,
   *  objective is the prose description a human reads first. */
  goalObjective?: string
  activity: {
    sessionIDs: string[]
    activeSessionIDs: string[]
    evidenceArtifactIDs: string[]
  }
  reviewAssociations: Array<{
    artifactID: string
    deliverySliceRevisionID: string
    judgment: "accepted" | "rejected" | "inconclusive"
  }>
  acceptance: { accepted: boolean; completionDecisionArtifactID?: string }
  /** Typed acceptance specs from the backend (board.ts). */
  acceptanceSpecs?: AcceptanceSpecLike[]
  priority: "blocking" | "advisory"
}

/** Reduce an AcceptanceSpec[] to a single short human-readable line for the
 *  per-Slice panel preview and the Goal-edit textarea seed. We pick the first
 *  scorer's criteria/command so operators see the most actionable signal. */
function previewAcceptance(specs: AcceptanceSpecLike[] | undefined): string {
  if (!Array.isArray(specs) || specs.length === 0) return ""
  const first = specs[0]
  const scorer = first.scorers?.[0]
  if (!scorer) return first.title ?? ""
  if (scorer.type === "llm_judge" && scorer.criteria) return scorer.criteria
  if (scorer.type === "heuristic" && scorer.spec?.kind === "shell" && scorer.spec.cmd) return scorer.spec.cmd
  if (scorer.type === "heuristic" && scorer.spec?.kind === "script_ref" && scorer.spec.path) return scorer.spec.path
  return first.title ?? ""
}

interface GoalGroupProps {
  goal: GoalProjection
  defaultOpen?: boolean
}

// ── Main GoalGroup ──

export function GoalGroup(props: GoalGroupProps) {
  // Cards with exactly associated active Sessions default open; an explicit operator choice remains authoritative.
  // Key is namespaced with "gwg:" so it never collides with conversation-panel keys.
  const cardKey = () => `gwg:${props.goal.deliverySliceID}`
  const presentationStatus = () => goalState(props.goal)
  const defaultOpen = () => props.defaultOpen ?? props.goal.activity.activeSessionIDs.length > 0
  const expanded = () => cardExpanded(cardKey(), defaultOpen())
  const sliceLabel = () => goalCompactLabelForBoardGoal(props.goal, props.goal.orderIndex ?? 0)
  const acceptanceLabel = () =>
    props.goal.acceptance.accepted ? t("goal.fact.accepted") : t("goal.fact.unaccepted")

  return (
    <Disclosure.Root
      class="gwg task-scope-disclosure-item"
      data-delivery-slice-id={props.goal.deliverySliceID}
      data-goal-accepted={String(props.goal.acceptance.accepted)}
      data-presentation-status={presentationStatus()}
      animated
      size="md"
      defaultOpen={expanded()}
      onOpenChange={(open) => setCardExpanded(cardKey(), open)}
    >
      <Disclosure.Trigger class="task-scope-disclosure-trigger gwg-header" data-ui="gwg-header" indicatorPosition="end">
        <span class="gwg-status-icon" data-status={presentationStatus()}>
          <Icon name={goalStateIconName(presentationStatus())} size="compact" />
        </span>
        <Show when={sliceLabel()}>
          <span class="gwg-revision">{sliceLabel()}</span>
        </Show>
        <span class="gwg-title-row">
          <span class="gwg-title">{props.goal.goalTitle}</span>
        </span>
        <span class="gwg-header-meta">
          <span class="gwg-execution-state" data-status={presentationStatus()}>
            <span>{acceptanceLabel()}</span>
          </span>
          <Show when={props.goal.priority === "advisory"}>
            <span class="gwg-priority-badge">{t("task_scope.requirement_priority.advisory")}</span>
          </Show>
        </span>
      </Disclosure.Trigger>
      <Disclosure.Content class="task-scope-disclosure-content gwg-content">
        <div class="task-scope-disclosure-content-inner gwg-body">
          <Show when={props.goal.goalObjective}>
            <div class="gwg-objective">
              <div class="gwg-objective-label oc-section-heading">{t("goal.field.objective")}</div>
              <div class="gwg-objective-text">
                <StaticTextPart text={props.goal.goalObjective!} />
              </div>
            </div>
          </Show>
          <Show when={previewAcceptance(props.goal.acceptanceSpecs)}>
            <div class="gwg-done-definition">
              <div class="gwg-done-definition-label oc-section-heading">{t("goal.field.acceptance")}</div>
              <div class="gwg-done-definition-text">
                <StaticTextPart text={previewAcceptance(props.goal.acceptanceSpecs)} />
              </div>
            </div>
          </Show>
          <Show when={props.goal.activity.sessionIDs.length > 0 || props.goal.reviewAssociations.length > 0}>
            <div class="gwg-done-definition">
              <div class="gwg-done-definition-label oc-section-heading">{t("goal.field.facts")}</div>
              <div class="gwg-done-definition-text">
                {t("goal.fact.summary", {
                  sessions: props.goal.activity.sessionIDs.length,
                  evidence: props.goal.activity.evidenceArtifactIDs.length,
                  reviews: props.goal.reviewAssociations.length,
                })}
              </div>
            </div>
          </Show>
        </div>
      </Disclosure.Content>
    </Disclosure.Root>
  )
}

/** Render a list of goal projections. */
export function GoalList(props: { goals: GoalProjection[] }) {
  return (
    <ProgressiveList items={props.goals} class="task-scope-disclosure-list gwg-list" dataUi="goals-progressive-list">
      {(goal) => <GoalGroup goal={goal} />}
    </ProgressiveList>
  )
}

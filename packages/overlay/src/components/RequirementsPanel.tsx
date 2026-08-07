/**
 * RequirementsPanel — structured requirements list from Requirements Agent output.
 *
 * Two states: structured requirements or an explicit pending hint.
 */
import { Show } from "solid-js"
import { cardExpanded, setCardExpanded } from "../store/conversation-ui"
import { t } from "../utils/i18n"
import { Disclosure } from "./ui/Disclosure"
import { ProgressiveList } from "./ui/ProgressiveList"

interface Requirement {
  id: string
  description: string
  type: "explicit" | "inferred" | "system"
  priority: "blocking" | "advisory"
  acceptance: {
    accepted: boolean
    claimingDeliverySliceRevisionIDs: string[]
    acceptedDeliverySliceRevisionIDs: string[]
    completionDecisionArtifactID?: string
  }
}

interface RequirementsPanelProps {
  requirements: Requirement[] | undefined
}

function typeBadgeClass(type: string): string {
  switch (type) {
    case "explicit":
      return "req-type--explicit"
    case "inferred":
      return "req-type--inferred"
    case "system":
      return "req-type--system"
    default:
      return ""
  }
}

function requirementTypeLabel(type: Requirement["type"]): string {
  return t(`task_scope.requirement_type.${type}`)
}

function RequirementItem(props: { requirement: Requirement; index: number }) {
  const cardKey = () => `req:${props.requirement.id}`
  const expanded = () => cardExpanded(cardKey(), false)

  return (
    <Disclosure.Root
      class="req-item task-scope-disclosure-item"
      data-requirement-id={props.requirement.id}
      animated
      size="md"
      defaultOpen={expanded()}
      onOpenChange={(open) => setCardExpanded(cardKey(), open)}
    >
      <Disclosure.Trigger
        class="task-scope-disclosure-trigger req-item-summary"
        data-ui="requirement-header"
        indicatorPosition="end"
      >
        <span class="req-index" title={props.requirement.id}>
          REQ {String(props.index + 1).padStart(2, "0")}
        </span>
        <span class="req-summary">{props.requirement.description}</span>
      </Disclosure.Trigger>
      <Disclosure.Content class="task-scope-disclosure-content req-item-content">
        <div class="task-scope-disclosure-content-inner req-item-body">
          <div class="req-desc">{props.requirement.description}</div>
          <div class="req-item-meta">
            <span class={`req-type ${typeBadgeClass(props.requirement.type)}`}>
              {requirementTypeLabel(props.requirement.type)}
            </span>
            <span
              class="req-status"
              data-req-status={props.requirement.acceptance.accepted ? "accepted" : "unaccepted"}
            >
              {t(
                props.requirement.acceptance.accepted
                  ? "task_scope.requirement_acceptance.accepted"
                  : "task_scope.requirement_acceptance.unaccepted",
              )}
            </span>
            <Show when={props.requirement.priority === "advisory"}>
              <span class="req-priority">{t("task_scope.requirement_priority.advisory")}</span>
            </Show>
          </div>
        </div>
      </Disclosure.Content>
    </Disclosure.Root>
  )
}

export function RequirementsPanel(props: RequirementsPanelProps) {
  const hasData = () => props.requirements && props.requirements.length > 0

  return (
    <div class="req-panel">
      {/* Structured requirements list. */}
      <Show when={hasData()}>
        <ProgressiveList
          items={props.requirements ?? []}
          class="task-scope-disclosure-list req-list"
          dataUi="requirements-progressive-list"
        >
          {(requirement, index) => <RequirementItem requirement={requirement} index={index()} />}
        </ProgressiveList>
      </Show>

      <Show when={!hasData()}>
        <p class="empty-hint empty-hint--card">{t("task_scope.requirements_pending")}</p>
      </Show>
    </div>
  )
}

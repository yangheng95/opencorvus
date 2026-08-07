import { Show } from "solid-js"
import { displayToolIconName } from "../utils/tool"
import {
  collapsedActivityPreviewText,
  collectLatestActivityText,
  collectTodoSummary,
  type CardNode,
} from "../utils/card-tree"
import { t } from "../utils/i18n"
import { CardDurationChip, CardHeaderChrome } from "./CardHeaderChrome"
import { CardTodoSummary } from "./CardTodoSummary"
import { Icon, type IconName } from "./ui/Icon"
import { Button } from "./ui/Button"

function leadingIconName(node: CardNode): IconName | undefined {
  if (node.kind === "tool") return displayToolIconName(node.stage || node.title)
  return undefined
}

function isStageCard(node: CardNode): boolean {
  return node.kind === "agent"
}

function cardTitleText(title: string): string {
  if (title === "tool.card.todos") return t("tool.card.todos")
  if (title === "tool.card.plan") return t("tool.card.plan")
  return /^[\w-]+(?:\.[\w-]+)+$/.test(title) ? t(title) : title
}

export function CardHeader(props: {
  node: CardNode
  expanded: boolean
  collapsible: boolean
  onToggle: () => void
  /** Invoked when the user clicks the rewind (↶) button. Receives the
   *  card's `time` (ms — becomes cursorTime on the backend) and id
   *  (anchorEventID for audit). Parent routes it to POST /task/:id/rewind. */
  onRewind?: (cursorTime: number, anchorID: string, opts: { resetWorktree: boolean }) => Promise<void>
  /** Set on cards that map 1:1 to an opencorvus session (kind="agent"
   *  cards whose id follows `<stage>:session:<sid>`). When present the
   *  header renders an inspect button that calls `onTrace` to toggle the
   *  AgentTrace panel for that session inside the card body. */
  traceSessionID?: string
  /** Whether the trace panel is currently open in the parent. */
  traceOpen?: boolean
  /** Toggle the trace panel for this card. */
  onTrace?: () => void
  /** Child-agent cancel control. Root orchestrator/task session is not
   *  passed. Operator steer moved to <OperatorSteerBox/> at the END of the card
   *  body — see Card.tsx. */
  agentSessionID?: string
  onAgentCancel?: (sessionID: string) => Promise<void>
}) {
  const iconName = () => leadingIconName(props.node)
  const collapsedActive = () =>
    !props.expanded && props.node.status !== "running" && isStageCard(props.node) && props.node.kind !== "tool"
  const collapsedPreview = () =>
    collapsedActive() ? collapsedActivityPreviewText(collectLatestActivityText(props.node), props.node.title) : ""
  const todoSummary = () => (collapsedActive() ? collectTodoSummary(props.node) : null)
  // Drives `card__head--with-meta` (flex-start vs center). Only true when
  // we render a row BELOW the title row — subtitle is inline, so it does
  // not count toward "needs vertical alignment to top".
  const hasSecondaryText = () => !!collapsedPreview() || !!todoSummary()
  const onHeaderClick = () => {
    if (!props.collapsible) return
    props.onToggle()
  }
  const headerContents = () => (
    <>
      <Show when={iconName()}>
        {(name) => (
          <span class="card__icon" aria-hidden="true">
            <Icon name={name()} />
          </span>
        )}
      </Show>
      <span class="card__main">
        <span class="card__title-row">
          <span class="card__title">{cardTitleText(props.node.title)}</span>
          <Show when={props.node.subtitle}>
            <span class="card__subtitle" title={props.node.kind === "tool" ? undefined : props.node.subtitle}>
              {props.node.subtitle}
            </span>
          </Show>
          <span class="card__title-spacer" aria-hidden="true" />
        </span>
        <Show when={collapsedPreview()}>
          <span class="card__preview-row">
            <span class="card__collapsed-preview">{collapsedPreview()}</span>
          </span>
        </Show>
        <Show when={todoSummary()}>{(summary) => <CardTodoSummary summary={summary()} />}</Show>
      </span>
    </>
  )
  return (
    <div class="card__head" classList={{ "card__head--with-meta": hasSecondaryText() }}>
      <Button
        type="button"
        variant="ghost"
        size="mini"
        tone="neutral"
        class="card__head-main oc-navigation-row"
        data-ui="card-head-main"
        aria-expanded={props.collapsible ? props.expanded : undefined}
        onClick={onHeaderClick}
      >
        {headerContents()}
      </Button>
      <CardHeaderChrome
        node={props.node}
        actionsClass="card__actions"
        onRewind={props.onRewind}
        traceSessionID={props.traceSessionID}
        traceOpen={props.traceOpen}
        onTrace={props.onTrace}
        agentSessionID={props.agentSessionID}
        onAgentCancel={props.onAgentCancel}
      />
      <CardDurationChip node={props.node} />
    </div>
  )
}

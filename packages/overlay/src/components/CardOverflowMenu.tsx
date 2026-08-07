import { Show } from "solid-js"

import { useCardHeadActions } from "../hooks/use-card-head-actions"
import type { CardNode } from "../store/card-tree"
import { t } from "../utils/i18n"
import { Button } from "./ui/Button"
import { DropdownMenu } from "./ui/DropdownMenu"
import { Icon } from "./ui/Icon"

export interface CardOverflowMenuProps {
  node: CardNode
  class: string
  onRewind?: (cursorTime: number, anchorID: string, opts: { resetWorktree: boolean }) => Promise<void>
  traceSessionID?: string
  traceOpen?: boolean
  onTrace?: () => void
  agentSessionID?: string
  onAgentCancel?: (sessionID: string) => Promise<void>
  agentSteerOpen?: boolean
  onAgentSteerToggle?: () => void
}

/** Shared command menu for structured card headers and Conversation turn
 * controls. The owning surface supplies placement; command capability and
 * execution remain centralized here. */
export function CardOverflowMenu(props: CardOverflowMenuProps) {
  const headActions = useCardHeadActions({
    node: () => props.node,
    onRewind: props.onRewind,
    onAgentCancel: props.onAgentCancel,
    agentSessionID: () => props.agentSessionID,
  })
  const hasActions = () =>
    (!!props.traceSessionID && !!props.onTrace) ||
    headActions.caps.canCancel() ||
    headActions.caps.canRewind() ||
    !!props.onAgentSteerToggle

  return (
    <Show when={hasActions()}>
      <div class={props.class}>
        <DropdownMenu.Root placement="bottom-end" gutter={6} fitViewport>
          <DropdownMenu.Trigger
            as={Button}
            type="button"
            variant="ghost"
            size="icon"
            tone="neutral"
            data-chrome="icon-action"
            data-ui="card-overflow-menu-trigger"
            title={t("card.more_actions")}
            aria-label={t("card.more_actions")}
            onClick={(event: MouseEvent) => event.stopPropagation()}
          >
            <Icon name="more-horizontal" />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content class="card-actions-menu" data-ui="card-overflow-menu">
              <Show when={!!props.traceSessionID && !!props.onTrace}>
                <DropdownMenu.Item
                  as="button"
                  type="button"
                  class="card-actions-menu__item"
                  data-ui="card-trace"
                  data-state={props.traceOpen ? "open" : "closed"}
                  onSelect={() => props.onTrace?.()}
                >
                  <Icon name="log-lines" />
                  <span>{t("card.inspect_agent_trace")}</span>
                </DropdownMenu.Item>
              </Show>
              <Show when={!!props.onAgentSteerToggle}>
                <DropdownMenu.Item
                  as="button"
                  type="button"
                  class="card-actions-menu__item"
                  data-ui="agent-reply-disclosure"
                  data-state={props.agentSteerOpen ? "open" : "closed"}
                  onSelect={() => props.onAgentSteerToggle?.()}
                >
                  <Icon name={props.agentSteerOpen ? "chevron-down" : "message"} />
                  <span>{t("card.agent_reply_toggle")}</span>
                </DropdownMenu.Item>
              </Show>
              <Show when={headActions.caps.canCancel()}>
                <DropdownMenu.Separator />
                <DropdownMenu.Item
                  as="button"
                  type="button"
                  class="card-actions-menu__item card-actions-menu__item--danger"
                  data-ui="card-agent-cancel"
                  data-state={headActions.state.cancelling() ? "pending" : "idle"}
                  disabled={headActions.state.cancelling()}
                  onSelect={() => headActions.onAgentCancel()}
                >
                  <Icon name="cancel" />
                  <span>{headActions.labels.cancel()}</span>
                </DropdownMenu.Item>
              </Show>
              <Show when={headActions.caps.canRewind()}>
                <DropdownMenu.Item
                  as="button"
                  type="button"
                  class="card-actions-menu__item"
                  data-ui="card-rewind"
                  data-state="disabled"
                  disabled
                  onSelect={() => headActions.onRewind()}
                >
                  <Icon name="rewind" />
                  <span>{headActions.labels.rewindDisabled()}</span>
                </DropdownMenu.Item>
              </Show>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </Show>
  )
}

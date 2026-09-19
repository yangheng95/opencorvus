import { Show } from "solid-js"

import type { CardNode } from "../store/card-tree"
import { renderAsBubble, renderAsPendingAgent } from "../utils/chat-bubble"
import { t } from "../utils/i18n"
import { Card } from "./Card"
import { ChatBubble } from "./ChatBubble"

export function ConversationCard(props: { node: CardNode; depth: number; collapsible?: boolean }) {
  const label = () => t("chat.thinking")
  return (
    <Show
      when={renderAsPendingAgent(props.node)}
      fallback={
        // Keep branch identity separate from the changing transcript object.
        // A plain conditional here recreates the bubble on every live projection.
        <Show when={renderAsBubble(props.node)} fallback={<Card node={props.node} depth={props.depth} />}>
          <ChatBubble node={props.node} depth={props.depth} collapsible={props.collapsible} />
        </Show>
      }
    >
      <div
        class="conversation-thinking"
        data-card-id={props.node.id}
        data-kind={props.node.kind}
        data-status={props.node.status}
        role="status"
      >
        <span class="conversation-thinking__text">{label()}</span>
      </div>
    </Show>
  )
}

import { Show } from "solid-js"

import type { CardNode } from "../store/card-tree"
import { renderAsBubble, renderAsPendingAgent } from "../utils/chat-bubble"
import { t } from "../utils/i18n"
import { Card } from "./Card"
import { ChatBubble } from "./ChatBubble"

export function ConversationCard(props: { node: CardNode; depth: number; collapsible?: boolean }) {
  const label = () => t("chat.thinking")
  const ordinaryCard = () =>
    renderAsBubble(props.node) ? (
      <ChatBubble node={props.node} depth={props.depth} collapsible={props.collapsible} />
    ) : (
      <Card node={props.node} depth={props.depth} />
    )

  return (
    <Show when={renderAsPendingAgent(props.node)} fallback={ordinaryCard()}>
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

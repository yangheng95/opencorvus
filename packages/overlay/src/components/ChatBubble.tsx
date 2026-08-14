import { For, Match, Show, Switch, createMemo } from "solid-js"

import type { CardNode } from "../store/card-tree"
import { rootTaskSessionID, activeTaskID, boardStore } from "../store/board"
import { cardExpanded, setCardExpanded } from "../store/conversation-ui"
import {
  collapsedActivityPreviewText,
  collectCardAnswerText,
  collectLatestActivityText,
  defaultExpandedForNode,
  visibleChildIDsForCard,
} from "../utils/card-tree"
import { bubbleAlign } from "../utils/chat-bubble"
import { agentIdentityLabel, normalizeAgentRole, workerSteerTargetSessionID } from "../utils/message"
import { stageAccent } from "../utils/card-color"
import { sendOperatorSteer, type OperatorSteerResult } from "../services/task"
import { t } from "../utils/i18n"
import { OperatorSteerBox, OperatorSteerForm, createOperatorSteerController } from "./OperatorSteerBox"
import { Avatar } from "./Avatar"
import { CardDurationChip, CardErrorReasonIndicator } from "./CardHeaderChrome"
import { Card } from "./Card"
import { CardParts } from "./CardParts"
import { FilePart, isImageFilePart } from "./FilePart"
import { ReviewStreamSection } from "./ReviewStreamSection"
import { storeCardNode } from "./StoreCardNode"
import { Button } from "./ui/Button"
import { Icon } from "./ui/Icon"
import { ConversationTurnControl } from "./ConversationTurnControl"
import { Badge, type BadgeTone } from "./ui/Badge"

type OperatorIngressPresentation = { label: string; tone: BadgeTone; state: string; title?: string }

function operatorIngressPresentation(messageID: string | undefined): OperatorIngressPresentation | undefined {
  if (!messageID || boardStore.selectedSource?.kind !== "task") return undefined
  const artifact = boardStore.board?.artifacts.find(
    (item: any) => item.kind === "task_root_ingress" && item.payload?.message_id === messageID,
  )
  if (!artifact) return undefined
  if (artifact.label === "accepted") return { label: t("task.ingress.accepted"), tone: "muted", state: "accepted" }
  if (artifact.label === "delivering") return { label: t("task.ingress.delivering"), tone: "accent", state: "delivering" }
  if (artifact.label === "delivered") return { label: t("task.ingress.delivered"), tone: "ok", state: "delivered" }
  if (artifact.label === "terminal_inapplicable") {
    return { label: t("task.ingress.cancelled"), tone: "muted", state: "cancelled" }
  }
  if (artifact.label === "delivery_failed") return { label: t("task.ingress.failed"), tone: "bad", state: "failed" }
  return undefined
}

function UnsupportedChatBubbleChild(props: { child: CardNode; parentID: string }): null {
  throw new Error(`ChatBubble: unsupported child kind "${props.child.kind}" for ${props.parentID}`)
}

function ChatBubbleIdentity(props: { node: CardNode; compact?: boolean; hideDuration?: boolean }) {
  const role = () => normalizeAgentRole(props.node.role || props.node.stage || "")
  const identityLabel = () => agentIdentityLabel(props.node.agentID, role())
  const status = () => props.node.status || "idle"
  const hasErrorReason = () => status() === "error" && !!String(props.node.errorReason || "").trim()
  return (
    <div
      class="chat-bubble__identity-meta"
      data-agent-id={props.node.agentID}
      data-compact={props.compact ? "true" : "false"}
    >
      <Avatar role={role()} status={props.node.status} class="chat-bubble__head-avatar" />
      <span class="chat-bubble__title">{identityLabel()}</span>
      <Show when={!props.hideDuration}>
        <CardDurationChip node={props.node} />
      </Show>
    </div>
  )
}

function ChatBubbleEmptyTurnState(props: { node: CardNode; hasVisibleContent: boolean }) {
  const errorReason = () => props.node.errorReason?.trim() || ""
  return (
    <Show when={!props.hasVisibleContent && props.node.status === "error" && errorReason()}>
      <div class="msg-tool-error" data-agent-error-card-id={props.node.id} role="alert">
        {errorReason()}
      </div>
    </Show>
  )
}

function ChatBubbleAgentChildBody(props: {
  child: CardNode
  depth: number
  rootTaskSessionID?: string
  onOperatorSteer: (sessionID: string, message: string) => Promise<OperatorSteerResult>
}) {
  const visibleChildIDs = createMemo(() => visibleChildIDsForCard(props.child))
  const steerTargetSessionID = createMemo(() => workerSteerTargetSessionID(props.child, props.rootTaskSessionID))
  const hasVisibleContent = () => props.child.parts.length > 0 || visibleChildIDs().length > 0

  return (
    <>
      <Show when={props.child.reviewStream}>
        <ReviewStreamSection reviewStream={props.child.reviewStream!} />
      </Show>
      <Show when={props.child.parts.length > 0}>
        <CardParts
          parts={props.child.parts}
          collapsedContextMessageIDs={props.child.collapsedContextMessageIDs}
          depth={props.depth + 1}
          streaming={props.child.status === "running"}
          collapseWorkDetails
          turnArtifacts={props.child.turnArtifacts}
          renderNestedCard={(node, depth) => <Card node={node} depth={depth} />}
        />
      </Show>
      <ChatBubbleEmptyTurnState node={props.child} hasVisibleContent={hasVisibleContent()} />
      <Show when={visibleChildIDs().length > 0}>
        <div class="chat-bubble__children">
          <For each={visibleChildIDs()}>
            {(childID) => (
              <ChatBubbleChild
                childID={childID}
                depth={props.depth + 1}
                parentID={props.child.id}
                rootTaskSessionID={props.rootTaskSessionID}
                onOperatorSteer={props.onOperatorSteer}
              />
            )}
          </For>
        </div>
      </Show>
      <Show when={steerTargetSessionID()}>
        <OperatorSteerBox onSend={(message) => props.onOperatorSteer(steerTargetSessionID()!, message)} />
      </Show>
    </>
  )
}

function ChatBubbleChild(props: {
  childID: string
  depth: number
  parentID: string
  rootTaskSessionID?: string
  onOperatorSteer: (sessionID: string, message: string) => Promise<OperatorSteerResult>
}) {
  const child = () => storeCardNode(props.childID, props.parentID)
  const childStyle = createMemo<Record<string, string> | undefined>(() => {
    if (child().kind !== "agent") return undefined
    const role = normalizeAgentRole(child().role || child().stage || "")
    const accent = stageAccent(role)
    return accent ? { "--card-stage": accent } : undefined
  })

  return (
    <div
      class="chat-bubble__child"
      data-card-id={child().id}
      data-kind={child().kind}
      data-stage={child().stage || child().role || ""}
      data-status={child().status || "none"}
      data-depth={props.depth + 1}
      style={childStyle()}
    >
      <Show when={child().kind === "agent"}>
        <div class="chat-bubble__child-identity">
          <ChatBubbleIdentity node={child()} compact />
          <Show when={child().status === "error" && String(child().errorReason || "").trim()}>
            {(reason) => <CardErrorReasonIndicator reason={reason()} />}
          </Show>
        </div>
      </Show>
      <Switch fallback={<UnsupportedChatBubbleChild child={child()} parentID={props.parentID} />}>
        <Match when={child().kind === "message"}>
          <CardParts
            parts={child().parts}
            collapsedContextMessageIDs={child().collapsedContextMessageIDs}
            depth={props.depth + 1}
            streaming={child().status === "running"}
            collapseWorkDetails
            turnArtifacts={child().turnArtifacts}
            renderNestedCard={(node, depth) => <Card node={node} depth={depth} />}
          />
        </Match>
        <Match when={child().kind === "agent"}>
          <ChatBubbleAgentChildBody
            child={child()}
            depth={props.depth}
            rootTaskSessionID={props.rootTaskSessionID}
            onOperatorSteer={props.onOperatorSteer}
          />
        </Match>
      </Switch>
    </div>
  )
}

export function ChatBubble(props: { node: CardNode; depth: number; collapsible?: boolean }) {
  const align = () => bubbleAlign(props.node)
  const normalizedRole = () => normalizeAgentRole(props.node.role || props.node.stage || "")
  const isUser = () => normalizedRole() === "user"
  const ingress = createMemo(() => (isUser() ? operatorIngressPresentation(props.node.messageID) : undefined))
  const collapsible = () => !isUser() && props.collapsible !== false
  const defaultExpanded = () => defaultExpandedForNode(props.node)
  const expanded = () => isUser() || !collapsible() || cardExpanded(props.node.id, defaultExpanded())
  const errorReason = () => (props.node.status === "error" ? String(props.node.errorReason || "").trim() : "")
  const collapsedPreview = createMemo(() => {
    if (expanded()) return ""
    const text = collectLatestActivityText(props.node)
    return collapsedActivityPreviewText(text, props.node.title)
  })
  const userPartPartition = createMemo(() => {
    if (!isUser()) return { images: [], body: props.node.parts }
    const images = []
    const body = []
    for (const part of props.node.parts) {
      if (isImageFilePart(part)) images.push(part)
      else body.push(part)
    }
    return { images, body }
  })
  const visibleChildIDs = createMemo(() => visibleChildIDsForCard(props.node))
  const answerText = createMemo(() => collectCardAnswerText(props.node))
  const hasFinalTurnOutput = createMemo(() => {
    if (!answerText().trim()) return false
    if (isUser()) return true
    return props.node.status !== "pending" && props.node.status !== "running"
  })
  const hasVisibleContent = () => props.node.parts.length > 0 || visibleChildIDs().length > 0

  const setExpanded = (value: boolean) => {
    if (!collapsible()) return
    setCardExpanded(props.node.id, value)
  }

  const toggleExpanded = () => {
    setExpanded(!expanded())
  }

  const steerTargetSessionID = createMemo(() => workerSteerTargetSessionID(props.node, rootTaskSessionID()))

  const onOperatorSteer = async (sessionID: string, message: string) => {
    const taskID = activeTaskID()
    if (!taskID) throw new Error(t("card.agent_reply_missing_task"))
    return await sendOperatorSteer(taskID, sessionID, message)
  }

  const steerController = createOperatorSteerController(async (message) => {
    const sessionID = steerTargetSessionID()
    if (!sessionID) throw new Error(t("card.agent_reply_missing_task"))
    return await onOperatorSteer(sessionID, message)
  })
  const onAgentSteerToggle = () => {
    const nextOpen = !steerController.open()
    setExpanded(true)
    steerController.setOpen(nextOpen)
  }

  const renderBodyParts = () => (
    <CardParts
      parts={userPartPartition().body}
      collapsedContextMessageIDs={props.node.collapsedContextMessageIDs}
      depth={props.depth}
      streaming={props.node.status === "running"}
      collapseWorkDetails
      turnArtifacts={props.node.turnArtifacts}
      renderNestedCard={(node, depth) => <Card node={node} depth={depth} />}
    />
  )

  const articleStyle = createMemo<Record<string, string> | undefined>(() => {
    const style: Record<string, string> = {}
    const accent = stageAccent(normalizedRole())
    if (accent) style["--card-stage"] = accent
    return Object.keys(style).length > 0 ? style : undefined
  })

  return (
    <article
      class="chat-bubble-row"
      data-card-id={props.node.id}
      data-kind={props.node.kind}
      data-role={normalizedRole()}
      data-stage={normalizedRole()}
      data-align={align()}
      data-status={props.node.status || "none"}
      data-depth={props.depth}
      style={articleStyle()}
    >
      <div class="chat-bubble-shell" data-align={align()}>
        <div
          class="chat-bubble"
          data-align={align()}
          data-stage={normalizedRole()}
          data-status={props.node.status || "none"}
          data-expanded={expanded() ? "true" : "false"}
        >
          <div class="chat-bubble__identity-row">
            <Show
              when={collapsible()}
              fallback={
                <div class="chat-bubble__head-static" data-ui="chat-bubble-head-static">
                  <span class="chat-bubble__head-content">
                    <ChatBubbleIdentity node={props.node} hideDuration={!!errorReason()} />
                  </span>
                </div>
              }
            >
              <Button
                type="button"
                variant="ghost"
                size="mini"
                tone="neutral"
                class="chat-bubble__head-main"
                data-chrome="text-disclosure"
                data-ui="chat-bubble-head-main"
                aria-expanded={expanded()}
                onClick={toggleExpanded}
              >
                <span class="chat-bubble__disclosure-icon" aria-hidden="true">
                  <Icon name={expanded() ? "chevron-down" : "chevron"} size="compact" />
                </span>
                <span class="chat-bubble__head-content">
                  <ChatBubbleIdentity node={props.node} hideDuration={!!errorReason()} />
                  <Show when={collapsedPreview()}>
                    {(preview) => <span class="chat-bubble__collapsed-preview">{preview()}</span>}
                  </Show>
                </span>
              </Button>
            </Show>
            <Show when={errorReason()}>{(reason) => <CardErrorReasonIndicator reason={reason()} />}</Show>
            <Show when={errorReason()}>
              <CardDurationChip node={props.node} />
            </Show>
            <Show when={ingress()}>
              {(item) => (
                <Badge
                  tone={item().tone}
                  size="sm"
                  data-ui="operator-ingress-state"
                  data-state={item().state}
                  title={item().title}
                >
                  {item().label}
                </Badge>
              )}
            </Show>
          </div>
          <Show when={expanded()}>
            <div class="chat-bubble__body">
              <div class="chat-bubble__body-inner">
                <Show when={userPartPartition().images.length > 0}>
                  <div class="chat-bubble__image-strip" data-ui="message-image-attachment-strip">
                    <For each={userPartPartition().images}>
                      {(part) => <FilePart part={part} presentation="thumbnail" />}
                    </For>
                  </div>
                </Show>
                <Show when={userPartPartition().body.length > 0}>{renderBodyParts()}</Show>
                <Show when={props.node.reviewStream}>
                  <ReviewStreamSection reviewStream={props.node.reviewStream!} />
                </Show>
                <Show when={!isUser()}>
                  <ChatBubbleEmptyTurnState node={props.node} hasVisibleContent={hasVisibleContent()} />
                </Show>
                <Show when={visibleChildIDs().length > 0}>
                  <div class="chat-bubble__children">
                    <For each={visibleChildIDs()}>
                      {(childID) => (
                        <ChatBubbleChild
                          childID={childID}
                          depth={props.depth}
                          parentID={props.node.id}
                          rootTaskSessionID={rootTaskSessionID()}
                          onOperatorSteer={onOperatorSteer}
                        />
                      )}
                    </For>
                  </div>
                </Show>
                <Show when={steerTargetSessionID()}>
                  <OperatorSteerForm controller={steerController} />
                </Show>
              </div>
            </div>
          </Show>
        </div>
        <Show when={hasFinalTurnOutput()}>
          <ConversationTurnControl
            node={props.node}
            copyText={answerText()}
            agentSteerOpen={steerController.open()}
            onAgentSteerToggle={steerTargetSessionID() ? onAgentSteerToggle : undefined}
          />
        </Show>
      </div>
    </article>
  )
}

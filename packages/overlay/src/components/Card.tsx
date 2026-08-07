import { For, Show, createEffect, createMemo, createSignal, onCleanup } from "solid-js"
import type { CardNode } from "../store/card-tree"
import { cardTreeStore } from "../store/card-tree"
import { collectActivityCounts, defaultExpandedForNode, visibleChildIDsForCard } from "../utils/card-tree"
import { cardExpanded, setCardExpanded } from "../store/conversation-ui"
import { rootTaskSessionID, activeTaskID } from "../store/board"
import { cancelAgentSession, sendOperatorSteer } from "../services/task"
import { submitTaskRewind } from "../services/rewind"
import { currentTraceDirectory } from "../services/trace-directory"
import { OperatorSteerBox } from "./OperatorSteerBox"
import { CardHeader } from "./CardHeader"
import { CardParts } from "./CardParts"
import { InlineToolPart } from "./InlineToolPart"
import { ReviewStreamSection } from "./ReviewStreamSection"
import { TracePanel } from "./TracePanel"
import { t } from "../utils/i18n"
import { StoreCardNode } from "./StoreCardNode"
import { createAnimationFrameScheduler } from "../utils/animation-frame"
import { workerSteerTargetSessionID } from "../utils/message"

/**
 * Recursive structured-card primitive for non-bubble conversation items.
 * Conversation.tsx routes top-level `message` / `agent` nodes into
 * <ChatBubble/>; this component retains tool, review, integrity, and nested
 * agent surfaces.
 *
 * Folding state lives in the unified `expandedCards` store. Once the operator
 * expands or collapses a card, runtime status transitions do not rewrite that
 * presentation choice.
 */
export function Card(props: { node: CardNode; depth: number }) {
  let articleRef: HTMLElement | undefined
  const defaultExpanded = () => defaultExpandedForNode(props.node)
  const [stickyInlineSize, setStickyInlineSize] = createSignal<number | undefined>()

  const isStageCard = () => props.node.kind === "agent"

  const expanded = () => cardExpanded(props.node.id, defaultExpanded())

  const headerNode = createMemo(() => props.node)
  const visibleChildIDs = createMemo(() => visibleChildIDsForCard(props.node))
  // Foot stats are collapsed-only. Expanded stage cards render their actual
  // body and children, so a recursive descendant scan here would only add
  // per-delta work on the streaming hot path.
  const footActivity = createMemo(() => {
    if (!isStageCard() || props.node.kind === "tool") return null
    if (expanded()) return null
    if (props.node.status === "running") return null
    const counts = collectActivityCounts(props.node)
    if (counts.messages + counts.tools + counts.agents + counts.skills === 0) return null
    return counts
  })

  const shouldLockInlineSize = () => props.node.kind === "tool" && expanded()

  const collapsible = () => true

  const setExpanded = (value: boolean) => {
    if (!collapsible()) return
    setCardExpanded(props.node.id, value)
  }

  const toggleExpanded = () => {
    setExpanded(!expanded())
  }

  const canCardSurfaceToggle = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null
    if (!target || !articleRef) return false
    if (target.closest(".card") !== articleRef) return false
    if (window.getSelection()?.type === "Range") return false
    const interactive = target.closest<HTMLElement>(
      [
        "button",
        "a",
        "input",
        "textarea",
        "select",
        "summary",
        "[contenteditable='true']",
        "[role='button']",
        "[role='menuitem']",
        "[role='checkbox']",
        "[role='tab']",
        "[role='textbox']",
        "[data-card-click-ignore='true']",
        "[data-card-dblclick-ignore='true']",
      ].join(","),
    )
    return interactive == null
  }

  const traceSessionID = createMemo(() => (props.node.kind === "agent" ? props.node.sessionID : undefined))
  const steerTargetSessionID = createMemo(() => workerSteerTargetSessionID(props.node, rootTaskSessionID()))
  const [traceOpen, setTraceOpen] = createSignal(false)
  const onTraceToggle = () => {
    if (!traceSessionID()) return
    // Auto-expand the card when opening the trace panel — collapsed cards
    // hide their body, which is where the panel renders.
    if (!expanded()) setExpanded(true)
    setTraceOpen((v) => !v)
  }

  /**
   * Rewind handler — submits POST /task/:id/rewind. The visible tree changes
   * only after the backend emits task.rewound, keeping HTTP failure from
   * creating local-only rewind state.
   */
  const onRewind = async (cursorTime: number, anchorID: string, opts: { resetWorktree: boolean }) => {
    const taskID = activeTaskID()
    if (!taskID) return
    await submitTaskRewind({ taskID, cursorTime, anchorID, resetWorktree: opts.resetWorktree })
  }

  const onOperatorSteer = async (sessionID: string, message: string) => {
    const taskID = activeTaskID()
    if (!taskID) throw new Error(t("card.agent_reply_missing_task"))
    return await sendOperatorSteer(taskID, sessionID, message)
  }

  const onAgentCancel = async (sessionID: string) => {
    const taskID = activeTaskID()
    if (!taskID) return
    await cancelAgentSession(taskID, sessionID)
  }

  const toolCancelSessionID = () => {
    const part = toolPart()
    const sessionID = typeof part?.sessionID === "string" ? part.sessionID.trim() : ""
    if (!sessionID || sessionID === rootTaskSessionID()) return undefined
    return sessionID
  }

  // Tool-kind nodes render their body via InlineToolPart(mode="body"),
  // not via CardParts — header already summarises the tool call.
  const isTool = () => props.node.kind === "tool"
  const toolPart = () => props.node.toolPart
  const bodyParts = createMemo(() => {
    return visibleBodyParts(props.node)
  })
  function visibleBodyParts(node: CardNode): any[] {
    return node.parts ?? []
  }

  const articleStyle = createMemo<Record<string, string> | undefined>(() => {
    const style: Record<string, string> = {}
    if (props.node.accent) style["--card-stage"] = props.node.accent
    const stickyWidth = stickyInlineSize()
    if (stickyWidth && shouldLockInlineSize()) {
      style["--card-sticky-inline-size"] = `${stickyWidth}px`
    }
    return Object.keys(style).length > 0 ? style : undefined
  })

  createEffect(() => {
    const article = articleRef
    if (!article || !shouldLockInlineSize()) return

    const updateStickyInlineSize = () => {
      const nextWidth = Math.ceil(article.getBoundingClientRect().width)
      if (!Number.isFinite(nextWidth) || nextWidth <= 0) return
      setStickyInlineSize((current) => (typeof current === "number" && current >= nextWidth ? current : nextWidth))
    }

    const updateStickyInlineSizeOnFrame = createAnimationFrameScheduler(updateStickyInlineSize)
    const observer = new ResizeObserver(updateStickyInlineSizeOnFrame.schedule)

    observer.observe(article)
    updateStickyInlineSize()

    onCleanup(() => {
      observer.disconnect()
      updateStickyInlineSizeOnFrame.cancel()
    })
  })

  return (
    <article
      ref={articleRef}
      class="card"
      data-card-id={props.node.id}
      data-kind={props.node.kind}
      data-role={props.node.role || undefined}
      data-stage={props.node.stage || undefined}
      data-status={props.node.status || "none"}
      data-depth={props.depth}
      style={articleStyle()}
      classList={{ "card--expanded": expanded(), "card--collapsed": !expanded() }}
      onDblClick={(event) => {
        if (!canCardSurfaceToggle(event)) return
        event.stopPropagation()
        toggleExpanded()
      }}
    >
      <CardHeader
        node={headerNode()}
        expanded={expanded()}
        collapsible={collapsible()}
        onToggle={toggleExpanded}
        onRewind={onRewind}
        traceSessionID={traceSessionID()}
        traceOpen={traceOpen()}
        onTrace={traceSessionID() ? onTraceToggle : undefined}
        agentSessionID={steerTargetSessionID() ?? toolCancelSessionID()}
        onAgentCancel={(steerTargetSessionID() ?? toolCancelSessionID()) ? onAgentCancel : undefined}
      />
      <Show when={expanded()}>
        <div class="card__body">
          <Show when={traceOpen() && traceSessionID()}>
            <TracePanel
              sessionID={traceSessionID()!}
              directory={currentTraceDirectory()}
              onClose={() => setTraceOpen(false)}
            />
          </Show>
          {/* Tool card body: delegate to InlineToolPart body mode */}
          <Show when={isTool() && toolPart()}>
            <InlineToolPart part={toolPart()} mode="body" />
          </Show>

          <Show when={props.node.reviewStream}>
            <ReviewStreamSection reviewStream={props.node.reviewStream!} />
          </Show>

          {/* Generic parts */}
          <Show when={!isTool() && bodyParts().length > 0}>
            <CardParts
              parts={bodyParts()}
              collapsedContextMessageIDs={props.node.collapsedContextMessageIDs}
              collapseWorkDetails
              depth={props.depth}
              streaming={props.node.status === "running"}
              turnArtifacts={props.node.turnArtifacts}
              renderNestedCard={(node, depth) => <Card node={node} depth={depth} />}
            />
          </Show>

          {/* Recursive children are store-backed only. */}
          <Show when={visibleChildIDs().length > 0}>
            <div class="card__children">
              <For each={visibleChildIDs()}>
                {(id) => (
                  <StoreCardNode id={id} ownerID={props.node.id}>
                    {(node) => <Card node={node} depth={props.depth + 1} />}
                  </StoreCardNode>
                )}
              </For>
            </div>
          </Show>

          {/* Inline steer box at the END of every targetable agent session
              card. All sessions use the operator-steer route so guidance is
              recorded as a coordination request for the orchestrator. */}
          <Show when={steerTargetSessionID()}>
            <OperatorSteerBox onSend={(message) => onOperatorSteer(steerTargetSessionID()!, message)} />
          </Show>
        </div>
      </Show>
      <Show when={footActivity()}>
        {(counts) => (
          <div
            class="card__foot"
            title={t("card.activity_summary", {
              messages: counts().messages,
              tools: counts().tools,
              agents: counts().agents,
              skills: counts().skills,
            })}
          >
            <Show when={counts().tools > 0}>
              <span class="card__stat" data-kind="tools" title={t("card.activity.tools", { count: counts().tools })}>
                <span class="card__stat-label">{t("card.activity.tools_short")}</span>
                <span class="card__stat-value">{counts().tools}</span>
              </span>
            </Show>
            <Show when={counts().messages > 0}>
              <span
                class="card__stat"
                data-kind="messages"
                title={t("card.activity.messages", { count: counts().messages })}
              >
                <span class="card__stat-label">{t("card.activity.messages_short")}</span>
                <span class="card__stat-value">{counts().messages}</span>
              </span>
            </Show>
            <Show when={counts().agents > 0}>
              <span class="card__stat" data-kind="agents" title={t("card.activity.agents", { count: counts().agents })}>
                <span class="card__stat-label">{t("card.activity.agents_short")}</span>
                <span class="card__stat-value">{counts().agents}</span>
              </span>
            </Show>
            <Show when={counts().skills > 0}>
              <span class="card__stat" data-kind="skills" title={t("card.activity.skills", { count: counts().skills })}>
                <span class="card__stat-label">{t("card.activity.skills_short")}</span>
                <span class="card__stat-value">{counts().skills}</span>
              </span>
            </Show>
          </div>
        )}
      </Show>
    </article>
  )
}

import { Index, Switch, Match, Show, createMemo, type JSX } from "solid-js"
import type { CardNode } from "../store/card-tree"
import { TextPart } from "./TextPart"
import { InteractionCard } from "./InteractionCard"
import { FilePart } from "./FilePart"
import { describeCurrentToolPart, shortRelativePath } from "../utils/tool"
import { selectedTaskDirectory } from "../store/board"
import { toolToCardNode } from "../utils/tool-card-node"
import { t } from "../utils/i18n"
import {
  isCollapsedExecutionMessagePart,
  isCardRenderableMessagePartType,
  executionDisclosureKey,
  partitionMessagePartRenderRuns,
  type MessagePartRenderRun,
} from "../utils/message-part"
import { Icon } from "./ui/Icon"
import { Button } from "./ui/Button"
import { InteractiveArtifactPart } from "./InteractiveArtifactPart"
import { conversationDisclosureExpanded, setConversationDisclosureExpanded } from "../store/conversation-ui"
import { partitionCardMessageRuns } from "../utils/card-message-run"
import { DelegatedContextDisclosure } from "./DelegatedContextDisclosure"
import { ConversationTurnArtifactSummary } from "./ConversationTurnArtifactSummary"

function unsupportedPartFallback(part: any) {
  const type = String(part?.type || "")
  if (isCardRenderableMessagePartType(type)) return null
  throw new Error(`CardParts unsupported part type: ${type || "<missing>"}`)
}

function partErrorSummary(part: any): string {
  const message = String(part?.message || "").trim()
  if (message) return message
  const id = String(part?.id || "").trim()
  return id ? t("chat.part_error_message", { id }) : t("chat.part_error_unknown")
}

function partErrorMeta(part: any): string {
  const originalType = String(part?.originalType || "").trim()
  const originalTool = String(part?.originalTool || "").trim()
  return [originalType ? `type=${originalType}` : "", originalTool ? `tool=${originalTool}` : ""]
    .filter(Boolean)
    .join(" · ")
}

function workPartKind(part: any): "tool" | "patch" {
  if (part?.type === "patch") return "patch"
  return "tool"
}

function patchSummary(parts: any[]): string {
  const count = parts.filter((part) => workPartKind(part) === "patch").length
  return t("transcript.execution_patch", { count: String(count) })
}

/** The card has one session lifecycle, but it can contain persisted history
 * from several message turns. Only the final visible part may own its live
 * activity treatment; applying it to every text part makes historical output
 * look as though it is still streaming. */
function trailingLiveTextPart(parts: any[], streaming?: boolean): any | undefined {
  if (!streaming) return undefined
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index]
    const type = String(part?.type || "")
    if (type === "boundary" || type === "reasoning" || type === "step-start" || type === "step-finish") continue
    return type === "text" && String(part?.text || "").trim() ? part : undefined
  }
  return undefined
}

function RenderableCardPart(props: {
  part: any
  depth: number
  streaming?: boolean
  streamingTextPart?: any
  renderNestedCard: (node: CardNode, depth: number) => JSX.Element
}) {
  const part = () => props.part
  return (
    <Switch fallback={unsupportedPartFallback(part())}>
      <Match when={part()?.type === "text" && (part().text || "").trim()}>
        <TextPart text={part().text || ""} streaming={props.streaming && part() === props.streamingTextPart} />
      </Match>
      <Match when={part()?.type === "part-error"}>
        <div class="msg-tool-error" data-part-error-id={part().id || undefined}>
          <div>{part().title || t("chat.part_error_title")}</div>
          <div>{partErrorSummary(part())}</div>
          <Show when={partErrorMeta(part())}>{(meta) => <div>{meta()}</div>}</Show>
        </div>
      </Match>
      <Match when={part()?.type === "tool"}>{props.renderNestedCard(toolToCardNode(part()), props.depth + 1)}</Match>
      <Match when={part()?.type === "patch" && (part().files || []).length > 0}>
        <div class="msg-patch">
          <Icon name="edit" class="msg-patch__icon" />
          <span class="msg-patch__text">
            {(part().files || []).map((f: string) => shortRelativePath(f, selectedTaskDirectory())).join(", ")}
          </span>
        </div>
      </Match>
      <Match when={part()?.type === "file"}>
        <FilePart part={part()} />
      </Match>
      <Match when={part()?.type === "interactive-artifact"}>
        <InteractiveArtifactPart part={part()} />
      </Match>
      <Match
        when={
          (part()?.type === "interaction-question" || part()?.type === "interaction-permission") && part().interaction
        }
      >
        <InteractionCard interaction={part().interaction} />
      </Match>
    </Switch>
  )
}

/** Render a card's user-facing parts and optionally place each chronological
 * execution run behind its own disclosure without introducing a second tool renderer. */
interface PartCollectionProps {
  parts: any[]
  depth: number
  streaming?: boolean
  streamingTextPart?: any
  collapseWorkDetails?: boolean
  renderNestedCard: (node: CardNode, depth: number) => JSX.Element
  turnArtifacts?: NonNullable<CardNode["turnArtifacts"]>
}

function ExecutionEventRun(props: PartCollectionProps) {
  return (
    <div class="msg-work-details__body">
      <Index each={props.parts}>
        {(part) => (
          <div class="msg-work-details__event" data-event-kind={workPartKind(part())}>
            <div class="msg-work-details__event-content">
              <RenderableCardPart
                part={part()}
                depth={props.depth}
                streaming={props.streaming}
                renderNestedCard={props.renderNestedCard}
              />
            </div>
          </div>
        )}
      </Index>
    </div>
  )
}

function ExecutionDisclosureRun(props: PartCollectionProps) {
  const disclosureKey = createMemo(() => executionDisclosureKey(props.parts))
  const expanded = () => conversationDisclosureExpanded(disclosureKey())
  const currentTool = createMemo(() => describeCurrentToolPart(props.parts, selectedTaskDirectory()))
  const summary = createMemo(() => {
    const tool = currentTool()
    if (!tool) return patchSummary(props.parts)
    return [tool.label, tool.detail].filter(Boolean).join(t("card.meta_separator"))
  })

  return (
    <section
      class="msg-work-details"
      data-expanded={expanded() ? "true" : "false"}
      data-status={currentTool()?.status}
      data-tool={currentTool()?.label}
    >
      <Button
        type="button"
        variant="ghost"
        size="mini"
        tone="neutral"
        data-chrome="text-disclosure"
        data-ui="work-details-toggle"
        aria-expanded={expanded()}
        aria-label={summary()}
        title={summary()}
        onClick={(event) => {
          event.stopPropagation()
          setConversationDisclosureExpanded(disclosureKey(), !expanded())
        }}
      >
        <Show when={currentTool()} fallback={<span class="msg-transcript-disclosure__label">{summary()}</span>}>
          {(tool) => (
            <>
              <span class="msg-work-details__tool-icon" aria-hidden="true">
                <Icon name={tool().icon} size="compact" />
              </span>
              <span class="msg-transcript-disclosure__label msg-work-details__tool-name">{tool().label}</span>
              <Show when={tool().detail}>
                <span class="msg-work-details__tool-detail">{tool().detail}</span>
              </Show>
            </>
          )}
        </Show>
        <span class="msg-transcript-disclosure__marker">
          <Icon name={expanded() ? "chevron-down" : "chevron"} />
        </span>
      </Button>
      <Show when={expanded()}>
        <ExecutionEventRun {...props} />
      </Show>
    </section>
  )
}

function ChronologicalCollapsedParts(props: PartCollectionProps & { runs: MessagePartRenderRun[] }) {
  return (
    <Index each={props.runs}>
      {(run) => (
        <Show
          when={run().kind === "execution"}
          fallback={
            <Index each={run().parts}>
              {(part) => (
                <RenderableCardPart
                  part={part()}
                  depth={props.depth}
                  streaming={props.streaming}
                  renderNestedCard={props.renderNestedCard}
                />
              )}
            </Index>
          }
        >
          <ExecutionDisclosureRun {...props} parts={run().parts} />
        </Show>
      )}
    </Index>
  )
}

function BodyParts(props: PartCollectionProps) {
  return (
    <Index each={props.parts}>
      {(part) => (
        <RenderableCardPart
          part={part()}
          depth={props.depth}
          streaming={props.streaming}
          renderNestedCard={props.renderNestedCard}
        />
      )}
    </Index>
  )
}

function PartCollection(props: PartCollectionProps) {
  const runs = createMemo(() => partitionMessagePartRenderRuns(props.parts, Boolean(props.collapseWorkDetails)))

  return (
    <Show when={Boolean(props.collapseWorkDetails)} fallback={<BodyParts {...props} />}>
      <ChronologicalCollapsedParts {...props} runs={runs()} />
    </Show>
  )
}

function DelegatedContextParts(props: PartCollectionProps & { messageID: string }) {
  return (
    <DelegatedContextDisclosure id={`delegated-context:message:${props.messageID}`}>
      <PartCollection {...props} />
    </DelegatedContextDisclosure>
  )
}

/** Render a card without splitting transcript ownership. Context delegation
 * changes only the default disclosure state of the matching message runs. */
export function CardParts(props: PartCollectionProps & { collapsedContextMessageIDs?: string[] }) {
  const runs = createMemo(() =>
    partitionCardMessageRuns(
      props.parts,
      props.collapsedContextMessageIDs || [],
      (props.turnArtifacts || []).map((summary) => summary.messageID),
    ),
  )
  const streamingTextPart = createMemo(() => trailingLiveTextPart(props.parts, props.streaming))
  return (
    <Index each={runs()}>
      {(run) => (
        <section class="card-message-run" data-message-id={run().messageID || undefined}>
          <Show
            when={run().collapsedContext}
            fallback={<PartCollection {...props} parts={run().parts} streamingTextPart={streamingTextPart()} />}
          >
            <DelegatedContextParts
              {...props}
              parts={run().parts}
              streamingTextPart={streamingTextPart()}
              messageID={run().messageID}
            />
          </Show>
          <Index each={(props.turnArtifacts || []).filter((summary) => summary.messageID === run().messageID)}>
            {(summary) => <ConversationTurnArtifactSummary summary={summary()} />}
          </Index>
        </section>
      )}
    </Index>
  )
}

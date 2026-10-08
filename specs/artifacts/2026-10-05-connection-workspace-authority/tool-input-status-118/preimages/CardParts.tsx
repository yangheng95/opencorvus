import { Index, Switch, Match, Show, createMemo, type JSX } from "solid-js"
import type { CardNode } from "../store/card-tree"
import { TextPart } from "./TextPart"
import { InteractionCard } from "./InteractionCard"
import { FilePart } from "./FilePart"
import { describeToolPart, shortRelativePath, type ToolDisplayModel } from "../utils/tool"
import { boardStore, selectedTaskDirectory } from "../store/board"
import { toolToCardNode } from "../utils/tool-card-node"
import { t } from "../utils/i18n"
import {
  isCardRenderableMessagePartType,
  isNoActionDecisionToolPart,
  executionDisclosureKey,
  partitionMessagePartRenderRuns,
  type MessagePartRenderRun,
} from "../utils/message-part"
import { Icon } from "./ui/Icon"
import { Button } from "./ui/Button"
import { InteractiveArtifactPart } from "./InteractiveArtifactPart"
import { cardExpanded, setCardExpanded } from "../store/conversation-ui"
import { partitionCardMessageRuns } from "../utils/card-message-run"
import { DelegatedContextDisclosure } from "./DelegatedContextDisclosure"
import { ConversationTurnArtifactSummary } from "./ConversationTurnArtifactSummary"
import { isConversationSourcePart, SourceParts } from "./SourceParts"
import { InlineToolPart } from "./InlineToolPart"

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
        <div data-quotation-message={part().messageID} data-quotation-session={part().sessionID}>
          <TextPart text={part().text || ""} streaming={props.streaming && part() === props.streamingTextPart} />
        </div>
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

type CitationRenderRun = { kind: "source"; parts: ReturnType<typeof sourceParts> } | { kind: "part"; parts: any[] }

function sourceParts(parts: any[]) {
  return parts.filter(isConversationSourcePart)
}

function citationRenderRuns(parts: any[]): CitationRenderRun[] {
  const runs: CitationRenderRun[] = []
  for (const part of parts) {
    const kind: CitationRenderRun["kind"] = isConversationSourcePart(part) ? "source" : "part"
    const previous = runs.at(-1)
    if (previous?.kind === kind) previous.parts.push(part)
    else runs.push({ kind, parts: [part] } as CitationRenderRun)
  }
  return runs
}

function CitationAwareBodyParts(props: PartCollectionProps) {
  return (
    <Index each={citationRenderRuns(props.parts)}>
      {(run) => (
        <Show
          when={run().kind === "source"}
          fallback={
            <Index each={run().parts}>
              {(part) => (
                <RenderableCardPart
                  part={part()}
                  depth={props.depth}
                  streaming={props.streaming}
                  streamingTextPart={props.streamingTextPart}
                  renderNestedCard={props.renderNestedCard}
                />
              )}
            </Index>
          }
        >
          <SourceParts sources={sourceParts(run().parts)} />
        </Show>
      )}
    </Index>
  )
}

function toolIdentityDetail(tool: ToolDisplayModel): string {
  return tool.detail.toLowerCase() === tool.label.toLowerCase() ? "" : tool.detail
}

function toolIdentitySummary(tool: ToolDisplayModel): string {
  return [tool.label, toolIdentityDetail(tool)].filter(Boolean).join(t("card.meta_separator"))
}

function ExecutionToolIdentity(props: { tool: ToolDisplayModel }) {
  const detail = () => toolIdentityDetail(props.tool)
  return (
    <>
      <span class="msg-work-details__tool-icon" aria-hidden="true">
        <Icon name={props.tool.icon} size="compact" />
      </span>
      <span class="msg-transcript-disclosure__label msg-work-details__tool-name">{props.tool.label}</span>
      <Show when={detail()}>
        <span class="msg-work-details__tool-detail">{detail()}</span>
      </Show>
    </>
  )
}

function ExecutionEventRun(props: PartCollectionProps) {
  const key = createMemo(() => executionDisclosureKey(props.parts))
  const expanded = () => cardExpanded(key(), false)
  const directory = () =>
    boardStore.selectedSource?.kind === "task" ? selectedTaskDirectory() : boardStore.selectedSource?.directory || ""
  const tools = createMemo(() =>
    props.parts.map((part) => describeToolPart(part, directory())).filter((tool) => tool !== null),
  )
  // Identity follows chronology; an earlier pending call must not rename the
  // latest call. Activity and errors still represent every result in the run.
  const latest = () => tools().at(-1)
  const activeCount = () => tools().filter((tool) => tool.status === "pending" || tool.status === "running").length
  const errorCount = () => tools().filter((tool) => tool.status === "error").length
  const active = () => Boolean(props.streaming && activeCount() > 0)
  const summary = () =>
    latest()
      ? toolIdentitySummary(latest()!)
      : t("transcript.execution_patch", { count: props.parts.length })
  return (
    <section
      class="msg-work-details"
      data-expanded={expanded() ? "true" : "false"}
      data-active={active() ? "true" : undefined}
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
        onClick={() => setCardExpanded(key(), !expanded())}
      >
        <Show when={latest()} fallback={<span class="msg-transcript-disclosure__label">{summary()}</span>}>
          {(tool) => <ExecutionToolIdentity tool={tool()} />}
        </Show>
        <span class="msg-work-details__status">
          <Show when={activeCount()}>
            {active() ? t("tool.group_running", { count: activeCount() }) : t("checks.pending")}
          </Show>
          <Show when={errorCount()}>
            <span data-status="error">{t("tool.group_errors", { count: errorCount() })}</span>
          </Show>
          <Show when={!activeCount() && !errorCount()}>
            <Icon
              name="status-completed"
              class="msg-tool-complete"
              size="compact"
              title={t("task.status.completed")}
              decorative={false}
            />
          </Show>
        </span>
        <span class="msg-transcript-disclosure__marker">
          <Icon name={expanded() ? "chevron-down" : "chevron"} size="compact" />
        </span>
      </Button>
      <Show when={expanded()}>
        <div class="msg-work-details__body">
          <Index each={props.parts}>
            {(part) => {
              const tool = createMemo(() => describeToolPart(part(), directory()))
              return (
                <div class="msg-work-details__event" data-event-kind={workPartKind(part())}>
                  <Show
                    when={tool()}
                    fallback={
                      <RenderableCardPart
                        part={part()}
                        depth={props.depth}
                        streaming={props.streaming}
                        renderNestedCard={props.renderNestedCard}
                      />
                    }
                  >
                    {(display) => (
                      <>
                        <Show when={props.parts.length > 1}>
                          <div
                            class="msg-work-details__event-header"
                            title={toolIdentitySummary(display())}
                          >
                            <ExecutionToolIdentity tool={display()} />
                            <span class="msg-work-details__status">
                              <Show when={display().status === "completed"} fallback={display().statusLabel}>
                                <Icon
                                  name="status-completed"
                                  class="msg-tool-complete"
                                  size="compact"
                                  title={t("task.status.completed")}
                                  decorative={false}
                                />
                              </Show>
                            </span>
                          </div>
                        </Show>
                        <div class="msg-work-details__event-content">
                          <InlineToolPart part={part()} mode="body" />
                        </div>
                      </>
                    )}
                  </Show>
                </div>
              )
            }}
          </Index>
        </div>
      </Show>
    </section>
  )
}

function ChronologicalCollapsedParts(props: PartCollectionProps & { runs: MessagePartRenderRun[] }) {
  return (
    <Index each={props.runs}>
      {(run) => (
        <Show when={run().kind === "execution"} fallback={<CitationAwareBodyParts {...props} parts={run().parts} />}>
          <ExecutionEventRun {...props} parts={run().parts} />
        </Show>
      )}
    </Index>
  )
}

function BodyParts(props: PartCollectionProps) {
  return <CitationAwareBodyParts {...props} />
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
  const displayParts = createMemo(() => props.parts.filter((part) => !isNoActionDecisionToolPart(part)))
  const runs = createMemo(() =>
    partitionCardMessageRuns(
      displayParts(),
      props.collapsedContextMessageIDs || [],
      (props.turnArtifacts || []).map((summary) => summary.messageID),
    ),
  )
  const streamingTextPart = createMemo(() => trailingLiveTextPart(displayParts(), props.streaming))
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

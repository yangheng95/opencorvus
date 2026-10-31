import { Index, Switch, Match, Show, createMemo, type JSX } from "solid-js"
import { Key } from "@solid-primitives/keyed"
import type { CardNode } from "../store/card-tree"
import { TextPart } from "./TextPart"
import { InteractionCard } from "./InteractionCard"
import { PermissionRequestContent } from "./PermissionRequestContent"
import { FilePart, messageAttachmentDisplayLabel, type FilePartPresentation, type MessageFilePart } from "./FilePart"
import { describeToolPart, shortRelativePath, type ToolDisplayModel } from "../utils/tool"
import { boardStore, selectedTaskDirectory } from "../store/board"
import { toolToCardNode } from "../utils/tool-card-node"
import { localeTag, t } from "../utils/i18n"
import { interactionRequestText, interactionResponseText } from "../utils/transcript"
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
import { SourceParts } from "./SourceParts"
import { isConversationSourcePart, type ConversationSourcePart } from "../utils/conversation-source"
import { InlineToolPart } from "./InlineToolPart"
import { AssistantMessageFailure } from "./AssistantMessageFailure"

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

function interactionHistoryText(part: any): string {
  if (part.phase === "request") return interactionRequestText(part.interaction)
  if (part.phase === "response") return interactionResponseText(part.interaction)
  throw new Error(`interaction ${part.interaction.id} has unknown history phase ${String(part.phase)}`)
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
  attachmentLabel: (part: MessageFilePart) => string | undefined
  depth: number
  streaming?: boolean
  streamingTextPart?: any
  filePresentation?: FilePartPresentation
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
        <FilePart part={part()} presentation={props.filePresentation} displayLabel={props.attachmentLabel(part())} />
      </Match>
      <Match when={part()?.type === "interactive-artifact"}>
        <InteractiveArtifactPart part={part()} />
      </Match>
      <Match
        when={
          part()?.type === "interaction-permission" && part().phase !== "pending" && part().interaction
        }
      >
        <Show when={part().phase === "request"} fallback={
          <div class="permission-response">{interactionHistoryText(part())}</div>
        }>
          <PermissionRequestContent interaction={part().interaction} compact />
        </Show>
      </Match>
      <Match
        when={
          part()?.type === "interaction-question" &&
          part().phase !== "pending" &&
          part().interaction
        }
      >
        <TextPart text={interactionHistoryText(part())} />
      </Match>
      <Match
        when={
          (part()?.type === "interaction-question" || part()?.type === "interaction-permission") &&
          part().phase === "pending" && part().interaction?.status === "pending" && part().interaction
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
  contextSources: ConversationSourcePart[]
  attachmentLabel: (part: MessageFilePart) => string | undefined
  depth: number
  streaming?: boolean
  streamingTextPart?: any
  collapseWorkDetails?: boolean
  filePresentation?: FilePartPresentation
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
                  attachmentLabel={props.attachmentLabel}
                  depth={props.depth}
                  streaming={props.streaming}
                  streamingTextPart={props.streamingTextPart}
                  filePresentation={props.filePresentation}
                  renderNestedCard={props.renderNestedCard}
                />
              )}
            </Index>
          }
        >
          <SourceParts sources={sourceParts(run().parts)} contextSources={props.contextSources} />
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

function ExecutionToolIdentity(props: { tool: ToolDisplayModel; commandCodeInStatus?: boolean }) {
  const detail = () => props.commandCodeInStatus && props.tool.command !== undefined
    ? props.tool.command
    : toolIdentityDetail(props.tool)
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
  const pendingCount = () => tools().filter((tool) => tool.status === "pending").length
  const runningCount = () => tools().filter((tool) => tool.status === "running").length
  const activeCount = () => pendingCount() + runningCount()
  const errorCount = () => tools().filter((tool) => tool.status === "error" && !tool.cancelled).length
  const cancelledCount = () => tools().filter((tool) => tool.cancelled).length
  const nonzeroExitCount = () => tools().filter((tool) => tool.commandExitCode !== undefined && tool.commandExitCode !== 0).length
  const number = (count: number) => count.toLocaleString(localeTag())
  const active = () => Boolean(props.streaming && activeCount() > 0)
  const summary = () => [
    latest()
      ? toolIdentitySummary(latest()!)
      : t("transcript.execution_patch", { count: props.parts.length }),
    pendingCount() ? t("tool.group_receiving_input", { count: number(pendingCount()) }) : "",
    runningCount() ? t("tool.group_running", { count: number(runningCount()) }) : "",
    errorCount() ? t("tool.group_errors", { count: number(errorCount()) }) : "",
    cancelledCount() ? t("tool.group_cancelled", { count: number(cancelledCount()) }) : "",
    nonzeroExitCount() ? t("tool.group_nonzero_exit", { count: number(nonzeroExitCount()) }) : "",
  ].filter(Boolean).join(t("card.meta_separator"))
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
          <Show when={pendingCount()}>
            <span>{t("tool.group_receiving_input", { count: number(pendingCount()) })}</span>
          </Show>
          <Show when={runningCount()}>
            <span>{t("tool.group_running", { count: number(runningCount()) })}</span>
          </Show>
          <Show when={errorCount()}>
            <span data-status="error">{t("tool.group_errors", { count: number(errorCount()) })}</span>
          </Show>
          <Show when={cancelledCount()}>
            <span>{t("tool.group_cancelled", { count: number(cancelledCount()) })}</span>
          </Show>
          <Show when={nonzeroExitCount()}>
            <span data-command-exit="nonzero">{t("tool.group_nonzero_exit", { count: number(nonzeroExitCount()) })}</span>
          </Show>
          <Show when={!activeCount() && !errorCount() && !cancelledCount() && !nonzeroExitCount()}>
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
                        attachmentLabel={props.attachmentLabel}
                        depth={props.depth}
                        streaming={props.streaming}
                        filePresentation={props.filePresentation}
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
                            <ExecutionToolIdentity tool={display()} commandCodeInStatus />
                            <span
                              class="msg-work-details__status"
                              data-command-exit={display().commandExitCode !== undefined && display().commandExitCode !== 0 ? "nonzero" : undefined}
                            >
                              <Show when={display().status === "completed" && display().commandExitCode === undefined} fallback={display().statusLabel}>
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
export function CardParts(props: Omit<PartCollectionProps, "contextSources" | "attachmentLabel"> & {
  attachmentParts?: CardNode["parts"]
  collapsedContextMessageIDs?: string[]
  messageFailures?: CardNode["messageFailures"]
}) {
  const displayParts = createMemo(() => props.parts.filter((part) => !isNoActionDecisionToolPart(part)))
  const contextSources = createMemo(() => sourceParts(displayParts()))
  const attachmentLabel = (part: MessageFilePart) => messageAttachmentDisplayLabel(part, props.attachmentParts ?? props.parts)
  const runs = createMemo(() =>
    partitionCardMessageRuns(
      displayParts(),
      props.collapsedContextMessageIDs || [],
      [...(props.turnArtifacts || []), ...(props.messageFailures || [])].map((item) => item.messageID),
    ),
  )
  const streamingTextPart = createMemo(() => trailingLiveTextPart(displayParts(), props.streaming))
  return (
    <Index each={runs()}>
      {(run) => (
        <section class="card-message-run" data-message-id={run().messageID || undefined}>
          <Show
            when={run().collapsedContext}
            fallback={<PartCollection {...props} contextSources={contextSources()} attachmentLabel={attachmentLabel} parts={run().parts} streamingTextPart={streamingTextPart()} />}
          >
            <DelegatedContextParts
              {...props}
              contextSources={contextSources()}
              attachmentLabel={attachmentLabel}
              parts={run().parts}
              streamingTextPart={streamingTextPart()}
              messageID={run().messageID}
            />
          </Show>
          <Key each={(props.messageFailures || []).filter((failure) => failure.messageID === run().messageID)} by="messageID">
            {(failure) => <AssistantMessageFailure {...failure()} />}
          </Key>
          <Index each={(props.turnArtifacts || []).filter((summary) => summary.messageID === run().messageID)}>
            {(summary) => <ConversationTurnArtifactSummary summary={summary()} />}
          </Index>
        </section>
      )}
    </Index>
  )
}

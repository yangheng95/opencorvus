import { For, Show, createEffect, createMemo, createSignal, on, onCleanup, onMount } from "solid-js"
import { apiJson, captureApiAuthority, getServerUrl, isApiAuthorityCurrent } from "../services/api"
import { fileEditorReserved } from "../services/file-workbench"
import {
  createSideChat,
  listSideChats,
  connectSideChat,
  sideChatPath,
  type SideChatSession,
  type SideChatSource,
} from "../services/side-chat"
import {
  composerDraftKey,
  composerDraftText,
  composerQuotation,
  setComposerDraft,
  setComposerQuotation,
  clearComposerDraft,
  composerSubmission,
} from "../services/composer-draft"
import { quotedPrompt, type Quotation } from "../services/quotation"
import type { SubagentConversationTranscript, SubagentTranscriptMessage } from "../services/subagent-conversation"
import { formatErrorDetails } from "../services/diagnostics"
import { setupAutoScroll, type AutoScrollController } from "../utils/dom-utils"
import { assistantMessageErrorReason, conversationMessageHasDisplayContent, isCardBodyMessagePart } from "../utils/message-part"
import { t } from "../utils/i18n"
import { ConversationCard } from "./ConversationCard"
import { QuotationSelection } from "./QuotationSelection"
import { QuotationChip } from "./QuotationChip"
import { AutoGrowTextarea } from "./ui/AutoGrowTextarea"
import { Button } from "./ui/Button"
import { Icon } from "./ui/Icon"
import { Feedback } from "./ui/Feedback"
import { Disclosure } from "./ui/Disclosure"
import { SelectControl } from "./ui/SelectControl"
import { InteractionCard, type InteractionData } from "./InteractionCard"

export interface SideChatRequest {
  source: SideChatSource
  intent: "open" | "fork"
  quotation?: Quotation
  prompt?: string
}

function SideMessage(props: { message: SubagentTranscriptMessage }) {
  const node = createMemo(() => {
    const message = props.message
    const user = message.info.role === "user"
    const time = message.info.time as { completed?: number } | undefined
    const errorReason = assistantMessageErrorReason(message.info)
    return {
      id: `side-message:${message.messageID}`,
      kind: "agent" as const,
      sessionID: message.sessionID,
      messageID: message.messageID,
      agentID: user ? "user" : message.agentID,
      role: user ? "user" : message.stage,
      stage: user ? "user" : message.stage,
      title: message.agentID,
      parts: message.parts.filter(isCardBodyMessagePart),
      childIDs: [],
      status: errorReason
        ? ("error" as const)
        : user || time?.completed
          ? ("completed" as const)
          : ("running" as const),
      errorReason,
      orderKey: message.orderKey,
      time: message.time,
    }
  })
  return <ConversationCard node={node()} depth={0} collapsible={false} />
}

export function SideChatPanel(props: {
  source: SideChatSource | undefined
  request: SideChatRequest | undefined
  consumeRequest: (request: SideChatRequest) => void
  onQuoteInMain: (quotation: Quotation) => void
}) {
  const [sessions, setSessions] = createSignal<SideChatSession[]>([])
  const [selected, setSelected] = createSignal("")
  const [transcript, setTranscript] = createSignal<SubagentConversationTranscript>()
  const [connected, setConnected] = createSignal(false)
  const [creating, setCreating] = createSignal(false)
  const [sessionListState, setSessionListState] = createSignal<"idle" | "loading" | "ready" | "error">("idle")
  const [sending, setSending] = createSignal(false)
  const [active, setActive] = createSignal(false)
  const [interactions, setInteractions] = createSignal<InteractionData[]>([])
  const [stopping, setStopping] = createSignal(false)
  const [error, setError] = createSignal("")
  const [tracking, setTracking] = createSignal(true)
  let generation = 0
  let attemptedRequest: SideChatRequest | undefined
  let scroll!: HTMLDivElement
  let textarea: HTMLTextAreaElement | undefined
  let follow: AutoScrollController | undefined
  const sourceKey = () => `${captureApiAuthority().revision}\0${JSON.stringify(props.source)}`
  const session = createMemo(() => sessions().find((item) => item.id === selected()))
  const key = () => composerDraftKey("side-chat", getServerUrl(), props.source?.directory ?? "", selected())
  const inherited = createMemo(() => new Set(session()?.metadata.sideChat.inheritedMessageIDs ?? []))
  const displayedMessages = createMemo(() => transcript()?.messages.filter(conversationMessageHasDisplayContent) ?? [])
  const history = createMemo(() => displayedMessages().filter((item) => inherited().has(item.messageID)))
  const messages = createMemo(() => displayedMessages().filter((item) => !inherited().has(item.messageID)))
  const messageIDs = createMemo(() => messages().map((message) => message.messageID))
  const messageByID = createMemo(() => new Map(messages().map((message) => [message.messageID, message])))
  const sessionLabel = (item: SideChatSession) =>
    t("side_chat.numbered", { number: sessions().length - sessions().findIndex((entry) => entry.id === item.id) })
  const running = createMemo(() => sending() || active())
  const preparing = () => creating() || sessionListState() === "loading"
  const report = (error: unknown) => setError(formatErrorDetails(error))
  onMount(() => {
    follow = setupAutoScroll(scroll, {
      isTracking: tracking,
      onUserScrollUp: () => setTracking(false),
      onAtBottom: () => setTracking(true),
    })
  })
  onCleanup(() => {
    generation++
    follow?.cleanup()
  })
  async function loadSessions() {
    const current = ++generation
    const authority = captureApiAuthority()
    const source = props.source
    setSessionListState(source ? "loading" : "idle")
    setSessions([])
    setSelected("")
    setTranscript(undefined)
    setError("")
    setCreating(false)
    if (!source) return
    try {
      const items = await listSideChats({ ...source, authority })
      if (current !== generation || !isApiAuthorityCurrent(authority)) return
      setSessions((current) => [
        ...current,
        ...items.filter((item) => !current.some((saved) => saved.id === item.id)),
      ])
      setSelected((current) => current || items[0]?.id || "")
      setSessionListState("ready")
    } catch (error) {
      if (current === generation && isApiAuthorityCurrent(authority)) {
        setSessionListState("error")
        report(error)
      }
    }
  }
  createEffect(on(sourceKey, () => void loadSessions()))
  async function create(request?: SideChatRequest) {
    if (fileEditorReserved()) return
    const source = request?.source ?? props.source
    if (!source || creating() || sessionListState() !== "ready") return
    const current = generation
    const authority = captureApiAuthority()
    if (source.authority && !isApiAuthorityCurrent(source.authority)) return
    const owns = () => current === generation && isApiAuthorityCurrent(authority)
    setCreating(true)
    setError("")
    try {
      const created = await createSideChat({ ...source, authority })
      if (!owns()) return
      setSessions((items) => [created, ...items.filter((item) => item.id !== created.id)])
      setSelected(created.id)
      if (request?.quotation) setComposerQuotation(key(), request.quotation)
      if (request?.prompt) setComposerDraft(key(), request.prompt)
      if (request) props.consumeRequest(request)
      queueMicrotask(() => {
        if (owns()) textarea?.focus()
      })
    } catch (error) {
      if (owns()) report(error)
    } finally {
      if (owns()) setCreating(false)
    }
  }
  createEffect(() => {
    const request = props.request
    if (
      !request ||
      fileEditorReserved() ||
      creating() ||
      sessionListState() !== "ready" ||
      request === attemptedRequest ||
      !props.source ||
      props.source.sessionID !== request.source.sessionID ||
      props.source.directory !== request.source.directory
    )
      return
    attemptedRequest = request
    if (request.intent === "open" && session()) {
      const current = generation
      props.consumeRequest(request)
      queueMicrotask(() => {
        if (current === generation && !fileEditorReserved()) textarea?.focus()
      })
      return
    }
    void create(request)
  })
  createEffect(
    on(
      () => `${sourceKey()}\0${selected()}`,
      () => {
        setTranscript(undefined)
        setConnected(false)
        setSending(false)
        setActive(false)
        setInteractions([])
        setStopping(false)
        setTracking(true)
        const source = props.source
        if (!source || !selected()) return
        const authority = captureApiAuthority()
        const current = generation
        const sessionID = selected()
        const owns = () => current === generation && selected() === sessionID && isApiAuthorityCurrent(authority)
        const dispose = connectSideChat(
          { ...source, sessionID, authority },
          {
            transcript: (value) => {
              if (owns()) setTranscript(value)
            },
            connection: (value) => {
              if (owns()) setConnected(value)
            },
            activity: (value) => {
              if (owns()) setActive(value)
            },
            interactions: (value) => {
              if (owns()) setInteractions(value)
            },
            error: (error) => {
              if (owns()) report(error)
            },
          },
        )
        onCleanup(dispose)
      },
    ),
  )
  createEffect(() => {
    transcript()
    interactions()
    follow?.contentChanged()
  })
  function quote(quotation: Quotation) {
    if (fileEditorReserved()) return
    const current = generation
    const authority = captureApiAuthority()
    setComposerQuotation(key(), quotation)
    queueMicrotask(() => {
      if (current === generation && isApiAuthorityCurrent(authority)) textarea?.focus()
    })
  }
  async function send() {
    if (fileEditorReserved()) return
    const source = props.source
    const text = composerDraftText(key()).trim()
    if (!source || !selected() || !text || running() || !connected()) return
    const target = { ...source, sessionID: selected() }
    const authority = captureApiAuthority()
    const current = generation
    const owns = () => current === generation && selected() === target.sessionID && isApiAuthorityCurrent(authority)
    const draftKey = key()
    const quoted = composerQuotation(draftKey)
    const submission = composerSubmission(draftKey, quotedPrompt(text, quoted))
    setSending(true)
    setError("")
    try {
      await apiJson(sideChatPath(target, "/message"), {
        authority,
        method: "POST",
        timeoutMilliseconds: null,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageID: submission.messageID,
          agent: "chat",
          parts: [{ type: "text", text: submission.text }],
        }),
      })
      if (owns() && quotedPrompt(composerDraftText(draftKey).trim(), composerQuotation(draftKey)) === submission.text)
        clearComposerDraft(draftKey)
    } catch (error) {
      if (owns()) report(error)
    } finally {
      if (owns()) setSending(false)
    }
  }
  async function stop() {
    if (!props.source || !selected()) return
    const authority = captureApiAuthority()
    const current = generation
    const sessionID = selected()
    const owns = () => current === generation && selected() === sessionID && isApiAuthorityCurrent(authority)
    setStopping(true)
    try {
      await apiJson(sideChatPath({ ...props.source, sessionID }, "/abort"), {
        authority,
        method: "POST",
        timeoutMilliseconds: null,
      })
    } catch (error) {
      if (owns()) report(error)
    } finally {
      if (owns()) setStopping(false)
    }
  }
  return (
    <section class="side-chat-panel" aria-label={t("side_chat.title")}>
      <div class="side-chat-panel__header">
        <SelectControl<SideChatSession>
          options={sessions()}
          value={session()}
          onChange={(item) => {
            if (!fileEditorReserved() && item) setSelected(item.id)
          }}
          disabled={fileEditorReserved()}
          optionValue="id"
          optionTextValue={sessionLabel}
          ariaLabel={t("side_chat.choose")}
          renderValue={(item) => (
            <span class="side-chat-panel__selection">
              <Icon name="side-chat" />
              {item ? sessionLabel(item) : t("side_chat.title")}
            </span>
          )}
          renderOptionLabel={sessionLabel}
        />
        <Button
          variant="ghost"
          size="icon"
          tone="neutral"
          disabled={fileEditorReserved() || creating() || sessionListState() !== "ready" || !props.source}
          onClick={() => void create()}
          title={t("side_chat.new")}
          aria-label={t("side_chat.new")}
        >
          <Icon name="plus" />
        </Button>
      </div>
      <p class="side-chat-panel__hint">{t("side_chat.description")}</p>
      <Show when={error()}>
        <Feedback
          tone="error"
          details={error()}
          actions={
            <>
              <Show when={(sessionListState() === "error" || props.request) && !preparing()}>
                <Button
                  variant="outline"
                  size="sm"
                  tone="neutral"
                  disabled={fileEditorReserved() || sessionListState() === "loading"}
                  onClick={() => {
                    if (sessionListState() === "error") void loadSessions()
                    else void create(props.request)
                  }}
                >
                  {t("side_chat.retry")}
                </Button>
              </Show>
              <Show when={sessionListState() !== "error"}>
                <Button variant="ghost" size="sm" tone="neutral" onClick={() => setError("")}>
                  {t("common.dismiss")}
                </Button>
              </Show>
            </>
          }
        >
          {t("side_chat.failed")}
        </Feedback>
      </Show>
      <div class="side-chat-panel__scroll" ref={scroll}>
        <QuotationSelection onQuote={quote}>
          <Show when={history().length}>
            <Disclosure.Root class="side-chat-history">
              <Disclosure.Trigger>{t("side_chat.history", { count: String(history().length) })}</Disclosure.Trigger>
              <Disclosure.Content>
                <For each={history()}>{(message) => <SideMessage message={message} />}</For>
              </Disclosure.Content>
            </Disclosure.Root>
          </Show>
          <For each={messageIDs()}>
            {(id) => {
              const message = () => messageByID().get(id)!
              return (
                <div class="side-chat-turn">
                  <SideMessage message={message()} />
                  <Show
                    when={
                      message().info.role === "assistant" &&
                      message().parts.some((part) => part.type === "text" && part.text)
                    }
                  >
                    <Button
                      class="side-chat-turn__quote"
                      variant="ghost"
                      size="mini"
                      tone="neutral"
                      disabled={fileEditorReserved()}
                      onClick={() =>
                        !fileEditorReserved() &&
                        props.onQuoteInMain({
                          sessionID: message().sessionID,
                          messageID: id,
                          text: message()
                            .parts.filter((part) => part.type === "text")
                            .map((part) => part.text)
                            .join("\n\n"),
                        })
                      }
                    >
                      <Icon name="quotation" size="compact" />
                      {t("side_chat.quote_main")}
                    </Button>
                  </Show>
                </div>
              )
            }}
          </For>
          <For each={interactions()}>
            {(interaction) => <InteractionCard interaction={interaction} afterReply={() => follow?.contentChanged()} />}
          </For>
        </QuotationSelection>
        <Show when={!messages().length}>
          <div class="side-chat-panel__empty">
            <span class="side-chat-panel__empty-icon">
              <Icon name={preparing() ? "loading" : "side-chat"} size="medium" />
            </span>
            <strong>{preparing() ? t("side_chat.creating") : t("side_chat.empty")}</strong>
            <span>{t("side_chat.empty_hint")}</span>
            <Show when={selected() && !creating()}>
              <div class="side-chat-suggestions">
                <For each={["side_chat.suggest_explain", "side_chat.suggest_tradeoffs", "side_chat.suggest_verify"]}>
                  {(label) => (
                    <Button
                      variant="outline"
                      size="sm"
                      tone="neutral"
                      disabled={fileEditorReserved()}
                      onClick={() => {
                        if (fileEditorReserved()) return
                        setComposerDraft(key(), t(label))
                        textarea?.focus()
                      }}
                    >
                      {t(label)}
                      <Icon name="arrow-up-right" size="compact" />
                    </Button>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Show>
      </div>
      <Show when={selected()}>
        <form
          class="side-chat-composer"
          onSubmit={(event) => {
            event.preventDefault()
            void send()
          }}
        >
          <Show when={composerQuotation(key())}>
            {(value) => (
              <QuotationChip
                quotation={value()}
                onRemove={() => {
                  if (!fileEditorReserved()) setComposerQuotation(key(), undefined)
                }}
              />
            )}
          </Show>
          <AutoGrowTextarea
            ref={(element) => (textarea = element)}
            value={composerDraftText(key())}
            surface="composer"
            disabled={sending() || fileEditorReserved()}
            aria-label={t("side_chat.placeholder")}
            placeholder={t("side_chat.placeholder")}
            onInput={(event) => {
              if (!fileEditorReserved()) setComposerDraft(key(), event.currentTarget.value)
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
                event.preventDefault()
                void send()
              }
            }}
          />
          <div class="side-chat-composer__actions">
            <span role="status" class="side-chat-status" data-connected={connected()} data-running={running()}>
              <span class="side-chat-status__dot" />
              {running() ? t("side_chat.running") : connected() ? t("side_chat.private") : t("side_chat.connecting")}
            </span>
            <Show
              when={running()}
              fallback={
                <Button
                  type="submit"
                  variant="solid"
                  tone="neutral"
                  size="icon"
                  disabled={fileEditorReserved() || !connected() || !composerDraftText(key()).trim()}
                  aria-label={t("side_chat.send")}
                >
                  <Icon name="arrow-up" />
                </Button>
              }
            >
              <Button
                type="button"
                variant="outline"
                tone="neutral"
                size="icon"
                disabled={stopping()}
                aria-label={t("side_chat.stop")}
                onClick={() => void stop()}
              >
                <Icon name="stop" />
              </Button>
            </Show>
          </div>
        </form>
      </Show>
    </section>
  )
}

import { For, Show, createEffect, createMemo, createSignal, on, onCleanup, onMount } from "solid-js"
import { apiJson, getServerUrl } from "../services/api"
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
  quotation?: Quotation
  prompt?: string
}

function SideMessage(props: { message: SubagentTranscriptMessage }) {
  const node = createMemo(() => {
    const message = props.message
    const user = message.info.role === "user"
    const time = message.info.time as { completed?: number } | undefined
    return {
      id: `side-message:${message.messageID}`,
      kind: "agent" as const,
      sessionID: message.sessionID,
      messageID: message.messageID,
      agentID: user ? "user" : message.agentID,
      role: user ? "user" : message.stage,
      stage: user ? "user" : message.stage,
      title: message.agentID,
      parts: message.parts,
      childIDs: [],
      status: user || time?.completed ? ("completed" as const) : ("running" as const),
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
  const sourceKey = () => JSON.stringify(props.source)
  const session = createMemo(() => sessions().find((item) => item.id === selected()))
  const key = () => composerDraftKey("side-chat", getServerUrl(), props.source?.directory ?? "", selected())
  const inherited = createMemo(() => new Set(session()?.metadata.sideChat.inheritedMessageIDs ?? []))
  const history = createMemo(() => transcript()?.messages.filter((item) => inherited().has(item.messageID)) ?? [])
  const messages = createMemo(() => transcript()?.messages.filter((item) => !inherited().has(item.messageID)) ?? [])
  const messageIDs = createMemo(() => messages().map((message) => message.messageID))
  const messageByID = createMemo(() => new Map(messages().map((message) => [message.messageID, message])))
  const sessionLabel = (item: SideChatSession) =>
    t("side_chat.numbered", { number: sessions().length - sessions().findIndex((entry) => entry.id === item.id) })
  const running = createMemo(() => sending() || active())
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
  createEffect(
    on(sourceKey, async () => {
      const current = ++generation
      const source = props.source
      setSessions([])
      setSelected("")
      setTranscript(undefined)
      setError("")
      if (!source) return
      try {
        const items = await listSideChats(source)
        if (current !== generation) return
        setSessions((current) => [
          ...current,
          ...items.filter((item) => !current.some((saved) => saved.id === item.id)),
        ])
        setSelected((current) => current || items[0]?.id || "")
      } catch (error) {
        if (current === generation) report(error)
      }
    }),
  )
  async function create(request?: SideChatRequest) {
    const source = request?.source ?? props.source
    if (!source || creating()) return
    const current = generation
    setCreating(true)
    setError("")
    try {
      const created = await createSideChat(source)
      if (current !== generation) return
      setSessions((items) => [created, ...items.filter((item) => item.id !== created.id)])
      setSelected(created.id)
      if (request?.quotation) setComposerQuotation(key(), request.quotation)
      if (request?.prompt) setComposerDraft(key(), request.prompt)
      if (request) props.consumeRequest(request)
      queueMicrotask(() => textarea?.focus())
    } catch (error) {
      if (current === generation) report(error)
    } finally {
      setCreating(false)
    }
  }
  createEffect(() => {
    const request = props.request
    if (
      !request ||
      creating() ||
      request === attemptedRequest ||
      !props.source ||
      sourceKey() !== JSON.stringify(request.source)
    )
      return
    attemptedRequest = request
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
        const dispose = connectSideChat(
          { ...source, sessionID: selected() },
          {
            transcript: setTranscript,
            connection: setConnected,
            activity: setActive,
            interactions: setInteractions,
            error: report,
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
    setComposerQuotation(key(), quotation)
    queueMicrotask(() => textarea?.focus())
  }
  async function send() {
    const source = props.source
    const text = composerDraftText(key()).trim()
    if (!source || !selected() || !text || running() || !connected()) return
    const target = { ...source, sessionID: selected() }
    const draftKey = key()
    const quoted = composerQuotation(draftKey)
    const submission = composerSubmission(draftKey, quotedPrompt(text, quoted))
    setSending(true)
    setError("")
    try {
      await apiJson(sideChatPath(target, "/message"), {
        method: "POST",
        timeoutMilliseconds: null,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageID: submission.messageID,
          agent: "chat",
          parts: [{ type: "text", text: submission.text }],
        }),
      })
      if (quotedPrompt(composerDraftText(draftKey).trim(), composerQuotation(draftKey)) === submission.text)
        clearComposerDraft(draftKey)
    } catch (error) {
      if (selected() === target.sessionID) report(error)
    } finally {
      if (selected() === target.sessionID) setSending(false)
    }
  }
  async function stop() {
    if (!props.source || !selected()) return
    setStopping(true)
    try {
      await apiJson(sideChatPath({ ...props.source, sessionID: selected() }, "/abort"), {
        method: "POST",
        timeoutMilliseconds: null,
      })
    } catch (error) {
      report(error)
    } finally {
      setStopping(false)
    }
  }
  return (
    <section class="side-chat-panel" aria-label={t("side_chat.title")}>
      <div class="side-chat-panel__header">
        <SelectControl<SideChatSession>
          options={sessions()}
          value={session()}
          onChange={(item) => item && setSelected(item.id)}
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
          disabled={creating() || !props.source}
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
              <Show when={props.request && !creating()}>
                <Button variant="outline" size="sm" tone="neutral" onClick={() => void create(props.request)}>
                  {t("side_chat.retry")}
                </Button>
              </Show>
              <Button variant="ghost" size="sm" tone="neutral" onClick={() => setError("")}>
                {t("common.dismiss")}
              </Button>
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
                      onClick={() =>
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
              <Icon name={creating() ? "loading" : "side-chat"} size="medium" />
            </span>
            <strong>{creating() ? t("side_chat.creating") : t("side_chat.empty")}</strong>
            <span>{t("side_chat.empty_hint")}</span>
            <Show when={selected() && !creating()}>
              <div class="side-chat-suggestions">
                <For each={["side_chat.suggest_explain", "side_chat.suggest_tradeoffs", "side_chat.suggest_verify"]}>
                  {(label) => (
                    <Button
                      variant="outline"
                      size="sm"
                      tone="neutral"
                      onClick={() => {
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
            {(value) => <QuotationChip quotation={value()} onRemove={() => setComposerQuotation(key(), undefined)} />}
          </Show>
          <AutoGrowTextarea
            ref={(element) => (textarea = element)}
            value={composerDraftText(key())}
            surface="composer"
            disabled={sending()}
            aria-label={t("side_chat.placeholder")}
            placeholder={t("side_chat.placeholder")}
            onInput={(event) => setComposerDraft(key(), event.currentTarget.value)}
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
                  disabled={!connected() || !composerDraftText(key()).trim()}
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

import { createEffect, createMemo, createSignal, on, onCleanup, Show } from "solid-js"
import { Dialog } from "./ui/Dialog"
import { ComboboxControl } from "./ui/ComboboxControl"
import { Button } from "./ui/Button"
import { Feedback } from "./ui/Feedback"
import { SourceSearchContext, sourceLabel } from "./SourceParts"
import { apiJson, captureApiAuthority, isApiAuthorityCurrent } from "../services/api"
import { directoryScopedPath, taskScopedPath } from "../services/task-path"
import { readConversationSnapshot, readTaskConversationSnapshot, type ConversationSearchSnapshot } from "../services/conversation-snapshot"
import { findConversationMessages, type ConversationSearchHit } from "../services/conversation-search"
import { loadOlderConversationHistory, ownsConversationHistory } from "../services/conversation"
import { renderedConversationCardTargetForMessage } from "../services/tree-writer"
import { requestConversationCardScroll } from "../services/conversation-scroll"
import { boardStore } from "../store/board"
import { conversationAgentRecordsForSource } from "../store/conversation-agents"
import { isSubagentActivityRecord, subagentProgressCardID } from "../utils/subagent-presentation"
import { setCardExpanded, setConversationDisclosureExpanded } from "../store/conversation-ui"
import { parentIDChainForCard } from "../utils/card-tree"
import { getLocale, t } from "../utils/i18n"
import { formatErrorDetails, reportError } from "../services/diagnostics"
import { conversationSourceExcerptKey, isConversationSourcePart } from "../utils/conversation-source"

export function ConversationSearchDialog(props: {
  open: boolean
  target: () => { kind: "session" | "task"; id: string; directory: string } | null
  onClose: () => void
  returnFocusTarget: () => HTMLElement | null
}) {
  const [snapshot, setSnapshot] = createSignal<ConversationSearchSnapshot>()
  const [query, setQuery] = createSignal("")
  const [loading, setLoading] = createSignal(false)
  const [locating, setLocating] = createSignal("")
  const [error, setError] = createSignal("")
  let input: HTMLInputElement | undefined
  let controller: AbortController | undefined
  let ownsSnapshot: (() => boolean) | undefined
  const hits = createMemo(() => snapshot() ? findConversationMessages(snapshot()!, query()) : [])
  const date = createMemo(() => new Intl.DateTimeFormat(getLocale(), { dateStyle: "medium", timeStyle: "short" }))
  const hitSource = (hit: ConversationSearchHit) => {
    if (!hit.sourceId) return undefined
    const part = snapshot()?.messages.find(message => message.id === hit.id)?.parts.find(part =>
      isConversationSourcePart(part) && part.sourceId === hit.sourceId)
    return isConversationSourcePart(part) ? part : undefined
  }
  const hitLabel = (hit: ConversationSearchHit) => {
    const source = hitSource(hit)
    return source ? `${sourceLabel(source)} · ${hit.preview}` : hit.preview
  }

  async function load(): Promise<void> {
    const target = props.target()
    if (!props.open || !target) return
    controller?.abort()
    const request = new AbortController()
    controller = request
    const authority = captureApiAuthority(), epoch = boardStore.selectEpoch
    const owns = () => props.open && controller === request && !request.signal.aborted &&
      isApiAuthorityCurrent(authority) && boardStore.selectEpoch === epoch &&
      props.target()?.kind === target.kind && props.target()?.id === target.id && props.target()?.directory === target.directory
    ownsSnapshot = owns
    setSnapshot(undefined)
    setLoading(true)
    setError("")
    try {
      const path = target.kind === "task"
        ? taskScopedPath(target.id, target.directory, "/transcript")
        : directoryScopedPath(`export/session/${encodeURIComponent(target.id)}`, target.directory, "conversationSearch")
      const exported = await apiJson<unknown>(path, { authority, signal: request.signal })
      if (owns()) setSnapshot(target.kind === "task"
        ? readTaskConversationSnapshot(exported)
        : readConversationSnapshot(exported, target.id))
    } catch (cause) {
      if (owns()) {
        setError(t("chat.search_failed"))
        reportError({ title: t("chat.search_failed"), details: formatErrorDetails(cause) })
      }
    } finally {
      if (controller === request) setLoading(false)
    }
  }

  createEffect(on(() => props.open, (open) => {
    if (open) void load()
    else {
      controller?.abort()
      controller = undefined
      setSnapshot(undefined)
      setQuery("")
      setError("")
      setLocating("")
    }
  }))
  onCleanup(() => controller?.abort())

  async function locate(hit: ConversationSearchHit | null): Promise<void> {
    if (!hit || locating() || !ownsSnapshot?.()) return
    const owns = ownsSnapshot, authority = captureApiAuthority(), source = boardStore.selectedSource
    const snapshotTarget = props.target()
    if (!source || source.kind !== snapshotTarget?.kind || source.id !== snapshotTarget.id) return
    setLocating(hit.id)
    setError("")
    try {
      if (!ownsConversationHistory(source, authority)) throw new Error("Conversation history owner changed")
      const message = snapshot()?.messages.find(message => message.id === hit.id)
      if (!message) throw new Error("Original message snapshot owner changed")
      const resolveTarget = () => {
        const participant = conversationAgentRecordsForSource(source).find(record =>
          record.sessionID === message.info.sessionID && isSubagentActivityRecord(record))
        return participant
          ? { renderedCardID: subagentProgressCardID(participant.sessionID), sessionID: participant.sessionID }
          : renderedConversationCardTargetForMessage(hit.id)
      }
      let target = resolveTarget()
      while (!target) {
        const loaded = await loadOlderConversationHistory(source, authority)
        if (!owns()) return
        if (!loaded) break
        target = resolveTarget()
      }
      if (!owns()) return
      if (!target) throw new Error("Original message has no rendered target")
      for (const id of [...parentIDChainForCard(target.renderedCardID), target.renderedCardID]) setCardExpanded(id, true)
      setConversationDisclosureExpanded(`delegated-context:message:${hit.id}`, true)
      const sourcePart = message.parts.find(part => isConversationSourcePart(part) && part.sourceId === hit.sourceId)
      if (sourcePart && isConversationSourcePart(sourcePart) && sourcePart.type !== "source-file" && sourcePart.snippet) {
        setCardExpanded(conversationSourceExcerptKey(sourcePart), true)
      }
      const found = await requestConversationCardScroll({ cardID: target.renderedCardID, messageID: hit.id, sourceId: hit.sourceId, sessionID: target.sessionID, block: "start", highlight: true })
      if (!owns()) return
      if (!found) throw new Error("Original message could not be located")
      props.onClose()
    } catch (cause) {
      if (owns()) {
        setError(t("chat.search_unavailable"))
        reportError({ title: t("chat.search_unavailable"), details: formatErrorDetails(cause) })
      }
    } finally {
      if (owns()) setLocating("")
    }
  }

  return <Dialog open={props.open} title={t("chat.search_action")} class="cmdk-dialog conversation-search-dialog"
    overlayClass="cmdk-backdrop" formClass="cmdk-panel" onClose={props.onClose}
    returnFocusTarget={props.returnFocusTarget}
    onOpenAutoFocus={(event) => { event.preventDefault(); input?.focus() }}>
    <ComboboxControl<ConversationSearchHit> class="cmdk-combobox" controlClass="cmdk-control" inputClass="cmdk-input"
      listboxClass="cmdk-list" optionClass="cmdk-item" optionLabelClass="cmdk-item-label"
      inputID="conversationSearchInput" listboxID="conversationSearchListbox" inputRef={(element) => { input = element }}
      options={hits()} optionValue="id" optionTextValue={hitLabel} optionLabel={hitLabel} value={null}
      open={props.open} onInputChange={setQuery} defaultFilter={() => true} allowsEmptyCollection closeOnSelection={false}
      noResetInputOnBlur
      onInputKeyDown={(event) => {
        if (event.key !== "Escape" || event.isComposing) return
        event.preventDefault()
        event.stopPropagation()
        props.onClose()
      }}
      onChange={(hit) => void locate(hit)} ariaLabel={t("chat.search_placeholder")} placeholder={t("chat.search_placeholder")}
      renderOptionLabel={(hit) => <span class="conversation-search-hit">
        <span class="conversation-search-hit__meta"><strong>{hit.author}</strong><time>{date().format(hit.created)}</time></span>
        <Show when={hitSource(hit)}>{(source) => <SourceSearchContext source={source()} />}</Show>
        <span>{hit.preview}</span>
      </span>}
      optionData={(hit) => ({ "data-message-id": hit.id })}
      emptyContent={<Show when={!loading() && !error()}><div class="cmdk-empty">{t(query().trim() ? "chat.search_empty" : "chat.search_hint")}</div></Show>}
    />
    <div class="cmdk-footer conversation-search-footer">
      <div role="status" aria-live="polite">{loading() ? t("common.loading") : locating() ? t("chat.search_locating") :
        query().trim() ? t(hits().length === 1 ? "chat.search_result" : "chat.search_results", { count: hits().length.toLocaleString(getLocale()) }) :
          t("chat.search_ready", { count: (snapshot()?.messages.length ?? 0).toLocaleString(getLocale()) })}</div>
      <Button type="button" variant="ghost" size="sm" tone="neutral" aria-disabled={loading() || !!locating()} onClick={() => {
        if (!loading() && !locating()) void load()
      }}>{t("common.refresh")}</Button>
      <Button type="button" variant="ghost" size="sm" tone="neutral" onClick={props.onClose}>{t("common.close")}</Button>
    </div>
    <Show when={error()}><Feedback tone="error">{error()}</Feedback></Show>
  </Dialog>
}

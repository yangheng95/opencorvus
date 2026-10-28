import { createEffect, createMemo, createSignal, on, onCleanup, Show } from "solid-js"
import type { ExportSessionResponse } from "@opencorvus-ai/sdk"
import { Dialog } from "./ui/Dialog"
import { ComboboxControl } from "./ui/ComboboxControl"
import { Button } from "./ui/Button"
import { Feedback } from "./ui/Feedback"
import { apiJson, captureApiAuthority, isApiAuthorityCurrent } from "../services/api"
import { directoryScopedPath } from "../services/task-path"
import { readConversationSnapshot } from "../services/conversation-snapshot"
import { findConversationMessages, type ConversationSearchHit } from "../services/conversation-search"
import { loadOlderConversationHistory, ownsConversationHistory } from "../services/conversation"
import { renderedConversationCardTargetForMessage } from "../services/tree-writer"
import { requestConversationCardScroll } from "../services/conversation-scroll"
import { boardStore } from "../store/board"
import { setCardExpanded } from "../store/conversation-ui"
import { parentIDChainForCard } from "../utils/card-tree"
import { getLocale, t } from "../utils/i18n"
import { formatErrorDetails, reportError } from "../services/diagnostics"

export function ConversationSearchDialog(props: {
  open: boolean
  target: () => { sessionID: string; directory: string } | null
  onClose: () => void
  returnFocusTarget: () => HTMLElement | null
}) {
  const [snapshot, setSnapshot] = createSignal<ReturnType<typeof readConversationSnapshot>>()
  const [query, setQuery] = createSignal("")
  const [loading, setLoading] = createSignal(false)
  const [locating, setLocating] = createSignal("")
  const [error, setError] = createSignal("")
  let input: HTMLInputElement | undefined
  let controller: AbortController | undefined
  let ownsSnapshot: (() => boolean) | undefined
  const hits = createMemo(() => snapshot() ? findConversationMessages(snapshot()!, query()) : [])
  const date = createMemo(() => new Intl.DateTimeFormat(getLocale(), { dateStyle: "medium", timeStyle: "short" }))

  async function load(): Promise<void> {
    const target = props.target()
    if (!props.open || !target) return
    controller?.abort()
    const request = new AbortController()
    controller = request
    const authority = captureApiAuthority(), epoch = boardStore.selectEpoch
    const owns = () => props.open && controller === request && !request.signal.aborted &&
      isApiAuthorityCurrent(authority) && boardStore.selectEpoch === epoch &&
      props.target()?.sessionID === target.sessionID && props.target()?.directory === target.directory
    ownsSnapshot = owns
    setSnapshot(undefined)
    setLoading(true)
    setError("")
    try {
      const exported = await apiJson<ExportSessionResponse>(directoryScopedPath(
        `export/session/${encodeURIComponent(target.sessionID)}`, target.directory, "conversationSearch",
      ), { authority, signal: request.signal })
      if (owns()) setSnapshot(readConversationSnapshot(exported, target.sessionID))
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
    if (!source || source.kind !== "session" || source.id !== props.target()?.sessionID) return
    setLocating(hit.id)
    setError("")
    try {
      if (!ownsConversationHistory(source, authority)) throw new Error("Conversation history owner changed")
      let target = renderedConversationCardTargetForMessage(hit.id)
      while (!target) {
        const loaded = await loadOlderConversationHistory(source, authority)
        if (!owns()) return
        if (!loaded) break
        target = renderedConversationCardTargetForMessage(hit.id)
      }
      if (!owns()) return
      if (!target) throw new Error("Original message has no rendered target")
      for (const id of [...parentIDChainForCard(target.renderedCardID), target.renderedCardID]) setCardExpanded(id, true)
      const found = await requestConversationCardScroll({ cardID: target.renderedCardID, block: "center", highlight: true })
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
      options={hits()} optionValue="id" optionTextValue="preview" optionLabel="preview" value={null}
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

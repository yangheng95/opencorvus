import { createMemo, createResource, createSignal, For, Show } from "solid-js"
import type { FileChange, FileChangeReceipt } from "./DiffView"
import { ChangeLineStats, DiffView, changeStatusLabel } from "./DiffView"
import { readRecordedToolComparison } from "../services/diff"
import { getLocale, t } from "../utils/i18n"
import { formatErrorDetails } from "../utils/error-details"
import { Disclosure } from "./ui/Disclosure"
import { Feedback } from "./ui/Feedback"

type ToolComparisonReceipt = Extract<FileChangeReceipt, { partID: string }> & { directory: string; fileIndex: number }

function RecordedToolComparison(props: { receipt: ToolComparisonReceipt; index: number }) {
  const [open, setOpen] = createSignal(false)
  const [change] = createResource(() => (open() ? props.receipt : false), readRecordedToolComparison)
  return (
    <Disclosure.Root class="msg-tool-diff-card" open={open()} onOpenChange={setOpen}>
      <Disclosure.Trigger>
        <span>{t("diff.original_change", { index: props.index.toLocaleString(getLocale()) })}</span>
        <Show when={!change.loading && !change.error && change()}>
          {(item) => (
            <>
              <span class="change-status" data-status={item().status}>
                {changeStatusLabel(item().status)}
              </span>
              <ChangeLineStats additions={item().additions} deletions={item().deletions} isText={item().isText} />
            </>
          )}
        </Show>
      </Disclosure.Trigger>
      <Disclosure.Content>
        <Show when={open()}>
          <Show when={!change.loading} fallback={<p class="empty-hint">{t("diff.loading")}</p>}>
            <Show
              when={!change.error}
              fallback={
                <Feedback tone="error" details={formatErrorDetails(change.error)}>
                  {t("diff.load_failed")}
                </Feedback>
              }
            >
              <Show when={change()}>{(item) => <DiffView item={item()} />}</Show>
            </Show>
          </Show>
        </Show>
      </Disclosure.Content>
    </Disclosure.Root>
  )
}

/** Keep each canonical Tool comparison separate when the interval cannot be composed. */
export function RecordedToolComparisons(props: { item: FileChange }) {
  const receipts = createMemo(() =>
    props.item.evidence.receipts.filter(
      (receipt): receipt is ToolComparisonReceipt =>
        "partID" in receipt &&
        Boolean(receipt.directory?.trim()) &&
        typeof receipt.fileIndex === "number" &&
        Number.isSafeInteger(receipt.fileIndex) &&
        receipt.fileIndex >= 0,
    ),
  )
  return (
    <Show when={receipts().length > 0}>
      <section class="msg-tool-diffs" aria-label={t("diff.original_changes")}>
        <p class="empty-hint">{t("diff.original_changes_hint")}</p>
        <For each={receipts()}>
          {(receipt, index) => <RecordedToolComparison receipt={receipt} index={index() + 1} />}
        </For>
      </section>
    </Show>
  )
}

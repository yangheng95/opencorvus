import { Feedback } from "../ui/Feedback"
import { For, Show, createEffect, createMemo, createSignal, onCleanup, untrack, type JSX } from "solid-js"
import {
  ApiAuthorityChangedError,
  captureApiAuthority,
  isApiAuthorityCurrent,
  type ApiAuthority,
} from "../../services/api"
import { loadArchivedWorkLedger, workLedgerProject, type WorkLedgerCursor, type WorkLedgerItemRow } from "../../services/work-ledger"
import { archiveRowKey } from "../../services/archive-row-key"
import { ArchiveStateUnconfirmedError } from "../../services/archive-state"
import { restoreArchivedWork } from "../../services/restore-archived-work"
import { deleteMission } from "../../services/mission"
import { deleteTask } from "../../services/task"
import { deleteConversationSession } from "../../services/conversation-session"
import { conversationExperienceIcon, conversationExperienceLabel } from "../../services/conversation-experience"
import { formatErrorDetails, reportError, reportSuccess, runPostCommitUiEffect } from "../../services/diagnostics"
import { detailStamp } from "../../utils/time"
import { localeTag, t } from "../../utils/i18n"
import { projectLedgerDisplayName } from "../../utils/project-directory"
import { ArmedConfirmButton } from "../ui/ArmedConfirmButton"
import { Badge } from "../ui/Badge"
import { Button } from "../ui/Button"
import { Icon, type IconName } from "../ui/Icon"
import { SearchField } from "../ui/SearchField"
import { SettingsDetailSection, SettingsEmpty, SettingsPanel, SettingsRow } from "./layout"

const ARCHIVE_PAGE_SIZE = 100
const DELETE_CONFIRM_WINDOW_MS = 3_000

type ArchiveRead = "initial" | "append" | "refresh"

type ArchiveFailure = {
  operation: ArchiveRead | "restore" | "delete"
  cause: unknown
}

function archiveFailureSummary({ operation, cause }: ArchiveFailure): string {
  if (cause instanceof ArchiveStateUnconfirmedError) return t("archive.restore_unconfirmed")
  if (operation === "restore") return t("archive.restore_failed")
  if (operation === "delete") return t("archive.delete_failed")
  if (operation === "refresh") return t("archive.refresh_failed")
  return t("archive.load_failed")
}

function ArchiveFailureFeedback(props: { failure: ArchiveFailure; actions?: JSX.Element }) {
  return (
    <Feedback tone="error" details={formatErrorDetails(props.failure.cause)} actions={props.actions}>
      {archiveFailureSummary(props.failure)}
    </Feedback>
  )
}

function kindIcon(row: WorkLedgerItemRow): IconName {
  if (row.kind === "mission") return "mission"
  if (row.kind === "chat") return conversationExperienceIcon(row.experience)
  return "tasks"
}

function kindLabel(row: WorkLedgerItemRow): string {
  if (row.kind === "mission") return t("work_ledger.kind.mission")
  if (row.kind === "chat") return conversationExperienceLabel(row.experience)
  return t("work_ledger.kind.task")
}

function archiveProjectName(row: WorkLedgerItemRow): string {
  return projectLedgerDisplayName({
    directory: row.directory,
    customName: workLedgerProject(row.directory)?.title,
    unknownName: t("task.project.unknown"),
    implicitProjectName: t("work_ledger.implicit_project"),
  })
}

function archiveActionText(
  key: "archive.open_item" | "archive.restore" | "archive.delete_permanently" | "archive.delete_confirm",
  row: WorkLedgerItemRow,
): string {
  const name = archiveProjectName(row)
  const project = row.directory
    ? t("archive.action_project_directory", { project: name, directory: row.directory })
    : name
  return t(key, { title: row.title || row.id, project })
}

function archivedAt(row: WorkLedgerItemRow): number {
  if (typeof row.archived !== "number") {
    throw new Error(`Archived ${row.kind} row is missing its archive timestamp: ${row.id}`)
  }
  return row.archived
}

export default function ArchivePanel(props: { onOpenItem: (row: WorkLedgerItemRow, trigger: HTMLButtonElement) => Promise<void> }) {
  const [search, setSearch] = createSignal("")
  const [rows, setRows] = createSignal<WorkLedgerItemRow[]>([])
  const [nextCursor, setNextCursor] = createSignal<WorkLedgerCursor | null>(null)
  const [loading, setLoading] = createSignal(false)
  const [busyID, setBusyID] = createSignal("")
  const [failure, setFailure] = createSignal<ArchiveFailure>()
  const [committedAction, setCommittedAction] = createSignal<{ action: "restore" | "delete"; title: string }>()
  let requestGeneration = 0
  let controller: AbortController | undefined
  let panelElement: HTMLDivElement | undefined
  let headingElement: HTMLSpanElement | undefined
  let continuationElement: HTMLDivElement | undefined
  let continuationButton: HTMLButtonElement | undefined

  const ownsRequest = (generation: number, authority: ApiAuthority) =>
    generation === requestGeneration && isApiAuthorityCurrent(authority)

  const continuationFailure = () => {
    const current = failure()
    return current?.operation === "append" ? current : undefined
  }
  const panelFailure = () => {
    const current = failure()
    return current?.operation === "append" ? undefined : current
  }
  const hasRefreshFailure = createMemo(() => panelFailure()?.operation === "refresh")

  const recordFailure = (id: string, operation: ArchiveFailure["operation"], cause: unknown) => {
    const failure = { operation, cause }
    setFailure(failure)
    reportError({
      id,
      title: archiveFailureSummary(failure),
      message: cause instanceof Error ? cause.message : String(cause),
      details: formatErrorDetails(cause),
    })
  }

  const readPages = async (input: {
    cursor: WorkLedgerCursor | null
    retainedTail?: WorkLedgerItemRow
    search: string
    signal: AbortSignal
    generation: number
    authority: ApiAuthority
  }) => {
    let cursor = input.cursor
    const refreshed: WorkLedgerItemRow[] = []
    do {
      const page = await loadArchivedWorkLedger({
        search: input.search,
        limit: ARCHIVE_PAGE_SIZE,
        cursor,
        signal: input.signal,
        authority: input.authority,
      })
      if (!ownsRequest(input.generation, input.authority)) return
      refreshed.push(...page.rows)
      cursor = page.nextCursor
      const tail = input.retainedTail
      // Follow the public pinned/updated/kind:id cursor through the accepted read window.
      const beforeTail = cursor && tail && (
        Number(cursor.pinned) > Number(tail.pinned) ||
        (cursor.pinned === tail.pinned && (
          cursor.updated > tail.updated ||
          (cursor.updated === tail.updated && cursor.rowKey > `${tail.kind}:${tail.id}`)
        ))
      )
      if (!beforeTail) return { rows: refreshed, nextCursor: cursor }
    } while (true)
  }

  const findArchiveRow = (rowKey: string) =>
    Array.from(panelElement?.querySelectorAll<HTMLElement>("[data-archive-row-key]") ?? [])
      .find((element) => element.dataset.archiveRowKey === rowKey)

  const focusAfterAction = (
    rowKey: string,
    previousIndex: number,
    previousFocus: HTMLElement | null,
    committed: boolean,
    ownsAction: () => boolean,
  ) => {
    queueMicrotask(() => {
      if (!ownsAction()) return
      const active = document.activeElement
      if (active !== previousFocus && active !== document.body) return
      if (!committed && previousFocus?.isConnected) {
        previousFocus.focus({ preventScroll: true })
        return
      }
      const currentRows = rows()
      const nextRow = currentRows[Math.min(previousIndex, Math.max(0, currentRows.length - 1))]
      const nextRowElement = findArchiveRow(nextRow ? archiveRowKey(nextRow) : rowKey)
      const nextAction = nextRowElement?.querySelector<HTMLElement>(
        '[data-archive-action="restore"]:not([disabled]), [data-archive-action="delete"]:not([disabled])',
      )
      ;(nextAction ?? headingElement)?.focus({ preventScroll: true })
    })
  }

  const load = async (operation: ArchiveRead, retryTrigger?: HTMLButtonElement) => {
    if (loading() || busyID()) return
    const append = operation === "append"
    const refresh = operation === "refresh"
    const cursor = append ? nextCursor() : null
    if (append && !cursor) return
    const retainedTail = refresh ? rows().at(-1) : undefined
    controller?.abort()
    const requestController = new AbortController()
    controller = requestController
    const generation = ++requestGeneration
    const authority = captureApiAuthority()
    const hadContinuationFocus = append && continuationButton === document.activeElement
    const hadRetryFocus = retryTrigger === document.activeElement
    let focusRow: WorkLedgerItemRow | undefined
    setLoading(true)
    if (append) setFailure(undefined)
    try {
      const result = await readPages({
        search: search().trim(),
        cursor,
        retainedTail,
        signal: requestController.signal,
        generation,
        authority,
      })
      if (!result || !ownsRequest(generation, authority)) return
      const nextFocus = hadContinuationFocus && continuationButton === document.activeElement
        ? result.rows[0] ?? (!result.nextCursor ? rows().at(-1) : undefined)
        : undefined
      if (hadRetryFocus && retryTrigger === document.activeElement) {
        headingElement?.focus({ preventScroll: true })
      }
      setRows((current) => (append ? [...current, ...result.rows] : result.rows))
      setNextCursor(result.nextCursor)
      focusRow = nextFocus
      if (!append) setFailure(undefined)
    } catch (cause) {
      if (
        requestController.signal.aborted ||
        !ownsRequest(generation, authority) ||
        cause instanceof ApiAuthorityChangedError
      )
        return
      recordFailure("settings:archive:load", operation, cause)
    } finally {
      if (ownsRequest(generation, authority)) {
        if (controller === requestController) controller = undefined
        setLoading(false)
        if (focusRow) {
          findArchiveRow(archiveRowKey(focusRow))?.querySelector<HTMLButtonElement>('[data-archive-action="open"]')?.focus()
        } else if (append && continuationFailure() && continuationElement?.contains(document.activeElement)) {
          continuationElement.scrollIntoView({ block: "nearest" })
        }
      }
    }
  }

  const retryRead = () => (
    <Button
      type="button"
      variant="outline"
      size="sm"
      tone="neutral"
      aria-disabled={loading() || !!busyID() || undefined}
      aria-busy={loading() || undefined}
      onClick={(event) => {
        const operation = panelFailure()?.operation
        if (operation === "initial" || operation === "refresh") void load(operation, event.currentTarget)
      }}
    >
      <Icon name="refresh" />{loading() ? t("common.loading") : t("common.retry")}
    </Button>
  )

  const runRowAction = async (row: WorkLedgerItemRow, action: "restore" | "delete") => {
    if (busyID() || loading()) return
    const rowKey = archiveRowKey(row)
    const previousIndex = Math.max(
      0,
      rows().findIndex((item) => archiveRowKey(item) === rowKey),
    )
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const retainedTail = rows().filter((item) => archiveRowKey(item) !== rowKey).at(-1)
    controller?.abort()
    controller = undefined
    const generation = ++requestGeneration
    const authority = captureApiAuthority()
    const ownsAction = () => ownsRequest(generation, authority)
    setBusyID(rowKey)
    setFailure(undefined)
    setCommittedAction(undefined)
    let committed = false
    try {
      if (action === "restore") {
        await restoreArchivedWork(row, authority)
      } else if (row.kind === "mission") {
        await deleteMission(
          { missionID: row.missionID, directory: row.directory, authority },
          {
            surface: "overlay.archive_panel",
            reason: "Operator deleted the archived Mission from Archive",
          },
        )
      } else if (row.kind === "chat") {
        await deleteConversationSession({
          sessionID: row.sessionID,
          directory: row.directory,
          experience: row.experience,
          authority,
        })
      } else {
        await deleteTask(
          row.id,
          {
            surface: "overlay.archive_panel",
            reason: "Operator deleted the archived task from Archive",
          },
          { authority },
        )
      }
      if (!ownsAction()) return
      committed = true
    } catch (cause) {
      if (!ownsAction() || cause instanceof ApiAuthorityChangedError) return
      recordFailure(`settings:archive:${action}:${row.kind}:${row.id}`, action, cause)
      setBusyID("")
      focusAfterAction(rowKey, previousIndex, previousFocus, false, ownsAction)
      return
    }

    runPostCommitUiEffect(
      {
        id: `settings:archive:${action}:projection:${row.kind}:${row.id}`,
        title: "Archive row reconciliation after committed mutation",
      },
      () => {
        setCommittedAction({ action, title: row.title || row.id })
        setRows((current) => current.filter((item) => archiveRowKey(item) !== rowKey))
      },
    )

    const requestController = new AbortController()
    controller = requestController
    setLoading(true)
    try {
      const result = await readPages({
        search: search().trim(),
        cursor: null,
        retainedTail,
        signal: requestController.signal,
        generation,
        authority,
      })
      if (!result || !ownsAction()) return
      setRows(result.rows)
      setNextCursor(result.nextCursor)
    } catch (cause) {
      if (requestController.signal.aborted || !ownsAction() || cause instanceof ApiAuthorityChangedError) return
      recordFailure(`settings:archive:${action}:refresh:${row.kind}:${row.id}`, "refresh", cause)
    } finally {
      if (!ownsAction()) return
      if (controller === requestController) controller = undefined
      setLoading(false)
      setBusyID("")
      if (committed) {
        runPostCommitUiEffect(
          {
            id: `settings:archive:${action}:notification:${row.kind}:${row.id}`,
            title: "Archive action committed",
          },
          () =>
            reportSuccess({
              id: `settings:archive:${action}:${row.kind}:${row.id}`,
              title: action === "restore" ? t("archive.restore_succeeded") : t("archive.delete_succeeded"),
              message: row.title || row.id,
            }),
        )
      }
      focusAfterAction(rowKey, previousIndex, previousFocus, committed, ownsAction)
    }
  }

  createEffect(() => {
    captureApiAuthority()
    // Query replacement retires the current page and its cursor with the same request owner.
    search()
    requestGeneration += 1
    controller?.abort()
    controller = undefined
    setRows([])
    setNextCursor(null)
    setBusyID("")
    setLoading(false)
    setFailure(undefined)
    setCommittedAction(undefined)
    untrack(() => void load("initial"))
  })
  onCleanup(() => {
    requestGeneration += 1
    controller?.abort()
  })

  return (
    <SettingsPanel ref={panelElement} data-ui="archive-panel" aria-busy={loading() || !!busyID() ? "true" : undefined}>
      <Show when={committedAction()}>
        {(result) => (
          <Feedback
            tone="success"
            title={result().action === "restore" ? t("archive.restore_succeeded") : t("archive.delete_succeeded")}
          >
            {result().title}
          </Feedback>
        )}
      </Show>
      <Show when={rows().length > 0 && panelFailure()}>
        {(current) => (
          <ArchiveFailureFeedback
            failure={current()}
            actions={hasRefreshFailure() ? retryRead() : undefined}
          />
        )}
      </Show>
      <SearchField
        clearable
        value={search()}
        placeholder={t("archive.search_placeholder")}
        onValueChange={setSearch}
        disabled={!!busyID()}
      />
      <SettingsDetailSection
        title={
          <span ref={headingElement} tabIndex={-1} data-ui="archive-heading-focus">
            {t("archive.heading")}
          </span>
        }
        description={t("archive.description")}
        actions={<Badge tone="muted">{rows().length.toLocaleString(localeTag())}</Badge>}
      >
        <Show when={rows().length > 0} fallback={
          <Show when={panelFailure()} fallback={
            <SettingsEmpty>
              {loading() ? t("common.loading") : search().trim() ? t("archive.no_results") : t("archive.empty")}
            </SettingsEmpty>
          }>
            {(current) => (
              <ArchiveFailureFeedback
                failure={current()}
                actions={retryRead()}
              />
            )}
          </Show>
        }>
          <For each={rows()}>
            {(row) => (
              <SettingsRow
                class="archive-row"
                align="center"
                data-ui="archive-row"
                data-kind={row.kind}
                data-experience={row.kind === "chat" ? row.experience : undefined}
                data-row-id={row.id}
                data-archive-row-key={archiveRowKey(row)}
                nativeTitle={row.title || row.id}
                title={
                  <span class="archive-row-title">
                    <span class="archive-row-title__icon" aria-hidden="true">
                      <Icon name={kindIcon(row)} size="medium" />
                    </span>
                    <span class="archive-row-title__text">{row.title || row.id}</span>
                  </span>
                }
                meta={
                  <>
                    <span>{kindLabel(row)}</span>
                    <span class="archive-row-project">{archiveProjectName(row)}</span>
                    <span>{t("archive.archived_at", { time: detailStamp(archivedAt(row)) })}</span>
                    <span class="archive-row-directory">{row.directory}</span>
                  </>
                }
                actions={
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      tone="neutral"
                      aria-label={archiveActionText("archive.open_item", row)}
                      data-archive-action="open"
                      disabled={!!busyID() || loading()}
                      onClick={(event) => void props.onOpenItem(row, event.currentTarget)}
                    >
                      {t("archive.open")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      tone="neutral"
                      data-chrome="icon-action"
                      data-ui="archive-restore"
                      data-archive-action="restore"
                      title={archiveActionText("archive.restore", row)}
                      aria-label={archiveActionText("archive.restore", row)}
                      disabled={!!busyID() || loading()}
                      onClick={() => void runRowAction(row, "restore")}
                    >
                      <Icon name="archive-restore" />
                    </Button>
                    <ArmedConfirmButton
                      type="button"
                      variant="ghost"
                      size="icon"
                      tone="danger"
                      data-ui="archive-delete"
                      data-archive-action="delete"
                      disabled={!!busyID() || loading()}
                      label={archiveActionText("archive.delete_permanently", row)}
                      armedDescription={archiveActionText("archive.delete_confirm", row)}
                      confirmWindowMs={DELETE_CONFIRM_WINDOW_MS}
                      onConfirm={() => void runRowAction(row, "delete")}
                      confirmChildren={<Icon name="check" size="compact" />}
                    >
                      <Icon name="delete" />
                    </ArmedConfirmButton>
                  </>
                }
              />
            )}
          </For>
        </Show>
      </SettingsDetailSection>
      <Show when={nextCursor()}>
        <div ref={continuationElement} class="dialog-actions compact archive-page-footer">
          <Show when={continuationFailure()}>
            {(current) => <ArchiveFailureFeedback failure={current()} />}
          </Show>
          <Button
            ref={continuationButton}
            type="button"
            variant="outline"
            size="md"
            tone="neutral"
            data-ui="archive-load-more"
            aria-disabled={loading() || !!busyID() || undefined}
            onClick={() => void load("append")}
          >
            {loading() ? t("common.loading") : t("work_ledger.load_more")}
          </Button>
        </div>
      </Show>
    </SettingsPanel>
  )
}

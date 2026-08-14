import { For, Show, createSignal, onCleanup, onMount } from "solid-js"
import { loadArchivedWorkLedger, type WorkLedgerCursor, type WorkLedgerItemRow } from "../../services/work-ledger"
import { archiveRowKey } from "../../services/archive-row-key"
import { deleteMission, setMissionArchived } from "../../services/mission"
import { deleteTask, setTaskArchived } from "../../services/task"
import { deleteConversationSession, setConversationSessionArchived } from "../../services/conversation-session"
import { conversationExperienceIcon, conversationExperienceLabel } from "../../services/conversation-experience"
import { formatErrorDetails, reportError, reportSuccess, runPostCommitUiEffect } from "../../services/diagnostics"
import { detailStamp } from "../../utils/time"
import { t } from "../../utils/i18n"
import { ArmedConfirmButton } from "../ui/ArmedConfirmButton"
import { Badge } from "../ui/Badge"
import { Button } from "../ui/Button"
import { Icon, type IconName } from "../ui/Icon"
import { SettingsDetailSection, SettingsEmpty, SettingsPanel, SettingsRow, SettingsState } from "./layout"

const ARCHIVE_PAGE_SIZE = 100
const DELETE_CONFIRM_WINDOW_MS = 3_000

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

function archivedAt(row: WorkLedgerItemRow): number {
  if (typeof row.archived !== "number") {
    throw new Error(`Archived ${row.kind} row is missing its archive timestamp: ${row.id}`)
  }
  return row.archived
}

export default function ArchivePanel() {
  const [rows, setRows] = createSignal<WorkLedgerItemRow[]>([])
  const [nextCursor, setNextCursor] = createSignal<WorkLedgerCursor | null>(null)
  const [loading, setLoading] = createSignal(false)
  const [busyID, setBusyID] = createSignal("")
  const [error, setError] = createSignal("")
  let requestGeneration = 0
  let controller: AbortController | undefined
  let panelElement: HTMLDivElement | undefined
  let headingElement: HTMLSpanElement | undefined

  const ownsRequest = (generation: number) => generation === requestGeneration

  const focusAfterAction = (
    rowKey: string,
    previousIndex: number,
    previousFocus: HTMLElement | null,
    committed: boolean,
  ) => {
    queueMicrotask(() => {
      if (!committed && previousFocus?.isConnected) {
        previousFocus.focus({ preventScroll: true })
        return
      }
      const currentRows = rows()
      const nextRow = currentRows[Math.min(previousIndex, Math.max(0, currentRows.length - 1))]
      const nextRowElement = Array.from(
        panelElement?.querySelectorAll<HTMLElement>("[data-archive-row-key]") ?? [],
      ).find((element) => element.dataset.archiveRowKey === (nextRow ? archiveRowKey(nextRow) : rowKey))
      const nextAction = nextRowElement?.querySelector<HTMLElement>(
        '[data-archive-action="restore"]:not([disabled]), [data-archive-action="delete"]:not([disabled])',
      )
      ;(nextAction ?? headingElement)?.focus({ preventScroll: true })
    })
  }

  const load = async (append: boolean) => {
    if (loading() || busyID()) return
    const cursor = append ? nextCursor() : null
    if (append && !cursor) return
    controller?.abort()
    const requestController = new AbortController()
    controller = requestController
    const generation = ++requestGeneration
    setLoading(true)
    setError("")
    try {
      const result = await loadArchivedWorkLedger({
        limit: ARCHIVE_PAGE_SIZE,
        cursor,
        signal: requestController.signal,
      })
      if (!ownsRequest(generation)) return
      setRows((current) => (append ? [...current, ...result.rows] : result.rows))
      setNextCursor(result.nextCursor)
    } catch (cause) {
      if (requestController.signal.aborted || !ownsRequest(generation)) return
      const message = cause instanceof Error ? cause.message : String(cause)
      setError(message)
      reportError({
        id: "settings:archive:load",
        title: t("archive.load_failed"),
        message,
        details: formatErrorDetails(cause),
      })
    } finally {
      if (ownsRequest(generation)) {
        if (controller === requestController) controller = undefined
        setLoading(false)
      }
    }
  }

  const runRowAction = async (row: WorkLedgerItemRow, action: "restore" | "delete") => {
    if (busyID() || loading()) return
    const rowKey = archiveRowKey(row)
    const previousIndex = Math.max(
      0,
      rows().findIndex((item) => archiveRowKey(item) === rowKey),
    )
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    controller?.abort()
    controller = undefined
    const generation = ++requestGeneration
    setBusyID(rowKey)
    setError("")
    let committed = false
    try {
      if (action === "restore") {
        if (row.kind === "mission") {
          await setMissionArchived({ missionID: row.missionID, directory: row.directory }, false)
        } else if (row.kind === "chat") {
          await setConversationSessionArchived(
            { sessionID: row.sessionID, directory: row.directory, experience: row.experience },
            false,
          )
        } else {
          await setTaskArchived({ taskID: row.id, directory: row.directory }, false)
        }
      } else if (row.kind === "mission") {
        await deleteMission(
          { missionID: row.missionID, directory: row.directory },
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
        })
      } else {
        await deleteTask(row.id, {
          surface: "overlay.archive_panel",
          reason: "Operator deleted the archived task from Archive",
        })
      }
      if (!ownsRequest(generation)) return
      committed = true
    } catch (cause) {
      if (!ownsRequest(generation)) return
      const message = cause instanceof Error ? cause.message : String(cause)
      setError(message)
      reportError({
        id: `settings:archive:${action}:${row.kind}:${row.id}`,
        title: action === "restore" ? t("archive.restore_failed") : t("archive.delete_failed"),
        message,
        details: formatErrorDetails(cause),
      })
      setBusyID("")
      focusAfterAction(rowKey, previousIndex, previousFocus, false)
      return
    }

    runPostCommitUiEffect(
      {
        id: `settings:archive:${action}:projection:${row.kind}:${row.id}`,
        title: "Archive row reconciliation after committed mutation",
      },
      () => setRows((current) => current.filter((item) => archiveRowKey(item) !== rowKey)),
    )

    const requestController = new AbortController()
    controller = requestController
    setLoading(true)
    try {
      const result = await loadArchivedWorkLedger({
        limit: ARCHIVE_PAGE_SIZE,
        cursor: null,
        signal: requestController.signal,
      })
      if (!ownsRequest(generation)) return
      setRows(result.rows)
      setNextCursor(result.nextCursor)
    } catch (cause) {
      if (requestController.signal.aborted || !ownsRequest(generation)) return
      const message = cause instanceof Error ? cause.message : String(cause)
      setError(message)
      reportError({
        id: `settings:archive:${action}:refresh:${row.kind}:${row.id}`,
        title: t("archive.load_failed"),
        message,
        details: formatErrorDetails(cause),
      })
    } finally {
      if (!ownsRequest(generation)) return
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
      focusAfterAction(rowKey, previousIndex, previousFocus, committed)
    }
  }

  onMount(() => void load(false))
  onCleanup(() => {
    requestGeneration += 1
    controller?.abort()
  })

  return (
    <SettingsPanel ref={panelElement} data-ui="archive-panel" aria-busy={loading() || !!busyID() ? "true" : undefined}>
      <Show when={error() && rows().length > 0}>
        <SettingsState tone="error">{error()}</SettingsState>
      </Show>
      <SettingsDetailSection
        title={
          <span ref={headingElement} tabIndex={-1} data-ui="archive-heading-focus">
            {t("archive.heading")}
          </span>
        }
        description={t("archive.description")}
        actions={<Badge tone="muted">{rows().length}</Badge>}
      >
        <Show when={!error() || rows().length > 0} fallback={
          <SettingsState tone="error" actions={
            <Button type="button" variant="outline" size="sm" tone="neutral" onClick={() => void load(false)}>
              <Icon name="refresh" />{t("common.retry")}
            </Button>
          }>{error()}</SettingsState>
        }>
        <Show when={rows().length > 0} fallback={<SettingsEmpty>{loading() ? t("common.loading") : t("archive.empty")}</SettingsEmpty>}>
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
                    <span>{row.directory}</span>
                    <span>{t("archive.archived_at", { time: detailStamp(archivedAt(row)) })}</span>
                  </>
                }
                actions={
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      tone="neutral"
                      data-chrome="icon-action"
                      data-ui="archive-restore"
                      data-archive-action="restore"
                      title={t("archive.restore")}
                      aria-label={t("archive.restore")}
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
                      label={t("archive.delete_permanently")}
                      armedDescription={t("archive.delete_confirm")}
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
        </Show>
      </SettingsDetailSection>
      <Show when={nextCursor()}>
        <div class="dialog-actions compact">
          <Button
            type="button"
            variant="outline"
            size="md"
            tone="neutral"
            data-ui="archive-load-more"
            disabled={loading()}
            onClick={() => void load(true)}
          >
            {loading() ? t("common.loading") : t("work_ledger.load_more")}
          </Button>
        </div>
      </Show>
    </SettingsPanel>
  )
}

// ── DiffPreviewPanel ──
// Main workspace view that shows the full diff for a single file.
// Given a file path, it resolves the FileChange from the shared diff service
// (which lazy-loads from the acceptance API when necessary) and renders it
// through the shared DiffView component.

import { createResource, createMemo, createEffect, createSignal, on, Show } from "solid-js"
import { ChangeLineStats, DiffView, changeStatusLabel, type FileChange } from "./DiffView"
import {
  changeGroupsRevisionKey,
  hasDiffBody,
  isKnownTextDiff,
  resolveDiff,
  type ChangeGroup,
  type DiffTarget,
} from "../services/diff"
import { captureApiAuthority, isApiAuthorityCurrent } from "../services/api"
import { fileEditorReserved, openFileReference } from "../services/file-workbench"
import { boardStore } from "../store/board"
import { Panel } from "./ui/Panel"
import { Button } from "./ui/Button"
import { Icon } from "./ui/Icon"
import { Feedback } from "./ui/Feedback"
import { t } from "../utils/i18n"
import { shortRelativePath } from "../utils/tool"
import { formatErrorDetails } from "../utils/error-details"
import { RecordedToolComparisons } from "./RecordedToolComparisons"
import type { JSX } from "solid-js"

export interface DiffPreviewPanelProps {
  /** Diff target to show — null/empty renders the empty state. */
  target: DiffTarget | null
  /** Exact task/source identity that owns the target. */
  scopeKey: string
  /** Exact visible collection that owns the target. */
  groups?: readonly ChangeGroup[]
  /** Owning project of the visible comparison, also used for current-file reads. */
  directory: string
  /** Canonical destination of the selected comparison, independent of its display label. */
  currentFilePath: string | undefined
}

type DiffPreviewRequest = { scopeKey: string; target: DiffTarget; groups?: readonly ChangeGroup[] }

export function DiffPreviewPanel(props: DiffPreviewPanelProps) {
  const request = createMemo<{ key: string; value: DiffPreviewRequest } | null>(
    () => {
      const target = props.target
      const scopeKey = props.scopeKey.trim()
      const groups = props.groups
      if (!target?.filePath || (!scopeKey && !groups)) return null
      const value: DiffPreviewRequest = {
        scopeKey,
        target: {
          filePath: target.filePath,
          groupID: target.groupID,
          sessionID: target.sessionID,
          agentID: target.agentID,
        },
        groups,
      }
      return {
        key: JSON.stringify([
          captureApiAuthority().revision,
          scopeKey,
          value.target,
          groups === undefined ? null : changeGroupsRevisionKey(groups),
        ]),
        value,
      }
    },
    null,
    { equals: (previous, current) => previous?.key === current?.key },
  )
  const [change, { refetch }] = createResource<FileChange | null, DiffPreviewRequest | null>(
    () => request()?.value ?? null,
    async (request) => {
      if (!request) return null
      return resolveDiff(request.target, request.groups)
    },
  )

  const item = createMemo(() => (change.loading || change.error ? null : (change() ?? null)))
  const loading = () => change.loading
  const [opening, setOpening] = createSignal(false)
  const [openFailure, setOpenFailure] = createSignal<{ error: unknown } | null>(null)
  createEffect(
    on(
      () => [request()?.key, props.directory, props.currentFilePath, boardStore.selectEpoch],
      () => {
        setOpening(false)
        setOpenFailure(null)
      },
    ),
  )

  const openCurrentFile = async () => {
    const path = props.currentFilePath
    const directory = props.directory.trim()
    if (!path || !directory || opening() || fileEditorReserved()) return
    const authority = captureApiAuthority()
    const key = request()?.key
    const epoch = boardStore.selectEpoch
    const current = () =>
      isApiAuthorityCurrent(authority) &&
      boardStore.selectEpoch === epoch &&
      props.directory.trim() === directory &&
      props.currentFilePath === path &&
      request()?.key === key
    setOpening(true)
    setOpenFailure(null)
    try {
      await openFileReference(path, { directory, authority })
    } catch (error) {
      if (current()) setOpenFailure({ error })
    } finally {
      if (current()) setOpening(false)
    }
  }

  // Compute header content in a memo so Panel's Show reads a stable reference,
  // avoiding double-creation of DOM nodes from the ternary getter.
  const headerContent = createMemo((): JSX.Element | undefined => {
    if (!props.target?.filePath) return undefined
    return (
      <>
        <div class="diff-preview-copy" classList={{ "diff-preview-copy--rename": !!item()?.previousPath }}>
          <Show when={item()?.previousPath} fallback={
            <span class="diff-preview-path" title={props.target?.filePath || ""}>
              {props.target?.filePath}
            </span>
          }>
            {(previousPath) => (
              <dl class="diff-preview-paths">
                <dt class="diff-preview-scope">{t("diff.original_path")}</dt>
                <dd class="diff-preview-path" title={previousPath()}>
                  {shortRelativePath(previousPath(), props.directory)}
                </dd>
                <dt class="diff-preview-scope">{t("diff.destination_path")}</dt>
                <dd class="diff-preview-path" title={item()!.openPath}>
                  {shortRelativePath(item()!.openPath, props.directory)}
                </dd>
              </dl>
            )}
          </Show>
        </div>
        <Show when={item()}>
          <span class="diff-preview-meta">
            <span class="change-status" data-status={item()!.status}>
              {changeStatusLabel(item()!.status, item()!.previousPath)}
            </span>
            <Show when={item()!.evidence.kind === "complete"}>
              <ChangeLineStats additions={item()!.additions} deletions={item()!.deletions} isText={item()!.isText} />
            </Show>
          </span>
        </Show>
        <Button
          class="diff-preview-open-file"
          type="button"
          variant="outline"
          size="sm"
          tone="accent"
          disabled={!props.currentFilePath || !props.directory.trim() || opening() || fileEditorReserved()}
          aria-busy={opening() || undefined}
          aria-label={props.currentFilePath ? `${t("diff.open_current_file")}: ${props.currentFilePath}` : t("diff.open_current_file")}
          title={t("diff.open_current_file_hint")}
          onClick={() => void openCurrentFile()}
        >
          <Icon name={opening() ? "loading" : "file-document"} />
          {t("diff.open_current_file")}
        </Button>
      </>
    )
  })

  return (
    <Panel class="diff-preview-panel" header={headerContent()}>
      <Show when={openFailure()}>
        <Feedback tone="error" details={formatErrorDetails(openFailure()!.error)}>
          {t("diff.open_current_file_failed")}
        </Feedback>
      </Show>
      <Show
        when={props.target?.filePath}
        fallback={
          <div class="diff-preview-empty">
            <p class="empty-hint">{t("diff.select_file")}</p>
          </div>
        }
      >
        <Show
          when={!loading()}
          fallback={
            <div class="diff-preview-empty">
              <p class="empty-hint">{t("diff.loading")}</p>
            </div>
          }
        >
          <Show
            when={!change.error}
            fallback={
              <div class="diff-preview-empty">
                <Feedback
                  tone="error"
                  details={formatErrorDetails(change.error)}
                  actions={
                    <Button type="button" variant="outline" size="sm" tone="neutral" onClick={() => refetch()}>
                      {t("common.retry")}
                    </Button>
                  }
                >
                  {t("diff.preview_load_failed")}
                </Feedback>
              </div>
            }
          >
            <Show
              when={item()}
              fallback={
                <div class="diff-preview-empty">
                  <p class="empty-hint">{t("diff.no_preview")}</p>
                </div>
              }
            >
              <div
                class="diff-preview-body"
                classList={{
                  "diff-preview-body--text":
                    hasDiffBody(item()) && isKnownTextDiff(item()) && item()!.before !== item()!.after,
                }}
              >
                <Show
                  when={
                    item()!.evidence.kind === "incomplete" &&
                    props.groups?.some(
                      (group) => group.id === props.target?.groupID && group.observationKind === "tool_interval",
                    )
                  }
                  fallback={<DiffView item={item()!} />}
                >
                  <RecordedToolComparisons item={item()!} />
                </Show>
              </div>
            </Show>
          </Show>
        </Show>
      </Show>
    </Panel>
  )
}

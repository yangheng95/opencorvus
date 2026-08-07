// ── DiffPreviewPanel ──
// Main workspace view that shows the full diff for a single file.
// Given a file path, it resolves the FileChange from the shared diff service
// (which lazy-loads from the acceptance API when necessary) and renders it
// through the shared DiffView component.

import { createResource, createMemo, Show } from "solid-js"
import { DiffView, changeStatusLabel, type FileChange } from "./DiffView"
import { resolveDiff, type ChangeGroup, type DiffTarget } from "../services/diff"
import { Panel } from "./ui/Panel"
import { t } from "../utils/i18n"
import type { JSX } from "solid-js"

export interface DiffPreviewPanelProps {
  /** Diff target to show — null/empty renders the empty state. */
  target: DiffTarget | null
  /** Exact task/source identity that owns the target. */
  scopeKey: string
  /** Exact visible collection that owns the target. */
  groups?: readonly ChangeGroup[]
}

export function DiffPreviewPanel(props: DiffPreviewPanelProps) {
  const [change] = createResource<
    FileChange | null,
    { scopeKey: string; target: DiffTarget; groups?: readonly ChangeGroup[] } | null
  >(
    () => {
      const target = props.target
      const scopeKey = props.scopeKey.trim()
      if (!target?.filePath || (!scopeKey && !props.groups)) return null
      return {
        scopeKey,
        target: {
          filePath: target.filePath,
          groupID: target.groupID,
          sessionID: target.sessionID,
          agentID: target.agentID,
        },
        groups: props.groups,
      }
    },
    async (request) => {
      if (!request) return null
      return resolveDiff(request.target, request.groups)
    },
  )

  const item = createMemo(() => change())
  const loading = () => change.loading

  // Compute header content in a memo so Panel's Show reads a stable reference,
  // avoiding double-creation of DOM nodes from the ternary getter.
  const headerContent = createMemo((): JSX.Element | undefined => {
    if (!props.target?.filePath) return undefined
    return (
      <>
        <span class="diff-preview-copy">
          <Show when={props.target?.agentID}>
            <span class="diff-preview-scope">{props.target?.agentID}</span>
          </Show>
          <span class="diff-preview-path" title={props.target?.filePath || ""}>
            {props.target?.filePath}
          </span>
        </span>
        <Show when={item()}>
          <span class="diff-preview-meta">
            <span class="change-status" data-status={item()!.status}>
              {changeStatusLabel(item()!.status)}
            </span>
            <span class="diff-dialog-stat" data-tone="add">
              +{item()!.additions}
            </span>
            <span class="diff-dialog-stat" data-tone="del">
              -{item()!.deletions}
            </span>
          </span>
        </Show>
      </>
    )
  })

  return (
    <Panel class="diff-preview-panel" header={headerContent()}>
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
            when={item()}
            fallback={
              <div class="diff-preview-empty">
                <p class="empty-hint">{t("diff.no_preview")}</p>
              </div>
            }
          >
            <div class="diff-preview-body">
              <DiffView item={item()!} />
            </div>
          </Show>
        </Show>
      </Show>
    </Panel>
  )
}

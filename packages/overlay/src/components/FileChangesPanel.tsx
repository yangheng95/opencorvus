import { createMemo, Show } from "solid-js"
import type { DiffTarget } from "../services/diff"
import { t } from "../utils/i18n"
import { ChangesPanel } from "./ChangesPanel"
import { DiffPreviewPanel } from "./DiffPreviewPanel"
import { Icon } from "./ui/Icon"
import { Button } from "./ui/Button"

export type FileChangesActiveView = "changes" | "diff"

export interface FileChangesPanelProps {
  scopeKey: string
  diffOpen: boolean
  diffTarget: DiffTarget
  activeView: FileChangesActiveView
  onCloseDiff: () => void
  active: () => boolean
}

export function FileChangesPanel(props: FileChangesPanelProps) {
  const hasDiff = createMemo(() => props.diffOpen && !!props.diffTarget?.filePath)
  const activeView = createMemo<FileChangesActiveView>(() =>
    props.activeView === "diff" && hasDiff() ? "diff" : "changes",
  )

  return (
    <section class="file-changes-panel" data-active-view={activeView()} aria-label={t("section.files")}>
      <div class="file-changes-body">
        <Show
          when={activeView() === "diff"}
          fallback={
            <div class="file-changes-view">
              <ChangesPanel active={props.active} hasSelectedTask />
            </div>
          }
        >
          <div class="file-changes-view file-changes-diff">
            <Show
              when={hasDiff()}
              fallback={
                <div class="file-editor-empty">
                  <Icon name="file-document" size="medium" />
                  <p>{t("diff.select_file")}</p>
                </div>
              }
            >
              <header class="file-changes-diff-header oc-section-heading">
                <span>{t("workspace.diff")}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  tone="neutral"
                  data-ui="file-changes-diff-close"
                  title={t("workspace.close")}
                  aria-label={t("workspace.close")}
                  onClick={props.onCloseDiff}
                >
                  <Icon name="close" />
                </Button>
              </header>
              <DiffPreviewPanel target={props.diffTarget} scopeKey={props.scopeKey} />
            </Show>
          </div>
        </Show>
      </div>
    </section>
  )
}

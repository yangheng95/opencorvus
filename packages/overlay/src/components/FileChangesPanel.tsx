import { t } from "../utils/i18n"
import { ChangesPanel } from "./ChangesPanel"

export interface FileChangesPanelProps {
  active: () => boolean
}

export function FileChangesPanel(props: FileChangesPanelProps) {
  return (
    <section class="file-changes-panel" aria-label={t("section.files")}>
      <div class="file-changes-body">
        <div class="file-changes-view">
          <ChangesPanel active={props.active} hasSelectedTask />
        </div>
      </div>
    </section>
  )
}

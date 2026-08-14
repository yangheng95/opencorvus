import { closeConfigDialog } from "../../services/config-dialog-control"
import { dialogStore } from "../../store/dialog"
import { Show } from "solid-js"
import { t } from "../../utils/i18n"
import { Icon } from "../ui/Icon"
import { Button } from "../ui/Button"

export function TitlebarNavigation() {
  return (
    <Show when={dialogStore.config.open}>
      <nav class="titlebar-navigation" aria-label={t("titlebar.settings_navigation_label")} data-no-drag="true">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          tone="neutral"
          data-ui="titlebar-navigation-back"
          title={t("titlebar.back_to_app")}
          aria-label={t("titlebar.back_to_app")}
          onClick={closeConfigDialog}
        >
          <Icon name="nav-back" />
        </Button>
      </nav>
    </Show>
  )
}

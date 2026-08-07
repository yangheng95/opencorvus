import { closeConfigDialog } from "../../services/config-dialog-control"
import { dialogStore } from "../../store/dialog"
import { t } from "../../utils/i18n"
import { Icon } from "../ui/Icon"
import { Button } from "../ui/Button"

export function TitlebarNavigation() {
  const canGoBack = () => dialogStore.config.open

  return (
    <nav class="titlebar-navigation" aria-label={t("titlebar.navigation_label")} data-no-drag="true">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        tone="neutral"
        data-ui="titlebar-navigation-back"
        title={t("titlebar.navigation_back")}
        aria-label={t("titlebar.navigation_back")}
        disabled={!canGoBack()}
        onClick={closeConfigDialog}
      >
        <Icon name="nav-back" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        tone="neutral"
        data-ui="titlebar-navigation-forward"
        title={t("titlebar.navigation_forward")}
        aria-label={t("titlebar.navigation_forward")}
        disabled
      >
        <Icon name="nav-forward" />
      </Button>
    </nav>
  )
}

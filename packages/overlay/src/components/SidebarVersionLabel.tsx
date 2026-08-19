import { createSignal } from "solid-js"
import { Button } from "./ui/Button"
import { DropdownMenu } from "./ui/DropdownMenu"
import { Icon } from "./ui/Icon"

import { OPENCORVUS_VERSION_LABEL } from "../utils/version"
import { openConfigDialog } from "../services/config-dialog-control"
import { canRestartManagedLocalServer, restartLocalServer } from "../services/connection"
import { formatErrorDetails, reportError } from "../services/diagnostics"
import { t } from "../utils/i18n"
import { PROJECT_URL } from "../utils/project-links"

export function SidebarVersionLabel() {
  const [restarting, setRestarting] = createSignal(false)

  async function restartBackend(): Promise<void> {
    if (restarting() || !canRestartManagedLocalServer()) return
    setRestarting(true)
    try {
      await restartLocalServer()
    } catch (error) {
      reportError({
        id: "sidebar:restart-backend",
        title: t("diagnostics.managed_server_restart_failed_title"),
        message: error instanceof Error ? error.message : String(error),
        details: formatErrorDetails(error),
      })
    } finally {
      setRestarting(false)
    }
  }

  return (
    <DropdownMenu.Root placement="top-start" gutter={6} fitViewport>
      <DropdownMenu.Trigger
        as={Button}
        type="button"
        variant="ghost"
        size="sm"
        tone="neutral"
        data-chrome="row-action"
        id="chatVersion"
        class="chat-version-copy"
        aria-label={t("sidebar.account_menu")}
        title={PROJECT_URL}
      >
        <span class="chat-version-avatar" aria-hidden="true">
          OC
        </span>
        <span class="chat-version-name">OpenCorvus</span>
        <span class="chat-version-plan">{OPENCORVUS_VERSION_LABEL}</span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content class="sidebar-account-menu" data-ui="sidebar-account-menu">
          <DropdownMenu.Item as="button" type="button" onSelect={() => openConfigDialog("general")}>
            <Icon name="config-general" size="medium" />
            <span>{t("config.title")}</span>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            as="button"
            type="button"
            data-ui="sidebar-restart-backend"
            disabled={!canRestartManagedLocalServer() || restarting()}
            onSelect={() => void restartBackend()}
          >
            <Icon name={restarting() ? "loading" : "refresh"} size="medium" />
            <span>{restarting() ? t("sidebar.restart_backend_running") : t("sidebar.restart_backend")}</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

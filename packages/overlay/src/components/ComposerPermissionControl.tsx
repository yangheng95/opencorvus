// The toolbar controls label visibility as its available width changes.
// The glyph and accessible name preserve the selected authorization mode.

import { createMemo, For } from "solid-js"
import type { JSX } from "solid-js"
import { DropdownMenu } from "./ui/DropdownMenu"
import { Icon, type IconName } from "./ui/Icon"
import { Button } from "./ui/Button"
import { t } from "../utils/i18n"
import { openConfigDialog } from "../services/config-dialog-control"
import { formatErrorDetails, reportError } from "../services/diagnostics"
import { currentPermissionMode, setPermissionMode, type PermissionMode } from "../services/permission-mode"

interface PermissionModeOption {
  value: PermissionMode
  label: string
  hint: string
  icon: IconName
}

const MODE_ICON: Record<PermissionMode, IconName> = {
  ask: "interaction-permission",
  full_access: "permission-full-access",
}

export interface ComposerPermissionControlProps {
  disabled: boolean
}

export function ComposerPermissionControl(props: ComposerPermissionControlProps): JSX.Element {
  const mode = createMemo(currentPermissionMode)
  const options = createMemo<PermissionModeOption[]>(() => [
    {
      value: "ask",
      label: t("permissions.mode_ask"),
      hint: t("chat.permission_ask_hint"),
      icon: MODE_ICON.ask,
    },
    {
      value: "full_access",
      label: t("permissions.mode_full_access"),
      hint: t("chat.permission_full_access_hint"),
      icon: MODE_ICON.full_access,
    },
  ])
  const activeLabel = createMemo(
    () => options().find((option) => option.value === mode())?.label ?? t("permissions.mode_full_access"),
  )

  function pickMode(value: string): void {
    if (value !== "ask" && value !== "full_access") return
    if (value === mode()) return
    setPermissionMode(value)
  }

  function openPermissionSettings(): void {
    void openConfigDialog("general").catch((error) => {
      reportError({
        id: "composer-permission-control:open-settings",
        title: t("permissions.title"),
        message: error instanceof Error ? error.message : String(error),
        details: formatErrorDetails(error),
      })
    })
  }

  return (
    <DropdownMenu.Root placement="top-start" gutter={6} fitViewport>
      <DropdownMenu.Trigger
        as={Button}
        variant="outline"
        size="sm"
        tone="neutral"
        type="button"
        class="composer-permission-trigger"
        data-ui="composer-permission-control"
        data-mode={mode()}
        disabled={props.disabled}
        title={t("chat.permission_mode_title", { mode: activeLabel() })}
        aria-label={t("chat.permission_mode_aria", { mode: activeLabel() })}
      >
        <Icon name={MODE_ICON[mode()]} size="compact" />
        <span class="composer-permission-label">{activeLabel()}</span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content class="composer-attachment-menu">
          <DropdownMenu.RadioGroup value={mode()} onChange={pickMode} aria-label={t("permissions.mode")}>
            <For each={options()}>
              {(option) => (
                <DropdownMenu.RadioItem
                  as="button"
                  type="button"
                  class="composer-attachment-menu-item composer-runtime-menu-item"
                  data-ui={`composer-permission-mode-${option.value}`}
                  value={option.value}
                  textValue={option.label}
                  title={option.hint}
                >
                  <Icon class="composer-runtime-menu-icon" name={option.icon} size="medium" />
                  <span>{option.label}</span>
                </DropdownMenu.RadioItem>
              )}
            </For>
          </DropdownMenu.RadioGroup>
          <DropdownMenu.Separator />
          <DropdownMenu.Item
            as="button"
            type="button"
            class="composer-attachment-menu-item"
            data-ui="composer-permission-open-settings"
            onSelect={openPermissionSettings}
          >
            <Icon name="config-general" size="medium" />
            <span>{t("chat.permission_settings_open")}</span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

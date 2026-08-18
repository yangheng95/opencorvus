// Authorization-mode icon control for the composer's bottom toolbar.
//
// The mode decides whether risk-bearing Tool/MCP calls stop for an explicit
// decision, so it belongs where the operator dispatches work rather than only
// behind the settings dialog.
//
// Geometry and row anatomy are the compose-meta row's, not this control's. The
// trigger joins the `--composer-pill-height` family and shares one button recipe
// with `.composer-reference-trigger`, the expert-squad selector it sits beside —
// so it is 24px with a compact glyph, not the 32px/medium of the attachment `+`
// and send button at the row's two ends. The menu rows are
// `.composer-runtime-menu-item`, the same recipe as the parallelism and
// unattended rows, down to carrying their hint on `title` so every row keeps one
// line and one control height.
//
// Mode reads from the glyph — closed keyhole for `ask`, open for `full_access` —
// never from color: every other control in this row rests at `--text-muted`, so
// a tinted icon would be the loudest mark in the composer chrome for what is,
// most of the time, the default state. Grants and history stay in the settings
// group, whose paragraphs would turn this menu into a wall of text.

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
        size="icon"
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

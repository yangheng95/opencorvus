/**
 * PermissionsSettingsGroup — Default tool permission actions for new tasks.
 *
 * Each tool permission can be: allow | ask | deny
 * Changes are saved immediately to the active project config, or to global
 * config before a project is selected.
 * The settingsStore is updated via init.ts on next config load.
 *
 * Rebuilt on 2026-05-26 onto the `.s-*` settings primitives — see
 * settings primitive contract.
 */
import { For } from "solid-js"
import { appStore, setAppStore } from "../../store/app"
import { t } from "../../utils/i18n"
import type { ToolPermAction } from "../../store/settings"
import { patchConfig, patchGlobalConfig } from "../../services/config"
import { activeProjectDirectory } from "../../services/project-directory"
import { formatErrorDetails, reportError } from "../../services/diagnostics"
import { SegmentedControl, type SegmentedControlOption } from "../ui/SegmentedControl"
import { SettingsGroup, SettingsRow } from "./layout"

// ── Permission key metadata ──
// i18n convention: labels/descriptions are thunks that call `t()` with a
// string literal, not stored-then-indirect-lookup. This keeps the static
// analyzer in check-panel-i18n.ts able to recognise every referenced key.

interface PermDef {
  key: keyof ToolPermsObj
  label: () => string
  desc: () => string
}

type ToolPermsObj = {
  websearch: ToolPermAction
  webfetch: ToolPermAction
  skill: ToolPermAction
  external_directory: ToolPermAction
  schedule: ToolPermAction
}

const PERM_ROWS: PermDef[] = [
  { key: "websearch", label: () => t("permissions.websearch"), desc: () => t("permissions.websearch_desc") },
  { key: "webfetch", label: () => t("permissions.webfetch"), desc: () => t("permissions.webfetch_desc") },
  { key: "skill", label: () => t("permissions.skill"), desc: () => t("permissions.skill_desc") },
  {
    key: "external_directory",
    label: () => t("permissions.external_directory"),
    desc: () => t("permissions.external_directory_desc"),
  },
  { key: "schedule", label: () => t("permissions.schedule"), desc: () => t("permissions.schedule_desc") },
]

function actionOptions(): SegmentedControlOption<ToolPermAction>[] {
  return [
    { value: "allow", label: t("permissions.action_allow"), tone: "ok" },
    { value: "ask", label: t("permissions.action_ask"), tone: "warn" },
    { value: "deny", label: t("permissions.action_deny"), tone: "bad" },
  ]
}

// ── Helpers ──

function toolPerms(): Partial<ToolPermsObj> {
  return (appStore.config as any)?.tool_permissions ?? {}
}

function currentAction(key: keyof ToolPermsObj): ToolPermAction {
  return toolPerms()[key] ?? "allow"
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

const permissionWriteTails = new Map<string, Promise<void>>()
const permissionWriteGenerations = new Map<string, number>()

function setPermission(key: keyof ToolPermsObj, action: ToolPermAction): void {
  const directory = activeProjectDirectory().trim()
  const ownerKey = `${directory || "global"}\u0000${key}`
  const generation = (permissionWriteGenerations.get(ownerKey) ?? 0) + 1
  permissionWriteGenerations.set(ownerKey, generation)
  const ownsResponse = () =>
    permissionWriteGenerations.get(ownerKey) === generation &&
    activeProjectDirectory().trim() === directory
  const previous = permissionWriteTails.get(ownerKey) ?? Promise.resolve()
  const write = previous.then(async () => {
    try {
      const diff = { tool_permissions: { [key]: action } }
      if (directory) {
        await patchConfig(diff, {
          directory,
          isCurrentDirectory: (candidate) => activeProjectDirectory().trim() === candidate,
          ownsResponse,
        })
      } else {
        const saved = await patchGlobalConfig(diff, { ownsResponse })
        if (ownsResponse()) setAppStore("config", saved)
      }
    } catch (error) {
      if (!ownsResponse()) return
      reportError({
        id: `permissions:${key}`,
        title: t("permissions.title"),
        message: errorMessage(error),
        details: formatErrorDetails(error),
      })
    }
  })
  permissionWriteTails.set(ownerKey, write)
  void write.finally(() => {
    if (permissionWriteTails.get(ownerKey) !== write) return
    permissionWriteTails.delete(ownerKey)
    if (permissionWriteGenerations.get(ownerKey) === generation) permissionWriteGenerations.delete(ownerKey)
  })
}

// ── General settings group ──

export function PermissionsSettingsGroup() {
  return (
    <SettingsGroup
      class="permissions-settings-group"
      title={t("permissions.title")}
      description={t("permissions.intro")}
    >
      <For each={PERM_ROWS}>
        {(row) => (
          <SettingsRow
            align="center"
            interactive
            title={row.label()}
            desc={row.desc()}
            actions={
              <SegmentedControl
                ariaLabel={row.label()}
                size="md"
                options={actionOptions()}
                value={currentAction(row.key)}
                onChange={(next) => setPermission(row.key, next)}
              />
            }
          />
        )}
      </For>
    </SettingsGroup>
  )
}

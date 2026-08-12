import { createResource, For, Show } from "solid-js"
import { appStore, setAppStore } from "../../store/app"
import { t } from "../../utils/i18n"
import { patchConfig, patchGlobalConfig } from "../../services/config"
import { activeProjectDirectory } from "../../services/project-directory"
import { formatErrorDetails, reportError } from "../../services/diagnostics"
import { apiJson } from "../../services/api"
import { directoryScopedPath } from "../../services/task-path"
import { Button } from "../ui/Button"
import { SegmentedControl, type SegmentedControlOption } from "../ui/SegmentedControl"
import { SettingsGroup, SettingsRow } from "./layout"

type PermissionMode = "ask" | "full_access"

type PermissionLedgerEvent = {
  id: string
  event_type: string
  summary: string
  decision_scope?: string | null
  actor_id?: string | null
  time_created: number
}

function modeOptions(): SegmentedControlOption<PermissionMode>[] {
  return [
    { value: "ask", label: t("permissions.mode_ask"), tone: "warn" },
    { value: "full_access", label: t("permissions.mode_full_access"), tone: "bad" },
  ]
}

function currentMode(): PermissionMode {
  return (appStore.config as { permission_mode?: PermissionMode } | undefined)?.permission_mode === "ask"
    ? "ask"
    : "full_access"
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

let permissionWriteTail = Promise.resolve()
let permissionWriteGeneration = 0

function setPermissionMode(mode: PermissionMode): void {
  const directory = activeProjectDirectory().trim()
  const generation = ++permissionWriteGeneration
  const ownsResponse = () => permissionWriteGeneration === generation && activeProjectDirectory().trim() === directory
  permissionWriteTail = permissionWriteTail.then(async () => {
    try {
      const diff = { permission_mode: mode }
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
        id: "permissions:mode",
        title: t("permissions.title"),
        message: errorMessage(error),
        details: formatErrorDetails(error),
      })
    }
  })
}

async function permissionRecords(directory: string): Promise<{
  grants: PermissionLedgerEvent[]
  history: PermissionLedgerEvent[]
}> {
  const [grants, history] = await Promise.all([
    apiJson(directoryScopedPath("permission/grants", directory, "permission grants")),
    apiJson(directoryScopedPath("permission/history", directory, "permission history")),
  ])
  return {
    grants: Array.isArray(grants) ? (grants as PermissionLedgerEvent[]) : [],
    history: Array.isArray(history) ? (history as PermissionLedgerEvent[]).slice(0, 8) : [],
  }
}

function eventDescription(event: PermissionLedgerEvent): string {
  const time = new Date(event.time_created).toLocaleString()
  const scope = event.decision_scope ? ` · ${event.decision_scope}` : ""
  return `${event.event_type}${scope} · ${time}`
}

export function PermissionsSettingsGroup() {
  const [records, { refetch }] = createResource(
    () => activeProjectDirectory().trim(),
    (directory) => permissionRecords(directory),
  )

  const revoke = async (grantID: string) => {
    const directory = activeProjectDirectory().trim()
    if (!directory) return
    try {
      await apiJson(directoryScopedPath(`permission/grants/${encodeURIComponent(grantID)}/revoke`, directory), {
        method: "POST",
      })
      await refetch()
    } catch (error) {
      reportError({
        id: `permissions:revoke:${grantID}`,
        title: t("permissions.revoke"),
        message: errorMessage(error),
        details: formatErrorDetails(error),
      })
    }
  }

  return (
    <SettingsGroup
      class="permissions-settings-group"
      title={t("permissions.title")}
      description={t("permissions.intro")}
    >
      <SettingsRow
        align="center"
        interactive
        title={t("permissions.mode")}
        desc={currentMode() === "full_access" ? t("permissions.full_access_warning") : t("permissions.ask_desc")}
        actions={
          <SegmentedControl
            ariaLabel={t("permissions.mode")}
            size="md"
            options={modeOptions()}
            value={currentMode()}
            onChange={setPermissionMode}
          />
        }
      />
      <Show when={activeProjectDirectory().trim()}>
        <SettingsRow title={t("permissions.active_grants")} desc={t("permissions.active_grants_desc")} />
        <Show when={!records.loading && (records()?.grants.length ?? 0) === 0}>
          <SettingsRow desc={t("permissions.no_active_grants")} />
        </Show>
        <For each={records()?.grants ?? []}>
          {(grant) => (
            <SettingsRow
              title={grant.summary}
              desc={eventDescription(grant)}
              actions={
                <Button type="button" variant="ghost" size="sm" tone="danger" onClick={() => void revoke(grant.id)}>
                  {t("permissions.revoke")}
                </Button>
              }
            />
          )}
        </For>
        <SettingsRow title={t("permissions.recent_history")} desc={t("permissions.recent_history_desc")} />
        <For each={records()?.history ?? []}>
          {(event) => <SettingsRow title={event.summary} desc={eventDescription(event)} />}
        </For>
      </Show>
    </SettingsGroup>
  )
}

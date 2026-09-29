import { createEffect, createMemo, createResource, createSignal, For, Show } from "solid-js"
import { localeTag, t } from "../../utils/i18n"
import { activeProjectDirectory } from "../../services/project-directory"
import { apiJson } from "../../services/api"
import { currentPermissionMode, setPermissionMode, type PermissionMode } from "../../services/permission-mode"
import { directoryScopedPath } from "../../services/task-path"
import { Badge, type BadgeTone } from "../ui/Badge"
import { Button } from "../ui/Button"
import { Disclosure } from "../ui/Disclosure"
import { Feedback } from "../ui/Feedback"
import { SegmentedControl, type SegmentedControlOption } from "../ui/SegmentedControl"
import { SettingsGroup, SettingsRow } from "./layout"

// The requested row owns identity; subsequent ledger rows are nullable deltas.
type PermissionLedgerEvent = {
  id: string
  request_id: string
  event_type: string
  summary: string | null
  tool_name: string | null
  effect_class: string | null
  provider_id: string | null
  session_id: string | null
  task_id: string | null
  mode: PermissionMode | null
  scope: Record<string, unknown> | null
  decision_scope: string | null
  source_event_id: string | null
  actor_id: string | null
  reason: string | null
  metadata?: Record<string, unknown> | null
  time_created: number
}

function modeOptions(): SegmentedControlOption<PermissionMode>[] {
  return [
    { value: "ask", label: t("permissions.mode_ask"), tone: "warn" },
    { value: "full_access", label: t("permissions.mode_full_access"), tone: "bad" },
  ]
}

const eventLabels: Record<string, string> = {
  requested: "permissions.event.requested",
  allowed_once: "permissions.event.allowed_once",
  grant_created: "permissions.event.grant_created",
  grant_used: "permissions.event.grant_used",
  denied: "permissions.event.denied",
  expired: "permissions.event.expired",
  revoked: "permissions.event.revoked",
  cancelled: "permissions.event.cancelled",
  stale: "permissions.event.stale",
  execution_started: "permissions.event.execution_started",
  mcp_task_created: "permissions.event.mcp_task_created",
  mcp_task_status: "permissions.event.mcp_task_status",
  execution_succeeded: "permissions.event.execution_succeeded",
  execution_failed: "permissions.event.execution_failed",
  outcome_unknown: "permissions.event.outcome_unknown",
  execution_reconciled: "permissions.event.execution_reconciled",
}
const effectLabels: Record<string, string> = {
  read_local: "permissions.effect.read_local",
  write_local: "permissions.effect.write_local",
  process: "permissions.effect.process",
  network_read: "permissions.effect.network_read",
  external_effect: "permissions.effect.external_effect",
  credential_release: "permissions.effect.credential_release",
  destructive: "permissions.effect.destructive",
}
function eventLabel(event: PermissionLedgerEvent): string {
  if (event.event_type === "allowed_once" && event.actor_id === "full-access-policy")
    return t("permissions.auto_allowed")
  return eventLabels[event.event_type] ? t(eventLabels[event.event_type]) : event.event_type
}
function effectLabel(effect: string | null | undefined): string {
  return effect && effectLabels[effect] ? t(effectLabels[effect]) : (effect ?? "")
}
function scopeLabel(scope: string | null): string {
  if (scope === "task") return t("permissions.scope.task")
  if (scope === "project") return t("permissions.scope.project")
  if (scope === "invocation") return t("permissions.scope.invocation")
  return scope ?? ""
}
function formatTime(time: number): string {
  return new Date(time).toLocaleString(localeTag(), { dateStyle: "medium", timeStyle: "short" })
}
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function PermissionScope(props: { scope: Record<string, unknown> | null | undefined }) {
  const resource = () => props.scope?.resource as Record<string, unknown> | undefined
  const paths = () =>
    Array.isArray(resource()?.paths)
      ? (resource()!.paths as unknown[]).filter((value): value is string => typeof value === "string")
      : []
  const endpoint = () => resource()?.endpoint as Record<string, unknown> | undefined
  return (
    <>
      <For each={paths()}>{(path) => <p class="permission-scope">{path}</p>}</For>
      <Show when={typeof endpoint()?.hostname === "string"}>
        <p class="permission-scope">
          {String(endpoint()?.scheme)}://{String(endpoint()?.hostname)}:{String(endpoint()?.port)}
          {String(endpoint()?.pathname)}
        </p>
      </Show>
      <Disclosure.Root>
        <Disclosure.Trigger>{t("permissions.technical_details")}</Disclosure.Trigger>
        <Disclosure.Content>
          <pre class="permission-scope">{JSON.stringify(props.scope, null, 2)}</pre>
        </Disclosure.Content>
      </Disclosure.Root>
    </>
  )
}
async function permissionRecords(directory: string) {
  try {
    const [grants, history] = await Promise.all([
      apiJson<PermissionLedgerEvent[]>(directoryScopedPath("permission/grants", directory, "permission grants")),
      apiJson<PermissionLedgerEvent[]>(directoryScopedPath("permission/history", directory, "permission history")),
    ])
    return { directory, grants, history, error: "" }
  } catch (error) {
    return {
      directory,
      grants: [] as PermissionLedgerEvent[],
      history: [] as PermissionLedgerEvent[],
      error: errorMessage(error),
    }
  }
}
function operationStatus(events: PermissionLedgerEvent[]): { label: string; tone: BadgeTone } {
  // History is newest first. Retirement closes the request, not its execution outcome.
  const execution = events.find((event) =>
    [
      "execution_started",
      "execution_succeeded",
      "execution_failed",
      "outcome_unknown",
      "execution_reconciled",
    ].includes(event.event_type),
  )
  if (execution) {
    const outcome = execution.event_type === "execution_reconciled" ? execution.metadata?.outcome : execution.event_type
    if (outcome === "execution_succeeded") return { label: t("permissions.event.execution_succeeded"), tone: "ok" }
    if (outcome === "execution_failed") return { label: t("permissions.event.execution_failed"), tone: "bad" }
    return { label: eventLabel(execution), tone: outcome === "outcome_unknown" ? "warn" : "accent" }
  }
  const event = events.find((entry) => entry.event_type !== "requested") ?? events[0]
  return { label: eventLabel(event), tone: event.event_type === "denied" ? "bad" : "muted" }
}

export function PermissionsSettingsGroup() {
  const directory = () => activeProjectDirectory().trim()
  const [recordsOpen, setRecordsOpen] = createSignal(false)
  const [visibleCount, setVisibleCount] = createSignal(6)
  const [revoking, setRevoking] = createSignal("")
  const [revokeError, setRevokeError] = createSignal("")
  const [records, { refetch }] = createResource(() => (recordsOpen() && directory()) || false, permissionRecords)
  createEffect(() => {
    directory()
    setVisibleCount(6)
    setRevokeError("")
  })
  const currentRecords = () => (records()?.directory === directory() ? records() : undefined)
  const operations = createMemo(() => {
    const grouped = new Map<string, PermissionLedgerEvent[]>()
    for (const event of currentRecords()?.history ?? []) {
      const events = grouped.get(event.request_id)
      if (events) events.push(event)
      else grouped.set(event.request_id, [event])
    }
    return [...grouped.entries()].map(([id, events]) => ({
      id,
      events,
      owner: events.find((event) => event.event_type === "requested"),
    }))
  })
  const owners = createMemo(() => new Map(operations().map((operation) => [operation.id, operation.owner])))
  const title = (owner: PermissionLedgerEvent | undefined) =>
    owner?.tool_name || owner?.summary || t("permissions.unknown_operation")
  const revoke = async (grantID: string) => {
    const grantDirectory = directory()
    if (!grantDirectory || revoking()) return
    setRevoking(grantID)
    setRevokeError("")
    try {
      await apiJson(directoryScopedPath(`permission/grants/${encodeURIComponent(grantID)}/revoke`, grantDirectory), {
        method: "POST",
      })
      if (directory() === grantDirectory) await refetch()
    } catch (error) {
      if (directory() === grantDirectory) setRevokeError(errorMessage(error))
    } finally {
      setRevoking("")
    }
  }

  return (
    <SettingsGroup class="permissions-settings-group" title={t("permissions.title")}>
      <SettingsRow
        align="center"
        interactive
        title={t("permissions.mode")}
        desc={
          currentPermissionMode() === "full_access" ? t("permissions.full_access_warning") : t("permissions.ask_desc")
        }
        meta={t("permissions.intro")}
        actions={
          <SegmentedControl
            ariaLabel={t("permissions.mode")}
            size="md"
            options={modeOptions()}
            value={currentPermissionMode()}
            onChange={setPermissionMode}
          />
        }
      />
      <Show when={directory()} fallback={<SettingsRow desc={t("permissions.select_project")} />}>
        <Disclosure.Root class="permission-records" open={recordsOpen()} onOpenChange={setRecordsOpen}>
          <Disclosure.Trigger indicatorPosition="end" class="permission-records-trigger">
            <span class="permission-record-copy">
              <strong>{t("permissions.records")}</strong>
              <span>{t("permissions.records_hint")}</span>
            </span>
          </Disclosure.Trigger>
          <Disclosure.Content class="permission-records-body">
            <div class="permission-records-toolbar">
              <span class="permission-project" title={directory()}>
                {directory()}
              </span>
              <Button
                size="sm"
                variant="ghost"
                tone="neutral"
                disabled={records.loading}
                onClick={() => void refetch()}
              >
                {t("common.refresh")}
              </Button>
            </div>
            <Show when={records.loading}>
              <Feedback>{t("permissions.loading")}</Feedback>
            </Show>
            <Show when={currentRecords()?.error}>
              <Feedback tone="error" details={currentRecords()?.error}>
                {t("permissions.load_failed")}
              </Feedback>
            </Show>
            <Show when={!records.loading && !currentRecords()?.error && currentRecords()}>
              <Disclosure.Root class="permission-grants">
                <Disclosure.Trigger indicatorPosition="end">
                  <span>{t("permissions.active_grants")}</span>
                  <Badge size="sm">{currentRecords()?.grants.length ?? 0}</Badge>
                </Disclosure.Trigger>
                <Disclosure.Content>
                  <p class="permission-record-hint">{t("permissions.active_grants_desc")}</p>
                  <Show
                    when={currentRecords()?.grants.length}
                    fallback={<p class="permission-record-hint">{t("permissions.no_active_grants")}</p>}
                  >
                    <For each={currentRecords()?.grants}>
                      {(grant) => (
                        <SettingsRow
                          title={title(owners().get(grant.request_id))}
                          desc={[
                            effectLabel(owners().get(grant.request_id)?.effect_class),
                            scopeLabel(grant.decision_scope),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                          meta={formatTime(grant.time_created)}
                          actions={
                            <Button
                              variant="ghost"
                              size="sm"
                              tone="danger"
                              disabled={!!revoking()}
                              onClick={() => void revoke(grant.id)}
                            >
                              {revoking() === grant.id ? t("permissions.revoking") : t("permissions.revoke")}
                            </Button>
                          }
                        >
                          <Disclosure.Root>
                            <Disclosure.Trigger>{t("permissions.exact_scope")}</Disclosure.Trigger>
                            <Disclosure.Content>
                              <PermissionScope scope={owners().get(grant.request_id)?.scope} />
                            </Disclosure.Content>
                          </Disclosure.Root>
                        </SettingsRow>
                      )}
                    </For>
                  </Show>
                  <Show when={revokeError()}>
                    <Feedback tone="error">{revokeError()}</Feedback>
                  </Show>
                </Disclosure.Content>
              </Disclosure.Root>
              <div class="permission-history-heading">
                <strong>{t("permissions.recent_history")}</strong>
                <span>{t("permissions.operation_count", { count: operations().length })}</span>
              </div>
              <p class="permission-record-hint">{t("permissions.recent_history_desc")}</p>
              <Show when={operations().length} fallback={<Feedback>{t("permissions.no_history")}</Feedback>}>
                <For each={operations().slice(0, visibleCount())}>
                  {(operation) => {
                    const status = () => operationStatus(operation.events)
                    const approval = () => {
                      const retiredGrant = operation.events.find(
                        (event) => event.event_type === "revoked" || event.event_type === "expired",
                      )
                      if (retiredGrant) return eventLabel(retiredGrant)
                      return operation.owner?.mode === "full_access"
                        ? t("permissions.mode_full_access")
                        : scopeLabel(
                            operation.events.find((event) =>
                              ["allowed_once", "grant_created", "grant_used", "denied"].includes(event.event_type),
                            )?.decision_scope ?? null,
                          )
                    }
                    return (
                      <Disclosure.Root class="permission-operation">
                        <Disclosure.Trigger indicatorPosition="end" class="permission-operation-trigger">
                          <span class="permission-record-copy">
                            <strong>{title(operation.owner)}</strong>
                            <span>
                              {[effectLabel(operation.owner?.effect_class), approval()].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                          <span class="permission-record-result">
                            <Badge size="sm" tone={status().tone}>
                              {status().label}
                            </Badge>
                            <time
                              dateTime={new Date(
                                operation.owner?.time_created ?? operation.events[0].time_created,
                              ).toISOString()}
                            >
                              {formatTime(operation.owner?.time_created ?? operation.events[0].time_created)}
                            </time>
                          </span>
                        </Disclosure.Trigger>
                        <Disclosure.Content class="permission-operation-details">
                          <Show when={operation.owner?.summary}>
                            <p class="permission-record-hint">{operation.owner?.summary}</p>
                          </Show>
                          <ol class="permission-timeline">
                            <For each={[...operation.events].reverse()}>
                              {(event) => (
                                <li>
                                  <div>
                                    <span>{eventLabel(event)}</span>
                                    <time title={new Date(event.time_created).toISOString()}>
                                      {new Date(event.time_created).toLocaleTimeString(localeTag())}
                                    </time>
                                  </div>
                                  <Show when={event.decision_scope}>
                                    <small>{scopeLabel(event.decision_scope)}</small>
                                  </Show>
                                  <Show when={event.reason}>
                                    <p>{event.reason}</p>
                                  </Show>
                                </li>
                              )}
                            </For>
                          </ol>
                          <Disclosure.Root>
                            <Disclosure.Trigger>{t("permissions.technical_details")}</Disclosure.Trigger>
                            <Disclosure.Content>
                              <dl class="permission-facts">
                                <dt>{t("permissions.request_id")}</dt>
                                <dd>{operation.id}</dd>
                                <dt>{t("permissions.provider")}</dt>
                                <dd>{operation.owner?.provider_id}</dd>
                                <dt>{t("permissions.session")}</dt>
                                <dd>{operation.owner?.task_id || operation.owner?.session_id}</dd>
                              </dl>
                              <pre class="permission-scope">{JSON.stringify(operation.owner?.scope, null, 2)}</pre>
                            </Disclosure.Content>
                          </Disclosure.Root>
                        </Disclosure.Content>
                      </Disclosure.Root>
                    )
                  }}
                </For>
                <Show when={operations().length > visibleCount()}>
                  <Button
                    size="sm"
                    variant="ghost"
                    tone="neutral"
                    onClick={() => setVisibleCount((count) => count + 6)}
                  >
                    {t("permissions.show_more", { count: operations().length - visibleCount() })}
                  </Button>
                </Show>
              </Show>
            </Show>
          </Disclosure.Content>
        </Disclosure.Root>
      </Show>
    </SettingsGroup>
  )
}

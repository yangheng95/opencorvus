import { createEffect, createMemo, createSignal, For, on, onCleanup, Show } from "solid-js"
import { localeTag, t } from "../../utils/i18n"
import { activeProjectDirectory } from "../../services/project-directory"
import { apiJson, captureApiAuthority, isApiAuthorityCurrent, type ApiAuthority } from "../../services/api"
import { loadConfigInfo } from "../../services/config-load"
import { formatErrorDetails, reportError } from "../../services/diagnostics"
import { appStore } from "../../store/app"
import { boardStore } from "../../store/board"
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
  grant_decision_indexed: "permissions.event.grant_decision_indexed",
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
type PermissionRecordScope = { directory: string; authority: ApiAuthority }
type PermissionRecords = { grants: PermissionLedgerEvent[]; history: PermissionLedgerEvent[] }
type PermissionRecordFailure = { error: unknown }
type PermissionRecordRead = { scope: PermissionRecordScope } & (
  | { kind: "loading"; accepted?: PermissionRecords; failure?: PermissionRecordFailure }
  | { kind: "failed"; accepted?: PermissionRecords; failure: PermissionRecordFailure }
  | { kind: "ready"; accepted: PermissionRecords }
)

async function permissionRecords({ directory, authority }: PermissionRecordScope): Promise<PermissionRecords> {
  const [grants, history] = await Promise.all([
    apiJson<PermissionLedgerEvent[]>(directoryScopedPath("permission/grants", directory, "permission grants"), { authority }),
    apiJson<PermissionLedgerEvent[]>(directoryScopedPath("permission/history", directory, "permission history"), { authority }),
  ])
  return { grants, history }
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
  const event =
    events.find((entry) => entry.event_type !== "requested" && entry.event_type !== "grant_decision_indexed") ??
    events.find((entry) => entry.event_type === "requested")
  if (!event) throw new Error("Permission operation has no business or requested history")
  return { label: eventLabel(event), tone: event.event_type === "denied" ? "bad" : "muted" }
}

export function PermissionsSettingsGroup() {
  const mode = createMemo(currentPermissionMode)
  const directory = () => activeProjectDirectory().trim()
  const modeScope = createMemo(() => appStore.connected
    ? { directory: directory(), authority: captureApiAuthority(), epoch: boardStore.selectEpoch }
    : undefined)
  const modeIssue = () => appStore.configLoadIssues.find((issue) => issue.resource === "config")
  const [modeReload, setModeReload] = createSignal<{
    scope: NonNullable<ReturnType<typeof modeScope>>
    button: HTMLButtonElement
    focused: boolean
  }>()
  const refreshingMode = () => {
    const reload = modeReload()
    return reload !== undefined && reload.scope === modeScope()
  }
  let modeControl: HTMLDivElement | undefined
  let modeMounted = true
  onCleanup(() => { modeMounted = false })

  async function refreshMode(button: HTMLButtonElement): Promise<void> {
    const scope = modeScope()
    if (!scope || mode() || refreshingMode()) return
    const reload = { scope, button, focused: document.activeElement === button }
    const owns = () =>
      modeMounted && modeReload() === reload && modeScope() === scope && isApiAuthorityCurrent(scope.authority)
    setModeReload(reload)
    try {
      await loadConfigInfo(undefined, { directory: scope.directory, authority: scope.authority })
      if (!owns() || !reload.focused || !mode() || !modeControl?.isConnected) return
      if (document.activeElement !== button && document.activeElement !== document.body) return
      modeControl.querySelector<HTMLInputElement>('input[type="radio"]:checked')?.focus()
    } catch (error) {
      if (owns()) {
        reportError({
          id: "permissions:reload",
          title: t("permissions.title"),
          message: errorMessage(error),
          details: formatErrorDetails(error),
        })
      }
    } finally {
      if (modeReload() === reload) setModeReload(undefined)
    }
  }

  const [recordsOpen, setRecordsOpen] = createSignal(false)
  const [visibleCount, setVisibleCount] = createSignal(6)
  const [revoking, setRevoking] = createSignal("")
  const [revokeError, setRevokeError] = createSignal("")
  const recordsScope = createMemo<PermissionRecordScope | undefined>(() => {
    const path = directory()
    return path && appStore.connected ? { directory: path, authority: captureApiAuthority() } : undefined
  })
  const [recordRead, setRecordRead] = createSignal<PermissionRecordRead>()
  let recordsRefreshButton: HTMLButtonElement | undefined
  let recordFeedback: HTMLDivElement | undefined
  let readSequence = 0
  onCleanup(() => readSequence++)

  const currentRecordRead = () => {
    const read = recordRead()
    return read?.scope === recordsScope() ? read : undefined
  }
  const currentRecords = () => currentRecordRead()?.accepted
  const recordsBusy = () => currentRecordRead()?.kind === "loading"
  const recordFailure = () => {
    const read = currentRecordRead()
    return read?.kind === "failed" || read?.kind === "loading" ? read.failure : undefined
  }

  async function refreshRecords(scope = recordsScope(), retireAccepted = false): Promise<void> {
    if (!scope || scope !== recordsScope() || (recordsBusy() && !retireAccepted)) return
    const sequence = ++readSequence
    const owns = () =>
      sequence === readSequence && recordsScope() === scope && isApiAuthorityCurrent(scope.authority)
    const accepted = retireAccepted ? undefined : currentRecords()
    const failure = retireAccepted ? undefined : recordFailure()
    setRecordRead({ kind: "loading", scope, accepted, failure })
    try {
      const records = await permissionRecords(scope)
      if (!owns()) return
      if (recordsOpen() && recordsRefreshButton?.isConnected && recordFeedback?.contains(document.activeElement)) {
        recordsRefreshButton.focus({ preventScroll: true })
      }
      setRecordRead({ kind: "ready", scope, accepted: records })
    } catch (error) {
      if (owns()) setRecordRead({ kind: "failed", scope, accepted, failure: { error } })
    }
  }

  createEffect(on(() => recordsOpen() ? recordsScope() : undefined, (scope) => {
    if (scope) void refreshRecords(scope)
  }))
  createEffect(() => {
    recordsScope()
    setVisibleCount(6)
    setRevokeError("")
  })
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
    const scope = recordsScope()
    if (!scope || revoking() || currentRecordRead()?.kind !== "ready") return
    setRevoking(grantID)
    setRevokeError("")
    try {
      await apiJson(directoryScopedPath(`permission/grants/${encodeURIComponent(grantID)}/revoke`, scope.directory), {
        method: "POST",
        authority: scope.authority,
      })
      if (recordsScope() === scope) await refreshRecords(scope, true)
    } catch (error) {
      if (recordsScope() === scope) setRevokeError(errorMessage(error))
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
          mode() === undefined
            ? t("permissions.mode_unavailable_desc")
            : mode() === "full_access"
              ? t("permissions.full_access_warning")
              : t("permissions.ask_desc")
        }
        meta={t("permissions.intro")}
        actions={
          <Show
            when={mode()}
            keyed
            fallback={
              <Button
                size="sm"
                variant="outline"
                tone="neutral"
                disabled={!modeScope()}
                aria-disabled={refreshingMode() || undefined}
                aria-busy={refreshingMode() || undefined}
                onBlur={(event) => {
                  const reload = modeReload()
                  if (!mode() && reload?.button === event.currentTarget) reload.focused = false
                }}
                onClick={(event) => void refreshMode(event.currentTarget)}
              >
                {t(refreshingMode() ? modeIssue() ? "common.retrying" : "common.loading" : "permissions.mode_reload")}
              </Button>
            }
          >
            {(confirmedMode) => (
              <div ref={modeControl}>
                <SegmentedControl
                  ariaLabel={t("permissions.mode")}
                  size="md"
                  options={modeOptions()}
                  value={confirmedMode}
                  onChange={setPermissionMode}
                />
              </div>
            )}
          </Show>
        }
      />
      <Show when={modeIssue()}>
        {(issue) => (
          <Feedback tone="error" details={formatErrorDetails(issue().cause)}>
            {t("permissions.mode_configuration_failed")}
          </Feedback>
        )}
      </Show>
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
                disabled={!recordsScope()}
                aria-disabled={recordsBusy() || undefined}
                aria-busy={recordsBusy() || undefined}
                ref={recordsRefreshButton}
                onClick={() => void refreshRecords()}
              >
                {t(recordsBusy()
                  ? recordFailure() ? "common.retrying" : "common.loading"
                  : recordFailure() ? "common.retry" : "common.refresh")}
              </Button>
            </div>
            <Show when={recordsBusy() && !recordFailure()}>
              <Feedback>{t(currentRecords() ? "permissions.refreshing_records" : "permissions.loading")}</Feedback>
            </Show>
            <Show when={recordFailure()}>
              {(failure) => (
                <Feedback ref={recordFeedback} tone="error" details={formatErrorDetails(failure().error)}>
                  {t(currentRecords() ? "permissions.refresh_records_failed" : "permissions.load_failed")}
                </Feedback>
              )}
            </Show>
            <Show when={currentRecords()}>
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
                              disabled={!!revoking() || currentRecordRead()?.kind !== "ready"}
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
                                <For each={[...operation.events].reverse()}>
                                  {(event) => (
                                    <Show when={event.reason}>
                                      <dt>
                                        {t("permissions.recorded_reason")} · {eventLabel(event)}
                                      </dt>
                                      <dd title={event.id}>{event.reason}</dd>
                                    </Show>
                                  )}
                                </For>
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

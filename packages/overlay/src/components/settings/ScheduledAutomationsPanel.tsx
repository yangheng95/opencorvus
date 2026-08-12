import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js"
import { activeSessionID, rootTaskSessionID } from "../../store/board"
import {
  automationTimeZoneOptions,
  buildAutomationRecurrence,
  browserTimeZone,
  parseAutomationRecurrence,
  recurrenceSummary,
  type AutomationRecurrencePreset,
} from "../../services/automation-recurrence"
import {
  createAutomation,
  deleteAutomation,
  listAutomationRuns,
  listAutomations,
  pauseAutomation,
  resolveAutomationProjectID,
  resumeAutomation,
  runAutomationNow,
  updateAutomation,
  type AutomationExecutionMode,
  type AutomationScope,
  type AutomationTarget,
  type AutomationRunSession,
  type AutomationRunView,
  type AutomationView,
} from "../../services/automations"
import { loadDiscoveredProjects, type DiscoveredProject } from "../../services/workspace"
import { loadProviderInfo } from "../../services/config-load"
import { connectedModelOptions, type ConnectedModelOption } from "../../services/llm"
import { closeConfigDialog } from "../../services/config-dialog-control"
import { t } from "../../utils/i18n"
import { ArmedConfirmButton } from "../ui/ArmedConfirmButton"
import { AutoGrowTextarea } from "../ui/AutoGrowTextarea"
import { Badge, type BadgeTone } from "../ui/Badge"
import { Button } from "../ui/Button"
import { Icon } from "../ui/Icon"
import { ListboxItem, ListboxRoot } from "../ui/Listbox"
import { ComboboxControl } from "../ui/ComboboxControl"
import { SearchField } from "../ui/SearchField"
import { SegmentedControl } from "../ui/SegmentedControl"
import { SelectControl } from "../ui/SelectControl"
import { TextField } from "../ui/TextField"
import { SettingsEmpty, SettingsGroup, SettingsPanel, SettingsRow, SettingsState, SettingsSurface } from "./layout"

type SelectOption<T extends string> = { value: T; label: string }
type AutomationError = { message: string; retry?: () => void; source?: "list-load" }
type AutomationModelOption = ConnectedModelOption & { defaultModel?: boolean }
type AutomationFilter = "all" | "active" | "paused"
type AutomationScopeFilter = "all" | AutomationScope
type AutomationMutationOwner = { kind: "save"; id: string } | { kind: "action"; id: string }
type AutomationRunState = {
  automationID: string
  status: "idle" | "loading" | "ready" | "error"
  items: AutomationRunView[]
  error?: string
}

interface AutomationSuggestion {
  icon: "notifications" | "file-document" | "inspect"
  name: string
  schedule: string
  description: string
  preset: AutomationRecurrencePreset
  time: string
  prompt: string
}

const DUE_REFRESH_GRACE_MS = 1_500
const DUE_REFRESH_RETRY_MS = 1_000
const MAX_BROWSER_TIMER_DELAY_MS = 2_147_483_647
function automationSuggestions(): AutomationSuggestion[] {
  return [
    {
      icon: "notifications",
      name: t("automations.suggestion.daily_brief.name"),
      schedule: t("automations.suggestion.daily_brief.schedule"),
      description: t("automations.suggestion.daily_brief.description"),
      preset: "weekdays",
      time: "08:00",
      prompt: t("automations.suggestion.daily_brief.prompt"),
    },
    {
      icon: "file-document",
      name: t("automations.suggestion.weekly_review.name"),
      schedule: t("automations.suggestion.weekly_review.schedule"),
      description: t("automations.suggestion.weekly_review.description"),
      preset: "weekly",
      time: "16:00",
      prompt: t("automations.suggestion.weekly_review.prompt"),
    },
    {
      icon: "inspect",
      name: t("automations.suggestion.follow_up.name"),
      schedule: t("automations.suggestion.follow_up.schedule"),
      description: t("automations.suggestion.follow_up.description"),
      preset: "weekdays",
      time: "09:00",
      prompt: t("automations.suggestion.follow_up.prompt"),
    },
  ]
}

export interface ScheduledAutomationsPanelProps {
  onOpenSession: (session: AutomationRunSession) => void | Promise<void>
}

function scopeOptions(): SelectOption<AutomationScope>[] {
  return [
    { value: "session", label: t("automations.scope.session") },
    { value: "project", label: t("automations.scope.project") },
    { value: "global", label: t("automations.scope.global") },
  ]
}

function executionOptions(): SelectOption<AutomationExecutionMode>[] {
  return [
    { value: "local", label: t("automations.execution.local") },
    { value: "worktree", label: t("automations.execution.worktree") },
  ]
}

function recurrenceOptions(): SelectOption<AutomationRecurrencePreset>[] {
  return [
    { value: "daily", label: t("automations.recurrence.daily") },
    { value: "weekdays", label: t("automations.recurrence.weekdays") },
    { value: "weekly", label: t("automations.recurrence.weekly") },
    { value: "custom", label: t("automations.recurrence.custom") },
  ]
}

function reasoningLabel(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : t("automations.reasoning_default")
}

function selectOption<T extends string>(options: SelectOption<T>[], value: T): SelectOption<T> {
  return options.find((option) => option.value === value) ?? options[0]
}

function formatTimestamp(value: number | null): string {
  if (!value) return t("automations.never")
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function statusTone(status: AutomationView["status"]): BadgeTone {
  return status === "active" ? "ok" : "muted"
}

function outcomeTone(outcome: AutomationRunView["outcome"]): BadgeTone {
  if (outcome === "succeeded") return "ok"
  if (outcome === "failed") return "bad"
  return "accent"
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export default function ScheduledAutomationsPanel(props: ScheduledAutomationsPanelProps) {
  const [automations, setAutomations] = createSignal<AutomationView[]>([])
  const [selectedID, setSelectedID] = createSignal("")
  const [runState, setRunState] = createSignal<AutomationRunState>({ automationID: "", status: "idle", items: [] })
  const [loading, setLoading] = createSignal(false)
  const [mutationOwner, setMutationOwner] = createSignal<AutomationMutationOwner | null>(null)
  const saving = createMemo(() => mutationOwner()?.kind === "save")
  const busyAction = createMemo(() => mutationOwner()?.id ?? "")
  const [error, setError] = createSignal<AutomationError | null>(null)
  const [editing, setEditing] = createSignal(false)
  const [creating, setCreating] = createSignal(false)
  const [projects, setProjects] = createSignal<DiscoveredProject[]>([])
  const [search, setSearch] = createSignal("")
  const [filter, setFilter] = createSignal<AutomationFilter>("all")
  const [scopeFilter, setScopeFilter] = createSignal<AutomationScopeFilter>("all")

  const [name, setName] = createSignal("")
  const [prompt, setPrompt] = createSignal("")
  const [scope, setScope] = createSignal<AutomationScope>("global")
  const [selectedProjectDirectories, setSelectedProjectDirectories] = createSignal<string[]>([])
  const [executionMode, setExecutionMode] = createSignal<AutomationExecutionMode>("local")
  const [preset, setPreset] = createSignal<AutomationRecurrencePreset>("daily")
  const [time, setTime] = createSignal("09:00")
  const [timeZone, setTimeZone] = createSignal(browserTimeZone())
  const [advancedRule, setAdvancedRule] = createSignal("")
  const [providerID, setProviderID] = createSignal("")
  const [modelID, setModelID] = createSignal("")
  const [reasoningEffort, setReasoningEffort] = createSignal("")
  const [timeZoneOpen, setTimeZoneOpen] = createSignal(false)

  let listRequest: AbortController | undefined
  let runRequest: AbortController | undefined
  let dueRefreshTimer: ReturnType<typeof setTimeout> | undefined
  let listReturnFocusElement: HTMLElement | undefined
  let detailReturnFocusElement: HTMLElement | undefined
  let listElement: HTMLElement | undefined
  let detailBackButton: HTMLButtonElement | undefined
  let formNameInput: HTMLInputElement | undefined
  const selected = createMemo(() => automations().find((automation) => automation.id === selectedID()) ?? null)
  const selectedRunState = createMemo(() => {
    const state = runState()
    return state.automationID === selectedID()
      ? state
      : ({ automationID: selectedID(), status: "idle", items: [] } satisfies AutomationRunState)
  })
  const filteredAutomations = createMemo(() => {
    const query = search().trim().toLocaleLowerCase()
    return automations().filter((automation) => {
      if (filter() !== "all" && automation.status !== filter()) return false
      if (scopeFilter() !== "all" && automation.target.scope !== scopeFilter()) return false
      if (!query) return true
      return [automation.name, automation.prompt, recurrenceSummary(automation.recurrence)].some((value) =>
        value.toLocaleLowerCase().includes(query),
      )
    })
  })
  const filtersActive = createMemo(() => Boolean(search().trim()) || filter() !== "all" || scopeFilter() !== "all")
  const initialLoadError = createMemo(() => {
    const problem = error()
    return automations().length === 0 && !loading() && problem?.source === "list-load" ? problem : null
  })
  function clearFilters(): void {
    if (busyAction()) return
    setSearch("")
    setFilter("all")
    setScopeFilter("all")
  }
  function rememberListFocus(): void {
    const active = document.activeElement
    if (active instanceof HTMLElement && listElement?.contains(active)) listReturnFocusElement = active
  }
  function focusAfterRender(resolveTarget: () => HTMLElement | undefined): void {
    queueMicrotask(() => {
      const target = resolveTarget()
      if (target?.isConnected) target.focus()
    })
  }
  function focusListReturn(): void {
    focusAfterRender(() => {
      if (listReturnFocusElement?.isConnected) return listReturnFocusElement
      return listElement?.querySelector<HTMLElement>(".automation-list-item:not(:disabled), input:not(:disabled)")
    })
  }
  const filterOptions = createMemo(() =>
    (["all", "active", "paused"] as const).map((value) => ({
      value,
      label: t(`automations.filter.${value}`),
      disabled: Boolean(busyAction()),
    })),
  )
  const scopeFilterOptions = createMemo(() =>
    (["all", "session", "project", "global"] as const).map((value) => ({
      value,
      label: t(`automations.scope_filter.${value}`),
      disabled: Boolean(busyAction()),
    })),
  )
  const modelOptions = createMemo<AutomationModelOption[]>(() => [
    {
      value: "",
      providerID: "",
      providerLabel: "",
      modelID: "",
      modelLabel: t(scope() === "global" ? "automations.model_global_default" : "automations.model_default"),
      variants: [],
      defaultModel: true,
    },
    ...connectedModelOptions(),
  ])
  const selectedModelOption = createMemo(
    () =>
      modelOptions().find((option) => option.providerID === providerID() && option.modelID === modelID()) ??
      modelOptions()[0],
  )
  const reasoningOptions = createMemo<SelectOption<string>[]>(() => [
    { value: "", label: t("automations.reasoning_default") },
    ...(selectedModelOption()?.variants ?? []).map((value) => ({ value, label: reasoningLabel(value) })),
  ])
  const selectedReasoningOption = createMemo(() => selectOption(reasoningOptions(), reasoningEffort()))
  const timeZoneOptions = automationTimeZoneOptions()
  const selectedTimeZoneOption = createMemo(() => timeZoneOptions.find((option) => option.value === timeZone()) ?? null)
  const showForm = createMemo(() => editing() || creating())
  const sessionTargetID = createMemo(() => {
    const target = selected()?.target
    if (target?.scope === "session") return target.sessionId
    return activeSessionID() || rootTaskSessionID()
  })
  function projectDirectories(projectIDs: string[]): string[] {
    const remaining = new Set(projectIDs)
    return projects()
      .filter((project) => Boolean(project.id) && remaining.delete(project.id!))
      .map((project) => project.directory)
  }

  function resetForm(automation?: AutomationView): void {
    const recurrence = automation ? parseAutomationRecurrence(automation.recurrence) : null
    setName(automation?.name ?? "")
    setPrompt(automation?.prompt ?? "")
    setScope(automation?.target.scope ?? "global")
    setSelectedProjectDirectories(
      automation?.target.scope === "project" ? projectDirectories(automation.target.projectIds) : [],
    )
    setExecutionMode(automation?.target.scope === "session" ? "local" : (automation?.executionMode ?? "local"))
    setPreset(recurrence?.preset ?? "daily")
    setAdvancedRule(recurrence?.customRule ?? "")
    setTime(recurrence?.time ?? "09:00")
    setTimeZone(recurrence?.timeZone ?? browserTimeZone())
    setProviderID(automation?.model?.providerID ?? "")
    setModelID(automation?.model?.modelID ?? "")
    setReasoningEffort(automation?.reasoningEffort ?? "")
    setError(null)
  }

  async function load(preferredID?: string, options: { background?: boolean } = {}): Promise<void> {
    listRequest?.abort()
    const request = new AbortController()
    listRequest = request
    if (!options.background) {
      setLoading(true)
      setError(null)
    }
    try {
      const items = await listAutomations(request.signal)
      if (request.signal.aborted) return
      setAutomations(items)
      const nextID = preferredID && items.some((item) => item.id === preferredID) ? preferredID : ""
      setSelectedID(nextID)
      if (!nextID) setRunState({ automationID: "", status: "idle", items: [] })
    } catch (cause) {
      if (!request.signal.aborted) {
        setError({
          message: errorText(cause),
          retry: () => void load(preferredID),
          source: "list-load",
        })
      }
    } finally {
      if (!request.signal.aborted && !options.background) setLoading(false)
    }
  }

  async function loadRuns(automationID: string): Promise<void> {
    runRequest?.abort()
    if (!automationID) {
      setRunState({ automationID: "", status: "idle", items: [] })
      return
    }
    const request = new AbortController()
    runRequest = request
    const current = runState()
    const currentItems = current.automationID === automationID ? current.items : []
    setRunState({ automationID, status: "loading", items: currentItems })
    try {
      const history = await listAutomationRuns(automationID, request.signal)
      if (!request.signal.aborted) setRunState({ automationID, status: "ready", items: history })
    } catch (cause) {
      if (!request.signal.aborted) {
        setRunState({ automationID, status: "error", items: currentItems, error: errorText(cause) })
      }
    }
  }

  function selectAutomation(id: string): void {
    if (busyAction()) return
    rememberListFocus()
    setSelectedID(id)
    setCreating(false)
    setEditing(false)
    setError(null)
    void loadRuns(id)
    focusAfterRender(() => detailBackButton)
  }

  function beginCreate(): void {
    if (loading() || busyAction()) return
    rememberListFocus()
    resetForm()
    setSelectedID("")
    setCreating(true)
    setEditing(false)
    focusAfterRender(() => formNameInput)
  }

  function beginSuggestion(suggestion: AutomationSuggestion): void {
    if (loading() || busyAction()) return
    rememberListFocus()
    resetForm()
    setName(suggestion.name)
    setPrompt(suggestion.prompt)
    setPreset(suggestion.preset)
    setTime(suggestion.time)
    setSelectedID("")
    setCreating(true)
    setEditing(false)
    focusAfterRender(() => formNameInput)
  }

  function returnToList(): void {
    if (busyAction()) return
    setSelectedID("")
    setRunState({ automationID: "", status: "idle", items: [] })
    setCreating(false)
    setEditing(false)
    setError(null)
    focusListReturn()
  }

  function selectScope(nextScope: AutomationScope): void {
    setError(null)
    setScope(nextScope)
    if (nextScope === "session") setExecutionMode("local")
  }

  function beginEdit(): void {
    if (busyAction()) return
    const automation = selected()
    if (!automation) return
    const active = document.activeElement
    if (active instanceof HTMLElement) detailReturnFocusElement = active
    resetForm(automation)
    setEditing(true)
    setCreating(false)
    focusAfterRender(() => formNameInput)
  }

  function cancelForm(): void {
    if (busyAction()) return
    if (editing() && selectedID()) {
      setEditing(false)
      setError(null)
      focusAfterRender(() => (detailReturnFocusElement?.isConnected ? detailReturnFocusElement : detailBackButton))
      return
    }
    returnToList()
  }

  function selectModel(option: AutomationModelOption | null): void {
    setError(null)
    const next = option ?? modelOptions()[0]
    setProviderID(next.providerID)
    setModelID(next.modelID)
    if (!next.variants.includes(reasoningEffort())) setReasoningEffort("")
  }

  async function submitForm(event: SubmitEvent): Promise<void> {
    event.preventDefault()
    if (busyAction()) return
    setError(null)
    if (scope() === "session" && !sessionTargetID()) {
      setError({ message: t("automations.error.session_required") })
      return
    }
    if (scope() === "project" && selectedProjectDirectories().length === 0) {
      setError({ message: t("automations.error.project_required") })
      return
    }

    let recurrence: string
    try {
      recurrence = buildAutomationRecurrence({
        preset: preset(),
        time: time(),
        timeZone: timeZone().trim(),
        customRule: advancedRule(),
      })
    } catch (cause) {
      setError({ message: errorText(cause) })
      return
    }

    const owner: AutomationMutationOwner = { kind: "save", id: selectedID() || "new" }
    setMutationOwner(owner)
    try {
      const model =
        providerID() && modelID() ? { providerID: providerID().trim(), modelID: modelID().trim() } : undefined
      const target: AutomationTarget =
        scope() === "session"
          ? { scope: "session", sessionId: sessionTargetID()! }
          : scope() === "project"
            ? {
                scope: "project",
                projectIds: [
                  ...new Set(await Promise.all(selectedProjectDirectories().map(resolveAutomationProjectID))),
                ],
              }
            : { scope: "global" }
      const base = {
        name: name().trim(),
        target,
        recurrence,
        executionMode: scope() === "session" ? ("local" as const) : executionMode(),
        prompt: prompt().trim(),
        ...(model ? { model } : {}),
        ...(reasoningEffort().trim() ? { reasoningEffort: reasoningEffort().trim() } : {}),
      }
      const current = selected()
      let preferredID: string
      if (editing() && current) {
        await updateAutomation(current.id, {
          ...base,
          model: model ?? null,
          reasoningEffort: reasoningEffort().trim() || null,
        })
        preferredID = current.id
      } else {
        const created = await createAutomation(base)
        preferredID = created.id
      }
      setCreating(false)
      setEditing(false)
      await load(preferredID)
      await loadRuns(preferredID)
      focusAfterRender(() => detailBackButton)
    } catch (cause) {
      setError({ message: errorText(cause) })
    } finally {
      if (mutationOwner() === owner) setMutationOwner(null)
    }
  }

  async function performAction(id: string, action: () => Promise<unknown>): Promise<void> {
    if (busyAction()) return
    const owner: AutomationMutationOwner = { kind: "action", id }
    setMutationOwner(owner)
    setError(null)
    try {
      await action()
      await load(id)
      await loadRuns(id)
    } catch (cause) {
      setError({ message: errorText(cause) })
    } finally {
      if (mutationOwner() === owner) setMutationOwner(null)
    }
  }

  async function removeSelected(): Promise<void> {
    const automation = selected()
    if (!automation) return
    await removeAutomation(automation.id)
  }

  async function removeAutomation(id: string): Promise<void> {
    if (busyAction()) return
    const removingSelected = selectedID() === id
    const active = document.activeElement
    const removingFocusedRow = active instanceof HTMLElement && Boolean(active.closest(".automation-list-row"))
    if (removingFocusedRow) rememberListFocus()
    const owner: AutomationMutationOwner = { kind: "action", id }
    setMutationOwner(owner)
    setError(null)
    try {
      await deleteAutomation(id)
      if (removingSelected) {
        setSelectedID("")
        setRunState({ automationID: "", status: "idle", items: [] })
        setCreating(false)
        setEditing(false)
      }
      await load()
      if (removingSelected || removingFocusedRow) focusListReturn()
    } catch (cause) {
      setError({ message: errorText(cause) })
    } finally {
      if (mutationOwner() === owner) setMutationOwner(null)
    }
  }

  async function initializeHost(): Promise<void> {
    setError(null)
    const automationLoad = load()
    const [projectResult, providerResult] = await Promise.allSettled([loadDiscoveredProjects(), loadProviderInfo()])
    if (projectResult.status === "fulfilled") setProjects(projectResult.value.projects)
    await automationLoad
    const messages = [
      ...(projectResult.status === "rejected" ? [errorText(projectResult.reason)] : []),
      ...(providerResult.status === "rejected"
        ? [errorText(providerResult.reason)]
        : providerResult.value.map((issue) => issue.message)),
    ]
    if (messages.length > 0) {
      const listLoadFailed = error()?.source === "list-load"
      setError({
        message: [...(listLoadFailed ? [error()!.message] : []), ...messages].join("; "),
        retry: () => void initializeHost(),
        source: listLoadFailed ? "list-load" : undefined,
      })
    }
  }

  async function openRunSession(session: AutomationRunSession): Promise<void> {
    try {
      await props.onOpenSession(session)
      closeConfigDialog()
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return
      setError({ message: errorText(cause) })
    }
  }

  async function refreshDueAutomation(): Promise<void> {
    const preferredID = selectedID()
    await load(preferredID, { background: true })
    if (selectedID()) await loadRuns(selectedID())
  }

  createEffect(() => {
    if (dueRefreshTimer) clearTimeout(dueRefreshTimer)
    dueRefreshTimer = undefined
    const dueTimes = automations()
      .filter((automation) => automation.status === "active")
      .map((automation) => automation.nextRun)
    if (dueTimes.length === 0 || loading() || saving() || busyAction() || showForm()) return
    const nextRun = Math.min(...dueTimes)
    const now = Date.now()
    const delay = nextRun > now ? nextRun - now + DUE_REFRESH_GRACE_MS : DUE_REFRESH_RETRY_MS
    dueRefreshTimer = setTimeout(
      () => {
        dueRefreshTimer = undefined
        void refreshDueAutomation()
      },
      Math.min(delay, MAX_BROWSER_TIMER_DELAY_MS),
    )
  })

  onMount(() => {
    void initializeHost()
  })
  onCleanup(() => {
    if (dueRefreshTimer) clearTimeout(dueRefreshTimer)
    listRequest?.abort()
    runRequest?.abort()
  })

  return (
    <SettingsPanel class="scheduled-automations-panel" data-ui="scheduled-automations">
      <div class="automations-page-intro">
        <p>{t("automations.subtitle")}</p>
        <div class="automations-page-actions">
          <Show when={!initialLoadError()}>
          <Button
            type="button"
            variant="solid"
            size="sm"
            tone="accent"
            data-ui="automation-create"
            disabled={loading() || Boolean(busyAction())}
            onClick={beginCreate}
          >
            <Icon name="plus" />
            {t("automations.new")}
          </Button>
          </Show>
        </div>
      </div>

      <SettingsGroup>
        <SettingsSurface class="automations-layout" data-drill-in={showForm() || selected() ? "true" : undefined}>
          <Show when={!initialLoadError() ? error() : null}>
            {(problem) => (
              <SettingsState
                tone="error"
                actions={
                  <Show when={problem().retry}>
                    {(retry) => (
                      <Button
                        type="button"
                        variant="ghost"
                        size="mini"
                        tone="neutral"
                        disabled={Boolean(busyAction())}
                        onClick={() => retry()()}
                      >
                        <Icon name="refresh" />
                        {t("common.retry")}
                      </Button>
                    )}
                  </Show>
                }
              >
                {problem().message}
              </SettingsState>
            )}
          </Show>
          <Show
            when={!initialLoadError()}
            fallback={
              <SettingsState
                tone="error"
                actions={
                  <Button type="button" variant="outline" size="sm" tone="neutral" onClick={() => initialLoadError()?.retry?.()}>
                    <Icon name="refresh" />
                    {t("common.retry")}
                  </Button>
                }
              >
                {initialLoadError()?.message}
              </SettingsState>
            }
          >
          <aside ref={listElement} class="automations-list" aria-label={t("automations.list")}>
            <SearchField
              class="automations-search"
              size="md"
              value={search()}
              placeholder={t("automations.search_placeholder")}
              onValueChange={setSearch}
              onClear={() => setSearch("")}
              disabled={Boolean(busyAction())}
            />
            <SegmentedControl
              class="automations-filter"
              options={filterOptions()}
              value={filter()}
              ariaLabel={t("automations.filter_label")}
              onChange={setFilter}
            />
            <SegmentedControl
              class="automations-filter automations-scope-filter"
              options={scopeFilterOptions()}
              value={scopeFilter()}
              ariaLabel={t("automations.scope_filter_label")}
              onChange={setScopeFilter}
            />
            <Show when={!loading()} fallback={<SettingsEmpty>{t("common.loading")}</SettingsEmpty>}>
              <Show
                when={filteredAutomations().length > 0}
                fallback={
                  <SettingsEmpty>
                    <span>{filtersActive() ? t("automations.filtered_empty") : t("automations.empty")}</span>
                    <Show when={filtersActive()}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        tone="neutral"
                        disabled={Boolean(busyAction())}
                        onClick={clearFilters}
                      >
                        {t("automations.clear_filters")}
                      </Button>
                    </Show>
                  </SettingsEmpty>
                }
              >
                <div class="automations-rows">
                  <For each={filteredAutomations()}>
                    {(automation) => (
                      <div class="automation-list-row">
                        <SettingsRow
                          as="button"
                          class="automation-list-item"
                          interactive
                          customContent
                          data-selected={String(selectedID() === automation.id)}
                          disabled={Boolean(busyAction())}
                          onClick={() => selectAutomation(automation.id)}
                        >
                          <Icon name={automation.status === "active" ? "run" : "scheduled"} />
                          <span class="automation-list-item__copy">
                            <span class="automation-list-item__top">
                              <strong>{automation.name}</strong>
                              <span>
                                {t(`automations.scope.${automation.target.scope}`)} ·{" "}
                                {recurrenceSummary(automation.recurrence)}
                              </span>
                            </span>
                            <span class="automation-list-item__next">
                              {t("automations.next_run", { value: formatTimestamp(automation.nextRun) })}
                            </span>
                          </span>
                        </SettingsRow>
                        <ArmedConfirmButton
                          class="automation-list-delete"
                          variant="ghost"
                          size="mini"
                          tone="danger"
                          label={t("automations.delete")}
                          armedDescription={t("automations.delete_confirm")}
                          confirmChildren={t("automations.delete_confirm")}
                          disabled={Boolean(busyAction())}
                          onConfirm={() => void removeAutomation(automation.id)}
                        >
                          <Icon name="delete" />
                        </ArmedConfirmButton>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </Show>
            <Show when={!loading() && !filtersActive()}>
              <section class="automation-suggestions">
                <h2>{t("automations.suggestions")}</h2>
                <For each={automationSuggestions()}>
                  {(suggestion) => (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      tone="neutral"
                      class="automation-suggestion oc-action-tile"
                      disabled={loading() || Boolean(busyAction())}
                      onClick={() => beginSuggestion(suggestion)}
                    >
                      <Icon name={suggestion.icon} />
                      <span>
                        <span class="automation-suggestion__title">
                          <strong>{suggestion.name}</strong>
                          <span>{suggestion.schedule}</span>
                        </span>
                        <span class="automation-suggestion__description">{suggestion.description}</span>
                      </span>
                    </Button>
                  )}
                </For>
              </section>
            </Show>
          </aside>

          <section class="automations-detail">
            <Show when={!loading()} fallback={<SettingsEmpty>{t("common.loading")}</SettingsEmpty>}>
              <Show
                when={showForm()}
                fallback={
                  <Show
                    when={selected()}
                    fallback={
                      <div class="automations-welcome">
                      <Icon name="scheduled" />
                      <h3>{t("automations.empty_title")}</h3>
                      <p>{t("automations.empty_body")}</p>
                      <Button
                        type="button"
                        variant="solid"
                        size="md"
                        tone="accent"
                        disabled={loading() || Boolean(busyAction())}
                        onClick={beginCreate}
                      >
                        {t("automations.new")}
                      </Button>
                      </div>
                    }
                  >
                    {(automation) => (
                      <div class="automation-detail-view">
                      <Button
                        ref={detailBackButton}
                        type="button"
                        class="automation-back"
                        variant="ghost"
                        size="sm"
                        tone="neutral"
                        disabled={Boolean(busyAction())}
                        onClick={returnToList}
                      >
                        <Icon name="nav-back" />
                        {t("automations.back")}
                      </Button>
                      <header class="automation-detail-header">
                        <div>
                          <div class="automation-detail-heading">
                            <h3>{automation().name}</h3>
                            <Badge tone={statusTone(automation().status)}>
                              {t(`automations.status.${automation().status}`)}
                            </Badge>
                          </div>
                          <p>{recurrenceSummary(automation().recurrence)}</p>
                        </div>
                        <div class="automation-detail-actions">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            tone="neutral"
                            data-ui="automation-run-now"
                            disabled={Boolean(busyAction())}
                            onClick={() => void performAction(automation().id, () => runAutomationNow(automation().id))}
                          >
                            <Icon name="run" />
                            {t("automations.run_now")}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            tone="neutral"
                            data-ui="automation-edit"
                            disabled={Boolean(busyAction())}
                            onClick={beginEdit}
                          >
                            <Icon name="edit" />
                            {t("common.edit")}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            tone="neutral"
                            data-ui="automation-status"
                            disabled={Boolean(busyAction())}
                            onClick={() =>
                              void performAction(
                                automation().id,
                                automation().status === "active"
                                  ? () => pauseAutomation(automation().id)
                                  : () => resumeAutomation(automation().id),
                              )
                            }
                          >
                            {automation().status === "active" ? t("automations.pause") : t("automations.resume")}
                          </Button>
                          <ArmedConfirmButton
                            variant="ghost"
                            size="sm"
                            tone="danger"
                            label={t("automations.delete")}
                            armedDescription={t("automations.delete_confirm")}
                            disabled={Boolean(busyAction())}
                            onConfirm={() => void removeSelected()}
                            confirmChildren={t("automations.delete_confirm")}
                          >
                            <Icon name="delete" />
                            {t("automations.delete")}
                          </ArmedConfirmButton>
                        </div>
                      </header>

                      <div class="automation-metadata-grid">
                        <div>
                          <span>{t("automations.scope")}</span>
                          <strong>{t(`automations.scope.${automation().target.scope}`)}</strong>
                        </div>
                        <Show when={automation().target.scope === "project"}>
                          <div>
                            <span>{t("automations.execution")}</span>
                            <strong>{t(`automations.execution.${automation().executionMode}`)}</strong>
                          </div>
                        </Show>
                        <div>
                          <span>{t("automations.next")}</span>
                          <strong>{formatTimestamp(automation().nextRun)}</strong>
                        </div>
                        <div>
                          <span>{t("automations.last")}</span>
                          <strong>{formatTimestamp(automation().lastRun)}</strong>
                        </div>
                        <div>
                          <span>{t("automations.model")}</span>
                          <strong>
                            {automation().model
                              ? `${automation().model!.providerID}/${automation().model!.modelID}`
                              : t(
                                  automation().target.scope === "global"
                                    ? "automations.model_global_default"
                                    : "automations.model_default",
                                )}
                          </strong>
                        </div>
                        <div>
                          <span>{t("automations.reasoning")}</span>
                          <strong>{reasoningLabel(automation().reasoningEffort ?? "")}</strong>
                        </div>
                        <div>
                          <span>{t("automations.failures")}</span>
                          <strong>{automation().failureCount}</strong>
                        </div>
                      </div>

                      <section class="automation-prompt">
                        <h4>{t("automations.prompt")}</h4>
                        <p>{automation().prompt}</p>
                        <Show when={automation().lastError}>
                          <SettingsState tone="error">{automation().lastError}</SettingsState>
                        </Show>
                      </section>

                      <section class="automation-history">
                        <div class="automation-section-heading">
                          <h4>{t("automations.history")}</h4>
                          <Button
                            type="button"
                            variant="ghost"
                            size="mini"
                            tone="neutral"
                            disabled={Boolean(busyAction())}
                            onClick={() => void loadRuns(automation().id)}
                          >
                            <Icon name="refresh" />
                            {t("common.refresh")}
                          </Button>
                        </div>
                        <Show
                          when={selectedRunState().status === "ready"}
                          fallback={
                            <Show
                              when={selectedRunState().status === "error"}
                              fallback={<p class="automations-muted" role="status">{t("common.loading")}</p>}
                            >
                              <SettingsState
                                tone="error"
                                actions={
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="mini"
                                    tone="neutral"
                                    onClick={() => void loadRuns(automation().id)}
                                  >
                                    <Icon name="refresh" />
                                    {t("common.retry")}
                                  </Button>
                                }
                              >
                                {selectedRunState().error}
                              </SettingsState>
                            </Show>
                          }
                        >
                          <Show
                            when={selectedRunState().items.length > 0}
                            fallback={<p class="automations-muted">{t("automations.history_empty")}</p>}
                          >
                          <div class="automation-run-list">
                            <For each={selectedRunState().items}>
                              {(run) => (
                                <div class="automation-run-row">
                                  <Badge tone={outcomeTone(run.outcome)} size="sm">
                                    {t(`automations.outcome.${run.outcome}`)}
                                  </Badge>
                                  <span>{formatTimestamp(run.startedAt)}</span>
                                  <Show
                                    when={run.session}
                                    fallback={<span class="automation-run-row__session">—</span>}
                                  >
                                    {(session) => (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="mini"
                                        tone="neutral"
                                        data-ui="automation-open-session"
                                        disabled={Boolean(busyAction())}
                                        onClick={() => void openRunSession(session())}
                                      >
                                        <Icon name="message" />
                                        {session().title || session().id}
                                      </Button>
                                    )}
                                  </Show>
                                  <Show when={run.error}>
                                    <span class="automation-run-row__error">{run.error}</span>
                                  </Show>
                                </div>
                              )}
                            </For>
                          </div>
                          </Show>
                        </Show>
                      </section>
                      </div>
                    )}
                  </Show>
                }
              >
                <form class="automation-form" onSubmit={(event) => void submitForm(event)}>
                <Button
                  type="button"
                  class="automation-back"
                  variant="ghost"
                  size="sm"
                  tone="neutral"
                  disabled={Boolean(busyAction())}
                  onClick={cancelForm}
                >
                  <Icon name="nav-back" />
                  {t("automations.back")}
                </Button>
                <div class="automation-form-heading">
                  <div>
                    <h3>{creating() ? t("automations.create_title") : t("automations.edit_title")}</h3>
                    <p>{t("automations.form_help")}</p>
                  </div>
                  <div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="md"
                      tone="neutral"
                      disabled={Boolean(busyAction())}
                      onClick={cancelForm}
                    >
                      {t("common.cancel")}
                    </Button>
                    <Button
                      type="submit"
                      variant="solid"
                      size="md"
                      tone="accent"
                      disabled={
                        Boolean(busyAction()) ||
                        !name().trim() ||
                        !prompt().trim() ||
                        (scope() === "session" && !sessionTargetID()) ||
                        (scope() === "project" && selectedProjectDirectories().length === 0)
                      }
                    >
                      {saving() ? t("common.saving") : t("common.save")}
                    </Button>
                  </div>
                </div>

                <fieldset class="automation-form-grid" disabled={Boolean(busyAction())}>
                  <TextField.Root as="label" class="automation-field-wide">
                    <TextField.Label>{t("automations.name")}</TextField.Label>
                    <TextField.Input
                      ref={formNameInput}
                      data-ui="automation-name"
                      value={name()}
                      required
                      onInput={(event) => {
                        setError(null)
                        setName(event.currentTarget.value)
                      }}
                    />
                  </TextField.Root>

                  <TextField.Root>
                    <TextField.Label>{t("automations.scope")}</TextField.Label>
                    <SelectControl
                      options={scopeOptions()}
                      value={selectOption(scopeOptions(), scope())}
                      onChange={(option) => option && selectScope(option.value)}
                      optionValue="value"
                      optionTextValue="label"
                      disallowEmptySelection
                      triggerDataUI="automation-scope"
                      ariaLabel={t("automations.scope")}
                      renderValue={(option) => <span>{option?.label}</span>}
                      renderOptionLabel={(option) => option.label}
                    />
                    <TextField.Description>{t(`automations.scope.${scope()}_help`)}</TextField.Description>
                  </TextField.Root>

                  <Show when={scope() === "session"}>
                    <div
                      class="automation-session-target automation-field-wide"
                      data-valid={String(Boolean(sessionTargetID()))}
                    >
                      <Icon name={sessionTargetID() ? "check" : "info-circle"} />
                      <div>
                        <strong>{t("automations.session_target")}</strong>
                        <span>
                          {sessionTargetID()
                            ? t("automations.session_target_exact", { session: sessionTargetID() })
                            : t("automations.session_target_missing")}
                        </span>
                      </div>
                    </div>
                  </Show>

                  <Show when={scope() === "project"}>
                    <div class="automation-project-targets automation-field-wide">
                      <strong>{t("automations.project_targets")}</strong>
                      <ListboxRoot<DiscoveredProject>
                        class="automation-project-target-list"
                        density="rich"
                        aria-label={t("automations.project_targets")}
                        options={projects()}
                        optionValue={(project) => project.directory}
                        optionTextValue={(project) => project.name}
                        value={selectedProjectDirectories()}
                        selectionMode="multiple"
                        selectionBehavior="toggle"
                        onChange={(next) => {
                          setError(null)
                          setSelectedProjectDirectories([...next])
                        }}
                        renderItem={(node) => {
                          const project = node.rawValue
                          return (
                            <ListboxItem
                              item={node}
                              as="button"
                              type="button"
                              class="automation-project-target"
                              data-selected={String(selectedProjectDirectories().includes(project.directory))}
                            >
                              <span class="automation-project-target__selection" aria-hidden="true">
                                <Show when={selectedProjectDirectories().includes(project.directory)}>
                                  <Icon name="check" size="compact" />
                                </Show>
                              </span>
                              <span>
                                <strong>{project.name}</strong>
                                <small>{project.directory}</small>
                              </span>
                            </ListboxItem>
                          )
                        }}
                      />
                      <Show when={projects().length === 0}>
                        <span class="automations-muted">{t("automations.project_targets_empty")}</span>
                      </Show>
                    </div>
                    <TextField.Root>
                      <TextField.Label>{t("automations.execution")}</TextField.Label>
                      <SelectControl
                        options={executionOptions()}
                        value={selectOption(executionOptions(), executionMode())}
                        onChange={(option) => {
                          if (!option) return
                          setError(null)
                          setExecutionMode(option.value)
                        }}
                        optionValue="value"
                        optionTextValue="label"
                        disallowEmptySelection
                        triggerDataUI="automation-execution"
                        ariaLabel={t("automations.execution")}
                        renderValue={(option) => <span>{option?.label}</span>}
                        renderOptionLabel={(option) => option.label}
                      />
                    </TextField.Root>
                  </Show>

                  <TextField.Root>
                    <TextField.Label>{t("automations.recurrence")}</TextField.Label>
                    <SelectControl
                      options={recurrenceOptions()}
                      value={selectOption(recurrenceOptions(), preset())}
                      onChange={(option) => {
                        if (!option) return
                        setError(null)
                        setPreset(option.value)
                      }}
                      optionValue="value"
                      optionTextValue="label"
                      disallowEmptySelection
                      triggerDataUI="automation-recurrence"
                      ariaLabel={t("automations.recurrence")}
                      renderValue={(option) => <span>{option?.label}</span>}
                      renderOptionLabel={(option) => option.label}
                    />
                  </TextField.Root>

                  <Show when={preset() !== "custom"}>
                    <TextField.Root as="label">
                      <TextField.Label>{t("automations.time")}</TextField.Label>
                      <TextField.Input
                        type="time"
                        data-ui="automation-time"
                        value={time()}
                        required
                        onInput={(event) => {
                          setError(null)
                          setTime(event.currentTarget.value)
                        }}
                      />
                    </TextField.Root>
                    <TextField.Root>
                      <TextField.Label>{t("automations.time_zone")}</TextField.Label>
                      <ComboboxControl
                        options={timeZoneOptions}
                        value={selectedTimeZoneOption()}
                        onChange={(option) => {
                          if (!option) return
                          setError(null)
                          setTimeZone(option.value)
                        }}
                        open={timeZoneOpen()}
                        onOpenChange={setTimeZoneOpen}
                        optionValue="value"
                        optionTextValue="label"
                        optionLabel="label"
                        defaultFilter="contains"
                        disallowEmptySelection
                        closeOnSelection
                        class="automation-time-zone-combobox"
                        controlClass="automation-time-zone-control"
                        inputClass="automation-time-zone-input"
                        listboxClass="automation-time-zone-list"
                        optionClass="automation-time-zone-option"
                        inputID="automation-time-zone"
                        listboxID="automation-time-zone-options"
                        ariaLabel={t("automations.time_zone")}
                        renderOptionLabel={(option) => option.label}
                      />
                      <TextField.Description>{t("automations.time_zone_help")}</TextField.Description>
                    </TextField.Root>
                  </Show>

                  <Show when={preset() === "custom"}>
                    <TextField.Root as="label" class="automation-field-wide">
                      <TextField.Label>{t("automations.advanced_rule")}</TextField.Label>
                      <AutoGrowTextarea
                        rows={4}
                        maxLines={8}
                        value={advancedRule()}
                        data-ui="automation-advanced-rule"
                        required
                        placeholder={"DTSTART;TZID=Asia/Singapore:20260727T090000\nRRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"}
                        onInput={(event) => {
                          setError(null)
                          setAdvancedRule(event.currentTarget.value)
                        }}
                      />
                      <TextField.Description>{t("automations.advanced_help")}</TextField.Description>
                    </TextField.Root>
                  </Show>

                  <TextField.Root>
                    <TextField.Label>{t("automations.model")}</TextField.Label>
                    <SelectControl
                      options={modelOptions()}
                      value={selectedModelOption()}
                      onChange={selectModel}
                      optionValue="value"
                      optionTextValue="modelLabel"
                      disallowEmptySelection
                      triggerDataUI="automation-model"
                      ariaLabel={t("automations.model")}
                      renderValue={(option) => <span>{option?.modelLabel}</span>}
                      renderOptionLabel={(option) =>
                        option.defaultModel ? option.modelLabel : `${option.providerLabel} · ${option.modelLabel}`
                      }
                    />
                    <TextField.Description>
                      {t(scope() === "global" ? "automations.model_global_help" : "automations.model_help")}
                    </TextField.Description>
                  </TextField.Root>
                  <TextField.Root>
                    <TextField.Label>{t("automations.reasoning")}</TextField.Label>
                    <SelectControl
                      options={reasoningOptions()}
                      value={selectedReasoningOption()}
                      onChange={(option) => {
                        setError(null)
                        setReasoningEffort(option?.value ?? "")
                      }}
                      optionValue="value"
                      optionTextValue="label"
                      disallowEmptySelection
                      disabled={selectedModelOption().defaultModel || selectedModelOption().variants.length === 0}
                      triggerDataUI="automation-reasoning"
                      ariaLabel={t("automations.reasoning")}
                      renderValue={(option) => <span>{option?.label}</span>}
                      renderOptionLabel={(option) => option.label}
                    />
                    <TextField.Description>
                      {selectedModelOption().defaultModel
                        ? t(
                            scope() === "global"
                              ? "automations.reasoning_global_default_help"
                              : "automations.reasoning_default_help",
                          )
                        : selectedModelOption().variants.length === 0
                          ? t("automations.reasoning_unavailable")
                          : t("automations.reasoning_help")}
                    </TextField.Description>
                  </TextField.Root>

                  <TextField.Root as="label" class="automation-field-wide">
                    <TextField.Label>{t("automations.prompt")}</TextField.Label>
                    <AutoGrowTextarea
                      rows={6}
                      maxLines={12}
                      value={prompt()}
                      data-ui="automation-prompt"
                      required
                      placeholder={t("automations.prompt_placeholder")}
                      onInput={(event) => {
                        setError(null)
                        setPrompt(event.currentTarget.value)
                      }}
                    />
                  </TextField.Root>
                </fieldset>
                </form>
              </Show>
            </Show>
          </section>
          </Show>
        </SettingsSurface>
      </SettingsGroup>
    </SettingsPanel>
  )
}

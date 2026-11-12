import { Feedback } from "../ui/Feedback"
import { batch, createEffect, createMemo, createSignal, For, onCleanup, onMount, Show, type Accessor } from "solid-js"
import { activeSessionID, rootTaskSessionID } from "../../store/board"
import { ApiError, captureApiAuthority, isApiAuthorityCurrent, type ApiAuthority } from "../../services/api"
import { formatErrorDetails } from "../../utils/error-details"
import {
  automationTimeZoneOptions,
  automationRecurrenceDefaults,
  automationRecurrenceUpdate,
  buildAutomationRecurrence,
  browserTimeZone,
  parseAutomationRecurrence,
  type AutomationRecurrencePreset,
  type AutomationWeekday,
  type ParsedAutomationRecurrence,
} from "../../services/automation-recurrence"
import {
  AutomationWriteUnconfirmedError,
  AutomationStatusUnconfirmedError,
  changeAutomationStatus,
  createAutomation,
  deleteAutomation,
  editAutomation,
  hasPendingAutomationRun,
  listAutomationRuns,
  listAutomations,
  runAutomationNow,
  type AutomationExecutionMode,
  type AutomationScope,
  type AutomationTarget,
  type AutomationRunSession,
  type AutomationRunView,
  type AutomationView,
} from "../../services/automations"
import {
  applyVisibleAutomationProjectSelection,
  projectTargetKey,
  resolveAutomationProjectTargets,
  type AutomationProjectTarget,
} from "../../services/automation-project-targets"
import { loadDiscoveredProjects, type DiscoveredProject } from "../../services/workspace"
import { showAppDialog } from "../../services/app-dialog"
import { loadProviderInfo } from "../../services/config-load"
import { connectedModelOptions, type ConnectedModelOption } from "../../services/llm"
import { closeConfigDialog } from "../../services/config-dialog-control"
import { workLedgerSessionExecution } from "../../services/work-ledger"
import { localeTag, t } from "../../utils/i18n"
import { randomUUID } from "../../utils/random-id"
import { projectDirectoryHints, projectLedgerDisplayName } from "../../utils/project-directory"
import { matchesSearchTerms } from "../../services/text-search"
import { AutoGrowTextarea } from "../ui/AutoGrowTextarea"
import { Badge, type BadgeTone } from "../ui/Badge"
import { Button } from "../ui/Button"
import { Disclosure } from "../ui/Disclosure"
import { Icon } from "../ui/Icon"
import { ListboxItem, ListboxRoot } from "../ui/Listbox"
import { ComboboxControl } from "../ui/ComboboxControl"
import { SearchField } from "../ui/SearchField"
import { SegmentedControl } from "../ui/SegmentedControl"
import { SelectControl } from "../ui/SelectControl"
import { TextField } from "../ui/TextField"
import { SettingsEmpty, SettingsGroup, SettingsPanel, SettingsRow, SettingsSurface } from "./layout"
import { ScheduledCalendarField } from "./ScheduledCalendarField"

type SelectOption<T extends string> = { value: T; label: string }
type AutomationError = {
  messageKey: string
  details?: string
  retry?: () => void
  source?: "list-load" | "status-check" | "delete-check" | "delete-retry"
  automationID?: string
  tone?: "warning"
}
type AutomationModelOption = ConnectedModelOption & { defaultModel?: boolean; retained?: boolean }
type AutomationFilter = "all" | "active" | "paused"
type AutomationScopeFilter = "all" | AutomationScope

type AutomationProjectOption = { key: string; target: AutomationProjectTarget; project?: DiscoveredProject }
type AutomationProjectRead =
  | { status: "reading"; projects?: DiscoveredProject[] }
  | { status: "ready"; projects: DiscoveredProject[] }
  | { status: "failed" | "retrying"; projects?: DiscoveredProject[]; cause: unknown; afterSave: boolean }

function projectChoiceLabel(option: AutomationProjectOption): string {
  return option.project ? projectOptionLabel(option.project)
    : option.target.kind === "project" ? option.target.projectID : option.target.directory
}

function projectChoiceDirectory(option: AutomationProjectOption): string | undefined {
  return option.project?.directory ?? (option.target.kind === "directory" ? option.target.directory : undefined)
}
type AutomationMutationOwner =
  | { kind: "save"; id: string }
  | { kind: "action"; id: string; operation: "run" | "status" | "delete" }
type AutomationRunState = {
  automationID: string
  authority: ApiAuthority
  pending: boolean
  items?: AutomationRunView[]
  error?: AutomationError
}

interface AutomationSuggestion {
  icon: "notifications" | "file-document" | "inspect"
  name: string
  schedule: string
  description: string
  preset: AutomationRecurrencePreset
  weekday?: AutomationWeekday
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
      weekday: "FR",
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
  active: boolean
  registerAuthor: (hasDraft: Accessor<boolean>) => () => void
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

function projectOptionLabel(project: DiscoveredProject): string {
  return projectLedgerDisplayName({
    directory: project.directory,
    customName: project.name,
    unknownName: t("task.project.unknown"),
    implicitProjectName: t("work_ledger.implicit_project_row"),
  })
}

function selectOption<T extends string>(options: SelectOption<T>[], value: T): SelectOption<T> {
  return options.find((option) => option.value === value) ?? options[0]
}

function formatTimestamp(value: number | null, timeStyle: "short" | "medium" = "short"): string {
  if (!value) return t("automations.never")
  const formatter = new Intl.DateTimeFormat(localeTag(), {
    dateStyle: "medium",
    timeStyle,
  })
  return t("automations.timestamp_with_zone", {
    value: formatter.format(new Date(value)),
    timeZone: formatter.resolvedOptions().timeZone,
  })
}

function nextRunValue(automation: AutomationView): string {
  if (automation.status === "paused") return t("automations.automatic_paused")
  const { nextRun } = automation
  return formatTimestamp(nextRun, nextRun !== null && nextRun % 60_000 !== 0 ? "medium" : "short")
}

function recurrenceSummary(parsed: ParsedAutomationRecurrence): string {
  if (parsed.preset === "custom") return t("automations.recurrence.advanced_summary")
  const schedule =
    parsed.preset === "weekly"
      ? `${t("automations.recurrence.weekly")} (${t(`automations.weekday.${parsed.weekday}`)})`
      : t(`automations.recurrence.${parsed.preset}`)
  const [hour, minute] = parsed.time.split(":").map(Number)
  // Format the rule's wall clock as a local-language clock, without converting its zone.
  const time = new Intl.DateTimeFormat(localeTag(), { hour: "numeric", minute: "2-digit", timeZone: "UTC" })
    .format(Date.UTC(2000, 0, 1, hour, minute))
  return t("automations.recurrence.summary", { schedule, time, timeZone: parsed.timeZone })
}

function statusTone(status: AutomationView["status"]): BadgeTone {
  return status === "active" ? "ok" : "muted"
}

function outcomeTone(outcome: AutomationRunView["outcome"]): BadgeTone {
  if (outcome === "succeeded") return "ok"
  if (outcome === "failed") return "bad"
  return "accent"
}

function automationErrorName(error: unknown): unknown {
  return error instanceof ApiError && error.body && typeof error.body === "object"
    ? (error.body as { name?: unknown }).name
    : undefined
}

function automationFailure(error: unknown, operationKey: string): AutomationError {
  const name = automationErrorName(error)
  let messageKey = operationKey
  switch (name) {
    case "AutomationRevisionConflictError":
      messageKey = "automations.error.revision_conflict"
      break
    case "AutomationCreationConflictError":
      messageKey = "automations.error.creation_conflict"
      break
    case "AutomationCreationUnavailableError":
      messageKey = "automations.error.creation_unavailable"
      break
    case "AutomationUpdateConflictError":
      messageKey = "automations.error.edit_request_conflict"
      break
    case "AutomationUpdateUnavailableError":
      messageKey = "automations.error.edit_request_unavailable"
      break
    case "InvalidAutomationRecurrenceError":
      messageKey = "automations.error.recurrence_invalid"
      break
  }
  return { messageKey, details: formatErrorDetails(error) }
}

export default function ScheduledAutomationsPanel(props: ScheduledAutomationsPanelProps) {
  const [automations, setAutomations] = createSignal<AutomationView[]>([])
  const [selectedID, setSelectedID] = createSignal("")
  const [manualRunRevision, setManualRunRevision] = createSignal(0)
  const hasUnconfirmedRun = (id: string) => {
    manualRunRevision()
    return hasPendingAutomationRun(id)
  }
  const [runState, setRunState] = createSignal<AutomationRunState>()
  const [loading, setLoading] = createSignal(false)
  const [mutationOwner, setMutationOwner] = createSignal<AutomationMutationOwner | null>(null)
  const saving = createMemo(() => mutationOwner()?.kind === "save")
  const busyAction = createMemo(() => mutationOwner()?.id ?? "")
  const runningAutomationID = createMemo(() => {
    const owner = mutationOwner()
    return owner?.kind === "action" && owner.operation === "run" ? owner.id : ""
  })
  const [error, setError] = createSignal<AutomationError | null>(null)
  const [editOwner, setEditOwner] = createSignal<{ definition: AutomationView; requestID: string } | null>(null)
  const editing = () => editOwner() !== null
  const [creationRequestID, setCreationRequestID] = createSignal<string>()
  const creating = () => creationRequestID() !== undefined
  const [projectRead, setProjectRead] = createSignal<AutomationProjectRead>({ status: "reading" })
  const projects = () => projectRead().projects ?? []
  const projectsByID = createMemo(() => {
    const entries = new Map<string, { name: string; directory: string }>()
    for (const project of projects()) {
      if (project.id && !entries.has(project.id)) {
        entries.set(project.id, { name: projectOptionLabel(project), directory: project.directory })
      }
    }
    return entries
  })
  const projectHints = createMemo(() => projectDirectoryHints([...projectsByID().values()]))
  const projectListFormat = createMemo(() => new Intl.ListFormat(localeTag(), { style: "short" }))
  const projectReadIssue = createMemo(() => {
    const state = projectRead()
    return state.status === "failed" || state.status === "retrying" ? state : undefined
  })
  const [search, setSearch] = createSignal("")
  const [filter, setFilter] = createSignal<AutomationFilter>("all")
  const [scopeFilter, setScopeFilter] = createSignal<AutomationScopeFilter>("all")

  const [name, setName] = createSignal("")
  const [prompt, setPrompt] = createSignal("")
  const [scope, setScope] = createSignal<AutomationScope>("global")
  const [draftSessionID, setDraftSessionID] = createSignal("")
  const [selectedProjectTargets, setSelectedProjectTargets] = createSignal<AutomationProjectTarget[]>([])
  const [projectSearch, setProjectSearch] = createSignal("")
  const projectChoices = createMemo(() => {
    const options = new Map<string, AutomationProjectOption>()
    for (const project of projects()) {
      const target: AutomationProjectTarget = project.id
        ? { kind: "project", projectID: project.id }
        : { kind: "directory", directory: project.directory }
      const key = projectTargetKey(target)
      if (!options.has(key)) options.set(key, { key, target, project })
    }
    for (const target of selectedProjectTargets()) {
      const key = projectTargetKey(target)
      if (!options.has(key)) options.set(key, { key, target })
    }
    return [...options.values()]
  })
  const selectedProjectKeys = createMemo(() => new Set(selectedProjectTargets().map(projectTargetKey)))
  const visibleProjects = createMemo(
    () => projectChoices().filter((option) =>
      matchesSearchTerms(projectSearch(), [projectChoiceLabel(option), option.project?.name, projectChoiceDirectory(option),
        option.target.kind === "project" ? option.target.projectID : option.target.directory]),
    ),
    undefined,
    {
      // A selection change alone must not replace the Listbox's focused option.
      equals: (previous, current) => previous.length === current.length && previous.every((option, index) => {
        const next = current[index]
        return option.key === next.key && option.project === next.project &&
          projectChoiceDirectory(option) === projectChoiceDirectory(next)
      }),
    },
  )
  const visibleSelectedProjects = createMemo(() =>
    visibleProjects()
      .filter((option) => selectedProjectKeys().has(option.key))
      .map((option) => option.key),
  )
  const [executionMode, setExecutionMode] = createSignal<AutomationExecutionMode>("local")
  const [preset, setPreset] = createSignal<AutomationRecurrencePreset>("daily")
  const [time, setTime] = createSignal("09:00")
  const [timeZone, setTimeZone] = createSignal(browserTimeZone())
  const initialCalendar = automationRecurrenceDefaults(timeZone())
  const [startDate, setStartDate] = createSignal(initialCalendar.startDate)
  const [weekday, setWeekday] = createSignal<AutomationWeekday>(initialCalendar.weekday)
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
  let listSearchInput: HTMLInputElement | undefined
  let detailBackButton: HTMLButtonElement | undefined
  let formNameInput: HTMLInputElement | undefined
  let projectSearchInput: HTMLInputElement | undefined
  let projectListElement: HTMLUListElement | undefined
  let isStartDateComplete: (() => boolean) | undefined
  let isTimeComplete: (() => boolean) | undefined
  let projectLoadSequence = 0
  let disposed = false
  let errorFeedbackElement: HTMLDivElement | undefined
  let errorRetryButton: HTMLButtonElement | undefined
  const selected = createMemo(() => automations().find((automation) => automation.id === selectedID()) ?? null)
  const selectedRecurrence = createMemo(() => {
    const definition = selected()
    return definition ? parseAutomationRecurrence(definition.recurrence) : undefined
  })
  const detailProjectIDs = createMemo(() => {
    const target = selected()?.target
    return target?.scope === "project" ? target.projectIds : []
  })
  const detailSessionID = createMemo(() => {
    const target = selected()?.target
    return target?.scope === "session" ? target.sessionId : undefined
  })
  const selectedRunState = createMemo(() => {
    const state = runState()
    return state && state.automationID === selectedID() && isApiAuthorityCurrent(state.authority)
      ? state
      : undefined
  })
  const acceptedRunItems = () => selectedRunState()?.items
  const runsByID = createMemo(() => new Map((acceptedRunItems() ?? []).map((run) => [run.id, run])))
  const runIDs = createMemo(() => [...runsByID().keys()])
  const scopedAutomations = createMemo(() => automations().filter((automation) =>
    (filter() === "all" || automation.status === filter()) &&
    (scopeFilter() === "all" || automation.target.scope === scopeFilter()),
  ))
  const searchQuery = () => search().trim().toLocaleLowerCase()
  const projectSearchIncomplete = () => Boolean(searchQuery()) && projectRead().status !== "ready" &&
    scopedAutomations().some(({ target }) => target.scope === "project")
  const sessionTitles = createMemo(() => {
    const owners = new Map<string, Set<string>>()
    for (const { targetSession } of automations()) {
      if (!targetSession) continue
      const matches = owners.get(targetSession.title) ?? new Set<string>()
      matches.add(targetSession.id)
      owners.set(targetSession.title, matches)
    }
    return owners
  })
  const filteredAutomations = createMemo(() => {
    const query = searchQuery()
    if (!query) return scopedAutomations()
    const matches = (value: string | undefined) => value?.toLocaleLowerCase().includes(query)
    return scopedAutomations().filter(({ name, prompt, recurrence, target, targetSession }) => {
      const parsed = parseAutomationRecurrence(recurrence)
      const wallTime = parsed.preset === "custom" ? undefined : parsed.time
      if ([name, prompt, recurrenceSummary(parsed), recurrence, wallTime].some(matches)) return true
      if (target.scope === "session") {
        return [target.sessionId, targetSession?.title, targetSession?.directory].some(matches)
      }
      return target.scope === "project" && target.projectIds.some((id) => {
        const project = projectsByID().get(id)
        return [id, project?.name, project?.directory].some(matches)
      })
    })
  })
  function targetLabel({ target, targetSession }: AutomationView): string {
    if (target.scope === "session") {
      if (!targetSession) return t("automations.session_target_with_id", {
        name: t("automations.session_target_unavailable"), session: target.sessionId,
      })
      const { title } = targetSession
      if (!title.trim()) return t("automations.session_target_exact", { session: target.sessionId })
      return (sessionTitles().get(title)?.size ?? 0) > 1
        ? t("automations.session_target_with_id", { name: title, session: target.sessionId }) : title
    }
    if (target.scope === "global") return t("automations.scope.global")
    return projectListFormat().format(target.projectIds.map((id) => {
      const project = projectsByID().get(id)
      if (!project) return id
      const hint = projectHints().get(project.directory)
      return hint ? t("automations.project_target_with_hint", { name: project.name, directory: hint }) : project.name
    }))
  }
  function deletionLabel(automation: AutomationView): string {
    return automation.target.scope === "global"
      ? t("automations.delete_named", { name: automation.name })
      : t("automations.delete_named_in_target", { name: automation.name, target: targetLabel(automation) })
  }
  const filtersActive = createMemo(() => Boolean(search().trim()) || filter() !== "all" || scopeFilter() !== "all")
  const initialLoadError = createMemo(() => {
    const problem = error()
    return automations().length === 0 && problem?.source === "list-load" ? problem : null
  })
  const feedbackRetryPending = () => error()?.source === "delete-retry" ? Boolean(busyAction()) : error()?.source !== undefined && loading()
  const statusNeedsCheck = () => error()?.source === "status-check"
  const checkingStatus = () => statusNeedsCheck() && loading()
  function deletionNeedsRetry(id: string): boolean {
    const problem = error()
    return problem?.source === "delete-retry" && problem.automationID === id
  }
  function feedbackRetryLabel(source: AutomationError["source"]): string {
    if (feedbackRetryPending()) return "common.retrying"
    switch (source) {
      case "status-check": return "automations.check_status"
      case "delete-check": return "automations.review_latest"
      case "delete-retry": return "automations.retry_delete"
      default: return "common.retry"
    }
  }
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
      if (!props.active) return
      const target = resolveTarget()
      if (target?.isConnected) target.focus()
    })
  }
  function showFormError(problem: AutomationError): void {
    setError(problem)
    focusAfterRender(() => errorFeedbackElement)
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
  const modelOptions = createMemo<AutomationModelOption[]>(() => {
    const available = connectedModelOptions()
    const storedProvider = providerID()
    const storedModel = modelID()
    const retained =
      storedProvider &&
      storedModel &&
      !available.some((option) => option.providerID === storedProvider && option.modelID === storedModel)
        ? [
            {
              value: `${storedProvider}/${storedModel}`,
              providerID: storedProvider,
              providerLabel: storedProvider,
              modelID: storedModel,
              modelLabel: `${storedProvider}/${storedModel}`,
              variants: [],
              retained: true,
            },
          ]
        : []
    return [
      {
        value: "",
        providerID: "",
        providerLabel: "",
        modelID: "",
        modelLabel: t(scope() === "global" ? "automations.model_global_default" : "automations.model_default"),
        variants: [],
        defaultModel: true,
      },
      ...retained,
      ...available,
    ]
  })
  const selectedModelOption = createMemo(
    () =>
      modelOptions().find((option) => option.providerID === providerID() && option.modelID === modelID()) ??
      modelOptions()[0],
  )
  const reasoningOptions = createMemo<SelectOption<string>[]>(() => {
    const variants = selectedModelOption()?.variants ?? []
    const stored = reasoningEffort()
    return [
      { value: "", label: t("automations.reasoning_default") },
      ...(stored && !variants.includes(stored)
        ? [{ value: stored, label: `${stored} · ${t("automations.saved_value")}` }]
        : []),
      ...variants.map((value) => ({ value, label: reasoningLabel(value) })),
    ]
  })
  const selectedReasoningOption = createMemo(() => selectOption(reasoningOptions(), reasoningEffort()))
  const timeZoneOptions = automationTimeZoneOptions()
  const selectedTimeZoneOption = createMemo(() => timeZoneOptions.find((option) => option.value === timeZone()) ?? null)
  const showForm = createMemo(() => editing() || creating())
  onCleanup(props.registerAuthor(showForm))
  const displayedError = createMemo((): AutomationError | null => {
    const reported = error()
    if (reported) return reported
    const id = selected()?.id
    return id && !showForm() && runningAutomationID() !== id && hasUnconfirmedRun(id)
      ? { messageKey: "automations.error.run_unconfirmed", tone: "warning" }
      : null
  })
  const sessionTargetID = createMemo(() => {
    const target = editOwner()?.definition.target
    if (target?.scope === "session") return target.sessionId
    return draftSessionID()
  })
  const openedSessionTarget = createMemo(() => {
    const opened = editOwner()?.definition
    return opened?.target.scope === "session" && opened.target.sessionId === sessionTargetID() ? opened : undefined
  })
  const sessionTargetTitle = createMemo(() => {
    const opened = openedSessionTarget()
    return opened ? opened.targetSession?.title : workLedgerSessionExecution(sessionTargetID())?.title
  })
  const missingOpenedSession = () => openedSessionTarget()?.targetSession === null
  const validSessionTarget = () => Boolean(sessionTargetID()) && !missingOpenedSession()
  function resetForm(automation?: AutomationView): void {
    const recurrence = automation ? parseAutomationRecurrence(automation.recurrence) : null
    const zone = recurrence?.timeZone ?? browserTimeZone()
    const calendar = recurrence ?? automationRecurrenceDefaults(zone)
    setName(automation?.name ?? "")
    setProjectSearch("")
    setPrompt(automation?.prompt ?? "")
    setScope(automation?.target.scope ?? "global")
    setDraftSessionID("")
    setSelectedProjectTargets(
      automation?.target.scope === "project"
        ? automation.target.projectIds.map<AutomationProjectTarget>((projectID) => ({ kind: "project", projectID })) : [],
    )
    setExecutionMode(automation?.target.scope === "session" ? "local" : (automation?.executionMode ?? "local"))
    setPreset(recurrence?.preset ?? "daily")
    setAdvancedRule(recurrence?.customRule ?? "")
    setTime(recurrence?.time ?? "09:00")
    setTimeZone(zone)
    setStartDate(calendar.startDate)
    setWeekday(calendar.weekday)
    setProviderID(automation?.model?.providerID ?? "")
    setModelID(automation?.model?.modelID ?? "")
    setReasoningEffort(automation?.reasoningEffort ?? "")
    setError(null)
  }

  async function load(
    preferredID?: string,
    { background, confirmation, authority }: { background?: boolean; confirmation?: AutomationError; authority?: ApiAuthority } = {},
  ): Promise<void> {
    listRequest?.abort()
    const request = new AbortController()
    listRequest = request
    const owns = () => !request.signal.aborted && (!authority || isApiAuthorityCurrent(authority))
    if (!background) {
      setLoading(true)
      if (!confirmation && error()?.source !== "list-load") setError(null)
    }
    try {
      const items = await listAutomations(request.signal, authority)
      if (!owns()) return
      if (background) {
        setAutomations(items)
      } else {
        const hadRetryFocus = Boolean(confirmation || initialLoadError()) && document.activeElement === errorRetryButton
        const nextID = preferredID && items.some((item) => item.id === preferredID) ? preferredID : ""
        batch(() => {
          setAutomations(items)
          setSelectedID(nextID)
          if (confirmation || error()?.source === "list-load") setError(null)
          setLoading(false)
        })
        if (hadRetryFocus) {
          focusAfterRender(() => document.activeElement === document.body
            ? (nextID ? detailBackButton : listSearchInput) : undefined)
        }
      }
    } catch (cause) {
      if (owns()) {
        if (confirmation) {
          setError({ ...confirmation, details: [confirmation.details, formatErrorDetails(cause)].filter(Boolean).join("\n\n") })
        } else if (!background || !error()?.source || error()?.source === "list-load") {
          setError({
            ...automationFailure(cause, "automations.error.list_load_failed"),
            retry: () => void load(preferredID, { authority }),
            source: "list-load",
          })
        }
      }
    } finally {
      if (!request.signal.aborted && !background) setLoading(false)
    }
  }

  function invalidateListNavigation(): void {
    listRequest?.abort()
    listRequest = undefined
    setLoading(false)
  }

  function retireRunHistory(): void {
    runRequest?.abort()
    runRequest = undefined
    setRunState(undefined)
  }

  async function loadRuns(automationID: string, options: { skipPending?: boolean } = {}): Promise<void> {
    if (disposed || !automationID || selectedID() !== automationID) return
    const current = selectedRunState()
    if (options.skipPending && current?.pending) return
    runRequest?.abort()
    const request = new AbortController()
    runRequest = request
    const authority = captureApiAuthority()
    const owns = () => !disposed && runRequest === request && !request.signal.aborted &&
      selectedID() === automationID && isApiAuthorityCurrent(authority)
    const items = current?.items
    setRunState({ automationID, authority, pending: true, items, error: current?.error })
    try {
      const history = await listAutomationRuns(automationID, request.signal)
      if (owns()) setRunState({ automationID, authority, pending: false, items: history })
    } catch (cause) {
      if (owns()) {
        const messageKey = items ? "automations.error.history_refresh_failed" : "automations.error.history_load_failed"
        setRunState({ automationID, authority, pending: false, items, error: automationFailure(cause, messageKey) })
      }
    } finally {
      if (runRequest === request) runRequest = undefined
    }
  }

  function selectAutomation(id: string): void {
    if (loading() || busyAction()) return
    invalidateListNavigation()
    rememberListFocus()
    setSelectedID(id)
    setCreationRequestID(undefined)
    setEditOwner(null)
    setError(null)
    void loadRuns(id)
    focusAfterRender(() => detailBackButton)
  }

  function beginCreate(): void {
    if (loading() || busyAction()) return
    invalidateListNavigation()
    rememberListFocus()
    resetForm()
    setSelectedID("")
    setCreationRequestID(randomUUID())
    setEditOwner(null)
    focusAfterRender(() => formNameInput)
  }

  function beginSuggestion(suggestion: AutomationSuggestion): void {
    if (loading() || busyAction()) return
    invalidateListNavigation()
    rememberListFocus()
    resetForm()
    setName(suggestion.name)
    setPrompt(suggestion.prompt)
    setPreset(suggestion.preset)
    if (suggestion.weekday) setWeekday(suggestion.weekday)
    setTime(suggestion.time)
    setSelectedID("")
    setCreationRequestID(randomUUID())
    setEditOwner(null)
    focusAfterRender(() => formNameInput)
  }

  function returnToList(): void {
    if (busyAction()) return
    invalidateListNavigation()
    setSelectedID("")
    setCreationRequestID(undefined)
    setEditOwner(null)
    setError(null)
    void load()
    focusListReturn()
  }

  function selectScope(nextScope: AutomationScope): void {
    setError(null)
    if (nextScope === "session" && scope() !== "session") {
      setDraftSessionID(activeSessionID() || rootTaskSessionID())
    }
    setScope(nextScope)
    if (nextScope === "session") setExecutionMode("local")
  }

  function applyProjectSelection(next: Set<string>): void {
    setError(null)
    const visible = visibleProjects().map((option) => option.target)
    setSelectedProjectTargets((current) => applyVisibleAutomationProjectSelection(current, visible, next))
  }

  function beginEdit(): void {
    if (busyAction()) return
    const automation = selected()
    if (!automation) return
    invalidateListNavigation()
    const active = document.activeElement
    if (active instanceof HTMLElement) detailReturnFocusElement = active
    resetForm(automation)
    setEditOwner({ definition: automation, requestID: randomUUID() })
    setCreationRequestID(undefined)
    focusAfterRender(() => formNameInput)
  }

  function cancelForm(): void {
    if (busyAction()) return
    invalidateListNavigation()
    if (editing() && selectedID()) {
      setEditOwner(null)
      setError(null)
      focusAfterRender(() => (detailReturnFocusElement?.isConnected ? detailReturnFocusElement : detailBackButton))
      return
    }
    returnToList()
  }

  function selectModel(option: AutomationModelOption | null): void {
    setError(null)
    const next = option ?? modelOptions()[0]
    const changed = next.providerID !== providerID() || next.modelID !== modelID()
    setProviderID(next.providerID)
    setModelID(next.modelID)
    if (changed && !next.variants.includes(reasoningEffort())) setReasoningEffort("")
  }

  async function submitForm(event: SubmitEvent): Promise<void> {
    event.preventDefault()
    if (busyAction()) return
    setError(null)
    const edit = editOwner()
    const current = edit?.definition
    const requestID = creationRequestID()
    if (current && !automations().some((item) => item.id === current.id)) {
      showFormError({ messageKey: "automations.error.edit_target_missing" })
      return
    }
    if (!current && !requestID) {
      showFormError({ messageKey: "automations.error.edit_target_missing" })
      return
    }
    if (preset() !== "custom" && (!isStartDateComplete?.() || !isTimeComplete?.())) {
      showFormError({ messageKey: "automations.error.calendar_fields_required" })
      return
    }
    const form = {
      name: name().trim(),
      prompt: prompt().trim(),
      scope: scope(),
      sessionID: sessionTargetID(),
      projectTargets: [...selectedProjectTargets()],
      executionMode: executionMode(),
      recurrence: {
        preset: preset(),
        startDate: startDate(),
        weekday: weekday(),
        time: time(),
        timeZone: timeZone().trim(),
        customRule: advancedRule(),
      },
      model: providerID() && modelID() ? { providerID: providerID().trim(), modelID: modelID().trim() } : undefined,
      reasoningEffort: reasoningEffort().trim(),
    }
    if (form.scope === "session" && !form.sessionID) {
      showFormError({ messageKey: "automations.error.session_required" })
      return
    }
    if (form.scope === "project" && form.projectTargets.length === 0) {
      showFormError({ messageKey: "automations.error.project_required" })
      return
    }

    let recurrence: string | undefined
    try {
      recurrence = current
        ? automationRecurrenceUpdate(current.recurrence, form.recurrence)
        : buildAutomationRecurrence(form.recurrence)
    } catch (cause) {
      showFormError(automationFailure(cause, "automations.error.recurrence_invalid"))
      return
    }

    const owner: AutomationMutationOwner = { kind: "save", id: current?.id ?? "new" }
    const authority = captureApiAuthority()
    const owns = () => !disposed && mutationOwner() === owner && isApiAuthorityCurrent(authority)
    setMutationOwner(owner)
    try {
      const target: AutomationTarget =
        form.scope === "session"
          ? { scope: "session", sessionId: form.sessionID! }
          : form.scope === "project"
            ? {
                scope: "project",
                projectIds: await resolveAutomationProjectTargets(form.projectTargets),
              }
            : { scope: "global" }
      if (!owns()) return
      const base = {
        name: form.name,
        target,
        ...(recurrence !== undefined ? { recurrence } : {}),
        executionMode: form.scope === "session" ? ("local" as const) : form.executionMode,
        prompt: form.prompt,
        ...(form.model ? { model: form.model } : {}),
        ...(form.reasoningEffort ? { reasoningEffort: form.reasoningEffort } : {}),
      }
      let preferredID: string
      if (edit) {
        await editAutomation(edit.definition.id, {
          ...base,
          expectedRevisionId: edit.definition.revisionId,
          requestID: edit.requestID,
          model: form.model ?? null,
          reasoningEffort: form.reasoningEffort || null,
        }, authority)
        preferredID = edit.definition.id
      } else {
        const created = await createAutomation({ ...base, recurrence: recurrence!, requestID }, authority)
        preferredID = created.id
      }
      if (!owns()) return
      setCreationRequestID(undefined)
      setEditOwner(null)
      await load(preferredID)
      await loadRuns(preferredID)
      if (form.scope === "project") await loadProjectChoices({ afterSave: true })
      focusAfterRender(() => detailBackButton)
    } catch (cause) {
      if (!owns()) return
      const missingEditTarget = current && cause instanceof ApiError && cause.status === 404 &&
        cause.path === `/global/automations/${encodeURIComponent(current.id)}`
      const messageKey = cause instanceof AutomationWriteUnconfirmedError
        ? current ? "automations.error.edit_unconfirmed" : "automations.error.creation_unconfirmed"
        : missingEditTarget ? "automations.error.edit_target_missing" : "automations.error.save_failed"
      showFormError(automationFailure(cause, messageKey))
    } finally {
      if (mutationOwner() === owner) setMutationOwner(null)
    }
  }

  async function performRun(id: string): Promise<void> {
    if (busyAction()) return
    const authority = captureApiAuthority()
    const owner: AutomationMutationOwner = { kind: "action", id, operation: "run" }
    setMutationOwner(owner)
    setError(null)
    try {
      await runAutomationNow(id)
      if (!isApiAuthorityCurrent(authority)) return
      await load(id)
      if (isApiAuthorityCurrent(authority)) await loadRuns(id)
    } catch (cause) {
      if (!isApiAuthorityCurrent(authority)) return
      if (hasPendingAutomationRun(id)) {
        setError({ ...automationFailure(cause, automationErrorName(cause) === "AutomationManualRunPendingError"
          ? "automations.error.run_pending" : "automations.error.run_unconfirmed"), tone: "warning" })
      } else {
        setError(automationFailure(cause, "automations.error.run_failed"))
      }
    } finally {
      setManualRunRevision((value) => value + 1)
      if (mutationOwner() === owner) setMutationOwner(null)
    }
  }

  async function performStatusChange(current: AutomationView): Promise<void> {
    if (busyAction() || statusNeedsCheck()) return
    const authority = captureApiAuthority()
    const owner: AutomationMutationOwner = { kind: "action", id: current.id, operation: "status" }
    const owns = () => !disposed && mutationOwner() === owner && selectedID() === current.id && isApiAuthorityCurrent(authority)
    setMutationOwner(owner)
    setError(null)
    try {
      const status = current.status === "active" ? "paused" : "active"
      const confirmed = await changeAutomationStatus(current.id, current.revisionId, status, authority)
      if (!owns()) return
      invalidateListNavigation()
      setAutomations((items) => items.map((item) =>
        item.id === current.id && item.revisionId === current.revisionId ? confirmed : item,
      ))
    } catch (cause) {
      if (!owns()) return
      const revisionConflict = cause instanceof ApiError && cause.status === 409 &&
        automationErrorName(cause) === "AutomationRevisionConflictError"
      if (!revisionConflict && !(cause instanceof AutomationStatusUnconfirmedError)) {
        setError(automationFailure(cause, "automations.error.status_failed"))
        return
      }
      const problem: AutomationError = {
        messageKey: revisionConflict ? "automations.error.status_revision_conflict" : "automations.error.status_unconfirmed",
        details: formatErrorDetails(cause),
        source: "status-check",
        tone: "warning",
        retry: () => {
          if (!disposed && selectedID() === current.id && isApiAuthorityCurrent(authority)) {
            void load(current.id, { confirmation: problem, authority })
          }
        },
      }
      setError(problem)
      focusAfterRender(() => document.activeElement === document.body ? errorRetryButton : undefined)
    } finally {
      if (mutationOwner() === owner) setMutationOwner(null)
    }
  }

  async function confirmRemoveAutomation(automation: AutomationView): Promise<void> {
    const authority = captureApiAuthority()
    const owns = () => !disposed && props.active && !busyAction() && isApiAuthorityCurrent(authority)
    let message = t("automations.delete_confirm", { name: automation.name })
    if (automation.target.scope === "project") {
      const targets = automation.target.projectIds.map((id) => {
        const project = projectsByID().get(id)
        return project ? `${project.name}\n${project.directory}` : id
      })
      message = `${message}\n\n${t("automations.project_targets")}\n${targets.join("\n\n")}`
    } else if (automation.target.scope === "session") {
      const { sessionId } = automation.target
      const { targetSession } = automation
      const targetLines = [
        t("automations.linked_conversation"),
        targetSession?.title || t("automations.session_target_unavailable"),
        t("automations.session_target_exact", { session: sessionId }),
        targetSession?.directory,
      ].filter(Boolean)
      message = `${message}\n\n${targetLines.join("\n")}`
    }
    try {
      const decision = await showAppDialog({
        title: t("automations.delete"),
        message,
        kind: "warning",
        cancel: true,
        okTone: "danger",
        okLabel: t("automations.delete"),
        openingGuard: owns,
      })
      if (decision.confirmed && owns()) await removeAutomation(automation, randomUUID(), authority)
    } catch (cause) {
      if (owns()) setError(automationFailure(cause, "automations.error.delete_failed"))
    }
  }

  async function removeAutomation(
    automation: AutomationView,
    requestID: string,
    authority: ApiAuthority,
    previous?: AutomationError,
  ): Promise<void> {
    if (busyAction() || disposed || !isApiAuthorityCurrent(authority)) return
    const { id } = automation
    const removingSelected = selectedID() === id
    const active = document.activeElement
    const removingFocusedRow = active instanceof HTMLElement && Boolean(active.closest(".automation-list-row"))
    const removingFromRetry = active === errorRetryButton
    if (removingFocusedRow) rememberListFocus()
    const owner: AutomationMutationOwner = { kind: "action", id, operation: "delete" }
    const owns = () => !disposed && mutationOwner() === owner && isApiAuthorityCurrent(authority)
    setMutationOwner(owner)
    if (!previous) setError(null)
    try {
      await deleteAutomation(automation, requestID, authority)
      if (!owns()) return
      batch(() => {
        setAutomations((items) => items.filter((item) => item.id !== id))
        if (removingSelected) setSelectedID("")
      })
      await load(undefined, { authority })
      if (owns() && (removingSelected || removingFocusedRow || removingFromRetry)) focusListReturn()
    } catch (cause) {
      if (!owns()) return
      const details = [previous?.details, formatErrorDetails(cause)].filter(Boolean).join("\n\n")
      const name = automationErrorName(cause)
      if (cause instanceof AutomationWriteUnconfirmedError) {
        const problem: AutomationError = {
          messageKey: "automations.error.delete_unconfirmed", details, source: "delete-retry", automationID: id, tone: "warning",
          retry: () => void removeAutomation(automation, requestID, authority, error() ?? undefined),
        }
        setError(problem)
        focusAfterRender(() => errorRetryButton)
      } else if (name === "AutomationRevisionConflictError" || name === "NotFoundError") {
        const problem: AutomationError = {
          messageKey: name === "NotFoundError" ? "automations.error.delete_unavailable" : "automations.error.delete_revision_conflict",
          details, source: "delete-check", tone: "warning",
          retry: () => {
            if (!disposed && isApiAuthorityCurrent(authority)) {
              void load(removingSelected ? id : undefined, { confirmation: error() ?? problem, authority })
            }
          },
        }
        setError(problem)
        focusAfterRender(() => errorRetryButton)
      } else {
        setError({ ...automationFailure(cause, "automations.error.delete_failed"), details })
      }
    } finally {
      if (mutationOwner() === owner) setMutationOwner(null)
    }
  }

  async function loadProjectChoices(options: { afterSave?: boolean; trigger?: HTMLButtonElement } = {}): Promise<void> {
    const previous = projectRead()
    if (options.trigger && previous.status !== "failed") return
    const issue = projectReadIssue()
    const afterSave = options.afterSave || issue?.afterSave || false
    const sequence = ++projectLoadSequence
    const authority = captureApiAuthority()
    const owns = () => !disposed && sequence === projectLoadSequence && isApiAuthorityCurrent(authority)
    setProjectRead(issue
      ? { ...issue, status: "retrying", afterSave }
      : { status: "reading", projects: previous.projects })
    try {
      const discovery = await loadDiscoveredProjects(authority)
      if (!owns()) return
      const returnFocus = options.trigger?.isConnected && document.activeElement === options.trigger
      setProjectRead({ status: "ready", projects: discovery.projects })
      if (returnFocus) focusAfterRender(() => {
        if (document.activeElement !== document.body) return
        if (showForm() && scope() === "project") return projectSearchInput
        return selected() && !showForm() ? detailBackButton : listSearchInput
      })
    } catch (cause) {
      if (owns()) setProjectRead({ status: "failed", projects: previous.projects, cause, afterSave })
    }
  }

  function projectReadFeedback(showLoading: boolean) {
    return (
      <Show when={projectReadIssue()} fallback={
        <Show when={showLoading && projectRead().status === "reading"}>
          <Feedback tone="info" aria-busy="true">
            {t(projectRead().projects?.length ? "automations.project_targets_loading_retained" : "automations.project_targets_loading")}
          </Feedback>
        </Show>
      }>
        {(issue) => (
          <Feedback
            tone="error"
            details={formatErrorDetails(issue().cause)}
            actions={
              <Button
                type="button"
                variant="outline"
                size="sm"
                tone="neutral"
                aria-disabled={issue().status === "retrying" || Boolean(busyAction()) || undefined}
                aria-busy={issue().status === "retrying" || undefined}
                onClick={(event) => {
                  if (!busyAction()) void loadProjectChoices({ trigger: event.currentTarget })
                }}
              >
                <Icon name={issue().status === "retrying" ? "loading" : "refresh"} />
                {t(issue().status === "retrying" ? "common.retrying" : "common.retry")}
              </Button>
            }
          >
            {t(issue().afterSave ? "automations.error.project_details_refresh_failed"
              : issue().projects?.length ? "automations.project_targets_load_failed_retained" : "automations.project_targets_load_failed")}
          </Feedback>
        )}
      </Show>
    )
  }

  async function initializeHost(): Promise<void> {
    const automationLoad = load()
    void loadProjectChoices()
    const details = await loadProviderInfo().then(
      (issues) => issues.map((issue) => issue.message),
      (cause) => [formatErrorDetails(cause)],
    )
    await automationLoad
    if (details.length > 0) {
      const previous = error()
      const listLoadFailed = previous?.source === "list-load"
      setError({
        messageKey: listLoadFailed ? previous.messageKey : "automations.error.provider_setup_failed",
        details: [...(listLoadFailed && previous.details ? [previous.details] : []), ...details].join("\n\n"),
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
      setError(automationFailure(cause, "automations.error.session_open_failed"))
    }
  }

  async function refreshDueAutomation(): Promise<void> {
    const preferredID = selectedID()
    await load(preferredID, { background: true })
    if (preferredID && selectedID() === preferredID) await loadRuns(preferredID, { skipPending: true })
  }

  createEffect(() => {
    const state = runState()
    if (state && (state.automationID !== selectedID() || !isApiAuthorityCurrent(state.authority))) retireRunHistory()
  })

  createEffect(() => {
    if (!props.active) setTimeZoneOpen(false)
  })

  createEffect(() => {
    if (dueRefreshTimer) clearTimeout(dueRefreshTimer)
    dueRefreshTimer = undefined
    if (!props.active) return
    const dueTimes = automations()
      .filter((automation) => automation.status === "active")
      .map((automation) => automation.nextRun)
      .filter((instant): instant is number => instant !== null)
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
    disposed = true
    projectLoadSequence += 1
    if (dueRefreshTimer) clearTimeout(dueRefreshTimer)
    listRequest?.abort()
    runRequest?.abort()
  })

  return (
    <SettingsPanel class="scheduled-automations-panel" data-ui="scheduled-automations">
      <div class="automations-page-intro">
        <p>{t("automations.subtitle")}</p>
        <div class="automations-page-actions">
          <Show when={!initialLoadError() && !showForm()}>
          <Button
            type="button"
            variant="solid"
            size="md"
            tone="neutral"
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
          <Show when={displayedError()}>
            {(problem) => (
              <Feedback
                ref={errorFeedbackElement}
                tabIndex={-1}
                tone={problem().tone ?? "error"}
                details={problem().details}
                actions={
                  <Show when={problem().retry}>
                    {(retry) => (
                      <Button
                        type="button"
                        variant={initialLoadError() ? "outline" : "ghost"}
                        size={initialLoadError() ? "sm" : "mini"}
                        tone="neutral"
                        ref={(element) => (errorRetryButton = element)}
                        disabled={!problem().source && Boolean(busyAction())}
                        aria-disabled={Boolean(problem().source) && (feedbackRetryPending() || Boolean(busyAction())) || undefined}
                        aria-busy={feedbackRetryPending() || undefined}
                        onClick={() => {
                          if (!busyAction() && !feedbackRetryPending()) retry()()
                        }}
                      >
                        <Icon name="refresh" />
                        {t(feedbackRetryLabel(problem().source))}
                      </Button>
                    )}
                  </Show>
                }
              >
                {t(problem().messageKey)}
              </Feedback>
            )}
          </Show>
          <Show when={!showForm() || scope() !== "project"}>{projectReadFeedback(false)}</Show>
          <Show when={!initialLoadError()}>
          <aside ref={listElement} class="automations-list" aria-label={t("automations.list")}>
            <SearchField
              clearable
              class="automations-search"
              size="md"
              value={search()}
              inputRef={(element) => (listSearchInput = element)}
              placeholder={t("automations.search_placeholder")}
              onValueChange={setSearch}
              disabled={Boolean(busyAction())}
            />
            <div class="automations-filters">
              <SegmentedControl
                class="automations-filter"
                options={filterOptions()}
                value={filter()}
                ariaLabel={t("automations.filter_label")}
                onChange={setFilter}
              />
              <SegmentedControl
                class="automations-filter"
                options={scopeFilterOptions()}
                value={scopeFilter()}
                ariaLabel={t("automations.scope_filter_label")}
                onChange={setScopeFilter}
              />
            </div>
            <Show when={!loading()} fallback={<SettingsEmpty>{t("common.loading")}</SettingsEmpty>}>
              <Show
                when={filteredAutomations().length > 0}
                fallback={
                  <SettingsEmpty>
                    <span role="status">
                      {projectSearchIncomplete()
                        ? t(projectRead().status === "failed" ? "automations.project_search_incomplete" : "automations.project_targets_loading")
                        : t(filtersActive() ? "automations.filtered_empty" : "automations.empty")}
                    </span>
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
                    {(automation) => {
                      const parsed = parseAutomationRecurrence(automation.recurrence)
                      const summary = createMemo(() => recurrenceSummary(parsed))
                      return (
                        <div class="automation-list-row">
                          <SettingsRow
                            as="button"
                            class="automation-list-item"
                            interactive
                            customContent
                            data-selected={String(selectedID() === automation.id)}
                            disabled={loading() || Boolean(busyAction()) || deletionNeedsRetry(automation.id)}
                            onClick={() => selectAutomation(automation.id)}
                          >
                            <Icon name={automation.status === "active" ? "run" : "scheduled"} />
                            <span class="automation-list-item__copy">
                              <span class="automation-list-item__top">
                                <strong title={automation.name}>{automation.name}</strong>
                                <span title={targetLabel(automation)}>{targetLabel(automation)}</span>
                              </span>
                              <span class="automation-list-item__timing">
                                <span class="automation-list-item__next">
                                  {deletionNeedsRetry(automation.id) ? t("automations.deletion_unconfirmed") : automation.status === "active"
                                    ? t("automations.next_run", { value: nextRunValue(automation) })
                                    : nextRunValue(automation)}
                                </span>
                                <span class="automation-list-item__rule" title={summary()}>
                                  {summary()}
                                </span>
                              </span>
                            </span>
                          </SettingsRow>
                          <Button
                            type="button"
                            class="automation-list-delete"
                            variant="ghost"
                            size="mini"
                            tone="danger"
                            title={deletionLabel(automation)}
                            aria-label={deletionLabel(automation)}
                            disabled={loading() || Boolean(busyAction()) || deletionNeedsRetry(automation.id)}
                            onClick={() => void confirmRemoveAutomation(automation)}
                          >
                            <Icon name="delete" />
                          </Button>
                        </div>
                      )
                    }}
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
            <Show when={!loading() || checkingStatus()} fallback={<SettingsEmpty>{t("common.loading")}</SettingsEmpty>}>
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
                        tone="neutral"
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
                        disabled={Boolean(busyAction()) || checkingStatus()}
                        onClick={returnToList}
                      >
                        <Icon name="nav-back" />
                        {t("automations.back")}
                      </Button>
                      <header class="automation-detail-header">
                        <div>
                          <div class="automation-detail-heading">
                            <h3>{automation().name}</h3>
                            <Badge tone={statusNeedsCheck() || deletionNeedsRetry(automation().id) ? "neutral" : statusTone(automation().status)}>
                              {t(deletionNeedsRetry(automation().id) ? "automations.deletion_unconfirmed"
                                : statusNeedsCheck() ? "automations.status.unconfirmed" : `automations.status.${automation().status}`)}
                            </Badge>
                          </div>
                          <Show when={selectedRecurrence()}>{(parsed) => <p>{recurrenceSummary(parsed())}</p>}</Show>
                        </div>
                        <div class="automation-detail-actions">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            tone="neutral"
                            data-ui="automation-run-now"
                            disabled={Boolean(busyAction()) || checkingStatus() || deletionNeedsRetry(automation().id)}
                            title={hasUnconfirmedRun(automation().id) ? t("automations.retry_run_hint") : undefined}
                            onClick={() => void performRun(automation().id)}
                          >
                            <Icon name={runningAutomationID() === automation().id ? "loading" : "run"} />
                            {t(runningAutomationID() === automation().id ? "automations.running" : hasUnconfirmedRun(automation().id)
                              ? "automations.retry_run" : "automations.run_now")}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            tone="neutral"
                            data-ui="automation-edit"
                            disabled={Boolean(busyAction()) || checkingStatus() || deletionNeedsRetry(automation().id)}
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
                            disabled={Boolean(busyAction()) || statusNeedsCheck() || deletionNeedsRetry(automation().id)}
                            onClick={() => void performStatusChange(automation())}
                          >
                            {automation().status === "active" ? t("automations.pause") : t("automations.resume")}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            tone="danger"
                            disabled={Boolean(busyAction()) || checkingStatus() || deletionNeedsRetry(automation().id)}
                            onClick={() => void confirmRemoveAutomation(automation())}
                          >
                            <Icon name="delete" />
                            {t("automations.delete")}
                          </Button>
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
                          <strong class="automation-detail-next-run">{statusNeedsCheck() || deletionNeedsRetry(automation().id)
                            ? t("automations.status.unconfirmed") : nextRunValue(automation())}</strong>
                        </div>
                        <div>
                          <span>{t("automations.last")}</span>
                          <strong>{!automation().lastRun && hasUnconfirmedRun(automation().id)
                            ? t("automations.last_run_unconfirmed") : formatTimestamp(automation().lastRun)}</strong>
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

                      <Show when={selectedRecurrence()?.preset === "custom"}>
                        <Disclosure.Root variant="surface">
                          <Disclosure.Trigger>{t("automations.recurrence.rule_details")}</Disclosure.Trigger>
                          <Disclosure.Content>
                            <pre class="automation-recurrence-rule">{automation().recurrence}</pre>
                          </Disclosure.Content>
                        </Disclosure.Root>
                      </Show>

                      <Show when={detailProjectIDs().length > 0}>
                        <section class="automation-target-summary">
                          <h4>{t("automations.project_targets")}</h4>
                          <ul class="automation-target-summary-list">
                            <For each={detailProjectIDs()}>
                              {(id) => {
                                const project = () => projectsByID().get(id)
                                return (
                                  <li>
                                    <strong>{project()?.name ?? id}</strong>
                                    <Show when={project()}>{(value) => <small>{value().directory}</small>}</Show>
                                  </li>
                                )
                              }}
                            </For>
                          </ul>
                        </section>
                      </Show>

                      <Show when={detailSessionID()}>
                        {(sessionId) => (
                          <section class="automation-target-summary">
                            <h4>{t("automations.linked_conversation")}</h4>
                            <ul class="automation-target-summary-list">
                              <li>
                                <strong>{automation().targetSession?.title || t("automations.session_target_unavailable")}</strong>
                                <small>{t("automations.session_target_exact", { session: sessionId() })}</small>
                                <Show when={automation().targetSession}>{(session) => <small>{session().directory}</small>}</Show>
                              </li>
                            </ul>
                          </section>
                        )}
                      </Show>

                      <section class="automation-prompt">
                        <h4>{t("automations.prompt")}</h4>
                        <p>{automation().prompt}</p>
                        <Show when={automation().lastError}>
                          <Feedback tone="error">{automation().lastError}</Feedback>
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
                            aria-disabled={Boolean(busyAction()) || selectedRunState()?.pending || undefined}
                            aria-busy={selectedRunState()?.pending || undefined}
                            onClick={() => {
                              if (!busyAction()) void loadRuns(automation().id, { skipPending: true })
                            }}
                          >
                            <Icon name="refresh" />
                            {t(selectedRunState()?.error
                              ? (selectedRunState()?.pending ? "common.retrying" : "common.retry")
                              : "common.refresh")}
                          </Button>
                        </div>
                        <Show when={selectedRunState()?.error}>
                          {(problem) => (
                            <Feedback tone="error" details={problem().details}>
                              <div>{t(problem().messageKey)}</div>
                              <Show when={acceptedRunItems()}>
                                <div>{t("automations.history_last_confirmed")}</div>
                              </Show>
                            </Feedback>
                          )}
                        </Show>
                        <Show when={selectedRunState()?.pending && !selectedRunState()?.error}>
                          <p class="automations-muted" role="status">
                            {t(acceptedRunItems() ? "automations.history_refreshing" : "common.loading")}
                          </p>
                        </Show>
                        <Show when={!selectedRunState()}>
                          <p class="automations-muted">{t("automations.history_not_loaded")}</p>
                        </Show>
                        <Show when={acceptedRunItems()}>
                          <Show
                            when={runIDs().length > 0}
                            fallback={<p class="automations-muted">{t("automations.history_empty")}</p>}
                          >
                            <div class="automation-run-list">
                              <For each={runIDs()}>
                                {(runID) => (
                                  <Show when={runsByID().get(runID)}>
                                    {(run) => (
                                      <div class="automation-run-row">
                                        <Badge tone={outcomeTone(run().outcome)} size="sm">
                                          {t(`automations.outcome.${run().outcome}`)}
                                        </Badge>
                                        <span>{formatTimestamp(run().startedAt)}</span>
                                        <Show
                                          when={run().session}
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
                                        <Show when={run().error}>
                                          <span class="automation-run-row__error">{run().error}</span>
                                        </Show>
                                      </div>
                                    )}
                                  </Show>
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
                  onClick={returnToList}
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
                      tone="neutral"
                      disabled={
                        Boolean(busyAction()) ||
                        !name().trim() ||
                        !prompt().trim() ||
                        (scope() === "session" && !sessionTargetID()) ||
                        (scope() === "project" && selectedProjectTargets().length === 0)
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
                      data-valid={String(validSessionTarget())}
                    >
                      <Icon name={validSessionTarget() ? "check" : "info-circle"} />
                      <div>
                        <strong>{sessionTargetTitle() || t(missingOpenedSession()
                          ? "automations.session_target_unavailable" : "automations.session_target")}</strong>
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
                      <SearchField
                        clearable
                        value={projectSearch()}
                        inputRef={(element) => (projectSearchInput = element)}
                        placeholder={t("automations.project_search")}
                        onValueChange={setProjectSearch}
                        disabled={Boolean(busyAction())}
                        onKeyDown={(event) => {
                          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
                          const options = projectListElement?.isConnected
                            ? projectListElement.querySelectorAll<HTMLElement>('[role="option"]:not([aria-disabled="true"])')
                            : undefined
                          const target = event.key === "ArrowDown" ? options?.[0] : options?.[options.length - 1]
                          if (!target) return
                          event.preventDefault()
                          target.focus()
                        }}
                      />
                      {projectReadFeedback(true)}
                      <Show when={projectRead().projects !== undefined}>
                        <span class="automations-muted" role="status" aria-live="polite">
                          {t("automations.project_results", {
                            visible: visibleProjects().length.toLocaleString(localeTag()),
                            total: projectChoices().length.toLocaleString(localeTag()),
                            selected: selectedProjectTargets().length.toLocaleString(localeTag()),
                          })}
                        </span>
                      </Show>
                      <Show when={visibleProjects().length > 0} fallback={
                        <Show when={projectRead().status === "ready"}>
                          <span class="automations-muted">{t(projectChoices().length > 0 ? "automations.project_search_empty" : "automations.project_targets_empty")}</span>
                        </Show>
                      }>
                      <ListboxRoot<AutomationProjectOption>
                        ref={projectListElement}
                        class="automation-project-target-list"
                        density="rich"
                        aria-label={t("automations.project_targets")}
                        options={visibleProjects()}
                        optionValue={(option) => option.key}
                        optionTextValue={projectChoiceLabel}
                        value={visibleSelectedProjects()}
                        selectionMode="multiple"
                        selectionBehavior="toggle"
                        onChange={applyProjectSelection}
                        renderItem={(node) => {
                          const option = node.rawValue
                          return (
                            <ListboxItem
                              item={node}
                              class="automation-project-target"
                              data-selected={String(selectedProjectKeys().has(option.key))}
                            >
                              <span class="automation-project-target__selection" aria-hidden="true">
                                <Show when={selectedProjectKeys().has(option.key)}>
                                  <Icon name="check" size="compact" />
                                </Show>
                              </span>
                              <span>
                                <strong>{projectChoiceLabel(option)}</strong>
                                <Show when={projectChoiceDirectory(option)}>{(directory) => <small title={directory()}>{directory()}</small>}</Show>
                              </span>
                            </ListboxItem>
                          )
                        }}
                      />
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
                    <div class="automation-calendar-fields automation-field-wide">
                      <ScheduledCalendarField
                        kind="date"
                        value={startDate()}
                        timeZone={timeZone()}
                        disabled={Boolean(busyAction())}
                        onChange={(value) => { setError(null); setStartDate(value) }}
                        registerValidation={(check) => { isStartDateComplete = check }}
                      />
                      <Show when={preset() === "weekly"}>
                        <TextField.Root>
                          <TextField.Label>{t("automations.weekday")}</TextField.Label>
                          <SelectControl
                            options={(["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as AutomationWeekday[]).map(
                              (value) => ({ value, label: t(`automations.weekday.${value}`) }),
                            )}
                            value={{ value: weekday(), label: t(`automations.weekday.${weekday()}`) }}
                            onChange={(option) => {
                              if (option) {
                                setError(null)
                                setWeekday(option.value)
                              }
                            }}
                            optionValue="value"
                            optionTextValue="label"
                            disallowEmptySelection
                            ariaLabel={t("automations.weekday")}
                            renderValue={(option) => option?.label}
                            renderOptionLabel={(option) => option.label}
                          />
                        </TextField.Root>
                      </Show>
                      <ScheduledCalendarField
                        kind="time"
                        value={time()}
                        timeZone={timeZone()}
                        disabled={Boolean(busyAction())}
                        onChange={(value) => { setError(null); setTime(value) }}
                        registerValidation={(check) => { isTimeComplete = check }}
                      />
                      <TextField.Root class={preset() === "weekly" ? undefined : "automation-field-wide"}>
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
                    </div>
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
                      optionValue={(option) => `model:${option.value}`}
                      optionTextValue="modelLabel"
                      disallowEmptySelection
                      triggerDataUI="automation-model"
                      ariaLabel={t("automations.model")}
                      renderValue={(option) => (
                        <span>
                          {option?.modelLabel}
                          {option?.retained ? ` · ${t("automations.saved_value")}` : ""}
                        </span>
                      )}
                      renderOptionLabel={(option) =>
                        option.defaultModel
                          ? option.modelLabel
                          : option.retained
                            ? `${option.modelLabel} · ${t("automations.saved_value")}`
                            : `${option.providerLabel} · ${option.modelLabel}`
                      }
                    />
                    <TextField.Description>
                      {selectedModelOption().retained
                        ? t("automations.model_retained_help")
                        : t(scope() === "global" ? "automations.model_global_help" : "automations.model_help")}
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
                      optionValue={(option) => `reasoning:${option.value}`}
                      optionTextValue="label"
                      disallowEmptySelection
                      disabled={selectedModelOption().defaultModel || reasoningOptions().length === 1}
                      triggerDataUI="automation-reasoning"
                      ariaLabel={t("automations.reasoning")}
                      renderValue={(option) => <span>{option?.label}</span>}
                      renderOptionLabel={(option) => option.label}
                    />
                    <TextField.Description>
                      {reasoningEffort() && !selectedModelOption().variants.includes(reasoningEffort())
                        ? t("automations.reasoning_retained_help")
                        : selectedModelOption().retained
                          ? t("automations.reasoning_catalog_help")
                          : selectedModelOption().defaultModel
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

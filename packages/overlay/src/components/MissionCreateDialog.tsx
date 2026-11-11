import { createEffect, createMemo, createSignal, createUniqueId, For, on, onCleanup, Show } from "solid-js"
import type { ProductPillar } from "@opencorvus-ai/transport-protocol"
import { captureApiAuthority, isApiAuthorityCurrent, type ApiAuthority } from "../services/api"
import {
  inspectExpertSquad,
  loadExpertSquadCatalog,
  searchExpertSquads,
  type ExpertSquadMarketIndexItem,
  type ExpertSquadOption,
} from "../services/expert-squad"
import { projectDirectoryLabel, projectLedgerDisplayName } from "../utils/project-directory"
import { workLedgerProject } from "../services/work-ledger"
import { formatErrorDetails } from "../services/diagnostics"
import { localeTag, t } from "../utils/i18n"
import { randomUUID } from "../utils/random-id"
import { expertSquadDescription } from "../utils/expert-squad-description"
import { AutoGrowTextarea } from "./ui/AutoGrowTextarea"
import { Badge } from "./ui/Badge"
import { Button } from "./ui/Button"
import { Checkbox } from "./ui/Checkbox"
import { Dialog } from "./ui/Dialog"
import { Feedback } from "./ui/Feedback"
import { Icon } from "./ui/Icon"
import { SegmentedControl, type SegmentedControlOption } from "./ui/SegmentedControl"
import { ComboboxControl } from "./ui/ComboboxControl"
import { matchesSearchTerms } from "../services/text-search"
import { SearchField } from "./ui/SearchField"
import { TextField } from "./ui/TextField"

type MissionCreateMode = "manual" | "ai"
type MissionTypeSelection = ProductPillar | ""
type SelectOption = {
  value: string
  label: string
  description?: string
  action?: "install-more"
  outsideSearch?: boolean
}
type SquadSearchResult = { options: ExpertSquadOption[]; matchingIDs: readonly string[] }
type SquadReadFailure = { operation: "context" | "search"; cause: unknown }

export interface MissionCreateRequest {
  requestID: string
  directory: string
  request: string
  productPillar: ProductPillar
  expertSquadIDs: string[]
}

export interface MissionManualCreateRequest extends MissionCreateRequest {
  title: string
}

export interface MissionCreateDialogProps {
  open: boolean
  projectDirectories: readonly string[]
  defaultProjectDirectory: string
  onInstallMoreExpertSquads?: (projectDirectory: string) => void
  onMarketExpertSquadQuery?: (
    projectDirectory: string,
    query: string,
    productPillar: ProductPillar,
  ) => Promise<readonly ExpertSquadMarketIndexItem[]>
  onInstallMarketExpertSquad?: (projectDirectory: string, item: ExpertSquadMarketIndexItem) => Promise<void>
  onOpenMarketExpertSquad?: (item: ExpertSquadMarketIndexItem) => Promise<void>
  canOpenMarketWebPage?: boolean
  onClose: () => void
  onCreateManual: (input: MissionManualCreateRequest) => Promise<void>
  onCreateWithAI: (input: MissionCreateRequest) => Promise<void>
}

function mergeSquadOptions(
  incoming: readonly ExpertSquadOption[],
  current: readonly ExpertSquadOption[],
  selectedIDs: readonly string[],
): ExpertSquadOption[] {
  const merged = new Map(incoming.map((option) => [option.id, option]))
  for (const selectedID of selectedIDs) {
    const selected = current.find((option) => option.id === selectedID)
    if (selected && !merged.has(selected.id)) merged.set(selected.id, selected)
  }
  return [...merged.values()]
}

export function MissionCreateDialog(props: MissionCreateDialogProps) {
  const modeHelpID = createUniqueId()
  const [mode, setMode] = createSignal<MissionCreateMode>("ai")
  const [title, setTitle] = createSignal("")
  const [request, setRequest] = createSignal("")
  const [projectDirectory, setProjectDirectory] = createSignal("")
  const [productPillar, setProductPillar] = createSignal<MissionTypeSelection>("")
  const [expertSquadResult, setExpertSquadResult] = createSignal<SquadSearchResult>({ options: [], matchingIDs: [] })
  const expertSquads = () => expertSquadResult().options
  const [expertSquadIDs, setExpertSquadIDs] = createSignal<string[]>([])
  const [expertSquadQuery, setExpertSquadQuery] = createSignal("")
  const [expertSquadLoading, setExpertSquadLoading] = createSignal(false)
  const [expertSquadError, setExpertSquadError] = createSignal<SquadReadFailure>()
  const [marketRecommendations, setMarketRecommendations] = createSignal<readonly ExpertSquadMarketIndexItem[]>([])
  const [marketLoading, setMarketLoading] = createSignal(false)
  const [marketError, setMarketError] = createSignal("")
  const [marketInstallingID, setMarketInstallingID] = createSignal("")
  const [marketInstalledID, setMarketInstalledID] = createSignal("")
  const [submitting, setSubmitting] = createSignal(false)
  const [error, setError] = createSignal<{ mode: MissionCreateMode; cause: unknown }>()
  const [submitAttempted, setSubmitAttempted] = createSignal(false)
  const [leaving, setLeaving] = createSignal(false)
  let requestRef: HTMLTextAreaElement | undefined
  let titleRef: HTMLInputElement | undefined
  let expertSquadSearchRef: HTMLInputElement | undefined
  let submitFeedback: HTMLDivElement | undefined
  let leaveFeedback: HTMLDivElement | undefined
  let leaveAction: (() => void) | undefined
  let dialogGeneration = 0
  let creationAttempt: { input: string; requestID: string } | undefined
  let expertSquadRequestSequence = 0

  function cancelLeave(): void {
    setLeaving(false)
    leaveAction = undefined
  }

  function keepEditing(): void {
    cancelLeave()
    queueMicrotask(() => requestRef?.focus())
  }

  function requestLeave(action: () => void): void {
    if (submitting()) return
    if (!title() && !request()) return action()
    leaveAction = action
    setLeaving(true)
    queueMicrotask(() => {
      leaveFeedback?.scrollIntoView({ block: "nearest" })
      leaveFeedback?.focus({ preventScroll: true })
    })
  }

  function close(): void {
    if (submitting()) return
    if (leaving()) return keepEditing()
    requestLeave(props.onClose)
  }

  function discardInput(): void {
    if (submitting()) return
    const action = leaveAction
    cancelLeave()
    action?.()
  }

  createEffect(on([mode, projectDirectory, productPillar, expertSquadIDs], cancelLeave, { defer: true }))

  const modeOptions = createMemo<SegmentedControlOption<MissionCreateMode>[]>(() => [
    { value: "ai", label: t("mission_board.create.ai"), disabled: submitting() },
    { value: "manual", label: t("mission_board.create.manual"), disabled: submitting() },
  ])
  const missionTypeOptions = createMemo<SegmentedControlOption<MissionTypeSelection>[]>(() => [
    {
      value: "code",
      label: t("chat.composer_mode_code"),
      title: t("chat.composer_mode_code_description"),
    },
    {
      value: "work",
      label: t("chat.composer_mode_work"),
      title: t("chat.composer_mode_work_description"),
    },
  ])
  const projectOptions = createMemo<SelectOption[]>(() =>
    props.projectDirectories.map((directory) => {
      const label = projectDirectoryLabel(directory, t("task.project.unknown"), t("work_ledger.implicit_project"))
      return {
        value: directory,
        label: projectLedgerDisplayName({
          directory,
          customName: workLedgerProject(directory)?.title,
          unknownName: t("task.project.unknown"),
          implicitProjectName: t("work_ledger.implicit_project"),
        }),
        description: label.parent,
      }
    }),
  )
  const selectedProject = createMemo(
    () => projectOptions().find((option) => option.value === projectDirectory()) ?? null,
  )
  const expertSquadOptions = createMemo<SelectOption[]>(() => {
    const options = expertSquads().map((squad) => ({
      value: squad.id,
      label: squad.display_label,
      description: expertSquadDescription(squad),
      outsideSearch:
        Boolean(expertSquadQuery().trim()) &&
        !expertSquadLoading() &&
        !expertSquadError() &&
        !expertSquadResult().matchingIDs.includes(squad.id),
    }))
    if (!projectDirectory()) return options
    return [
      ...options,
      {
        value: "__install-more-expert-squads__",
        label: t("chat.references.install_more"),
        description: t("chat.references.install_more_description"),
        action: "install-more" as const,
      },
    ]
  })
  const selectedExpertSquadCount = createMemo(() => expertSquadIDs().length)
  const noMatchingSquads = createMemo(
    () =>
      Boolean(expertSquadQuery().trim()) &&
      !expertSquadLoading() &&
      !expertSquadError() &&
      expertSquadResult().matchingIDs.length === 0,
  )
  const canSubmit = createMemo(
    () =>
      Boolean(
        projectDirectory() &&
          productPillar() &&
          selectedExpertSquadCount() > 0 &&
          request().trim() &&
          !marketInstallingID() &&
          !expertSquadLoading() &&
          !expertSquadError(),
      ) && (mode() === "manual" ? Boolean(title().trim()) : true),
  )
  const prerequisiteMessage = createMemo(() => {
    if (props.projectDirectories.length === 0) return t("mission_board.create.no_projects")
    if (!productPillar()) return t("mission_board.create.select_mission_type")
    if (expertSquadLoading()) return t("mission_board.create.loading_context")
    if (expertSquadError()) return t("mission_board.create.context_load_failed")
    if (selectedExpertSquadCount() === 0) {
      if (noMatchingSquads()) return t("mission_board.create.no_matching_squads")
      if (expertSquads().length > 0) return t("mission_board.create.expert_squad_placeholder")
      return t("mission_board.create.no_compatible_squad")
    }
    return ""
  })
  const titleInvalid = createMemo(() => mode() === "manual" && submitAttempted() && !title().trim())
  const requestInvalid = createMemo(() => submitAttempted() && !request().trim())

  function ownsSquadRequest(generation: number, sequence: number, directory: string, pillar: ProductPillar): boolean {
    return (
      props.open &&
      generation === dialogGeneration &&
      sequence === expertSquadRequestSequence &&
      directory === projectDirectory() &&
      pillar === productPillar()
    )
  }

  function acceptExpertSquadRead(retryTrigger?: HTMLButtonElement): void {
    if (retryTrigger === document.activeElement && expertSquadSearchRef?.isConnected) {
      expertSquadSearchRef.focus()
    }
    setExpertSquadError(undefined)
  }

  async function loadExpertSquadsForContext(
    directory: string,
    pillar: ProductPillar,
    retryTrigger?: HTMLButtonElement,
  ): Promise<void> {
    const generation = dialogGeneration
    const sequence = ++expertSquadRequestSequence
    setExpertSquadIDs([])
    setExpertSquadResult({ options: [], matchingIDs: [] })
    setExpertSquadLoading(true)
    if (!retryTrigger) setExpertSquadError(undefined)
    try {
      const [catalog, page] = await Promise.all([
        loadExpertSquadCatalog({ kind: "project", directory }),
        searchExpertSquads({ directory, productPillar: pillar, limit: 20 }),
      ])
      if (!ownsSquadRequest(generation, sequence, directory, pillar)) return
      const squads = page.entries
      const activeID = squads.some((squad) => squad.id === catalog.active.effective)
        ? catalog.active.effective
        : (squads[0]?.id ?? "")
      setExpertSquadResult({ options: squads, matchingIDs: page.entries.map((squad) => squad.id) })
      setExpertSquadIDs(activeID ? [activeID] : [])
      acceptExpertSquadRead(retryTrigger)
    } catch (nextError) {
      if (!ownsSquadRequest(generation, sequence, directory, pillar)) return
      setExpertSquadError({ operation: "context", cause: nextError })
    } finally {
      if (ownsSquadRequest(generation, sequence, directory, pillar)) setExpertSquadLoading(false)
    }
  }

  async function searchSquads(query: string, retryTrigger?: HTMLButtonElement): Promise<void> {
    const directory = projectDirectory()
    const pillar = productPillar()
    if (!directory || !pillar) return
    const generation = dialogGeneration
    const sequence = ++expertSquadRequestSequence
    setExpertSquadLoading(true)
    if (!retryTrigger) setExpertSquadError(undefined)
    try {
      const page = await searchExpertSquads({ directory, productPillar: pillar, query, limit: 20 })
      if (!ownsSquadRequest(generation, sequence, directory, pillar)) return
      const squads = mergeSquadOptions(page.entries, expertSquads(), expertSquadIDs())
      setExpertSquadResult({ options: squads, matchingIDs: page.entries.map((squad) => squad.id) })
      acceptExpertSquadRead(retryTrigger)
    } catch (nextError) {
      if (!ownsSquadRequest(generation, sequence, directory, pillar)) return
      setExpertSquadError({ operation: "search", cause: nextError })
    } finally {
      if (ownsSquadRequest(generation, sequence, directory, pillar)) setExpertSquadLoading(false)
    }
  }

  // Market can match package-owned evidence outside the installed search projection.
  // Keep the actual project installation visible for the query that offered it.
  async function refreshSquadsAfterInstall(
    directory: string,
    pillar: ProductPillar,
    query: string,
    offered: ExpertSquadMarketIndexItem | undefined,
    authority: ApiAuthority,
  ): Promise<void> {
    const generation = dialogGeneration
    const sequence = ++expertSquadRequestSequence
    const owns = () => isApiAuthorityCurrent(authority) && ownsSquadRequest(generation, sequence, directory, pillar)
    setExpertSquadLoading(true)
    setExpertSquadError(undefined)
    try {
      const [page, exact] = await Promise.all([
        searchExpertSquads({ directory, productPillar: pillar, query, limit: 20, authority }),
        offered && inspectExpertSquad({
          directory, id: offered.id, namespace: offered.namespace, installationScope: "project", authority,
        }),
      ])
      if (!owns()) return
      const installed = exact?.product_pillars.includes(pillar) ? exact : undefined
      const entries = installed
        ? [installed, ...page.entries.filter((entry) => entry.id !== installed.id)]
        : page.entries
      setExpertSquadResult({
        options: mergeSquadOptions(entries, expertSquads(), expertSquadIDs()),
        matchingIDs: entries.map((squad) => squad.id),
      })
    } catch (nextError) {
      if (!owns()) return
      setExpertSquadError({ operation: "search", cause: nextError })
    } finally {
      if (ownsSquadRequest(generation, sequence, directory, pillar)) setExpertSquadLoading(false)
    }
  }

  function changeProject(directory: string): void {
    expertSquadRequestSequence += 1
    setProjectDirectory(directory)
    setExpertSquadQuery("")
    setExpertSquadResult({ options: [], matchingIDs: [] })
    setExpertSquadIDs([])
    setExpertSquadLoading(false)
    setExpertSquadError(undefined)
    setMarketRecommendations([])
    setMarketLoading(false)
    setMarketError("")
    const pillar = productPillar()
    if (directory && pillar) void loadExpertSquadsForContext(directory, pillar)
  }

  function changeMissionType(pillar: ProductPillar): void {
    setProductPillar(pillar)
    setExpertSquadQuery("")
    setError(undefined)
    const directory = projectDirectory()
    if (directory) void loadExpertSquadsForContext(directory, pillar)
  }

  function retryExpertSquads(trigger: HTMLButtonElement): void {
    const directory = projectDirectory()
    const pillar = productPillar()
    const failure = expertSquadError()
    if (!directory || !pillar || !failure || submitting() || expertSquadLoading()) return
    if (failure.operation === "search") {
      void searchSquads(expertSquadQuery(), trigger)
      return
    }
    void loadExpertSquadsForContext(directory, pillar, trigger)
  }

  createEffect(
    on(
      () => props.open,
      (open) => {
        cancelLeave()
        if (!open) {
          expertSquadRequestSequence += 1
          return
        }
        dialogGeneration += 1
        creationAttempt = undefined
        expertSquadRequestSequence += 1
        const directories = props.projectDirectories
        const preferredDirectory = directories.includes(props.defaultProjectDirectory)
          ? props.defaultProjectDirectory
          : (directories[0] ?? "")
        setMode("ai")
        setTitle("")
        setRequest("")
        setProjectDirectory(preferredDirectory)
        setProductPillar("")
        setExpertSquadResult({ options: [], matchingIDs: [] })
        setExpertSquadIDs([])
        setExpertSquadQuery("")
        setExpertSquadLoading(false)
        setExpertSquadError(undefined)
        setMarketRecommendations([])
        setMarketLoading(false)
        setMarketError("")
        setSubmitting(false)
        setError(undefined)
        setSubmitAttempted(false)
        queueMicrotask(() => requestRef?.focus())
      },
    ),
  )

  createEffect(
    on(
      () => props.projectDirectories,
      (directories) => {
        if (!props.open) return
        const currentDirectory = projectDirectory()
        if (currentDirectory && directories.includes(currentDirectory)) return
        const preferredDirectory = directories.includes(props.defaultProjectDirectory)
          ? props.defaultProjectDirectory
          : (directories[0] ?? "")
        changeProject(preferredDirectory)
      },
    ),
  )

  let marketSearchSequence = 0
  createEffect(() => {
    const open = props.open
    const directory = projectDirectory().trim()
    const pillar = productPillar()
    const query = expertSquadQuery().trim().slice(0, 500)
    const search = props.onMarketExpertSquadQuery
    const sequence = ++marketSearchSequence
    if (!open || !directory || !pillar || query.length < 2 || !search) {
      setMarketRecommendations([])
      setMarketLoading(false)
      setMarketError("")
      return
    }
    setMarketLoading(true)
    setMarketRecommendations([])
    setMarketError("")
    const timer = window.setTimeout(() => {
      void search(directory, query, pillar)
        .then((items) => {
          if (sequence !== marketSearchSequence) return
          setMarketRecommendations(items)
        })
        .catch((nextError) => {
          if (sequence !== marketSearchSequence) return
          setMarketRecommendations([])
          setMarketError(nextError instanceof Error ? nextError.message : String(nextError))
        })
        .finally(() => {
          if (sequence === marketSearchSequence) setMarketLoading(false)
        })
    }, 280)
    onCleanup(() => window.clearTimeout(timer))
  })

  let installLifecycleSequence = 0
  createEffect(on(
    [() => props.open, projectDirectory, productPillar],
    () => {
      installLifecycleSequence += 1
      setMarketInstallingID("")
      setMarketInstalledID("")
    },
  ))

  async function installMarketExpertSquad(item: ExpertSquadMarketIndexItem, trigger: HTMLButtonElement): Promise<void> {
    const install = props.onInstallMarketExpertSquad
    const directory = projectDirectory().trim()
    const pillar = productPillar()
    const loadMarket = props.onMarketExpertSquadQuery
    if (!install || !loadMarket || !directory || !pillar || submitting() || marketInstallingID()) return
    const lifecycle = ++installLifecycleSequence
    const authority = captureApiAuthority()
    const origin = document.activeElement === trigger ? trigger : undefined
    const offeredQuery = expertSquadQuery().trim().slice(0, 500)
    const owns = () =>
      lifecycle === installLifecycleSequence &&
      props.open &&
      projectDirectory().trim() === directory &&
      productPillar() === pillar &&
      isApiAuthorityCurrent(authority)
    let refreshSequence: number | undefined
    marketSearchSequence += 1
    setMarketLoading(false)
    setMarketInstallingID(item.id)
    setMarketInstalledID("")
    setMarketError("")
    try {
      await install(directory, item)
      if (!owns()) return
      if (origin && document.activeElement === origin && expertSquadSearchRef?.isConnected) expertSquadSearchRef.focus()
      setMarketInstalledID(item.id)
      const query = expertSquadQuery().trim().slice(0, 500)
      refreshSequence = ++marketSearchSequence
      setMarketRecommendations([])
      setMarketLoading(query.length >= 2)
      const [, market] = await Promise.all([
        refreshSquadsAfterInstall(directory, pillar, query, query === offeredQuery ? item : undefined, authority),
        query.length >= 2 ? loadMarket(directory, query, pillar) : Promise.resolve([]),
      ])
      if (owns() && refreshSequence === marketSearchSequence) {
        setMarketRecommendations(market)
        setMarketLoading(false)
      }
    } catch (nextError) {
      if (owns() && (refreshSequence === undefined || refreshSequence === marketSearchSequence)) {
        if (refreshSequence !== undefined) setMarketLoading(false)
        setMarketError(nextError instanceof Error ? nextError.message : String(nextError))
      }
    } finally {
      if (lifecycle === installLifecycleSequence) setMarketInstallingID("")
    }
  }

  async function openMarketExpertSquad(item: ExpertSquadMarketIndexItem): Promise<void> {
    if (!props.onOpenMarketExpertSquad) return
    setMarketError("")
    try {
      await props.onOpenMarketExpertSquad(item)
    } catch (nextError) {
      setMarketError(nextError instanceof Error ? nextError.message : String(nextError))
    }
  }

  async function submit(): Promise<void> {
    const pillar = productPillar()
    setSubmitAttempted(true)
    if (!canSubmit() || submitting() || !pillar) {
      queueMicrotask(() => {
        if (mode() === "manual" && !title().trim()) {
          titleRef?.focus()
          return
        }
        if (!request().trim()) requestRef?.focus()
      })
      return
    }
    setSubmitting(true)
    setError(undefined)
    const createMode = mode()
    const common = {
      directory: projectDirectory(),
      request: request().trim(),
      productPillar: pillar,
      expertSquadIDs: [...expertSquadIDs()],
    }
    try {
      const authoredTitle = createMode === "manual" ? title().trim() : ""
      const input = JSON.stringify([createMode, { ...common, expertSquadIDs: [...common.expertSquadIDs].sort() }, authoredTitle])
      if (creationAttempt?.input !== input) creationAttempt = { input, requestID: randomUUID() }
      const submission = { ...common, requestID: creationAttempt.requestID }
      if (createMode === "manual") {
        await props.onCreateManual({ ...submission, title: authoredTitle })
      } else {
        await props.onCreateWithAI(submission)
      }
      props.onClose()
    } catch (nextError) {
      if (nextError instanceof DOMException && nextError.name === "AbortError") return
      const failure = { mode: createMode, cause: nextError }
      setError(failure)
      queueMicrotask(() => {
        if (props.open && error() === failure) submitFeedback?.focus()
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      id="missionCreateDialog"
      open={props.open}
      class="mission-create-dialog"
      wide
      backdropClose={!submitting()}
      title={
        <span class="mission-create-dialog__breadcrumb">
          <span>{t("mission_board.title")}</span>
          <Icon name="chevron" size="compact" />
          <strong>{mode() === "manual" ? t("mission_board.create.manual") : t("mission_board.create.ai")}</strong>
        </span>
      }
      onOpenAutoFocus={(event) => event.preventDefault()}
      onClose={close}
      footer={
        <>
          <Button
            type="button"
            variant="ghost"
            size="md"
            tone="neutral"
            disabled={submitting()}
            onClick={close}
          >
            {leaving() ? t("mission_board.unsaved.keep") : t("common.cancel")}
          </Button>
          <Show when={leaving()}>
            <Button type="button" variant="outline" size="md" tone="danger" disabled={submitting()} onClick={discardInput}>
              {t("mission_board.unsaved.discard")}
            </Button>
          </Show>
          <Button
            type="submit"
            form="missionCreateForm"
            variant="solid"
            size="md"
            tone="neutral"
            data-ui="mission-create-submit"
            aria-describedby={modeHelpID}
            disabled={Boolean(prerequisiteMessage()) || submitting()}
            title={prerequisiteMessage() || undefined}
          >
            <Show when={submitting()}>
              <Icon name="loading" size="compact" />
            </Show>
            {submitting()
              ? mode() === "manual" ? t("common.saving") : t("mission_board.create.dispatching")
              : mode() === "manual"
                ? t("mission_board.create.manual_action")
                : t("mission_board.create.ai_action")}
          </Button>
        </>
      }
    >
      <form
        id="missionCreateForm"
        class="mission-create-form"
        data-mode={mode()}
        noValidate
        onInput={cancelLeave}
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <Show when={leaving()}>
          <Feedback ref={leaveFeedback} tone="warning" title={t("mission_board.unsaved.title")} tabIndex={-1}>
            {t("mission_board.unsaved.message")}
          </Feedback>
        </Show>
        <div class="mission-create-form__mode">
          <SegmentedControl
            value={mode()}
            options={modeOptions()}
            ariaLabel={t("mission_board.create.mode")}
            onChange={(nextMode) => {
              if (submitting()) return
              setMode(nextMode)
              setError(undefined)
              setSubmitAttempted(false)
            }}
          />
          <p class="mission-create-form__context-status" id={modeHelpID}>
            {t(mode() === "manual" ? "mission_board.create.manual_help" : "mission_board.create.ai_help")}
          </p>
        </div>

        <Show when={mode() === "manual"}>
          <TextField.Root as="label" class="mission-create-form__title" invalid={titleInvalid()}>
            <TextField.Label>{t("mission_board.create.title")}</TextField.Label>
            <TextField.Input
              ref={(element) => {
                titleRef = element
              }}
              value={title()}
              maxlength={200}
              disabled={submitting()}
              required
              aria-required="true"
              placeholder={t("mission_board.create.title_placeholder")}
              data-ui="mission-create-title"
              onInput={(event) => setTitle(event.currentTarget.value)}
            />
            <Show when={titleInvalid()}>
              <TextField.ErrorMessage>{t("mission_board.create.enter_title")}</TextField.ErrorMessage>
            </Show>
          </TextField.Root>
        </Show>

        <TextField.Root as="label" class="mission-create-form__request" invalid={requestInvalid()}>
          <TextField.Label>
            {t("mission_board.create.description")}
          </TextField.Label>
          <AutoGrowTextarea
            ref={(element) => {
              requestRef = element
            }}
            rows={7}
            maxLines={16}
            maxlength={32_000}
            disabled={submitting()}
            required
            aria-required="true"
            value={request()}
            placeholder={t("mission_board.create.description_placeholder")}
            data-ui="mission-create-request"
            onInput={(event) => setRequest(event.currentTarget.value)}
          />
          <Show when={requestInvalid()}>
            <TextField.ErrorMessage>{t("mission_board.create.enter_request")}</TextField.ErrorMessage>
          </Show>
        </TextField.Root>

        <fieldset class="mission-create-form__context" disabled={submitting()}>
          <legend>{t("mission_board.create.execution_context")}</legend>
          <div class="mission-create-form__context-grid">
            <TextField.Root>
              <TextField.Label>{t("mission_board.create.project")}</TextField.Label>
              <ComboboxControl<SelectOption>
                presentation="popup"
                options={projectOptions()}
                value={selectedProject()}
                onChange={(option) => {
                  if (option) changeProject(option.value)
                }}
                optionValue="value"
                optionTextValue={(option) => `${option.label} ${option.description ?? ""}`}
                optionLabel="label"
                placeholder={t("project_picker.search_placeholder")}
                defaultFilter={(option, query) =>
                  matchesSearchTerms(query, [
                    option.label,
                    option.description,
                    option.value,
                    option.value.replaceAll("\\", "/"),
                  ])
                }
                allowsEmptyCollection
                closeOnSelection
                emptyContent={t("project_picker.no_matches")}
                disallowEmptySelection
                disabled={submitting()}
                ariaLabel={t("mission_board.create.project")}
                inputDataUI="mission-create-project"
                renderOptionLabel={(option) => (
                  <>
                    {option.label}
                    <Show when={option.description}>
                      {(parent) => <span class="mission-project-parent">{parent()}</span>}
                    </Show>
                  </>
                )}
                renderOptionTooltip={(option) => option.value}
                inputTitle={projectDirectory() || t("project_picker.search_placeholder")}
              />
              <Show when={projectDirectory()}>
                {(directory) => (
                  <TextField.Description class="mission-create-form__project-directory">
                    {directory()}
                  </TextField.Description>
                )}
              </Show>
            </TextField.Root>
            <TextField.Root class="mission-create-form__mission-type">
              <TextField.Label>{t("mission_board.create.mission_type")}</TextField.Label>
              <SegmentedControl<MissionTypeSelection>
                value={productPillar()}
                options={missionTypeOptions()}
                ariaLabel={t("mission_board.create.mission_type")}
                onChange={(value) => {
                  if (value) changeMissionType(value)
                }}
              />
            </TextField.Root>
          </div>
          <TextField.Root class="mission-create-form__expert-squad">
            <TextField.Label>
              {t("mission_board.create.expert_squad")}
              <Show when={expertSquadLoading()}>
                <Icon name="loading" size="compact" />
              </Show>
              <Show when={productPillar() && !expertSquadLoading() && !expertSquadError()}>
                <span class="mission-create-form__selection-count" role="status">
                  {t("mission_board.create.squads_selected", {
                    count: new Intl.NumberFormat(localeTag()).format(selectedExpertSquadCount()),
                  })}
                </span>
              </Show>
            </TextField.Label>
            <SearchField
              clearable
              inputRef={(element) => { expertSquadSearchRef = element }}
              value={expertSquadQuery()}
              disabled={!projectDirectory() || !productPillar()}
              onValueChange={(value) => {
                setExpertSquadQuery(value)
                void searchSquads(value)
              }}
              placeholder={t("mission_board.create.squad_search_placeholder")}
              size="sm"
            />
            <Show when={expertSquadError()}>
              {(failure) => (
                <Feedback
                  tone="error"
                  details={formatErrorDetails(failure().cause)}
                  actions={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      tone="neutral"
                      aria-disabled={expertSquadLoading() || undefined}
                      aria-busy={expertSquadLoading() || undefined}
                      onClick={(event) => retryExpertSquads(event.currentTarget)}
                    >
                      {t(expertSquadLoading() ? "common.loading" : "common.retry")}
                    </Button>
                  }
                >
                  {t("mission_board.create.context_load_failed")}
                </Feedback>
              )}
            </Show>
            <p class="mission-create-form__context-status">{t("mission_board.create.squad_selection_help")}</p>
            <Show when={noMatchingSquads()}>
              <p class="mission-create-form__context-status" role="status">
                {t("mission_board.create.no_matching_squads")}
                <Show when={selectedExpertSquadCount() > 0}> {t("mission_board.create.selection_retained")}</Show>
              </p>
            </Show>
            <div
              class="mission-create-form__expert-squad-list"
              role="group"
              aria-label={t("mission_board.create.expert_squad")}
              data-ui="mission-create-expert-squads"
            >
              <For each={expertSquadOptions()}>
                {(option) => (
                  <Show
                    when={option.action !== "install-more"}
                    fallback={
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        tone="accent"
                        data-ui="mission-create-install-more-squads"
                        disabled={submitting() || expertSquadLoading()}
                        onClick={() => {
                          const directory = projectDirectory()
                          requestLeave(() => {
                            props.onClose()
                            props.onInstallMoreExpertSquads?.(directory)
                          })
                        }}
                      >
                        <Icon name="config-expert-squad-install" size="compact" />
                        {option.label}
                      </Button>
                    }
                  >
                    <Checkbox
                      checked={expertSquadIDs().includes(option.value)}
                      disabled={submitting() || expertSquadLoading()}
                      onChange={(checked) => {
                        setExpertSquadIDs((current) =>
                          checked
                            ? current.includes(option.value)
                              ? current
                              : [...current, option.value]
                            : current.filter((id) => id !== option.value),
                        )
                      }}
                    >
                      <span class="mission-create-form__option">
                        <strong>{option.label}</strong>
                        <Show when={option.outsideSearch}>
                          <Badge class="mission-create-form__search-origin" tone="muted" size="sm">
                            {t("mission_board.create.outside_search")}
                          </Badge>
                        </Show>
                        <Show when={option.description}>
                          <small>{option.description}</small>
                        </Show>
                      </span>
                    </Checkbox>
                  </Show>
                )}
              </For>
            </div>
          </TextField.Root>
          <Show when={!expertSquadError() && prerequisiteMessage() && !noMatchingSquads()}>
            <p class="mission-create-form__context-status" role="status">
              {prerequisiteMessage()}
            </p>
          </Show>
          <p class="mission-create-form__model-note">{t("mission_board.create.project_model_note")}</p>
        </fieldset>

        <Show when={marketLoading()}>
          <div class="mission-create-form__market-state" role="status" aria-live="polite">
            <Icon name="loading" size="compact" />
            <span>{t("mission_board.create.market_searching")}</span>
          </div>
        </Show>
        <Show when={marketRecommendations().length > 0}>
          <section class="mission-create-form__market" aria-labelledby="missionCreateMarketTitle">
            <header>
              <div>
                <strong id="missionCreateMarketTitle">{t("mission_board.create.market_title")}</strong>
                <small>{t("mission_board.create.market_intro")}</small>
              </div>
              <Icon name="config-skill-market" size="medium" />
            </header>
            <div class="mission-create-form__market-list">
              <For each={marketRecommendations()}>
                {(item) => (
                  <article class="mission-create-form__market-item" data-market-id={item.id}>
                    <div class="mission-create-form__market-copy">
                      <strong>{item.name || item.label}</strong>
                      <small>
                        {item.namespace}/{item.id} · {item.version}
                      </small>
                      <p>{expertSquadDescription(item) || item.label}</p>
                    </div>
                    <div class="mission-create-form__market-actions">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        tone="neutral"
                        disabled={!props.canOpenMarketWebPage || Boolean(marketInstallingID())}
                        onClick={() => void openMarketExpertSquad(item)}
                      >
                        <Icon name="web-search" size="compact" />
                        {t("mission_board.create.market_open")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        tone="accent"
                        disabled={submitting()}
                        aria-disabled={Boolean(marketInstallingID()) || undefined}
                        aria-busy={marketInstallingID() === item.id || undefined}
                        onClick={(event) => void installMarketExpertSquad(item, event.currentTarget)}
                      >
                        <Icon
                          name={marketInstallingID() === item.id ? "loading" : "config-expert-squad-install"}
                          size="compact"
                        />
                        {marketInstallingID() === item.id
                          ? t("expert_squad.installing")
                          : t("mission_board.create.market_install")}
                      </Button>
                    </div>
                  </article>
                )}
              </For>
            </div>
          </section>
        </Show>
        <Show when={marketInstalledID()}>
          <div class="mission-create-form__market-state is-success" role="status" aria-live="polite">
            <Icon name="status-completed" size="compact" />
            <span>{t("mission_board.create.market_installed", { id: marketInstalledID() })}</span>
          </div>
        </Show>

        <Show when={error()}>
          {(failure) => (
            <Feedback
              ref={submitFeedback}
              tone="error"
              tabIndex={-1}
              data-ui="mission-create-submit-error"
              details={formatErrorDetails(failure().cause)}
            >
              {t(failure().mode === "manual" ? "mission_board.create.manual_failed" : "mission_board.create.ai_failed")}
            </Feedback>
          )}
        </Show>
        <Show when={!error() && marketError()}>
          <div class="mission-create-form__error" role="alert" tabIndex={-1}>
            <Icon name="error-reason" size="compact" />
            <span>{marketError()}</span>
          </div>
        </Show>
      </form>
    </Dialog>
  )
}

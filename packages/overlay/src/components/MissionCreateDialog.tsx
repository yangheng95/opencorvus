import { createMemo, createSignal, on, createEffect, Show } from "solid-js"
import type { ProductPillar } from "@opencorvus-ai/transport-protocol"
import { loadExpertSquadCatalog, searchExpertSquads, type ExpertSquadOption } from "../services/expert-squad"
import { projectDirectoryLabel } from "../utils/project-directory"
import { t } from "../utils/i18n"
import { AutoGrowTextarea } from "./ui/AutoGrowTextarea"
import { Button } from "./ui/Button"
import { Dialog } from "./ui/Dialog"
import { Icon } from "./ui/Icon"
import { SegmentedControl, type SegmentedControlOption } from "./ui/SegmentedControl"
import { SelectControl } from "./ui/SelectControl"
import { SearchField } from "./ui/SearchField"
import { TextField } from "./ui/TextField"

type MissionCreateMode = "manual" | "ai"
type MissionTypeSelection = ProductPillar | ""
type SelectOption = { value: string; label: string; description?: string; action?: "install-more" }

export interface MissionCreateRequest {
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
  onClose: () => void
  onCreateManual: (input: MissionManualCreateRequest) => Promise<void>
  onCreateWithAI: (input: MissionCreateRequest) => Promise<void>
}

function mergeSquadOptions(
  incoming: readonly ExpertSquadOption[],
  current: readonly ExpertSquadOption[],
  selectedID: string,
): ExpertSquadOption[] {
  const merged = new Map(incoming.map((option) => [option.id, option]))
  if (selectedID) {
    const selected = current.find((option) => option.id === selectedID)
    if (selected && !merged.has(selected.id)) merged.set(selected.id, selected)
  }
  return [...merged.values()]
}

export function MissionCreateDialog(props: MissionCreateDialogProps) {
  const [mode, setMode] = createSignal<MissionCreateMode>("ai")
  const [title, setTitle] = createSignal("")
  const [request, setRequest] = createSignal("")
  const [projectDirectory, setProjectDirectory] = createSignal("")
  const [productPillar, setProductPillar] = createSignal<MissionTypeSelection>("")
  const [expertSquads, setExpertSquads] = createSignal<ExpertSquadOption[]>([])
  const [expertSquadID, setExpertSquadID] = createSignal("")
  const [expertSquadQuery, setExpertSquadQuery] = createSignal("")
  const [expertSquadLoading, setExpertSquadLoading] = createSignal(false)
  const [expertSquadError, setExpertSquadError] = createSignal("")
  const [submitting, setSubmitting] = createSignal(false)
  const [error, setError] = createSignal("")
  let requestRef: HTMLTextAreaElement | undefined
  let titleRef: HTMLInputElement | undefined
  let dialogGeneration = 0
  let expertSquadRequestSequence = 0

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
      const label = projectDirectoryLabel(directory, t("task.project.unknown"))
      return { value: directory, label: label.name, description: directory }
    }),
  )
  const selectedProject = createMemo(
    () => projectOptions().find((option) => option.value === projectDirectory()) ?? null,
  )
  const expertSquadOptions = createMemo<SelectOption[]>(() => {
    const options = expertSquads().map((squad) => ({
      value: squad.id,
      label: squad.display_label,
      description: squad.description,
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
  const selectedExpertSquad = createMemo(
    () => expertSquadOptions().find((option) => option.value === expertSquadID()) ?? null,
  )
  const canSubmit = createMemo(
    () =>
      Boolean(
        projectDirectory() &&
          productPillar() &&
          expertSquadID() &&
          request().trim() &&
          !expertSquadLoading() &&
          !expertSquadError(),
      ) && (mode() === "manual" ? Boolean(title().trim()) : true),
  )
  const prerequisiteMessage = createMemo(() => {
    if (props.projectDirectories.length === 0) return t("mission_board.create.no_projects")
    if (!productPillar()) return t("mission_board.create.select_mission_type")
    if (expertSquadLoading()) return t("mission_board.create.loading_context")
    if (expertSquadError()) return t("mission_board.create.context_load_failed")
    if (!expertSquadID()) return t("mission_board.create.no_compatible_squad")
    return ""
  })
  const contentRequirementMessage = createMemo(() => {
    if (mode() === "manual" && !title().trim()) return t("mission_board.create.enter_title")
    if (!request().trim()) return t("mission_board.create.enter_request")
    return ""
  })
  const submitDisabledReason = createMemo(() => contentRequirementMessage() || prerequisiteMessage())

  function ownsSquadRequest(generation: number, sequence: number, directory: string, pillar: ProductPillar): boolean {
    return (
      props.open &&
      generation === dialogGeneration &&
      sequence === expertSquadRequestSequence &&
      directory === projectDirectory() &&
      pillar === productPillar()
    )
  }

  async function loadExpertSquadsForContext(directory: string, pillar: ProductPillar): Promise<void> {
    const generation = dialogGeneration
    const sequence = ++expertSquadRequestSequence
    setExpertSquadID("")
    setExpertSquads([])
    setExpertSquadLoading(true)
    setExpertSquadError("")
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
      setExpertSquads(squads)
      setExpertSquadID(activeID)
    } catch (nextError) {
      if (!ownsSquadRequest(generation, sequence, directory, pillar)) return
      setExpertSquadError(nextError instanceof Error ? nextError.message : String(nextError))
    } finally {
      if (ownsSquadRequest(generation, sequence, directory, pillar)) setExpertSquadLoading(false)
    }
  }

  async function searchSquads(query: string): Promise<void> {
    const directory = projectDirectory()
    const pillar = productPillar()
    if (!directory || !pillar) return
    const generation = dialogGeneration
    const sequence = ++expertSquadRequestSequence
    setExpertSquadLoading(true)
    setExpertSquadError("")
    try {
      const page = await searchExpertSquads({ directory, productPillar: pillar, query, limit: 20 })
      if (!ownsSquadRequest(generation, sequence, directory, pillar)) return
      const squads = mergeSquadOptions(page.entries, expertSquads(), expertSquadID())
      setExpertSquads(squads)
      if (!expertSquadID()) setExpertSquadID(squads[0]?.id ?? "")
    } catch (nextError) {
      if (!ownsSquadRequest(generation, sequence, directory, pillar)) return
      setExpertSquadError(nextError instanceof Error ? nextError.message : String(nextError))
    } finally {
      if (ownsSquadRequest(generation, sequence, directory, pillar)) setExpertSquadLoading(false)
    }
  }

  function changeProject(directory: string): void {
    expertSquadRequestSequence += 1
    setProjectDirectory(directory)
    setExpertSquadQuery("")
    setExpertSquads([])
    setExpertSquadID("")
    setExpertSquadLoading(false)
    setExpertSquadError("")
    const pillar = productPillar()
    if (directory && pillar) void loadExpertSquadsForContext(directory, pillar)
  }

  function changeMissionType(pillar: ProductPillar): void {
    setProductPillar(pillar)
    setExpertSquadQuery("")
    setError("")
    const directory = projectDirectory()
    if (directory) void loadExpertSquadsForContext(directory, pillar)
  }

  function retryExpertSquads(): void {
    const directory = projectDirectory()
    const pillar = productPillar()
    if (!directory || !pillar || submitting()) return
    const query = expertSquadQuery()
    if (query) {
      void searchSquads(query)
      return
    }
    void loadExpertSquadsForContext(directory, pillar)
  }

  createEffect(
    on(
      () => props.open,
      (open) => {
        if (!open) {
          expertSquadRequestSequence += 1
          return
        }
        dialogGeneration += 1
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
        setExpertSquads([])
        setExpertSquadID("")
        setExpertSquadQuery("")
        setExpertSquadLoading(false)
        setExpertSquadError("")
        setSubmitting(false)
        setError("")
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

  async function submit(): Promise<void> {
    const pillar = productPillar()
    if (!canSubmit() || submitting() || !pillar) return
    setSubmitting(true)
    setError("")
    const common = {
      directory: projectDirectory(),
      request: request().trim(),
      productPillar: pillar,
      expertSquadIDs: [expertSquadID()],
    }
    try {
      if (mode() === "manual") {
        await props.onCreateManual({ ...common, title: title().trim() })
      } else {
        await props.onCreateWithAI(common)
      }
      props.onClose()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError))
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
      onClose={() => {
        if (!submitting()) props.onClose()
      }}
      footer={
        <>
          <Button
            type="button"
            variant="ghost"
            size="md"
            tone="neutral"
            disabled={submitting()}
            onClick={props.onClose}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            form="missionCreateForm"
            variant="solid"
            size="md"
            tone="accent"
            data-ui="mission-create-submit"
            disabled={!canSubmit() || submitting()}
            title={!canSubmit() ? submitDisabledReason() : undefined}
          >
            <Show when={submitting()}>
              <Icon name="loading" size="compact" />
            </Show>
            {submitting()
              ? t("mission_board.create.submitting")
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
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <SegmentedControl
          class="mission-create-form__mode"
          value={mode()}
          options={modeOptions()}
          ariaLabel={t("mission_board.create.mode")}
          onChange={(nextMode) => {
            if (submitting()) return
            setMode(nextMode)
            setError("")
            queueMicrotask(() => (nextMode === "manual" ? titleRef?.focus() : requestRef?.focus()))
          }}
        />

        <Show when={mode() === "manual"}>
          <TextField.Root as="label" class="mission-create-form__title">
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
          </TextField.Root>
        </Show>

        <TextField.Root as="label" class="mission-create-form__request">
          <TextField.Label>
            {mode() === "manual" ? t("mission_board.create.description") : t("mission_board.create.ai_prompt")}
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
            placeholder={
              mode() === "manual"
                ? t("mission_board.create.description_placeholder")
                : t("mission_board.create.ai_placeholder")
            }
            data-ui="mission-create-request"
            onInput={(event) => setRequest(event.currentTarget.value)}
          />
        </TextField.Root>

        <Show when={contentRequirementMessage()}>
          <p id="missionCreateContentRequirement" class="mission-create-form__required-status" role="status">
            {contentRequirementMessage()}
          </p>
        </Show>

        <fieldset class="mission-create-form__context" disabled={submitting()}>
          <legend>{t("mission_board.create.execution_context")}</legend>
          <div class="mission-create-form__context-grid">
            <TextField.Root>
              <TextField.Label>{t("mission_board.create.project")}</TextField.Label>
              <SelectControl<SelectOption>
                options={projectOptions()}
                value={selectedProject()}
                onChange={(option) => changeProject(option?.value ?? "")}
                optionValue="value"
                optionTextValue="label"
                disallowEmptySelection
                sameWidth
                ariaLabel={t("mission_board.create.project")}
                triggerDataUI="mission-create-project"
                renderValue={(option) => option?.label ?? t("mission_board.create.project_placeholder")}
                renderOptionLabel={(option) => (
                  <span class="mission-create-form__option">
                    <strong>{option.label}</strong>
                    <small>{option.description}</small>
                  </span>
                )}
              />
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
            </TextField.Label>
            <SearchField
              value={expertSquadQuery()}
              disabled={!projectDirectory() || !productPillar()}
              onValueChange={(value) => {
                setExpertSquadQuery(value)
                void searchSquads(value)
              }}
              onClear={() => undefined}
              placeholder={t("chat.references.search_placeholder")}
              size="sm"
            />
            <SelectControl<SelectOption>
              options={expertSquadOptions()}
              value={selectedExpertSquad()}
              onChange={(option) => {
                if (submitting()) return
                if (option?.action === "install-more") {
                  props.onClose()
                  props.onInstallMoreExpertSquads?.(projectDirectory())
                  return
                }
                setExpertSquadID(option?.value ?? "")
              }}
              optionValue="value"
              optionTextValue="label"
              disallowEmptySelection
              sameWidth
              disabled={!projectDirectory() || !productPillar() || expertSquadLoading()}
              ariaLabel={t("mission_board.create.expert_squad")}
              triggerDataUI="mission-create-expert-squad"
              optionData={(option) => ({
                "data-expert-squad-action": option.action,
                "data-ui": option.action === "install-more" ? "mission-create-install-more-squads" : undefined,
              })}
              renderValue={(option) => option?.label ?? t("mission_board.create.expert_squad_placeholder")}
              renderOptionLabel={(option) => (
                <span class="mission-create-form__option">
                  <strong>
                    <Show when={option.action === "install-more"}>
                      <Icon name="config-expert-squad-install" size="compact" />
                    </Show>
                    {option.label}
                  </strong>
                  <Show when={option.description}>
                    <small>{option.description}</small>
                  </Show>
                </span>
              )}
            />
          </TextField.Root>
          <Show
            when={expertSquadError()}
            fallback={
              <Show when={prerequisiteMessage()}>
                <p class="mission-create-form__context-status" role="status">
                  {prerequisiteMessage()}
                </p>
              </Show>
            }
          >
            <div class="mission-create-form__context-error" role="alert">
              <span>
                <strong>{t("mission_board.create.context_load_failed")}</strong>
                <small>{expertSquadError()}</small>
              </span>
              <Button type="button" variant="outline" size="sm" tone="neutral" onClick={retryExpertSquads}>
                {t("common.retry")}
              </Button>
            </div>
          </Show>
          <p class="mission-create-form__model-note">{t("mission_board.create.project_model_note")}</p>
        </fieldset>

        <Show when={error()}>
          <div class="mission-create-form__error" role="alert">
            <Icon name="error-reason" size="compact" />
            <span>{error()}</span>
          </div>
        </Show>
      </form>
    </Dialog>
  )
}

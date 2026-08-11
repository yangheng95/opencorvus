import { createEffect, createMemo, createSignal, Show } from "solid-js"
import type { ProductPillar } from "@opencorvus-ai/transport-protocol"
import type { ExpertSquadOption } from "../services/expert-squad"
import { projectDirectoryLabel } from "../utils/project-directory"
import { t } from "../utils/i18n"
import { ComposerModelSelector } from "./ComposerModelSelector"
import { AutoGrowTextarea } from "./ui/AutoGrowTextarea"
import { Button } from "./ui/Button"
import { Dialog } from "./ui/Dialog"
import { Icon } from "./ui/Icon"
import { SegmentedControl, type SegmentedControlOption } from "./ui/SegmentedControl"
import { SelectControl } from "./ui/SelectControl"
import { SearchField } from "./ui/SearchField"
import { TextField } from "./ui/TextField"

type MissionCreateMode = "manual" | "ai"
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
  productPillar: ProductPillar
  expertSquads: readonly ExpertSquadOption[]
  activeExpertSquadID: string
  onExpertSquadQuery?: (query: string, selectedExpertSquadIDs: readonly string[]) => void
  onInstallMoreExpertSquads?: (projectDirectory: string) => void
  onClose: () => void
  onCreateManual: (input: MissionManualCreateRequest) => Promise<void>
  onCreateWithAI: (input: MissionCreateRequest) => Promise<void>
}

export function MissionCreateDialog(props: MissionCreateDialogProps) {
  const [mode, setMode] = createSignal<MissionCreateMode>("ai")
  const [title, setTitle] = createSignal("")
  const [request, setRequest] = createSignal("")
  const [projectDirectory, setProjectDirectory] = createSignal("")
  const [expertSquadID, setExpertSquadID] = createSignal("")
  const [expertSquadQuery, setExpertSquadQuery] = createSignal("")
  const [submitting, setSubmitting] = createSignal(false)
  const [error, setError] = createSignal("")
  const [modelAvailable, setModelAvailable] = createSignal(false)
  let requestRef: HTMLTextAreaElement | undefined
  let titleRef: HTMLInputElement | undefined

  const modeOptions = createMemo<SegmentedControlOption<MissionCreateMode>[]>(() => [
    { value: "ai", label: t("mission_board.create.ai") },
    { value: "manual", label: t("mission_board.create.manual") },
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
  const expertSquadOptions = createMemo<SelectOption[]>(() => [
    ...props.expertSquads.map((squad) => ({
      value: squad.id,
      label: squad.display_label,
      description: squad.description,
    })),
    {
      value: "__install-more-expert-squads__",
      label: t("chat.references.install_more"),
      description: t("chat.references.install_more_description"),
      action: "install-more",
    },
  ])
  const selectedExpertSquad = createMemo(
    () => expertSquadOptions().find((option) => option.value === expertSquadID()) ?? null,
  )
  const canSubmit = createMemo(
    () =>
      Boolean(projectDirectory() && expertSquadID() && request().trim()) &&
      (mode() === "manual" ? Boolean(title().trim()) : modelAvailable()),
  )

  createEffect(() => {
    if (!props.open) return
    const directories = props.projectDirectories
    const preferredDirectory = directories.includes(props.defaultProjectDirectory)
      ? props.defaultProjectDirectory
      : (directories[0] ?? "")
    const squadIDs = props.expertSquads.map((squad) => squad.id)
    const preferredSquad = squadIDs.includes(props.activeExpertSquadID)
      ? props.activeExpertSquadID
      : (squadIDs[0] ?? "")
    setMode("ai")
    setTitle("")
    setRequest("")
    setProjectDirectory(preferredDirectory)
    setExpertSquadID(preferredSquad)
    setExpertSquadQuery("")
    setSubmitting(false)
    setError("")
    queueMicrotask(() => requestRef?.focus())
  })

  async function submit(): Promise<void> {
    if (!canSubmit() || submitting()) return
    setSubmitting(true)
    setError("")
    const common = {
      directory: projectDirectory(),
      request: request().trim(),
      productPillar: props.productPillar,
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
            rows={8}
            maxLines={18}
            maxlength={32_000}
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

        <Show when={mode() === "ai"}>
          <TextField.Root class="mission-create-form__model">
            <TextField.Label>{t("model_selector.group")}</TextField.Label>
            <ComposerModelSelector onModelAvailabilityChange={setModelAvailable} />
          </TextField.Root>
        </Show>

        <div class="mission-create-form__assignments">
          <TextField.Root>
            <TextField.Label>{t("mission_board.create.project")}</TextField.Label>
            <SelectControl<SelectOption>
              options={projectOptions()}
              value={selectedProject()}
              onChange={(option) => setProjectDirectory(option?.value ?? "")}
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
          <TextField.Root>
            <TextField.Label>{t("mission_board.create.expert_squad")}</TextField.Label>
            <SearchField
              value={expertSquadQuery()}
              onValueChange={(value) => {
                setExpertSquadQuery(value)
                props.onExpertSquadQuery?.(value, expertSquadID() ? [expertSquadID()] : [])
              }}
              onClear={() => props.onExpertSquadQuery?.("", expertSquadID() ? [expertSquadID()] : [])}
              placeholder={t("chat.references.search_placeholder")}
              size="sm"
            />
            <SelectControl<SelectOption>
              options={expertSquadOptions()}
              value={selectedExpertSquad()}
              onChange={(option) => {
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
        </div>

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

import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js"
import type { ProductPillar } from "@opencorvus-ai/transport-protocol"
import type { ExpertSquadMarketIndexItem, ExpertSquadOption } from "../services/expert-squad"
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
  onInstallMoreExpertSquads?: (projectDirectory: string) => void
  onProjectExpertSquadQuery?: (
    projectDirectory: string,
    query: string,
    preservedExpertSquadIDs: readonly string[],
  ) => Promise<readonly ExpertSquadOption[]>
  onMarketExpertSquadQuery?: (projectDirectory: string, query: string) => Promise<readonly ExpertSquadMarketIndexItem[]>
  onInstallMarketExpertSquad?: (projectDirectory: string, item: ExpertSquadMarketIndexItem) => Promise<void>
  onOpenMarketExpertSquad?: (item: ExpertSquadMarketIndexItem) => Promise<void>
  canOpenMarketWebPage?: boolean
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
  const [projectExpertSquads, setProjectExpertSquads] = createSignal<readonly ExpertSquadOption[]>(props.expertSquads)
  const [catalogLoading, setCatalogLoading] = createSignal(false)
  const [marketRecommendations, setMarketRecommendations] = createSignal<readonly ExpertSquadMarketIndexItem[]>([])
  const [marketLoading, setMarketLoading] = createSignal(false)
  const [catalogError, setCatalogError] = createSignal("")
  const [marketError, setMarketError] = createSignal("")
  const [marketInstallingID, setMarketInstallingID] = createSignal("")
  const [marketInstalledID, setMarketInstalledID] = createSignal("")
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
    ...projectExpertSquads().map((squad) => ({
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
      !catalogLoading() &&
      !marketInstallingID() &&
      Boolean(projectDirectory() && expertSquadID() && request().trim()) &&
      (mode() === "manual" ? Boolean(title().trim()) : modelAvailable()),
  )

  createEffect<boolean>((wasOpen) => {
    const open = props.open
    if (!open || wasOpen) return open
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
    setProjectExpertSquads(props.expertSquads)
    setCatalogLoading(false)
    setMarketRecommendations([])
    setMarketLoading(false)
    setCatalogError("")
    setMarketError("")
    setMarketInstallingID("")
    setMarketInstalledID("")
    setSubmitting(false)
    setError("")
    queueMicrotask(() => requestRef?.focus())
    return open
  }, false)

  createEffect<string>((previousDirectory) => {
    const directory = projectDirectory()
    if (previousDirectory && directory !== previousDirectory) {
      setProjectExpertSquads([])
      setExpertSquadID("")
      setCatalogLoading(true)
      setMarketRecommendations([])
      setMarketLoading(false)
      setMarketInstallingID("")
      setMarketInstalledID("")
      setCatalogError("")
      setMarketError("")
    }
    return directory
  }, "")

  let catalogSearchSequence = 0
  function applyProjectExpertSquadCatalog(items: readonly ExpertSquadOption[]): void {
    setProjectExpertSquads(items)
    if (!items.some((item) => item.id === expertSquadID())) setExpertSquadID(items[0]?.id ?? "")
  }

  createEffect(() => {
    const open = props.open
    const directory = projectDirectory().trim()
    const query = expertSquadQuery().trim().slice(0, 500)
    const selectedID = expertSquadID()
    const search = props.onProjectExpertSquadQuery
    const sequence = ++catalogSearchSequence
    if (!open || !directory || !search) {
      setCatalogLoading(false)
      return
    }
    setCatalogLoading(true)
    const timer = window.setTimeout(
      () => {
        setCatalogError("")
        void search(directory, query, [selectedID])
          .then((items) => {
            if (sequence === catalogSearchSequence) applyProjectExpertSquadCatalog(items)
          })
          .catch((nextError) => {
            if (sequence === catalogSearchSequence) {
              setProjectExpertSquads([])
              setExpertSquadID("")
              setCatalogError(nextError instanceof Error ? nextError.message : String(nextError))
            }
          })
          .finally(() => {
            if (sequence === catalogSearchSequence) setCatalogLoading(false)
          })
      },
      query ? 280 : 0,
    )
    onCleanup(() => window.clearTimeout(timer))
  })

  let marketSearchSequence = 0
  createEffect(() => {
    const open = props.open
    const directory = projectDirectory().trim()
    const query = expertSquadQuery().trim().slice(0, 500)
    const search = props.onMarketExpertSquadQuery
    const sequence = ++marketSearchSequence
    if (!open || !directory || query.length < 2 || !search) {
      setMarketRecommendations([])
      setMarketLoading(false)
      setMarketError("")
      return
    }
    setMarketLoading(true)
    setMarketRecommendations([])
    setMarketError("")
    const timer = window.setTimeout(() => {
      void search(directory, query)
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
  createEffect(() => {
    const open = props.open
    projectDirectory()
    installLifecycleSequence += 1
    if (!open) {
      setMarketInstallingID("")
      setMarketLoading(false)
    }
  })

  async function installMarketExpertSquad(item: ExpertSquadMarketIndexItem): Promise<void> {
    const install = props.onInstallMarketExpertSquad
    const directory = projectDirectory().trim()
    const loadCatalog = props.onProjectExpertSquadQuery
    const loadMarket = props.onMarketExpertSquadQuery
    if (!install || !loadCatalog || !loadMarket || !directory || marketInstallingID()) return
    const lifecycle = ++installLifecycleSequence
    catalogSearchSequence += 1
    marketSearchSequence += 1
    setCatalogLoading(false)
    setMarketLoading(false)
    setMarketInstallingID(item.id)
    setMarketInstalledID("")
    setMarketError("")
    try {
      await install(directory, item)
      if (lifecycle !== installLifecycleSequence || !props.open || projectDirectory().trim() !== directory) return
      const query = expertSquadQuery().trim().slice(0, 500)
      const catalogSequence = ++catalogSearchSequence
      const marketSequence = ++marketSearchSequence
      const [catalog, market] = await Promise.all([
        loadCatalog(directory, query, [expertSquadID(), item.id]),
        query.length >= 2 ? loadMarket(directory, query) : Promise.resolve([]),
      ])
      if (lifecycle !== installLifecycleSequence || !props.open || projectDirectory().trim() !== directory) return
      if (catalogSequence === catalogSearchSequence) applyProjectExpertSquadCatalog(catalog)
      if (marketSequence === marketSearchSequence) {
        setMarketRecommendations(market)
        setMarketLoading(false)
      }
      setMarketInstalledID(item.id)
    } catch (nextError) {
      if (lifecycle === installLifecycleSequence) {
        setMarketLoading(false)
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
              onValueChange={setExpertSquadQuery}
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
                      <p>{item.description || item.label}</p>
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
                        disabled={submitting() || Boolean(marketInstallingID())}
                        onClick={() => void installMarketExpertSquad(item)}
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

        <Show when={error() || catalogError() || marketError()}>
          <div class="mission-create-form__error" role="alert">
            <Icon name="error-reason" size="compact" />
            <span>{error() || catalogError() || marketError()}</span>
          </div>
        </Show>
      </form>
    </Dialog>
  )
}

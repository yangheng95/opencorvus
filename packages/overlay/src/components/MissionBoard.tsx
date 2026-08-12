import { createEffect, createMemo, createSignal, For, Show } from "solid-js"
import type { ExpertSquadMarketIndexItem } from "../services/expert-squad"
import { MISSION_BOARD_LANES, type MissionBoardLane, type MissionRecord } from "../services/mission"
import { missionBoardStore, reloadMissionBoard } from "../services/mission-board"
import { projectDirectoryLabel } from "../utils/project-directory"
import { detailStamp, relativeTime } from "../utils/time"
import { t } from "../utils/i18n"
import { MissionCreateDialog, type MissionCreateRequest, type MissionManualCreateRequest } from "./MissionCreateDialog"
import { Badge, type BadgeTone } from "./ui/Badge"
import { Button } from "./ui/Button"
import { ContextMenu } from "./ui/ContextMenu"
import { Icon } from "./ui/Icon"
import { SelectControl } from "./ui/SelectControl"
import { TextField } from "./ui/TextField"
import { appStore } from "../store/app"

const MISSION_TASK_PREVIEW_LIMIT = 3

type MissionTask = MissionRecord["tasks"][number]
type ProjectOption = { value: string; label: string }

export interface MissionBoardProps {
  projectDirectories: readonly string[]
  defaultProjectDirectory: string
  onInstallMoreExpertSquads?: (projectDirectory: string) => void
  onMarketExpertSquadQuery?: (projectDirectory: string, query: string) => Promise<readonly ExpertSquadMarketIndexItem[]>
  onInstallMarketExpertSquad?: (projectDirectory: string, item: ExpertSquadMarketIndexItem) => Promise<void>
  onOpenMarketExpertSquad?: (item: ExpertSquadMarketIndexItem) => Promise<void>
  canOpenMarketWebPage?: boolean
  onOpenMission: (mission: MissionRecord) => void | Promise<void>
  onCreateManual: (input: MissionManualCreateRequest) => Promise<void>
  onCreateWithAI: (input: MissionCreateRequest) => Promise<void>
  onDispatchMission: (mission: MissionRecord) => Promise<void>
  onConfirmDeleteMission: (mission: MissionRecord) => Promise<boolean>
  onDeleteMission: (mission: MissionRecord) => Promise<boolean>
}

function taskIsTerminal(task: MissionTask): boolean {
  return (
    task.lifecycleStatus === "completed" || task.lifecycleStatus === "failed" || task.lifecycleStatus === "cancelled"
  )
}

function taskStatusTone(task: MissionTask): BadgeTone {
  if (task.lifecycleStatus === "completed") return "ok"
  if (task.lifecycleStatus === "failed" || task.lifecycleStatus === "cancelled") return "bad"
  if (task.lifecycleStatus === "active") return "accent"
  return "muted"
}

function taskStatusLabel(task: MissionTask): string {
  return t(`mission_board.task_status.${task.lifecycleStatus}`)
}

function missionDirectoryLabel(directory: string): string {
  return projectDirectoryLabel(directory, t("task.project.unknown")).name
}

function missionProjectLabel(mission: MissionRecord): string {
  return missionDirectoryLabel(mission.directory)
}

function missionIdentity(mission: MissionRecord): string {
  return mission.missionID.length > 18 ? `${mission.missionID.slice(0, 15)}…` : mission.missionID
}

function MissionBoardCard(props: {
  mission: MissionRecord
  dispatching: boolean
  deleting: boolean
  actionBusy: boolean
  onOpen: () => void
  onDispatch: () => void
  onDelete: () => void
}) {
  const terminalTasks = createMemo(() => props.mission.tasks.filter(taskIsTerminal).length)
  const activeTasks = createMemo(
    () =>
      props.mission.tasks.filter((task) => task.lifecycleStatus === "queued" || task.lifecycleStatus === "active")
        .length,
  )
  const remainingTasks = createMemo(() => Math.max(0, props.mission.tasks.length - MISSION_TASK_PREVIEW_LIMIT))

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger
        as="article"
        class="mission-board-card"
        data-ui="mission-board-card"
        data-app-context-menu-trigger="true"
        data-lane={props.mission.boardLane}
        data-deleting={props.deleting ? "true" : undefined}
      >
        <Button
          type="button"
          variant="ghost"
          size="md"
          tone="neutral"
          class="mission-board-card__open"
          title={props.mission.title}
          aria-label={t("mission_board.open_mission", { title: props.mission.title })}
          disabled={props.actionBusy}
          onClick={props.onOpen}
        >
          <span class="mission-board-card__identity">
            <span>{missionIdentity(props.mission)}</span>
            <time datetime={new Date(props.mission.updated).toISOString()} title={detailStamp(props.mission.updated)}>
              {relativeTime(props.mission.updated)}
            </time>
          </span>
          <strong class="mission-board-card__title">{props.mission.title}</strong>
          <span class="mission-board-card__project">
            <Icon name="folder" size="compact" />
            <span>{missionProjectLabel(props.mission)}</span>
          </span>
          <Show when={props.mission.completion?.summary}>
            {(summary) => <span class="mission-board-card__summary">{summary()}</span>}
          </Show>
          <Show when={props.mission.pendingPrompt?.text}>
            {(pendingPrompt) => <span class="mission-board-card__summary">{pendingPrompt()}</span>}
          </Show>
          <Show when={props.mission.tasks.length > 0}>
            <span class="mission-board-card__progress-copy">
              <span>
                {t("mission_board.task_progress", {
                  completed: terminalTasks(),
                  total: props.mission.tasks.length,
                })}
              </span>
              <Show when={activeTasks() > 0}>
                <span>{t("mission_board.active_tasks", { count: activeTasks() })}</span>
              </Show>
            </span>
            <progress
              class="mission-board-card__progress"
              max={props.mission.tasks.length}
              value={terminalTasks()}
              aria-label={t("mission_board.task_progress", {
                completed: terminalTasks(),
                total: props.mission.tasks.length,
              })}
            />
            <span class="mission-board-card__tasks">
              <For each={props.mission.tasks.slice(0, MISSION_TASK_PREVIEW_LIMIT)}>
                {(task) => (
                  <Badge class="mission-board-card__task" size="sm" tone={taskStatusTone(task)} title={task.title}>
                    <span>{task.title}</span>
                    <span aria-hidden="true">·</span>
                    <span>{taskStatusLabel(task)}</span>
                  </Badge>
                )}
              </For>
              <Show when={remainingTasks() > 0}>
                <Badge size="sm" tone="muted">
                  {t("mission_board.more_tasks", { count: remainingTasks() })}
                </Badge>
              </Show>
            </span>
          </Show>
          <Show when={props.mission.pendingInteractions > 0}>
            <Badge class="mission-board-card__attention" size="sm" tone="warn">
              <Icon name="interaction-question" size="compact" />
              {t("mission_board.pending_interactions", { count: props.mission.pendingInteractions })}
            </Badge>
          </Show>
        </Button>
        <Show when={props.mission.pendingPrompt}>
          <div class="mission-board-card__actions">
            <Badge size="sm" tone="muted">
              {t("mission_board.create.manual_draft")}
            </Badge>
            <Button
              type="button"
              variant="solid"
              size="sm"
              tone="accent"
              data-ui="mission-board-dispatch"
              disabled={props.actionBusy}
              onClick={props.onDispatch}
            >
              <Icon name={props.dispatching ? "loading" : "send"} size="compact" />
              {props.dispatching ? t("mission_board.create.dispatching") : t("mission_board.create.dispatch")}
            </Button>
          </div>
        </Show>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content class="mission-board-card-menu" data-ui="mission-board-card-menu">
          <ContextMenu.Item
            class="mission-board-card-menu__delete"
            data-ui="mission-board-card-delete"
            disabled={props.actionBusy}
            onSelect={props.onDelete}
          >
            <Icon name={props.deleting ? "loading" : "delete"} size="compact" />
            <span>{props.deleting ? t("mission_board.delete.deleting") : t("mission_board.delete.action")}</span>
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  )
}

export function MissionBoard(props: MissionBoardProps) {
  const [search, setSearch] = createSignal("")
  const [projectDirectory, setProjectDirectory] = createSignal("")
  const [createOpen, setCreateOpen] = createSignal(false)
  const [pendingAction, setPendingAction] = createSignal<{ kind: "dispatch" | "delete"; missionID: string } | null>(
    null,
  )
  const [actionError, setActionError] = createSignal("")
  let searchInput: HTMLInputElement | undefined
  let actionGeneration = 0

  const projectOptions = createMemo<ProjectOption[]>(() => {
    const directories = [...new Set(missionBoardStore.records.map((mission) => mission.directory))].sort(
      (left, right) => missionDirectoryLabel(left).localeCompare(missionDirectoryLabel(right)),
    )
    return [
      { value: "", label: t("mission_board.all_projects") },
      ...directories.map((directory) => ({
        value: directory,
        label: missionDirectoryLabel(directory),
      })),
    ]
  })
  const selectedProject = createMemo(
    () => projectOptions().find((option) => option.value === projectDirectory()) ?? projectOptions()[0] ?? null,
  )
  createEffect(() => {
    const directory = projectDirectory()
    if (directory && !projectOptions().some((option) => option.value === directory)) setProjectDirectory("")
  })
  const visibleMissions = createMemo(() => {
    const query = search().trim().toLocaleLowerCase()
    const directory = projectDirectory()
    return missionBoardStore.records.filter((mission) => {
      if (directory && mission.directory !== directory) return false
      if (!query) return true
      return [mission.title, mission.missionID, mission.directory, missionProjectLabel(mission)].some((value) =>
        value.toLocaleLowerCase().includes(query),
      )
    })
  })
  const filtersActive = createMemo(() => Boolean(search().trim() || projectDirectory()))
  const resetFilters = (): void => {
    setSearch("")
    setProjectDirectory("")
    queueMicrotask(() => searchInput?.focus())
  }
  const laneMissions = (lane: MissionBoardLane) => visibleMissions().filter((mission) => mission.boardLane === lane)

  async function dispatchMission(mission: MissionRecord): Promise<void> {
    if (pendingAction()) return
    const generation = ++actionGeneration
    setActionError("")
    setPendingAction({ kind: "dispatch", missionID: mission.missionID })
    try {
      await props.onDispatchMission(mission)
    } catch (nextError) {
      if (generation === actionGeneration) {
        setActionError(nextError instanceof Error ? nextError.message : String(nextError))
      }
    } finally {
      if (generation === actionGeneration) setPendingAction(null)
    }
  }

  async function deleteMission(mission: MissionRecord): Promise<void> {
    if (pendingAction()) return
    setActionError("")
    try {
      if (!(await props.onConfirmDeleteMission(mission))) return
    } catch (nextError) {
      setActionError(nextError instanceof Error ? nextError.message : String(nextError))
      return
    }
    if (pendingAction()) return
    const generation = ++actionGeneration
    setPendingAction({ kind: "delete", missionID: mission.missionID })
    try {
      await props.onDeleteMission(mission)
    } catch (nextError) {
      if (generation === actionGeneration) {
        setActionError(nextError instanceof Error ? nextError.message : String(nextError))
      }
    } finally {
      if (generation === actionGeneration) setPendingAction(null)
    }
  }

  return (
    <section class="mission-board" data-ui="mission-board" aria-labelledby="missionBoardTitle">
      <header class="mission-board__header oc-surface-header">
        <div class="mission-board__heading oc-surface-header__main">
          <span class="mission-board__title-icon" aria-hidden="true">
            <Icon name="tasks" size="medium" />
          </span>
          <div>
            <h1 id="missionBoardTitle" tabIndex={-1}>
              {t("mission_board.title")}
            </h1>
            <p>{t("mission_board.subtitle")}</p>
          </div>
        </div>
        <div class="mission-board__controls oc-surface-header__actions">
          <Button
            type="button"
            variant="solid"
            size="sm"
            tone="accent"
            data-ui="mission-board-create"
            disabled={Boolean(pendingAction())}
            onClick={() => setCreateOpen(true)}
          >
            <Icon name="plus" size="compact" />
            {t("mission_board.create.action")}
          </Button>
          <TextField.Root class="mission-board__search" size="sm" variant="search">
            <Icon name="search" size="compact" />
            <TextField.Input
              ref={(element) => {
                searchInput = element
              }}
              value={search()}
              placeholder={t("mission_board.search_placeholder")}
              aria-label={t("mission_board.search_placeholder")}
              onInput={(event) => setSearch(event.currentTarget.value)}
            />
          </TextField.Root>
          <SelectControl<ProjectOption>
            class="mission-board__project-filter"
            options={projectOptions()}
            value={selectedProject()}
            onChange={(option) => setProjectDirectory(option?.value ?? "")}
            optionValue="value"
            optionTextValue="label"
            renderValue={(option) => option?.label ?? t("mission_board.all_projects")}
            renderOptionLabel={(option) => option.label}
            ariaLabel={t("mission_board.project_filter")}
            disallowEmptySelection
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            tone="neutral"
            title={t("mission_board.refresh")}
            aria-label={t("mission_board.refresh")}
            disabled={missionBoardStore.loading}
            onClick={() => void reloadMissionBoard()}
          >
            <Icon name={missionBoardStore.loading ? "loading" : "refresh"} size="medium" />
          </Button>
        </div>
      </header>

      <Show when={actionError()}>
        <div class="mission-board__error" role="alert">
          <span>
            <strong>{t("mission_board.action_failed")}</strong>
            <small>{actionError()}</small>
          </span>
          <Button type="button" variant="ghost" size="sm" tone="neutral" onClick={() => setActionError("")}>
            {t("common.dismiss")}
          </Button>
        </div>
      </Show>

      <Show
        when={!missionBoardStore.loading || missionBoardStore.records.length > 0}
        fallback={
          <div class="mission-board__state" role="status" aria-live="polite">
            <Icon name="loading" size="large" />
            <span>{t("mission_board.loading")}</span>
          </div>
        }
      >
        <Show
          when={!missionBoardStore.error && appStore.connected}
          fallback={
            <div class="mission-board__state" role="alert">
              <Icon name="error-reason" size="large" />
              <strong>{t("mission_board.load_failed")}</strong>
              <span>{missionBoardStore.error || t("connection.banner_backend_offline")}</span>
              <Button type="button" variant="outline" size="sm" tone="neutral" onClick={() => void reloadMissionBoard()}>
                {t("common.retry")}
              </Button>
            </div>
          }
        >
          <Show
            when={visibleMissions().length > 0}
            fallback={
              <div class="mission-board__state">
                <Icon name="tasks" size="large" />
                <Show
                  when={missionBoardStore.records.length > 0 && filtersActive()}
                  fallback={
                    <>
                      <strong>{t("mission_board.empty_true")}</strong>
                      <span>{t("mission_board.empty_true_description")}</span>
                      <Button type="button" variant="solid" size="sm" tone="accent" onClick={() => setCreateOpen(true)}>
                        <Icon name="plus" size="compact" />
                        {t("mission_board.create.action")}
                      </Button>
                    </>
                  }
                >
                  <strong>{t("mission_board.empty_filtered")}</strong>
                  <span>
                    {t("mission_board.empty_filtered_description", {
                      search: search().trim() || t("mission_board.filter_none"),
                      project: selectedProject()?.label ?? t("mission_board.all_projects"),
                    })}
                  </span>
                  <Button type="button" variant="outline" size="sm" tone="neutral" onClick={resetFilters}>
                    {t("mission_board.reset_filters")}
                  </Button>
                </Show>
              </div>
            }
          >
            <div class="mission-board__lanes" data-ui="mission-board-lanes">
              <For each={MISSION_BOARD_LANES}>
                {(lane) => (
                  <section class="mission-board-lane" data-lane={lane} aria-labelledby={`missionBoardLane-${lane}`}>
                    <header class="mission-board-lane__header">
                      <span class="mission-board-lane__indicator" aria-hidden="true" />
                      <h2 id={`missionBoardLane-${lane}`}>{t(`mission_board.lane.${lane}`)}</h2>
                      <Badge size="sm" tone="muted">
                        {laneMissions(lane).length}
                      </Badge>
                    </header>
                    <div class="mission-board-lane__cards">
                      <For
                        each={laneMissions(lane)}
                        fallback={<div class="mission-board-lane__empty">{t("mission_board.lane_empty")}</div>}
                      >
                        {(mission) => (
                          <MissionBoardCard
                            mission={mission}
                            dispatching={
                              pendingAction()?.kind === "dispatch" && pendingAction()?.missionID === mission.missionID
                            }
                            deleting={
                              pendingAction()?.kind === "delete" && pendingAction()?.missionID === mission.missionID
                            }
                            actionBusy={Boolean(pendingAction())}
                            onOpen={() => void props.onOpenMission(mission)}
                            onDispatch={() => void dispatchMission(mission)}
                            onDelete={() => void deleteMission(mission)}
                          />
                        )}
                      </For>
                    </div>
                  </section>
                )}
              </For>
            </div>
          </Show>
        </Show>
      </Show>
      <MissionCreateDialog
        open={createOpen()}
        projectDirectories={props.projectDirectories}
        defaultProjectDirectory={props.defaultProjectDirectory}
        onInstallMoreExpertSquads={props.onInstallMoreExpertSquads}
        onMarketExpertSquadQuery={props.onMarketExpertSquadQuery}
        onInstallMarketExpertSquad={props.onInstallMarketExpertSquad}
        onOpenMarketExpertSquad={props.onOpenMarketExpertSquad}
        canOpenMarketWebPage={props.canOpenMarketWebPage}
        onClose={() => setCreateOpen(false)}
        onCreateManual={props.onCreateManual}
        onCreateWithAI={props.onCreateWithAI}
      />
    </section>
  )
}

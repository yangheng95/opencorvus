import { createEffect, createMemo, createSignal, createUniqueId, For, Show } from "solid-js"
import type { ProductPillar } from "@opencorvus-ai/transport-protocol"
import type { ExpertSquadMarketIndexItem } from "../services/expert-squad"
import {
  MISSION_BOARD_LANES,
  type MissionBoardLane,
  type MissionDraftEditInput,
  type MissionRecord,
} from "../services/mission"
import { missionBoardStore, reloadMissionBoard } from "../services/mission-board"
import { workLedgerProject } from "../services/work-ledger"
import { projectDirectoryLabel, projectLedgerDisplayName } from "../utils/project-directory"
import { detailStamp, relativeTime } from "../utils/time"
import { localeTag, t } from "../utils/i18n"
import { taskLifecycleStatusLabel } from "../utils/status-labels"
import { MissionCreateDialog, type MissionCreateRequest, type MissionManualCreateRequest } from "./MissionCreateDialog"
import { Badge, type BadgeTone } from "./ui/Badge"
import { Button } from "./ui/Button"
import { ContextMenu } from "./ui/ContextMenu"
import { Icon } from "./ui/Icon"
import { ComboboxControl } from "./ui/ComboboxControl"
import { matchesSearchTerms } from "../services/text-search"
import { SearchField } from "./ui/SearchField"
import { Feedback } from "./ui/Feedback"
import { appStore } from "../store/app"
import { MissionDraftEditDialog, type MissionDraftEditTarget } from "./MissionDraftEditDialog"
import { Disclosure } from "./ui/Disclosure"
import { SegmentedControl } from "./ui/SegmentedControl"
import { captureApiAuthority, assertApiAuthorityCurrent, isApiAuthorityCurrent, type ApiAuthority } from "../services/api"

const MISSION_TASK_PREVIEW_LIMIT = 3

type MissionTask = MissionRecord["tasks"][number]
type ProjectOption = { value: string; label: string; parent?: string }

export interface MissionBoardProps {
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
  onOpenMission: (mission: MissionRecord) => void | Promise<void>
  onOpenTask: (task: MissionTask) => void | Promise<void>
  onCreateManual: (input: MissionManualCreateRequest) => Promise<MissionRecord>
  onCreateWithAI: (input: MissionCreateRequest) => Promise<void>
  onDispatchMission: (mission: MissionRecord) => Promise<void>
  onEditMissionDraft: (input: MissionDraftEditInput) => Promise<void>
  onConfirmDeleteMission: (mission: MissionRecord) => Promise<boolean>
  onDeleteMission: (mission: MissionRecord) => Promise<boolean>
}

function taskStatusTone(status: MissionTask["lifecycleStatus"]): BadgeTone {
  if (status === "completed") return "ok"
  if (status === "failed" || status === "cancelled") return "bad"
  return "accent"
}

function missionDirectoryLabel(directory: string): string {
  return projectLedgerDisplayName({
    directory,
    customName: workLedgerProject(directory)?.title,
    unknownName: t("task.project.unknown"),
    implicitProjectName: t("work_ledger.implicit_project"),
  })
}

function missionProjectLabel(mission: MissionRecord): string {
  return missionDirectoryLabel(mission.directory)
}

function missionSearchParts(mission: MissionRecord): readonly unknown[] {
  return [
    mission.title,
    mission.missionID,
    mission.sessionID,
    mission.directory,
    mission.directory.replaceAll("\\", "/"),
    missionProjectLabel(mission),
    mission.pendingPrompt?.text,
    mission.outcome?.summary,
    ...(mission.outcome?.kind === "blocked" ? mission.outcome.unresolvedCriteria : []),
  ]
}

function MissionBoardCard(props: {
  mission: MissionRecord
  searchQuery: string
  dispatching: boolean
  deleting: boolean
  actionBusy: boolean
  onOpen: () => void
  onOpenTask: (task: MissionTask) => void
  onDispatch: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const taskCounts = createMemo(() =>
    props.mission.tasks.reduce(
      (counts, task) => {
        counts[task.lifecycleStatus] += 1
        return counts
      },
      { active: 0, completed: 0, failed: 0, cancelled: 0 },
    ),
  )
  const taskProgressLabel = createMemo(() =>
    t("mission_board.task_progress", {
      completed: taskCounts().completed.toLocaleString(localeTag()),
      total: props.mission.tasks.length.toLocaleString(localeTag()),
    }),
  )
  const remainingTasks = createMemo(() => Math.max(0, props.mission.tasks.length - MISSION_TASK_PREVIEW_LIMIT))
  const taskPreview = createMemo(() => {
    if (!props.searchQuery.trim()) return props.mission.tasks.slice(0, MISSION_TASK_PREVIEW_LIMIT)
    const parentParts = missionSearchParts(props.mission)
    return props.mission.tasks
      .map((task, index) => ({
        task,
        index,
        matching: matchesSearchTerms(props.searchQuery, [...parentParts, task.title, task.description]),
      }))
      .sort((left, right) => Number(right.matching) - Number(left.matching) || left.index - right.index)
      .slice(0, MISSION_TASK_PREVIEW_LIMIT)
      .map(({ task }) => task)
  })
  const blockedOutcome = createMemo(() => {
    const outcome = props.mission.outcome
    return outcome?.kind === "blocked" ? outcome : undefined
  })

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
          <strong class="mission-board-card__title">{props.mission.title}</strong>
          <span class="mission-board-card__project" title={props.mission.directory}>
            <Icon name="folder" size="compact" />
            <span>{missionProjectLabel(props.mission)}</span>
          </span>
          <Show when={projectDirectoryLabel(props.mission.directory, "", t("work_ledger.implicit_project")).parent}>
            {(parent) => (
              <span class="mission-board-card__project-parent" title={props.mission.directory}>
                {parent()}
              </span>
            )}
          </Show>
          <Show when={props.mission.outcome?.summary}>
            {(summary) => <span class="mission-board-card__summary">{summary()}</span>}
          </Show>
          <Show when={props.mission.pendingPrompt?.text}>
            {(pendingPrompt) => <span class="mission-board-card__summary">{pendingPrompt()}</span>}
          </Show>
          <span class="mission-board-card__identity">
            <time datetime={new Date(props.mission.updated).toISOString()} title={detailStamp(props.mission.updated)}>
              {relativeTime(props.mission.updated)}
            </time>
          </span>
          <Show when={props.mission.tasks.length > 0}>
            <span class="mission-board-card__progress-copy">{taskProgressLabel()}</span>
            <progress
              class="mission-board-card__progress"
              max={props.mission.tasks.length}
              value={taskCounts().completed}
              aria-label={taskProgressLabel()}
            />
            <Show when={taskCounts().completed < props.mission.tasks.length}>
              <span class="mission-board-card__task-counts">
                <For each={["active", "failed", "cancelled"] as const}>
                  {(status) => (
                    <Show when={taskCounts()[status] > 0}>
                      <Badge size="sm" tone={taskStatusTone(status)}>
                        {t(`mission_board.task_count.${status}`, {
                          count: taskCounts()[status].toLocaleString(localeTag()),
                        })}
                      </Badge>
                    </Show>
                  )}
                </For>
              </span>
            </Show>
          </Show>
          <Show when={props.mission.pendingInteractions > 0}>
            <Badge class="mission-board-card__attention" size="sm" tone="warn">
              <Icon name="interaction-question" size="compact" />
              {t("mission_board.pending_interactions", {
                count: props.mission.pendingInteractions.toLocaleString(localeTag()),
              })}
            </Badge>
          </Show>
        </Button>
        <Show when={props.mission.tasks.length > 0}>
          <div class="mission-board-card__tasks" role="group" aria-label={t("mission_board.child_tasks")}>
            <span class="mission-board-card__tasks-label">{t("mission_board.child_tasks")}</span>
            <For each={taskPreview()}>
              {(task) => (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  tone="neutral"
                  class="mission-board-card__task"
                  title={task.title}
                  aria-label={t("mission_board.open_task", {
                    title: task.title,
                    status: taskLifecycleStatusLabel(task.lifecycleStatus),
                  })}
                  disabled={props.actionBusy}
                  onClick={() => props.onOpenTask(task)}
                >
                  <span class="mission-board-card__task-title">{task.title}</span>
                  <span class="mission-board-card__task-meta">
                    <Badge size="sm" tone={taskStatusTone(task.lifecycleStatus)}>
                      {taskLifecycleStatusLabel(task.lifecycleStatus)}
                    </Badge>
                    <Icon name="chevron" size="compact" />
                  </span>
                </Button>
              )}
            </For>
            <Show when={remainingTasks() > 0}>
              <Badge size="sm" tone="muted">
                {t("mission_board.more_tasks", { count: remainingTasks().toLocaleString(localeTag()) })}
              </Badge>
            </Show>
          </div>
        </Show>
        <Show when={blockedOutcome()}>
          {(outcome) => (
            <Disclosure.Root class="mission-board-card__blockers">
              <Disclosure.Trigger
                indicatorPosition="end"
                aria-label={t("mission_board.unmet_requirements_for", {
                  title: props.mission.title,
                  count: outcome().unresolvedCriteria.length.toLocaleString(localeTag()),
                })}
              >
                <span>
                  {t("mission_board.unmet_requirements", {
                    status: t("mission.outcome.blocked"),
                    count: outcome().unresolvedCriteria.length.toLocaleString(localeTag()),
                  })}
                </span>
              </Disclosure.Trigger>
              <Disclosure.Content>
                <ul>
                  <For each={outcome().unresolvedCriteria}>{(criterion) => <li>{criterion}</li>}</For>
                </ul>
              </Disclosure.Content>
            </Disclosure.Root>
          )}
        </Show>
        <Show when={props.mission.pendingPrompt}>
          <div class="mission-board-card__actions">
            <Badge size="sm" tone="muted">
              {t("mission_board.create.manual_draft")}
            </Badge>
            <div class="mission-board-card__draft-controls">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                tone="neutral"
                disabled={props.actionBusy}
                onClick={props.onEdit}
              >
                <Icon name="edit" size="compact" />
                {t("mission_board.edit.action")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                tone="neutral"
                data-ui="mission-board-dispatch"
                disabled={props.actionBusy}
                onClick={props.onDispatch}
              >
                <Icon name={props.dispatching ? "loading" : "send"} size="compact" />
                {props.dispatching ? t("mission_board.create.dispatching") : t("mission_board.create.dispatch")}
              </Button>
            </div>
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
  const [layout, setLayout] = createSignal<"list" | "board">("list")
  const [projectDirectory, setProjectDirectory] = createSignal("")
  const [createOpen, setCreateOpen] = createSignal(false)
  const [savedDraftReceipt, setSavedDraftReceipt] = createSignal<{ missionID: string; authority: ApiAuthority } | null>(null)
  const [pendingAction, setPendingAction] = createSignal<{ kind: "dispatch" | "delete"; missionID: string } | null>(
    null,
  )
  const [actionError, setActionError] = createSignal("")
  const [editingDraft, setEditingDraft] = createSignal<MissionDraftEditTarget | null>(null)
  let createButton: HTMLButtonElement | undefined
  let searchInput: HTMLInputElement | undefined
  let lanesElement: HTMLDivElement | undefined
  const laneHeadings: Partial<Record<MissionBoardLane, HTMLHeadingElement>> = {}
  let actionGeneration = 0
  const projectContextID = createUniqueId()
  const searchHintID = createUniqueId()
  const currentSavedDraftReceipt = createMemo(() => {
    const receipt = savedDraftReceipt()
    return receipt && isApiAuthorityCurrent(receipt.authority) ? receipt : null
  })
  const savedDraftMission = createMemo(() => {
    const receipt = currentSavedDraftReceipt()
    return receipt ? missionBoardStore.records.find((mission) => mission.missionID === receipt.missionID) : undefined
  })

  const projectOptions = createMemo<ProjectOption[]>(() => {
    const directories = [...new Set(missionBoardStore.records.map((mission) => mission.directory))].sort(
      (left, right) => missionDirectoryLabel(left).localeCompare(missionDirectoryLabel(right)),
    )
    return [
      { value: "", label: t("mission_board.all_projects") },
      ...directories.map((directory) => ({
        value: directory,
        label: missionDirectoryLabel(directory),
        parent: projectDirectoryLabel(directory, "", t("work_ledger.implicit_project")).parent,
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
    const query = search().trim()
    const directory = projectDirectory()
    return missionBoardStore.records.filter((mission) => {
      if (directory && mission.directory !== directory) return false
      return matchesSearchTerms(query, [
        ...missionSearchParts(mission),
        ...mission.tasks.flatMap((task) => [task.title, task.description]),
      ])
    })
  })
  const filtersActive = createMemo(() => Boolean(search().trim() || projectDirectory()))
  const resetFilters = (): void => {
    setSearch("")
    setProjectDirectory("")
    queueMicrotask(() => searchInput?.focus())
  }
  const laneMissions = (lane: MissionBoardLane) => visibleMissions().filter((mission) => mission.boardLane === lane)

  function changeLayout(next: "list" | "board"): void {
    setLayout(next)
    queueMicrotask(() => lanesElement?.scrollTo({ top: 0, left: 0 }))
  }

  function jumpToLane(lane: MissionBoardLane): void {
    const heading = laneHeadings[lane]
    const viewport = lanesElement
    if (!viewport || !heading || !viewport.contains(heading)) return
    viewport.scrollTo({
      top: Math.max(0, heading.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop),
      left: 0,
    })
    heading.focus({ preventScroll: true })
  }

  async function dispatchMission(mission: MissionRecord): Promise<void> {
    if (pendingAction()) return
    const generation = ++actionGeneration
    setActionError("")
    setPendingAction({ kind: "dispatch", missionID: mission.missionID })
    try {
      await props.onDispatchMission(mission)
    } catch (nextError) {
      if (nextError instanceof DOMException && nextError.name === "AbortError") return
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
    <section class="mission-board" data-ui="mission-board" data-layout={layout()} aria-labelledby="missionBoardTitle">
      <header class="mission-board__header">
        <div class="mission-board__heading">
          <div>
            <h1 id="missionBoardTitle" tabIndex={-1}>
              {t("mission_board.title")}
            </h1>
            <p>{t("mission_board.subtitle")}</p>
          </div>
        </div>
        <Button
          type="button"
          variant="solid"
          size="md"
          tone="neutral"
          data-ui="mission-board-create"
          ref={createButton}
          disabled={Boolean(pendingAction())}
          onClick={() => setCreateOpen(true)}
        >
          <Icon name="plus" size="compact" />
          {t("mission_board.create.action")}
        </Button>
      </header>
      <div class="mission-board__controls">
        <SearchField
          clearable
          class="mission-board__search"
          inputRef={(element) => {
            searchInput = element
          }}
          value={search()}
          placeholder={t("mission_board.search_placeholder")}
          ariaDescribedBy={searchHintID}
          onValueChange={setSearch}
        />
        <ComboboxControl<ProjectOption>
          presentation="popup"
          class="mission-board__project-filter"
          options={projectOptions()}
          value={selectedProject()}
          onChange={(option) => {
            if (option) setProjectDirectory(option.value)
          }}
          optionValue="value"
          optionTextValue={(option) => `${option.label} ${option.parent ?? ""}`}
          optionLabel="label"
          placeholder={t("project_picker.search_placeholder")}
          defaultFilter={(option, query) =>
            matchesSearchTerms(query, [option.label, option.parent, option.value, option.value.replaceAll("\\", "/")])
          }
          allowsEmptyCollection
          closeOnSelection
          emptyContent={t("project_picker.no_matches")}
          renderOptionLabel={(option) => (
            <>
              {option.label}
              <Show when={option.parent}>{(parent) => <span class="mission-project-parent">{parent()}</span>}</Show>
            </>
          )}
          renderOptionTooltip={(option) => option.value || undefined}
          inputTitle={projectDirectory() || t("project_picker.search_placeholder")}
          ariaLabel={t("mission_board.project_filter")}
          ariaDescribedBy={projectDirectory() ? projectContextID : undefined}
          disallowEmptySelection
        />
        <SegmentedControl<"list" | "board">
          class="mission-board__layout"
          size="sm"
          ariaLabel={t("mission_board.layout_label")}
          value={layout()}
          options={[
            { value: "list", label: t("mission_board.layout.list") },
            { value: "board", label: t("mission_board.layout.board") },
          ]}
          onChange={changeLayout}
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
        <p class="mission-board__search-hint" id={searchHintID}>{t("mission_board.search_hint")}</p>
        <Show when={projectDirectory()}>
          {(directory) => (
            <div class="mission-board__project-context" id={projectContextID}>
              {directory()}
            </div>
          )}
        </Show>
      </div>

      <Show when={currentSavedDraftReceipt()}>
        <Feedback
          class="mission-board__saved"
          tone="success"
          title={t("mission_board.create.saved")}
          actions={
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                tone="neutral"
                disabled={!savedDraftMission() || Boolean(pendingAction())}
                onClick={() => {
                  const mission = savedDraftMission()
                  if (mission) void props.onOpenMission(mission)
                }}
              >
                {t("mission_board.create.open_saved")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                tone="neutral"
                onClick={() => {
                  setSavedDraftReceipt(null)
                  createButton?.focus({ preventScroll: true })
                }}
              >
                {t("common.dismiss")}
              </Button>
            </>
          }
        >
          {t("mission_board.create.saved_hint")}
        </Feedback>
      </Show>
      <Show when={actionError()}>
        <Feedback
          class="mission-board__error"
          tone="error"
          details={actionError()}
          actions={
            <Button type="button" variant="ghost" size="sm" tone="neutral" onClick={() => setActionError("")}>
              {t("common.dismiss")}
            </Button>
          }
        >
          {t("mission_board.action_failed")}
        </Feedback>
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                tone="neutral"
                onClick={() => void reloadMissionBoard()}
              >
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
                      <Button
                        type="button"
                        variant="solid"
                        size="md"
                        tone="neutral"
                        onClick={() => setCreateOpen(true)}
                      >
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
            <Show when={layout() === "list"}>
              <nav class="mission-board__status-navigation" aria-label={t("mission_board.status_navigation")}>
                <For each={MISSION_BOARD_LANES}>
                  {(lane) => (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      tone="neutral"
                      aria-label={t("mission_board.jump_to_status", {
                        status: t(`mission_board.lane.${lane}`),
                        count: laneMissions(lane).length.toLocaleString(localeTag()),
                      })}
                      disabled={laneMissions(lane).length === 0}
                      onClick={() => jumpToLane(lane)}
                    >
                      {t(`mission_board.lane.${lane}`)}
                      <Badge size="sm" tone="muted">{laneMissions(lane).length.toLocaleString(localeTag())}</Badge>
                    </Button>
                  )}
                </For>
              </nav>
            </Show>
            <div ref={lanesElement} class="mission-board__lanes" data-ui="mission-board-lanes">
              <For each={MISSION_BOARD_LANES}>
                {(lane) => (
                  <section
                    class="mission-board-lane"
                    data-lane={lane}
                    data-empty={laneMissions(lane).length === 0 ? "true" : undefined}
                    aria-labelledby={`missionBoardLane-${lane}`}
                  >
                    <header class="mission-board-lane__header">
                      <span class="mission-board-lane__indicator" aria-hidden="true" />
                      <h2 ref={(element) => { laneHeadings[lane] = element }} id={`missionBoardLane-${lane}`} tabIndex={-1}>
                        {t(`mission_board.lane.${lane}`)}
                      </h2>
                      <Badge size="sm" tone="muted">
                        {laneMissions(lane).length.toLocaleString(localeTag())}
                      </Badge>
                    </header>
                    <div class="mission-board-lane__cards">
                      <For
                        each={laneMissions(lane)}
                        fallback={<div class="mission-board-lane__empty" aria-label={t("mission_board.lane_empty")} />}
                      >
                        {(mission) => (
                          <MissionBoardCard
                            mission={mission}
                            searchQuery={search()}
                            dispatching={
                              pendingAction()?.kind === "dispatch" && pendingAction()?.missionID === mission.missionID
                            }
                            deleting={
                              pendingAction()?.kind === "delete" && pendingAction()?.missionID === mission.missionID
                            }
                            actionBusy={Boolean(pendingAction())}
                            onOpen={() => void props.onOpenMission(mission)}
                            onOpenTask={(task) => void props.onOpenTask(task)}
                            onDispatch={() => void dispatchMission(mission)}
                            onEdit={() =>
                              setEditingDraft({
                                missionID: mission.missionID,
                                directory: mission.directory,
                                title: mission.title,
                                expectedRequest: mission.pendingPrompt!.text,
                              })
                            }
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
      <MissionDraftEditDialog
        target={editingDraft()}
        onClose={() => setEditingDraft(null)}
        onSave={props.onEditMissionDraft}
      />
      <MissionCreateDialog
        open={createOpen()}
        projectDirectories={props.projectDirectories}
        defaultProjectDirectory={projectDirectory() || props.defaultProjectDirectory}
        onInstallMoreExpertSquads={props.onInstallMoreExpertSquads}
        onMarketExpertSquadQuery={props.onMarketExpertSquadQuery}
        onInstallMarketExpertSquad={props.onInstallMarketExpertSquad}
        onOpenMarketExpertSquad={props.onOpenMarketExpertSquad}
        canOpenMarketWebPage={props.canOpenMarketWebPage}
        onClose={() => setCreateOpen(false)}
        onCreateManual={async (input) => {
          const authority = captureApiAuthority()
          const created = await props.onCreateManual(input)
          assertApiAuthorityCurrent(authority)
          setSavedDraftReceipt({ missionID: created.missionID, authority })
        }}
        onCreateWithAI={props.onCreateWithAI}
      />
    </section>
  )
}

import { createMemo, createSignal, onCleanup, onMount, Show } from "solid-js"
import type { WorkLedgerCursor, WorkLedgerRow, WorkLedgerTaskRow } from "../../services/work-ledger"
import { loadWorkLedger } from "../../services/work-ledger"
import { activeTaskID } from "../../store/board"
import { projectDisplayName } from "../../utils/project-directory"
import { taskLifecycleStatusOrIdleLabel } from "../../utils/status-labels"
import { t } from "../../utils/i18n"
import { MemoryPanel } from "../MemoryPanel"
import { SelectControl } from "../ui/SelectControl"
import { SettingsGroup, SettingsPanel, SettingsState } from "./layout"

interface MemoryTaskOption {
  key: string
  id: string
  title: string
  directory: string
  project: string
  status: string
  searchText: string
  updated: number
}

function memoryTaskKey(task: Pick<WorkLedgerTaskRow, "id" | "directory">): string {
  return `${task.id}\u0000${task.directory}`
}

function memoryTaskOptions(rows: readonly WorkLedgerRow[]): MemoryTaskOption[] {
  const projectNames = new Map(
    rows
      .filter((row) => row.kind === "project")
      .map((row) => [
        row.directory,
        projectDisplayName({
          directory: row.directory,
          customName: row.title,
          unknownName: t("task.project.unknown"),
          implicitProjectName: t("work_ledger.implicit_project"),
        }),
      ]),
  )
  const tasks = new Map<string, WorkLedgerTaskRow>()
  const remember = (task: WorkLedgerTaskRow) => tasks.set(memoryTaskKey(task), task)
  for (const row of rows) {
    if (row.kind === "mission") row.tasks.forEach(remember)
    if (row.kind === "task") remember(row)
  }
  return [...tasks.values()]
    .map((task) => {
      const title = task.title.trim() || task.id
      const project =
        projectNames.get(task.directory) ??
        projectDisplayName({
          directory: task.directory,
          unknownName: t("task.project.unknown"),
          implicitProjectName: t("work_ledger.implicit_project"),
        })
      return {
        key: memoryTaskKey(task),
        id: task.id,
        title,
        directory: task.directory,
        project,
        status: taskLifecycleStatusOrIdleLabel(task.lifecycleStatus),
        searchText: `${title} ${project} ${task.directory} ${task.id}`,
        updated: task.updated,
      }
    })
    .sort((left, right) => right.updated - left.updated || left.title.localeCompare(right.title))
}

export function MemoryContextPanel() {
  const [tasks, setTasks] = createSignal<MemoryTaskOption[]>([])
  const [selectedTask, setSelectedTask] = createSignal<MemoryTaskOption | null>(null)
  const [loadingTasks, setLoadingTasks] = createSignal(true)
  const [taskLoadError, setTaskLoadError] = createSignal("")
  const controller = new AbortController()

  onCleanup(() => controller.abort())
  onMount(() => {
    void (async () => {
      setLoadingTasks(true)
      setTaskLoadError("")
      try {
        const rows: WorkLedgerRow[] = []
        let cursor: WorkLedgerCursor | null = null
        do {
          const result = await loadWorkLedger({ cursor, signal: controller.signal })
          rows.push(...result.rows)
          cursor = result.nextCursor
        } while (cursor)
        const options = memoryTaskOptions(rows)
        setTasks(options)
        const activeID = activeTaskID()
        setSelectedTask(options.find((task) => task.id === activeID) ?? null)
      } catch (error) {
        if (controller.signal.aborted) return
        setTasks([])
        setSelectedTask(null)
        setTaskLoadError(error instanceof Error ? error.message : String(error))
      } finally {
        if (!controller.signal.aborted) setLoadingTasks(false)
      }
    })()
  })

  const pickerPlaceholder = createMemo(() => {
    if (loadingTasks()) return t("memory.task_picker_loading")
    if (tasks().length === 0) return t("memory.task_picker_empty")
    return t("memory.task_picker_placeholder")
  })

  return (
    <SettingsPanel>
      <SettingsGroup
        title={t("memory.task_picker_label")}
        description={t("memory.task_picker_description")}
        contentInset
      >
        <div class="memory-task-picker">
          <SelectControl<MemoryTaskOption>
            options={tasks()}
            value={selectedTask()}
            onChange={setSelectedTask}
            optionValue="key"
            optionTextValue="searchText"
            disallowEmptySelection
            disabled={loadingTasks() || tasks().length === 0}
            triggerDataUI="memory-task-picker"
            ariaLabel={t("memory.task_picker_label")}
            renderValue={(task) => <span>{task?.title ?? pickerPlaceholder()}</span>}
            renderOptionLabel={(task) => task.title}
            renderOptionDescription={(task) => `${task.project} · ${task.status}`}
            optionData={(task) => ({
              "data-task-id": task.id,
              "data-task-directory": task.directory,
            })}
          />
          <Show when={taskLoadError()}>
            <SettingsState tone="error">
              {t("memory.task_picker_load_failed", { error: taskLoadError() })}
            </SettingsState>
          </Show>
        </div>
      </SettingsGroup>
      <SettingsGroup title={t("memory.saved_context")} contentInset>
        <MemoryPanel
          taskID={() => selectedTask()?.id}
          directory={() => selectedTask()?.directory}
          active={!loadingTasks()}
        />
      </SettingsGroup>
    </SettingsPanel>
  )
}

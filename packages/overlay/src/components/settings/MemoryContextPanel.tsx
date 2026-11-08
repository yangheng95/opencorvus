import { Feedback } from "../ui/Feedback"
import { batch, createEffect, createMemo, createSignal, onCleanup, Show, untrack } from "solid-js"
import { captureApiAuthority, isApiAuthorityCurrent, type ApiAuthority } from "../../services/api"
import { activeProjectDirectory } from "../../services/project-directory"
import { refreshProjectMemory, type ProjectMemoryDocument } from "../../services/project-memory"
import { loadWorkLedger, type WorkLedgerCursor } from "../../services/work-ledger"
import { subscribeWorkLedgerChanges } from "../../services/sse"
import { projectDirectoryKey, projectDisplayName } from "../../utils/project-directory"
import { localeTag, t } from "../../utils/i18n"
import { MemoryPanel } from "../MemoryPanel"
import { SelectControl } from "../ui/SelectControl"
import { SettingsEmpty, SettingsGroup, SettingsPanel } from "./layout"

interface MemoryProjectOption {
  key: string
  directory: string
  customName?: string
}

function projectName(project: MemoryProjectOption): string {
  return projectDisplayName({
    directory: project.directory,
    customName: project.customName,
    unknownName: t("task.project.unknown"),
    implicitProjectName: t("work_ledger.implicit_project"),
  })
}

export function MemoryContextPanel() {
  const [projects, setProjects] = createSignal<MemoryProjectOption[]>([])
  const projectOptions = createMemo(() => {
    const locale = localeTag()
    return projects().toSorted((left, right) =>
      projectName(left).localeCompare(projectName(right), locale) || left.directory.localeCompare(right.directory),
    )
  })
  const [selectedProjectKey, setSelectedProjectKey] = createSignal<string | null>(null)
  const selectedProject = createMemo(() => projects().find((project) => project.key === selectedProjectKey()) ?? null)
  const selectedDirectory = createMemo(() => selectedProject()?.directory)
  const [projectRefreshToken, setProjectRefreshToken] = createSignal(0)
  const [loadingProjects, setLoadingProjects] = createSignal(true)
  const memoryPanelActive = createMemo(() => !loadingProjects() || projects().length > 0)
  const [projectLoadError, setProjectLoadError] = createSignal("")
  const [document, setDocument] = createSignal<ProjectMemoryDocument | null>(null)
  const [loadingDocument, setLoadingDocument] = createSignal(false)
  const [documentError, setDocumentError] = createSignal("")
  let loadedProjectsAuthority: ApiAuthority | undefined

  onCleanup(
    subscribeWorkLedgerChanges((event) => {
      if (
        event.type === "work-ledger.connected" ||
        (event.type === "work-ledger.changed" && event.sourceType === "project.updated")
      ) {
        setProjectRefreshToken((value) => value + 1)
      }
    }),
  )

  createEffect(() => {
    projectRefreshToken()
    const authority = captureApiAuthority()
    const retainProjects = !!loadedProjectsAuthority && isApiAuthorityCurrent(loadedProjectsAuthority)
    const controller = new AbortController()
    const ownsLoad = () => !controller.signal.aborted && isApiAuthorityCurrent(authority)
    if (!retainProjects) {
      loadedProjectsAuthority = undefined
      batch(() => {
        setProjects([])
        setSelectedProjectKey(null)
      })
    }
    onCleanup(() => controller.abort())
    void (async () => {
      setLoadingProjects(true)
      setProjectLoadError("")
      try {
        const rows = new Map<string, MemoryProjectOption>()
        let cursor: WorkLedgerCursor | null = null
        do {
          const result = await loadWorkLedger({ cursor, signal: controller.signal, authority })
          if (!ownsLoad()) return
          for (const project of result.rows) {
            if (project.kind !== "project") continue
            const key = projectDirectoryKey(project.directory)
            rows.set(key, { key, directory: project.directory, customName: project.title })
          }
          cursor = result.nextCursor
        } while (cursor)
        const currentDirectory = activeProjectDirectory()
        const currentKey = currentDirectory ? projectDirectoryKey(currentDirectory) : ""
        if (currentDirectory && !rows.has(currentKey)) {
          rows.set(currentKey, { key: currentKey, directory: currentDirectory })
        }
        const options = [...rows.values()]
        const selectedKey = retainProjects ? untrack(selectedProjectKey) : currentKey
        batch(() => {
          loadedProjectsAuthority = authority
          setProjects(options)
          setSelectedProjectKey(options.find((project) => project.key === selectedKey)?.key ?? null)
        })
      } catch (error) {
        if (!ownsLoad()) return
        loadedProjectsAuthority = undefined
        batch(() => {
          setProjects([])
          setSelectedProjectKey(null)
        })
        setProjectLoadError(error instanceof Error ? error.message : String(error))
      } finally {
        if (ownsLoad()) setLoadingProjects(false)
      }
    })()
  })

  createEffect(() => {
    const directory = selectedDirectory()
    const authority = captureApiAuthority()
    let active = true
    onCleanup(() => { active = false })
    const ownsLoad = () => active && isApiAuthorityCurrent(authority) && selectedDirectory() === directory
    setDocument(null)
    setDocumentError("")
    setLoadingDocument(!!directory)
    if (!directory) return
    void refreshProjectMemory({ authority, directory }).then(
      (value) => { if (ownsLoad()) setDocument(value) },
      (error) => { if (ownsLoad()) setDocumentError(error instanceof Error ? error.message : String(error)) },
    ).finally(() => { if (ownsLoad()) setLoadingDocument(false) })
  })

  const pickerPlaceholder = createMemo(() => {
    if (loadingProjects()) return t("memory.project_picker_loading")
    if (projects().length === 0) return t("memory.project_picker_empty")
    return t("memory.project_picker_placeholder")
  })
  const number = (value: number) => new Intl.NumberFormat(localeTag()).format(value)

  return (
    <SettingsPanel>
      <SettingsGroup
        title={t("memory.project_picker_label")}
        description={t("memory.project_picker_description")}
        contentInset
      >
        <div class="memory-project-picker">
          <SelectControl<MemoryProjectOption>
            options={projectOptions()}
            value={selectedProject()}
            onChange={(project) => setSelectedProjectKey(project?.key ?? null)}
            optionValue="key"
            optionTextValue={(project) => `${projectName(project)} ${project.directory}`}
            disallowEmptySelection
            disabled={projects().length === 0}
            triggerDataUI="memory-project-picker"
            ariaLabel={t("memory.project_picker_label")}
            renderValue={(project) => <span>{project ? projectName(project) : pickerPlaceholder()}</span>}
            renderOptionLabel={projectName}
            renderOptionDescription={(project) => project.directory}
            optionData={(project) => ({ "data-project-directory": project.directory })}
          />
          <Show when={selectedProject()}>
            {(project) => <div class="memory-project-directory">{project().directory}</div>}
          </Show>
          <Show when={projectLoadError()}>
            <Feedback tone="error">{t("memory.project_picker_load_failed", { error: projectLoadError() })}</Feedback>
          </Show>
        </div>
      </SettingsGroup>
      <SettingsGroup
        title={t("memory.project_document")}
        description={t("memory.project_document_description")}
        contentInset
      >
        <Show when={loadingDocument()}><Feedback>{t("common.loading")}</Feedback></Show>
        <Show when={documentError()}>
          <Feedback tone="error" details={documentError()}>{t("memory.project_document_failed")}</Feedback>
        </Show>
        <Show when={document()}>
          {(value) => (
            <>
              <div class="memory-project-meta">
                <span>{t("memory.project_revision", { value: number(value().revision) })}</span>
                <span>{t("memory.project_tokens", { value: number(value().tokenCount) })}</span>
                <span>{t("memory.updated", { value: new Date(value().timeUpdated).toLocaleString(localeTag()) })}</span>
              </div>
              <Show when={value().pendingCount > 0}>
                <Feedback>{t("memory.project_pending", { value: number(value().pendingCount) })}</Feedback>
              </Show>
              <Show when={value().content} fallback={<SettingsEmpty>{t("memory.project_document_empty")}</SettingsEmpty>}>
                <pre class="memory-project-content" tabIndex={0} aria-label={t("memory.project_document")}>
                  {value().content}
                </pre>
              </Show>
            </>
          )}
        </Show>
        <Show when={!selectedProject() && !loadingProjects()}>
          <SettingsEmpty>{t("memory.none_unselected")}</SettingsEmpty>
        </Show>
      </SettingsGroup>
      <SettingsGroup
        title={t("memory.saved_context")}
        description={t("memory.saved_context_description")}
        contentInset
      >
        <MemoryPanel directory={selectedDirectory} active={memoryPanelActive()} />
      </SettingsGroup>
    </SettingsPanel>
  )
}

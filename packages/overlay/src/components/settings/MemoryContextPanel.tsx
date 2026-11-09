import { Feedback } from "../ui/Feedback"
import { batch, createEffect, createMemo, createSignal, onCleanup, Show, untrack } from "solid-js"
import { captureApiAuthority, isApiAuthorityCurrent, type ApiAuthority } from "../../services/api"
import { activeProjectDirectory } from "../../services/project-directory"
import { refreshProjectMemory, type ProjectMemoryDocument } from "../../services/project-memory"
import { loadWorkLedger, type WorkLedgerCursor } from "../../services/work-ledger"
import { subscribeWorkLedgerChanges } from "../../services/sse"
import { formatErrorDetails } from "../../utils/error-details"
import { projectDirectoryKey, projectDisplayName } from "../../utils/project-directory"
import { localeTag, t } from "../../utils/i18n"
import { MemoryPanel } from "../MemoryPanel"
import { Button } from "../ui/Button"
import { Icon } from "../ui/Icon"
import { SelectControl } from "../ui/SelectControl"
import { SettingsEmpty, SettingsGroup, SettingsPanel } from "./layout"

interface MemoryProjectOption {
  key: string
  directory: string
  customName?: string
}

interface ProjectListFailure {
  authority: ApiAuthority
  cause: unknown
  operation: "initial" | "refresh"
}

type ProjectDocumentState =
  | { status: "loading" }
  | { status: "error" | "retrying"; cause: unknown }
  | { status: "ready"; value: ProjectMemoryDocument }

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
  const refreshProjects = () => setProjectRefreshToken((value) => value + 1)
  const [loadingProjects, setLoadingProjects] = createSignal(true)
  const memoryPanelActive = createMemo(() => !loadingProjects() || projects().length > 0)
  const [projectLoadError, setProjectLoadError] = createSignal<ProjectListFailure>()
  const [documentState, setDocumentState] = createSignal<ProjectDocumentState>()
  const documentValue = createMemo(() => {
    const state = documentState()
    return state?.status === "ready" ? state.value : undefined
  })
  const documentFailure = createMemo(() => {
    const state = documentState()
    return state?.status === "error" || state?.status === "retrying" ? state : undefined
  })
  let loadedProjectsAuthority: ApiAuthority | undefined
  let projectGroup: HTMLElement | undefined
  let projectTrigger: HTMLButtonElement | undefined
  let retryTrigger: HTMLButtonElement | undefined
  let documentGroup: HTMLElement | undefined
  let retryDocument: ((trigger: HTMLButtonElement) => void) | undefined

  onCleanup(
    subscribeWorkLedgerChanges((event) => {
      if (
        event.type === "work-ledger.connected" ||
        (event.type === "work-ledger.changed" && event.sourceType === "project.updated")
      ) {
        refreshProjects()
      }
    }),
  )

  createEffect(() => {
    projectRefreshToken()
    const authority = captureApiAuthority()
    const retainProjects = !!loadedProjectsAuthority && isApiAuthorityCurrent(loadedProjectsAuthority)
    const controller = new AbortController()
    const ownsLoad = () => !controller.signal.aborted && isApiAuthorityCurrent(authority)
    const previousFailure = untrack(projectLoadError)
    batch(() => {
      setLoadingProjects(true)
      if (previousFailure && !isApiAuthorityCurrent(previousFailure.authority)) {
        retryTrigger = undefined
        setProjectLoadError(undefined)
      }
      if (!retainProjects) {
        loadedProjectsAuthority = undefined
        setProjects([])
        setSelectedProjectKey(null)
      }
    })
    onCleanup(() => controller.abort())
    void (async () => {
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
        if (retryTrigger && retryTrigger.ownerDocument.activeElement === retryTrigger) {
          const destination = options.length ? projectTrigger : projectGroup
          destination?.focus({ preventScroll: true })
        }
        retryTrigger = undefined
        setProjectLoadError(undefined)
      } catch (cause) {
        if (!ownsLoad()) return
        setProjectLoadError({ authority, cause, operation: retainProjects ? "refresh" : "initial" })
      } finally {
        if (ownsLoad()) setLoadingProjects(false)
      }
    })()
  })

  createEffect(() => {
    const directory = selectedDirectory()
    const authority = captureApiAuthority()
    let active = true
    onCleanup(() => {
      active = false
      retryDocument = undefined
    })
    const ownsLoad = () => active && isApiAuthorityCurrent(authority) && selectedDirectory() === directory
    if (!directory) {
      setDocumentState(undefined)
      return
    }
    const read = async (retry?: { trigger: HTMLButtonElement; cause: unknown }) => {
      if (!ownsLoad()) return
      setDocumentState(retry ? { status: "retrying", cause: retry.cause } : { status: "loading" })
      let value: ProjectMemoryDocument
      try {
        value = await refreshProjectMemory({ authority, directory })
      } catch (cause) {
        if (ownsLoad()) setDocumentState({ status: "error", cause })
        return
      }
      if (!ownsLoad()) return
      const restoreFocus = retry && retry.trigger.ownerDocument.activeElement === retry.trigger
      setDocumentState({ status: "ready", value })
      if (restoreFocus) documentGroup?.focus({ preventScroll: true })
    }
    retryDocument = (trigger) => {
      const state = documentState()
      if (state?.status === "error") void read({ trigger, cause: state.cause })
    }
    void read()
  })

  const pickerPlaceholder = createMemo(() => {
    if (projectLoadError()?.operation === "initial") return t("memory.project_picker_unavailable")
    if (loadingProjects() && projects().length === 0) return t("memory.project_picker_loading")
    if (projects().length === 0) return t("memory.project_picker_empty")
    return t("memory.project_picker_placeholder")
  })
  const number = (value: number) => new Intl.NumberFormat(localeTag()).format(value)

  return (
    <SettingsPanel>
      <SettingsGroup
        title={t("memory.project_picker_label")}
        description={t("memory.project_picker_description")}
        aria-label={t("memory.project_picker_label")}
        tabIndex={-1}
        ref={projectGroup}
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
            triggerRef={(element) => { projectTrigger = element }}
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
            {(failure) => (
              <Feedback
                tone="error"
                details={formatErrorDetails(failure().cause)}
                actions={(
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    tone="neutral"
                    aria-disabled={loadingProjects() || undefined}
                    onClick={(event) => {
                      if (loadingProjects()) return
                      retryTrigger = event.currentTarget
                      refreshProjects()
                    }}
                  >
                    <Icon name="refresh" />{loadingProjects() ? t("common.loading") : t("common.retry")}
                  </Button>
                )}
              >
                {t(failure().operation === "refresh" ? "memory.project_picker_refresh_failed" : "memory.project_picker_load_failed")}
              </Feedback>
            )}
          </Show>
        </div>
      </SettingsGroup>
      <SettingsGroup
        title={t("memory.project_document")}
        description={t("memory.project_document_description")}
        aria-label={t("memory.project_document")}
        class="memory-project-document"
        tabIndex={-1}
        ref={documentGroup}
        contentInset
      >
        <Show when={documentState()?.status === "loading"}><Feedback>{t("common.loading")}</Feedback></Show>
        <Show when={documentFailure()}>
          {(failure) => (
            <Feedback
              tone="error"
              details={formatErrorDetails(failure().cause)}
              actions={(
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  tone="neutral"
                  aria-disabled={failure().status === "retrying" || undefined}
                  onClick={(event) => retryDocument?.(event.currentTarget)}
                >
                  <Icon name="refresh" />{t(failure().status === "retrying" ? "common.loading" : "common.retry")}
                </Button>
              )}
            >
              {t("memory.project_document_failed")}
            </Feedback>
          )}
        </Show>
        <Show when={documentValue()}>
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

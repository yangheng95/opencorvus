import { DropdownMenu } from "./ui/DropdownMenu"
import { createSignal, Show, type JSX } from "solid-js"
import { formatErrorDetails, reportError } from "../services/diagnostics"
import { t } from "../utils/i18n"
import { projectDirectoryKey, projectDirectoryLabel, projectDisplayName } from "../utils/project-directory"
import { workLedgerSummaryAnchorRect } from "../utils/work-ledger-summary-anchor"
import { Icon } from "./ui/Icon"
import { Button } from "./ui/Button"
import { Tooltip } from "./ui/Tooltip"
import { pathRevealLabelKey } from "../services/workspace"

export interface ProjectLedgerGroupProps {
  directory: string
  count: number
  collapsed: boolean
  onToggle: () => void
  onSelectProject?: (directory: string) => void | Promise<void>
  projectName?: string
  pinned?: boolean
  onPinnedChange?: (pinned: boolean) => void | Promise<void>
  onCreateChat?: (directory: string) => void | Promise<void>
  onOpenProjectDirectory?: (directory: string) => void | Promise<void>
  onRenameProject?: (directory: string, currentName: string) => void | Promise<void>
  onPromoteProject?: (directory: string) => void | Promise<void>
  onDeleteProject?: (directory: string) => void | Promise<void>
  children: JSX.Element
  class?: string
  dataUi?: string
}

export function createProjectLedgerGroupCollapseState() {
  const [collapsedDirectories, setCollapsedDirectories] = createSignal<Record<string, boolean>>({})

  function isCollapsed(directory: string): boolean {
    return collapsedDirectories()[projectDirectoryKey(directory)] === true
  }

  function toggle(directory: string): void {
    const key = projectDirectoryKey(directory)
    setCollapsedDirectories((current) => {
      const next = { ...current }
      if (next[key]) delete next[key]
      else next[key] = true
      return next
    })
  }

  return { isCollapsed, toggle }
}

function projectLedgerGroupBodyElementID(directory: string, dataUi: string | undefined): string {
  const namespace = dataUi || "task-project-group"
  const raw = `${namespace}-${projectDirectoryKey(directory)}-body`
  return raw.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "project-group-body"
}

function projectActionErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function runProjectAction(owner: string, action: () => void | Promise<void>): void {
  try {
    void Promise.resolve(action()).catch((error) => {
      reportError({
        id: `project-ledger:${owner}`,
        title: t("common.error"),
        message: projectActionErrorMessage(error),
        details: formatErrorDetails(error),
      })
    })
  } catch (error) {
    reportError({
      id: `project-ledger:${owner}`,
      title: t("common.error"),
      message: projectActionErrorMessage(error),
      details: formatErrorDetails(error),
    })
  }
}

export function ProjectLedgerGroup(props: ProjectLedgerGroupProps) {
  let groupHeadRef!: HTMLDivElement
  const directoryLabel = () => projectDirectoryLabel(props.directory, t("task.project.unknown"))
  const label = () => {
    const directoryDefaults = directoryLabel()
    return {
      ...directoryDefaults,
      name: projectDisplayName({
        directory: props.directory,
        customName: props.projectName,
        unknownName: t("task.project.unknown"),
      }),
    }
  }
  const className = () => ["project-group", props.class].filter(Boolean).join(" ")
  const countText = () => String(props.count)
  const tooltipDirectory = () => props.directory.trim()
  const tooltipFolderName = () => (tooltipDirectory() ? projectDirectoryLabel(tooltipDirectory(), "").name.trim() : "")
  const hasTooltipSummary = () => Boolean(tooltipFolderName() || props.count > 0 || tooltipDirectory())
  const bodyElementID = () => projectLedgerGroupBodyElementID(props.directory, props.dataUi)
  const canCreateChat = () => !!props.onCreateChat && !!props.directory.trim()
  const canPinProject = () => !!props.onPinnedChange && !!props.directory.trim()
  const canOpenProjectDirectory = () => !!props.onOpenProjectDirectory && !!props.directory.trim()
  const canRenameProject = () => !!props.onRenameProject && !!props.directory.trim()
  const canPromoteProject = () => !!props.onPromoteProject && !!props.directory.trim()
  const canDeleteProject = () => !!props.onDeleteProject && !!props.directory.trim()
  const canManageProject = () =>
    canPinProject() || canOpenProjectDirectory() || canRenameProject() || canPromoteProject() || canDeleteProject()
  const hasProjectActions = () => canManageProject() || canCreateChat()

  return (
    <section
      class={className()}
      data-ui={props.dataUi}
      data-collapsed={props.collapsed ? "true" : undefined}
      data-project-directory={props.directory}
      data-project-actions={hasProjectActions() ? "true" : undefined}
    >
      <div ref={groupHeadRef} class="project-group-head oc-navigation-row" data-density="compact">
        <Tooltip.Root
          openDelay={350}
          closeDelay={0}
          ignoreSafeArea
          placement="right-start"
          flip={false}
          gutter={8}
          getAnchorRect={() => workLedgerSummaryAnchorRect(groupHeadRef)}
        >
          <Tooltip.Trigger
            as={Button}
            type="button"
            variant="ghost"
            size="mini"
            tone="neutral"
            data-ui="project-group-toggle"
            aria-expanded={props.collapsed ? "false" : "true"}
            aria-controls={props.collapsed ? undefined : bodyElementID()}
            aria-label={
              props.collapsed
                ? t("task.project.expand", { name: label().name })
                : t("task.project.collapse", { name: label().name })
            }
            onClick={() => {
              props.onToggle()
              if (props.onSelectProject) {
                runProjectAction(`select:${props.directory}`, () => props.onSelectProject?.(props.directory))
              }
            }}
          >
            <span class="project-group-icon" aria-hidden="true">
              <Icon name={props.collapsed ? "folder" : "folder-open"} size="medium" />
            </span>
            <span class="project-group-copy">
              <span class="project-group-name">{label().name}</span>
              <Show when={label().parent}>
                <span class="project-group-parent">{label().parent}</span>
              </Show>
            </span>
            <span class="project-group-count" aria-label={t("task.project.count", { count: countText() })}>
              {countText()}
            </span>
            <span class="project-group-chevron" aria-hidden="true">
              <Icon name={props.collapsed ? "chevron" : "chevron-down"} size="compact" />
            </span>
          </Tooltip.Trigger>
          <Show when={hasTooltipSummary()}>
            <Tooltip.Portal>
              <Tooltip.Content
                class="card-meta-tooltip project-group-summary-tooltip"
                data-ui="project-group-summary-tooltip"
              >
                <Show when={tooltipFolderName()}>
                  <div class="project-group-summary-tooltip__headline">
                    <Icon name="folder" size="medium" />
                    <strong>{tooltipFolderName()}</strong>
                  </div>
                </Show>
                <Show when={props.count > 0}>
                  <div class="work-ledger-tooltip__fact" data-ui="project-group-summary-count">
                    <Icon name="message" size="medium" />
                    <span class="work-ledger-tooltip__fact-value">
                      {t("work_ledger.tooltip.item_count", { count: String(props.count) })}
                    </span>
                  </div>
                </Show>
                <Show when={tooltipDirectory()}>
                  <div
                    class="work-ledger-tooltip__fact project-group-summary-tooltip__path"
                    data-ui="project-group-summary-path"
                  >
                    <Icon name="folder" size="medium" />
                    <span class="work-ledger-tooltip__fact-value">{tooltipDirectory()}</span>
                  </div>
                </Show>
              </Tooltip.Content>
            </Tooltip.Portal>
          </Show>
        </Tooltip.Root>
        <div class="project-group-actions">
          <Show when={canManageProject()}>
            <DropdownMenu.Root placement="bottom-start" gutter={6} fitViewport>
              <DropdownMenu.Trigger
                as={Button}
                type="button"
                variant="ghost"
                size="icon"
                tone="neutral"
                data-chrome="icon-action"
                data-ui="project-group-more"
                title={t("project.more_actions")}
                aria-label={t("project.more_actions")}
              >
                <Icon name="more-horizontal" />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content class="project-group-menu" data-ui="project-group-menu">
                  <Show when={canPinProject()}>
                    <DropdownMenu.Item
                      as="button"
                      type="button"
                      class="project-group-menu-item"
                      data-ui="project-group-pin"
                      data-pinned={props.pinned ? "true" : "false"}
                      onSelect={() => {
                        runProjectAction(`pin:${props.directory}`, () => props.onPinnedChange?.(!props.pinned))
                      }}
                    >
                      <Icon name="pin" size="medium" />
                      <span>{props.pinned ? t("work_ledger.action.unpin") : t("work_ledger.action.pin")}</span>
                    </DropdownMenu.Item>
                  </Show>
                  <Show when={canOpenProjectDirectory()}>
                    <DropdownMenu.Item
                      as="button"
                      type="button"
                      class="project-group-menu-item"
                      data-ui="project-group-open-directory"
                      onSelect={() => {
                        runProjectAction(`open-directory:${props.directory}`, () =>
                          props.onOpenProjectDirectory?.(props.directory),
                        )
                      }}
                    >
                      <Icon name="folder-open" size="medium" />
                      <span>{t(pathRevealLabelKey())}</span>
                    </DropdownMenu.Item>
                  </Show>
                  <Show when={canRenameProject()}>
                    <DropdownMenu.Item
                      as="button"
                      type="button"
                      class="project-group-menu-item"
                      data-ui="project-group-rename"
                      onSelect={() => {
                        runProjectAction(`rename:${props.directory}`, () =>
                          props.onRenameProject?.(props.directory, label().name),
                        )
                      }}
                    >
                      <Icon name="edit" size="medium" />
                      <span>{t("project.rename_menu_label")}</span>
                    </DropdownMenu.Item>
                  </Show>
                  <Show when={canPromoteProject()}>
                    <DropdownMenu.Item
                      as="button"
                      type="button"
                      class="project-group-menu-item"
                      data-ui="project-group-promote-anonymous"
                      onSelect={() => {
                        runProjectAction(`promote:${props.directory}`, () => props.onPromoteProject?.(props.directory))
                      }}
                    >
                      <Icon name="project-add" size="medium" />
                      <span>{t("project.promote_anonymous_menu_label")}</span>
                    </DropdownMenu.Item>
                  </Show>
                  <Show
                    when={
                      canDeleteProject() &&
                      (canPinProject() || canOpenProjectDirectory() || canRenameProject() || canPromoteProject())
                    }
                  >
                    <DropdownMenu.Separator />
                  </Show>
                  <Show when={canDeleteProject()}>
                    <DropdownMenu.Item
                      as="button"
                      type="button"
                      class="project-group-menu-item"
                      data-tone="danger"
                      data-ui="project-group-delete"
                      data-project-delete={props.directory}
                      onSelect={() => {
                        runProjectAction(`delete:${props.directory}`, () => props.onDeleteProject?.(props.directory))
                      }}
                    >
                      <Icon name="delete" size="medium" />
                      <span>{t("project.delete_menu_label")}</span>
                    </DropdownMenu.Item>
                  </Show>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </Show>
          <Show when={canCreateChat()}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              tone="neutral"
              data-chrome="icon-action"
              data-ui="project-group-new-chat"
              data-project-new-chat={props.directory}
              title={t("project.new_chat_button_title")}
              aria-label={t("project.new_chat_button_title")}
              onClick={(event) => {
                event.stopPropagation()
                runProjectAction(`new-chat:${props.directory}`, () => props.onCreateChat?.(props.directory))
              }}
            >
              <Icon name="plus" />
            </Button>
          </Show>
        </div>
      </div>
      <Show when={!props.collapsed}>
        <div id={bodyElementID()} class="project-group-body">
          {props.children}
        </div>
      </Show>
    </section>
  )
}

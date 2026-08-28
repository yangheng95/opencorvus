import { For, Show, createMemo, createSignal, onCleanup } from "solid-js"
import { type ProjectEditorID } from "../services/host-transport"
import { getHostTransport } from "../services/host-transport-runtime"
import { formatErrorDetails, reportError } from "../services/diagnostics"
import { createPersistedSelectionOwner } from "../services/persisted-selection-owner"
import type { PersistedOverlaySettings } from "../services/persisted-overlay-settings"
import {
  activeDirectory,
  openDirectory,
  openDirectoryInEditor,
  pathRevealLabelKey,
  PROJECT_EDITORS,
} from "../services/workspace"
import { saveSettings, settingsStore, setSettingsStore } from "../store/settings"
import { t } from "../utils/i18n"
import { Icon, type IconName } from "./ui/Icon"
import type { IconSizeTier } from "./ui/Icon.types"
import { WorkspaceSplitLauncher, WorkspaceSplitLauncherItem } from "./WorkspaceSplitLauncher"

const EDITOR_ICONS: Record<ProjectEditorID, IconName> = {
  vscode: "editor-vscode",
  pycharm: "editor-pycharm",
  webstorm: "editor-webstorm",
  intellij: "editor-intellij",
  cursor: "editor-cursor",
}

const EDITOR_MENU_ICON_SIZES: Record<ProjectEditorID, IconSizeTier> = {
  vscode: "medium",
  pycharm: "medium",
  webstorm: "large",
  intellij: "large",
  cursor: "large",
}

/** Whether this host has any project editor to launch. */
export function workspaceEditorLaunchersAvailable(): boolean {
  return getHostTransport().capabilities.ui.projectEditors.length > 0
}

export function WorkspaceEditorLaunchers() {
  const hostCapabilities = getHostTransport().capabilities
  const supportedEditorIDs = hostCapabilities.ui.projectEditors
  const supportedEditors = createMemo(() => PROJECT_EDITORS.filter((editor) => supportedEditorIDs.includes(editor.id)))
  const disabled = () => !activeDirectory() || supportedEditors().length === 0
  const selectedEditor = () =>
    supportedEditorIDs.includes(settingsStore.projectEditor) ? settingsStore.projectEditor : supportedEditors()[0]?.id
  const selectedEditorLabel = () =>
    PROJECT_EDITORS.find((editor) => editor.id === selectedEditor())?.label ?? selectedEditor()
  const [open, setOpen] = createSignal(false)
  const editorSelectionOwner = createPersistedSelectionOwner<ProjectEditorID, PersistedOverlaySettings>({
    read: () => settingsStore.projectEditor,
    write: (value) => setSettingsStore("projectEditor", value),
    confirmedValue: (settings) => settings.projectEditor,
    persist: (snapshot, onFailure) =>
      saveSettings({
        overrides: { projectEditor: snapshot },
        onFailure,
      }),
    onCurrentFailure: (error) =>
      reportError({
        id: "workspace-launcher:editor-save",
        title: t("common.error"),
        message: error instanceof Error ? error.message : String(error),
        details: formatErrorDetails(error),
      }),
  })
  onCleanup(editorSelectionOwner.invalidate)

  function close() {
    setOpen(false)
  }

  async function openEditor(editor: ProjectEditorID) {
    if (!supportedEditorIDs.includes(editor)) return
    const snapshot = editor
    close()
    if (!(await editorSelectionOwner.select(snapshot))) return
    await openDirectoryInEditor(snapshot)
  }

  async function openFileManager() {
    close()
    await openDirectory()
  }

  return (
    <WorkspaceSplitLauncher
      rootClass="workspace-editor-launchers"
      menuClass="workspace-editor-menu"
      disabled={disabled()}
      open={open()}
      title={t("workspace.editor_launchers")}
      primaryAriaLabel={t("cwd.open_in_editor", { name: selectedEditorLabel() })}
      menuAriaLabel={t("workspace.editor_launchers_menu")}
      primaryDataUI="workspace-editor-open-default"
      menuDataUI="workspace-editor-menu"
      onPrimaryClick={() => {
        const editor = selectedEditor()
        if (editor) return openEditor(editor)
      }}
      onOpenChange={setOpen}
      primaryChildren={
        <>
          <span class="workspace-editor-select-icon" data-editor={selectedEditor() ?? ""} aria-hidden="true">
            <Icon name={EDITOR_ICONS[selectedEditor() ?? "vscode"]} size="medium" />
          </span>
          <span class="workspace-editor-primary-label">{t("workspace.editor_open")}</span>
        </>
      }
      menuButtonChildren={
        <span class="workspace-editor-select-caret" aria-hidden="true">
          <Icon name="chevron-down" size="medium" />
        </span>
      }
    >
      <For each={supportedEditors()}>
        {(editor) => (
          <WorkspaceSplitLauncherItem
            class="workspace-editor-option"
            dataAttributes={{ "data-editor": editor.id }}
            onSelect={() => openEditor(editor.id)}
          >
            <span class="workspace-editor-option-icon" aria-hidden="true">
              <Icon name={EDITOR_ICONS[editor.id]} size={EDITOR_MENU_ICON_SIZES[editor.id]} />
            </span>
            <span class="workspace-editor-option-label">{t("cwd.open_in_editor", { name: editor.label })}</span>
          </WorkspaceSplitLauncherItem>
        )}
      </For>
      <WorkspaceSplitLauncherItem
        class="workspace-editor-option"
        dataAttributes={{ "data-open-target": "file-manager" }}
        onSelect={openFileManager}
      >
        <span class="workspace-editor-option-icon" aria-hidden="true">
          <Icon name="folder-open" size="medium" />
        </span>
        <span class="workspace-editor-option-label">{t(pathRevealLabelKey())}</span>
      </WorkspaceSplitLauncherItem>
    </WorkspaceSplitLauncher>
  )
}

import { createMemo, Show } from "solid-js"
import { t } from "../../utils/i18n"
import { projectDirectoryLabel, projectLedgerDisplayName } from "../../utils/project-directory"
import { Disclosure } from "../ui/Disclosure"

interface ProjectScopeProps {
  directory: string
  customName?: string
}

export function SettingsProjectScopeLabel(props: ProjectScopeProps) {
  const label = createMemo(() => {
    const input = {
      directory: props.directory,
      customName: props.customName,
      unknownName: t("task.project.unknown"),
      implicitProjectName: t("work_ledger.implicit_project"),
    }
    return {
      name: projectLedgerDisplayName(input),
      parent: projectDirectoryLabel(input.directory, input.unknownName, input.implicitProjectName).parent,
    }
  })
  return (
    <span class="settings-project-scope-label">
      <strong>{t("settings.product.scope_project", { project: label().name })}</strong>
      <Show when={label().parent}>
        {(path) => (
          <span class="settings-project-scope-parent">
            {" "}
            <span class="settings-project-scope-separator" aria-hidden="true">· </span>
            {path()}
          </span>
        )}
      </Show>
    </span>
  )
}

export function SettingsProjectScope(props: ProjectScopeProps & {
  class?: string
  triggerRef?: (element: HTMLElement) => void
}) {
  return (
    <Disclosure.Root class={props.class ? `settings-project-scope ${props.class}` : "settings-project-scope"}>
      <Disclosure.Trigger ref={props.triggerRef}>
        <SettingsProjectScopeLabel directory={props.directory} customName={props.customName} />
      </Disclosure.Trigger>
      <Disclosure.Content>
        <code class="settings-project-scope-path">{props.directory}</code>
      </Disclosure.Content>
    </Disclosure.Root>
  )
}

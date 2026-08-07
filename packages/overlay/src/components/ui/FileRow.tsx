import { Show, type JSX } from "solid-js"
import { Icon, type IconName } from "./Icon"

export interface FileRowContentProps {
  name: JSX.Element
  icon: IconName
  detail?: JSX.Element
  prefix?: JSX.Element
  trailing?: JSX.Element
  expandable?: boolean
  expanded?: boolean
}

/**
 * Shared visual content for project files. Explorer owns tree interaction and
 * Review owns diff/listbox interaction; this primitive owns their one row
 * grammar so the same file cannot look like two unrelated controls.
 */
export function FileRowContent(props: FileRowContentProps): JSX.Element {
  return (
    <>
      <span class="oc-file-row__chevron" data-open={props.expanded ? "true" : "false"} aria-hidden="true">
        <Show when={props.expandable}>
          <Icon name="chevron" size="compact" />
        </Show>
      </span>
      <Icon name={props.icon} class="oc-file-row__icon" aria-hidden="true" />
      <span class="oc-file-row__copy">
        <Show when={props.prefix}>
          <span class="oc-file-row__prefix">{props.prefix}</span>
        </Show>
        <span class="oc-file-row__name">{props.name}</span>
        <Show when={props.detail}>
          <span class="oc-file-row__detail">{props.detail}</span>
        </Show>
      </span>
      <Show when={props.trailing}>
        <span class="oc-file-row__trailing">{props.trailing}</span>
      </Show>
    </>
  )
}

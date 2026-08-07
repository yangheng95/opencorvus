import { splitProps } from "solid-js"
import type { JSX } from "solid-js"
import { statusIconName } from "../../utils/status-mapping"
import { Icon } from "./Icon"
import type { IconSizeTier } from "./Icon.types"

export interface StatusIndicatorProps extends Omit<JSX.HTMLAttributes<HTMLSpanElement>, "children"> {
  status: string
  label: string
  size?: IconSizeTier
  appearance?: "icon" | "dot"
}

export function StatusIndicator(props: StatusIndicatorProps): JSX.Element {
  const [local, indicatorProps] = splitProps(props, ["status", "label", "size", "appearance", "class"])
  const className = () => (local.class ? `oc-status-indicator ${local.class}` : "oc-status-indicator")
  const hidden = () => indicatorProps["aria-hidden"] === true || indicatorProps["aria-hidden"] === "true"

  return (
    <span
      {...indicatorProps}
      class={className()}
      data-status={local.status}
      data-appearance={local.appearance ?? "icon"}
      role={hidden() ? undefined : (indicatorProps.role ?? "img")}
      aria-label={hidden() ? undefined : (indicatorProps["aria-label"] ?? local.label)}
      title={indicatorProps.title ?? local.label}
    >
      {local.appearance === "dot" ? (
        <span class="oc-status-indicator__dot" aria-hidden="true" />
      ) : (
        <Icon name={statusIconName(local.status)} size={local.size ?? "compact"} />
      )}
    </span>
  )
}

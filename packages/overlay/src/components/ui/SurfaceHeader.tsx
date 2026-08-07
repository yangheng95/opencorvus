import { splitProps } from "solid-js"
import type { JSX } from "solid-js"

export const SURFACE_HEADER_VARIANTS = ["panel", "settings-group"] as const

export type SurfaceHeaderVariant = (typeof SURFACE_HEADER_VARIANTS)[number]

export interface SurfaceHeaderProps extends Omit<JSX.HTMLAttributes<HTMLElement>, "class" | "classList" | "title"> {
  variant: SurfaceHeaderVariant
  title?: JSX.Element
  actions?: JSX.Element
}

export function SurfaceHeader(props: SurfaceHeaderProps): JSX.Element {
  const [local, headerProps] = splitProps(props, ["variant", "title", "actions"])

  return (
    <header
      {...headerProps}
      class="oc-surface-header"
      data-surface={local.variant}
      data-title={local.title == null ? "false" : "true"}
    >
      {local.title == null ? null : <span class="oc-surface-header__title">{local.title}</span>}
      {local.actions ? <span class="oc-surface-header__actions">{local.actions}</span> : null}
    </header>
  )
}

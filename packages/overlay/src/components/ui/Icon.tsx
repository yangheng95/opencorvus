// Icon primitive
//
// Single-source icon primitive for the overlay. Commodity glyphs render
// through the private Lucide registry; custom SVG remains isolated in the
// private third-party brand registry. Callers import only this component.

import { createUniqueId, Show, type JSX } from "solid-js"
import type { IconSizeTier } from "./Icon.types"
import { CUSTOM_ICON_PATHS, type CustomIconName, type IconRecord } from "./Icon.brands"
import { LUCIDE_ICON_MAP, type LucideIconName, type LucideIconRecord } from "./Icon.lucide"

export type IconName = LucideIconName | CustomIconName

function isLucideIconName(name: string): name is LucideIconName {
  return Object.prototype.hasOwnProperty.call(LUCIDE_ICON_MAP, name)
}

function isCustomIconName(name: string): name is CustomIconName {
  return Object.prototype.hasOwnProperty.call(CUSTOM_ICON_PATHS, name)
}

function lucideIconRecord(name: IconName): LucideIconRecord | undefined {
  return isLucideIconName(name) ? LUCIDE_ICON_MAP[name] : undefined
}

function customIconRecord(name: IconName): IconRecord | undefined {
  return isCustomIconName(name) ? CUSTOM_ICON_PATHS[name] : undefined
}

export interface IconProps {
  name: IconName
  /** Closed visual-density tier; arbitrary feature-authored pixel sizes are forbidden. */
  size?: IconSizeTier
  class?: string
  /** Hide from screen readers; most icons are decorative. */
  decorative?: boolean
  /** Title for tooltip + aria-label fallback. */
  title?: string
}

export function Icon(props: IconProps): JSX.Element {
  const iconIDPrefix = createUniqueId()
  const iconName = (): IconName => {
    const name = String(props.name)
    if (!isLucideIconName(name) && !isCustomIconName(name)) {
      throw new Error(`Unknown icon "${name}"`)
    }
    return name
  }
  const sizeTier = () => props.size ?? "standard"
  const className = (source?: string) => ["oc-icon", source, props.class].filter(Boolean).join(" ")
  const decorative = () => props.decorative !== false
  const resolvedLucideRecord = () => lucideIconRecord(iconName())
  const resolvedCustomRecord = () => customIconRecord(iconName())
  const customStrokeWidth = () => resolvedCustomRecord()?.strokeWidth ?? 1.4
  const lucideStrokeWidth = () => resolvedLucideRecord()?.strokeWidth ?? 1.75

  return (
    <Show
      when={resolvedLucideRecord()}
      keyed
      fallback={
        <svg
          class={className()}
          data-oc-icon="true"
          data-size={sizeTier()}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width={customStrokeWidth()}
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden={decorative() ? "true" : undefined}
          role={decorative() ? undefined : "img"}
        >
          <Show when={props.title}>
            <title>{props.title}</title>
          </Show>
          {resolvedCustomRecord()?.body(iconIDPrefix)}
        </svg>
      }
    >
      {(record) => {
        const Lucide = record.component
        return (
          <Lucide
            class={className(record.class)}
            data-oc-icon="true"
            data-size={sizeTier()}
            color="currentColor"
            strokeWidth={lucideStrokeWidth()}
            aria-hidden={decorative() ? "true" : undefined}
            role={decorative() ? undefined : "img"}
          >
            <Show when={props.title}>
              <title>{props.title}</title>
            </Show>
          </Lucide>
        )
      }}
    </Show>
  )
}

export const LUCIDE_ICON_NAMES = Object.keys(LUCIDE_ICON_MAP) as LucideIconName[]
export const CUSTOM_ICON_NAMES = Object.keys(CUSTOM_ICON_PATHS) as CustomIconName[]
export const REGISTERED_ICONS: readonly IconName[] = [...LUCIDE_ICON_NAMES, ...CUSTOM_ICON_NAMES]

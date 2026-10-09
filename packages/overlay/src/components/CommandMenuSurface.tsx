import { For, Show, createEffect, onCleanup } from "solid-js"
import { Icon } from "./ui/Icon"
import { NATIVE_MENU_SURFACE_LABEL, type NativeMenuSurfaceModel, type NativeMenuSurfaceMeasured } from "../services/native-menu-surface-contract"

interface CommandMenuSurfaceProps {
  model?: NativeMenuSurfaceModel
  onAction: (itemID: string) => void | Promise<void>
  onDismiss: () => void | Promise<void>
  onMeasure?: (measurement: NativeMenuSurfaceMeasured) => void
}

/** One menu renderer and keyboard interaction shared by both physical hosts. */
export function CommandMenuSurface(props: CommandMenuSurfaceProps) {
  let surfaceElement!: HTMLDivElement

  function reportIntentFailure(action: Promise<void>): void {
    void action.catch((error) => console.error("[command-menu-surface] menu intent failed", error))
  }

  async function dismiss(): Promise<void> { await props.onDismiss() }
  async function choose(itemID: string): Promise<void> { await props.onAction(itemID) }

  function moveFocus(delta: number, scope: ParentNode = surfaceElement): void {
    const buttons = Array.from(scope.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"))
    if (buttons.length === 0) return
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const next = current < 0 ? (delta > 0 ? 0 : buttons.length - 1) : (current + delta + buttons.length) % buttons.length
    buttons[next].focus()
  }

  createEffect(() => {
    const current = props.model
    if (!current) return
    const frame = requestAnimationFrame(() => {
      const bounds = surfaceElement.getBoundingClientRect()
      props.onMeasure?.({ requestID: current.requestID, width: Math.ceil(bounds.width), height: Math.ceil(bounds.height) })
      ;(surfaceElement.querySelector<HTMLButtonElement>("button:not(:disabled)") ?? surfaceElement).focus()
    })
    onCleanup(() => cancelAnimationFrame(frame))
  })

  return (
    <div
      ref={surfaceElement}
      tabIndex={-1}
      class="native-menu-shell"
      data-ui={NATIVE_MENU_SURFACE_LABEL}
      data-variant={props.model?.variant ?? "standard"}
      style={{
        "--native-menu-maximum-height": props.model?.maxHeight ? `${props.model!.maxHeight}px` : undefined,
      }}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) reportIntentFailure(dismiss())
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault()
          reportIntentFailure(dismiss())
        }
        if (event.key === "ArrowDown") {
          event.preventDefault()
          moveFocus(1)
        }
        if (event.key === "ArrowUp") {
          event.preventDefault()
          moveFocus(-1)
        }
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          const toolbar = (event.target as Element | null)?.closest<HTMLElement>(
            '.native-menu-group[data-layout="toolbar"]',
          )
          if (!toolbar) return
          event.preventDefault()
          moveFocus(event.key === "ArrowRight" ? 1 : -1, toolbar)
        }
      }}
    >
      <Show when={props.model} keyed>
        {(current) => (
          <div class="native-menu-card" role="menu">
            <For each={current.groups}>
              {(group) => (
                <section class="native-menu-group" data-layout={group.layout ?? "menu"}>
                  <Show when={group.heading}>
                    <span class="native-menu-group__heading">{group.heading}</span>
                  </Show>
                  <div class="native-menu-group__items">
                    <For each={group.items}>
                      {(item) => (
                        <button
                          type="button"
                          class="native-menu-item"
                          data-icon-only={String(item.iconOnly === true)}
                          data-has-description={String(Boolean(item.description))}
                          data-checked={String(item.checked === true)}
                          role={item.checked === undefined ? "menuitem" : "menuitemcheckbox"}
                          aria-label={item.ariaLabel ?? item.label}
                          aria-checked={item.checked === undefined ? undefined : item.checked}
                          disabled={item.enabled === false}
                          title={item.ariaLabel}
                          onClick={() => reportIntentFailure(choose(item.id))}
                        >
                          <Show when={item.icon}>{(icon) => <Icon name={icon()} size="standard" />}</Show>
                          <Show when={!item.iconOnly}>
                            <span class="native-menu-item__copy">
                              <span class="native-menu-item__label">{item.label}</span>
                              <Show when={item.description}>
                                {(description) => <span class="native-menu-item__description">{description()}</span>}
                              </Show>
                            </span>
                          </Show>
                          <Show when={item.checked}>
                            <Icon name="check" size="compact" class="native-menu-item__check" />
                          </Show>
                        </button>
                      )}
                    </For>
                  </div>
                </section>
              )}
            </For>
          </div>
        )}
      </Show>
    </div>
  )
}

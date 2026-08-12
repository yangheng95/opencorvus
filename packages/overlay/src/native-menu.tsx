import "@fontsource-variable/geist/index.css"
import "@fontsource-variable/noto-sans-sc/index.css"
import { emitTo, listen } from "@tauri-apps/api/event"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { For, Show, createSignal, onCleanup, onMount } from "solid-js"
import { render } from "solid-js/web"
import { Icon } from "./components/ui/Icon"
import {
  NATIVE_MENU_SURFACE_ACTION_EVENT,
  NATIVE_MENU_SURFACE_DISMISS_EVENT,
  NATIVE_MENU_SURFACE_FAILED_EVENT,
  NATIVE_MENU_SURFACE_LABEL,
  NATIVE_MENU_SURFACE_MEASURED_EVENT,
  NATIVE_MENU_SURFACE_MODEL_EVENT,
  NATIVE_MENU_SURFACE_READY_EVENT,
  type NativeMenuSurfaceModel,
} from "./services/native-menu-surface-contract"

const surfaceGeneration = Number(new URLSearchParams(location.search).get("generation"))
if (!Number.isInteger(surfaceGeneration) || surfaceGeneration < 1) {
  throw new Error("Native menu surface requires a valid window generation")
}

function NativeMenuSurface() {
  let surfaceElement!: HTMLDivElement
  const [model, setModel] = createSignal<NativeMenuSurfaceModel>()

  async function dismiss(): Promise<void> {
    const requestID = model()?.requestID
    if (requestID === undefined) return
    await emitTo("main", NATIVE_MENU_SURFACE_DISMISS_EVENT, { requestID })
  }

  function reportIntentFailure(action: Promise<void>): void {
    void action.catch((error) => {
      console.error("[native-menu-surface] failed to send menu intent", error)
    })
  }

  async function choose(itemID: string): Promise<void> {
    const requestID = model()?.requestID
    if (requestID === undefined) return
    await emitTo("main", NATIVE_MENU_SURFACE_ACTION_EVENT, { requestID, itemID })
  }

  function moveFocus(delta: number, scope: ParentNode = surfaceElement): void {
    const buttons = Array.from(scope.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"))
    if (buttons.length === 0) return
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const next =
      current < 0 ? (delta > 0 ? 0 : buttons.length - 1) : (current + delta + buttons.length) % buttons.length
    buttons[next].focus()
  }

  onMount(() => {
    const unlisteners: Array<() => void> = []
    onCleanup(() => {
      for (const unlisten of unlisteners) unlisten()
    })
    void (async () => {
      unlisteners.push(await listen<NativeMenuSurfaceModel>(NATIVE_MENU_SURFACE_MODEL_EVENT, ({ payload }) => {
        document.documentElement.dataset.theme = payload.theme
        document.documentElement.lang = payload.language
        document.documentElement.style.setProperty("--ui-scale", String(payload.scale))
        setModel(payload)
        requestAnimationFrame(() => {
          const bounds = surfaceElement.getBoundingClientRect()
          void emitTo("main", NATIVE_MENU_SURFACE_MEASURED_EVENT, {
            requestID: payload.requestID,
            width: Math.ceil(bounds.width),
            height: Math.ceil(bounds.height),
          }).catch((error) => {
            console.error("[native-menu-surface] failed to report measurement", error)
          })
          surfaceElement.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus()
        })
      }))
      unlisteners.push(await getCurrentWindow().onFocusChanged(({ payload: focused }) => {
        if (!focused && model()) reportIntentFailure(dismiss())
      }))
      await emitTo("main", NATIVE_MENU_SURFACE_READY_EVENT, { generation: surfaceGeneration })
    })().catch((error) => {
      const message = error instanceof Error ? error.message : String(error)
      console.error("[native-menu-surface] initialization failed", error)
      void emitTo("main", NATIVE_MENU_SURFACE_FAILED_EVENT, { generation: surfaceGeneration, message }).catch((emitError) => {
        console.error("[native-menu-surface] failed to report initialization error", emitError)
      })
    })
  })

  return (
    <div
      ref={surfaceElement}
      class="native-menu-shell"
      data-ui={NATIVE_MENU_SURFACE_LABEL}
      data-variant={model()?.variant ?? "standard"}
      style={{
        "--native-menu-maximum-height": model()?.maxHeight ? `${model()!.maxHeight}px` : undefined,
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
      <Show when={model()} keyed>
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

const host = document.getElementById("nativeMenuHost")
if (!host) throw new Error("Native menu surface host is missing from native-menu.html")
render(() => <NativeMenuSurface />, host)

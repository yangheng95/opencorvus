import "@fontsource-variable/geist/index.css"
import "@fontsource-variable/noto-sans-sc/index.css"
import { emitTo, listen } from "@tauri-apps/api/event"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { createSignal, onCleanup, onMount } from "solid-js"
import { render } from "solid-js/web"
import { CommandMenuSurface } from "./components/CommandMenuSurface"
import {
  NATIVE_MENU_SURFACE_ACTION_EVENT, NATIVE_MENU_SURFACE_DISMISS_EVENT,
  NATIVE_MENU_SURFACE_FAILED_EVENT, NATIVE_MENU_SURFACE_LABEL,
  NATIVE_MENU_SURFACE_MEASURED_EVENT, NATIVE_MENU_SURFACE_MODEL_EVENT,
  NATIVE_MENU_SURFACE_READY_EVENT, type NativeMenuSurfaceModel,
} from "./services/native-menu-surface-contract"

const surfaceGeneration = Number(new URLSearchParams(location.search).get("generation"))
if (!Number.isInteger(surfaceGeneration) || surfaceGeneration < 1) {
  throw new Error("Native menu surface requires a valid window generation")
}

function NativeMenuSurfaceHost() {
  const [model, setModel] = createSignal<NativeMenuSurfaceModel>()

  async function dismiss(): Promise<void> {
    const requestID = model()?.requestID
    if (requestID !== undefined) await emitTo("main", NATIVE_MENU_SURFACE_DISMISS_EVENT, { requestID })
  }

  async function choose(itemID: string): Promise<void> {
    const requestID = model()?.requestID
    if (requestID !== undefined) await emitTo("main", NATIVE_MENU_SURFACE_ACTION_EVENT, { requestID, itemID })
  }

  onMount(() => {
    const unlisteners: Array<() => void> = []
    onCleanup(() => { for (const unlisten of unlisteners) unlisten() })
    void (async () => {
      unlisteners.push(await listen<NativeMenuSurfaceModel>(NATIVE_MENU_SURFACE_MODEL_EVENT, ({ payload }) => {
        document.documentElement.dataset.theme = payload.theme
        document.documentElement.lang = payload.language
        document.documentElement.style.setProperty("--ui-scale", String(payload.scale))
        setModel(payload)
      }))
      unlisteners.push(await getCurrentWindow().onFocusChanged(({ payload: focused }) => {
        if (!focused && model()) void dismiss().catch((error) => console.error("[native-menu-surface] failed to dismiss", error))
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

  return <CommandMenuSurface model={model()} onAction={choose} onDismiss={dismiss} onMeasure={(measurement) => {
    void emitTo("main", NATIVE_MENU_SURFACE_MEASURED_EVENT, measurement).catch((error) => {
      console.error("[native-menu-surface] failed to report measurement", error)
    })
  }} />
}

const host = document.getElementById("nativeMenuHost")
if (!host) throw new Error("Native menu surface host is missing from native-menu.html")
render(() => <NativeMenuSurfaceHost />, host)

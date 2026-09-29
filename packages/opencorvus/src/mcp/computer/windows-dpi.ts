import { ComputerError } from "./errors"
import { requireRuntimePackage } from "@/runtime/package-require"

// DPI means dots per inch. The headless host owns this process; initialize its
// default before CUA creates native worker threads or any desktop windows.
const PER_MONITOR_V2 = -4
const CURRENT_PROCESS = -1

export type WindowsDpiApi = {
  context(): number | bigint
  equal(left: number | bigint, right: number | bigint): number
  set(context: number): number
  lastError(): number
}

export function establishComputerHostDpi(api: WindowsDpiApi) {
  if (api.equal(api.context(), PER_MONITOR_V2)) return
  const accepted = api.set(PER_MONITOR_V2)
  const error = accepted ? 0 : api.lastError()
  if (!accepted || !api.equal(api.context(), PER_MONITOR_V2)) {
    throw new ComputerError(
      "COMPUTER_BACKEND_ERROR",
      "Computer host requires Per-Monitor V2 DPI awareness before native driver initialization",
      {
        operation: "initialize_dpi",
        win32Error: error,
      },
    )
  }
}

export async function prepareComputerHostDpi() {
  if (process.platform !== "win32") return "not-required" as const
  const bindings = await (windowsBindings ??= loadWindowsBindings())
  establishComputerHostDpi(bindings.api)
  return "per-monitor-v2" as const
}

// Retain native function/library handles for the host lifetime. They are used by
// every driver initialization and must not be finalized during native SDK work.
let windowsBindings: ReturnType<typeof loadWindowsBindings> | undefined

async function loadWindowsBindings() {
  const koffi = requireRuntimePackage<typeof import("koffi")>("koffi")
  const user = koffi.load("user32.dll")
  const kernel = koffi.load("kernel32.dll")
  const context = user.func("intptr_t __stdcall GetDpiAwarenessContextForProcess(intptr_t process)")
  const equal = user.func("int __stdcall AreDpiAwarenessContextsEqual(intptr_t first, intptr_t second)")
  const set = user.func("int __stdcall SetProcessDpiAwarenessContext(intptr_t context)")
  const lastError = kernel.func("uint32_t __stdcall GetLastError()")
  return {
    user,
    kernel,
    api: { context: () => context(CURRENT_PROCESS), equal, set, lastError } satisfies WindowsDpiApi,
  }
}
